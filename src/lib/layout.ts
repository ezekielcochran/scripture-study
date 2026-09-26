import type { Edge, Node, NodeChange } from '@xyflow/react'
import type { Highlight, Layout, State, Window } from '../model/types'
import { bringToFront, moveWindow, resizeWindow } from '../model/actions'

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

/**
 * One edge per link for every pair of windows showing its two highlights.
 * Edges attach to the per-highlight handles rendered inside each window node.
 * Links whose highlights are not visible in any window produce no edges.
 */
export function linksToEdges(state: State, layout: Layout): LinkEdge[] {
  const byId = new Map(state.highlights.map((h) => [h.id, h]))
  const edges: LinkEdge[] = []
  for (const link of state.links) {
    const from = byId.get(link.fromHighlightId)
    const to = byId.get(link.toHighlightId)
    if (!from || !to) continue
    for (const a of layout.windows.filter((w) => windowShows(w, from))) {
      for (const b of layout.windows.filter((w) => windowShows(w, to))) {
        edges.push({
          id: `${link.id}:${a.id}:${b.id}`,
          type: 'link',
          zIndex: EDGE_Z_INDEX,
          source: a.id,
          sourceHandle: from.id,
          target: b.id,
          targetHandle: to.id,
          data: { linkId: link.id, ...(link.label ? { label: link.label } : {}) },
        })
      }
    }
  }
  return edges
}
