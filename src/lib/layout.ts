import type { Node } from '@xyflow/react'
import type { Layout } from '../model/types'

export interface WindowNodeData {
  windowId: string
  [key: string]: unknown
}

export type WindowNode = Node<WindowNodeData, 'window'>

/** Convert a layout's windows into React Flow nodes. Pure; no React here. */
export function layoutToNodes(layout: Layout): WindowNode[] {
  return layout.windows.map((w) => ({
    id: w.id,
    type: 'window',
    position: { x: w.x, y: w.y },
    zIndex: w.z,
    style: { width: w.width, height: w.height },
    data: { windowId: w.id },
  }))
}
