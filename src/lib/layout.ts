import type { Node, NodeChange } from '@xyflow/react'
import type { Layout, State } from '../model/types'
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
