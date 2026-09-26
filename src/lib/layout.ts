import type { Edge, Node, NodeChange } from '@xyflow/react'
import type { Highlight, Layout, LinkEnd, State, Window } from '../model/types'
import { bringToFront, moveWindow, resizeWindow } from '../model/actions'
import type { RecordOptions } from '../store/history'
import type { LinkPart } from './geometry'

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
    zIndex: nodeZIndex(w.z),
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
  /** Which piece of the link this edge draws; see linkPieces in geometry.ts. */
  part: LinkPart
  label?: string
  [key: string]: unknown
}

export type LinkEdge = Edge<LinkEdgeData, 'link'>

/**
 * Z ordering: windows take even z-indexes (2 * z). A link is drawn as three
 * edges: the lead inside each window sits one above that window, and the span
 * between the windows sits one above the lower of the two, so a window above
 * both linked windows covers the span and a window below either does not.
 * A link whose label is being edited is elevated above everything.
 */
export const ELEVATED_EDGE_Z_INDEX = 100000

export function nodeZIndex(z: number): number {
  return z * 2
}

export function edgeZIndex(zA: number, zB: number): number {
  return Math.min(zA, zB) * 2 + 1
}

/** Is this handle id the document-level anchor in a window header? */
export function isDocumentHandle(handleId: string | null | undefined): boolean {
  return typeof handleId === 'string' && handleId.startsWith('doc:')
}

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
 * Three edges (pieces) per link for every pair of windows showing its two ends.
 * Highlight ends attach to the per-highlight handles inside a window; document
 * ends attach to the handle in the window header. Ends not visible in any window
 * draw nothing.
 */
export function linksToEdges(state: State, layout: Layout, opts: { elevateLinkId?: string | null } = {}): LinkEdge[] {
  const edges: LinkEdge[] = []
  for (const link of state.links) {
    const from = resolveEnd(state, layout, link.from)
    const to = resolveEnd(state, layout, link.to)
    if (!from || !to) continue
    for (const a of from.windows) {
      for (const b of to.windows) {
        const elevated = link.id === opts.elevateLinkId
        const parts: [LinkPart, number][] = [
          ['a', nodeZIndex(a.z) + 1],
          ['mid', edgeZIndex(a.z, b.z)],
          ['b', nodeZIndex(b.z) + 1],
        ]
        for (const [part, z] of parts) {
          edges.push({
            id: `${link.id}:${a.id}:${b.id}:${part}`,
            type: 'link',
            zIndex: elevated ? ELEVATED_EDGE_Z_INDEX : z,
            source: a.id,
            sourceHandle: from.handle,
            target: b.id,
            targetHandle: to.handle,
            data: { linkId: link.id, part, ...(link.label ? { label: link.label } : {}) },
          })
        }
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
