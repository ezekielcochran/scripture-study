import type { Edge, Node, NodeChange } from '@xyflow/react'
import type { Highlight, Layout, LinkEnd, State, Window } from '../model/types'
import { bringToFront, moveWindow, resizeWindow } from '../model/actions'
import type { RecordOptions } from '../store/history'

export interface WindowNodeData {
  windowId: string
  [key: string]: unknown
}

export type WindowNode = Node<WindowNodeData, 'window'>

/** CSS class on the part of a window that drags it (the header). */
export const DRAG_HANDLE_CLASS = 'window-drag-handle'

/** Convert a layout's windows into React Flow nodes. Pure; no React here. */
export function layoutToNodes(layout: Layout): WindowNode[] {
  return layout.windows.map((w) => ({
    id: w.id,
    type: 'window',
    position: { x: w.x, y: w.y },
    zIndex: w.z,
    width: w.width,
    height: w.height,
    dragHandle: `.${DRAG_HANDLE_CLASS}`,
    data: { windowId: w.id },
  }))
}

/**
 * Apply React Flow node changes (drag, resize, select) to the State so the
 * layout is the single source of truth and every change persists.
 * Measurement-only dimension changes and removals are ignored.
 */
export function applyNodeChangesToState(state: State, changes: NodeChange<WindowNode>[]): State {
  let next = state
  for (const c of changes) {
    if (c.type === 'position' && c.position) {
      next = moveWindow(next, c.id, c.position)
    } else if (c.type === 'dimensions' && c.resizing && c.dimensions) {
      next = resizeWindow(next, c.id, c.dimensions)
    } else if (c.type === 'select' && c.selected) {
      next = bringToFront(next, c.id)
    }
  }
  return next
}

export interface LinkEdgeData {
  linkId: string
  label?: string
  [key: string]: unknown
}

export type LinkEdge = Edge<LinkEdgeData, 'link'>

/**
 * Edges and their labels render above every window (window z values are kept
 * small by bringToFront). The edge label layer gets the same value in index.css.
 */
export const EDGE_Z_INDEX = 10000

/** Does the window show any part of the highlight? */
function windowShows(w: Window, h: Highlight): boolean {
  return w.documentId === h.documentId && (!w.range || (h.start < w.range.end && h.end > w.range.start))
}

/** Handle id used for a document end, rendered in the window header. */
export function documentHandleId(documentId: string): string {
  return `doc:${documentId}`
}

/** Windows where a link end is visible, and the handle id to attach to in each. */
function resolveEnd(state: State, layout: Layout, end: LinkEnd): { windows: Window[]; handle: string } | null {
  if (end.kind === 'highlight') {
    const h = state.highlights.find((x) => x.id === end.id)
    if (!h) return null
    return { windows: layout.windows.filter((w) => windowShows(w, h)), handle: h.id }
  }
  if (!state.documents.some((d) => d.id === end.id)) return null
  return { windows: layout.windows.filter((w) => w.documentId === end.id), handle: documentHandleId(end.id) }
}

/**
 * One edge per link for every pair of windows showing its two ends. Highlight
 * ends attach to the per-highlight handles inside a window; document ends attach
 * to the handle in the window header. Ends not visible in any window draw nothing.
 */
export function linksToEdges(state: State, layout: Layout): LinkEdge[] {
  const edges: LinkEdge[] = []
  for (const link of state.links) {
    const from = resolveEnd(state, layout, link.from)
    const to = resolveEnd(state, layout, link.to)
    if (!from || !to) continue
    for (const a of from.windows) {
      for (const b of to.windows) {
        edges.push({
          id: `${link.id}:${a.id}:${b.id}`,
          type: 'link',
          zIndex: EDGE_Z_INDEX,
          source: a.id,
          sourceHandle: from.handle,
          target: b.id,
          targetHandle: to.handle,
          data: { linkId: link.id, ...(link.label ? { label: link.label } : {}) },
        })
      }
    }
  }
  return edges
}

/**
 * How a batch of React Flow node changes should enter undo history:
 * pure selection (bring-to-front) is skipped; a drag or resize coalesces into
 * one step per window for as long as it continues.
 */
export function historyOptionsForChanges(changes: NodeChange<WindowNode>[]): RecordOptions {
  for (const c of changes) {
    if (c.type === 'position') return { key: `move:${c.id}`, within: Infinity }
    if (c.type === 'dimensions' && c.resizing) return { key: `resize:${c.id}`, within: Infinity }
  }
  if (changes.length > 0 && changes.every((c) => c.type === 'select')) return { skip: true }
  return {}
}
