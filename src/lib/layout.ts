import type { Edge, Node, NodeChange } from '@xyflow/react'
import type { Highlight, LinkEnd, Portal, State, Window } from '../model/types'
import { PORTAL_SIZE } from '../model/constants'
import { bringToFront, linksIn, moveElement, portalsIn, resizeWindow, windowsIn } from '../model/actions'
import type { RecordOptions } from '../store/history'
import type { LinkPart } from './geometry'

export interface WindowNodeData {
  windowId: string
  [key: string]: unknown
}

export type WindowNode = Node<WindowNodeData, 'window'>

export interface PortalNodeData {
  portalId: string
  [key: string]: unknown
}

export type PortalNode = Node<PortalNodeData, 'portal'>

export type CanvasNode = WindowNode | PortalNode

export { PORTAL_SIZE }

/** CSS class on the part of a window that drags it (the header). */
export const DRAG_HANDLE_CLASS = 'window-drag-handle'

/** Convert a workspace's windows and portals into React Flow nodes. Pure; no React here. */
export function layoutToNodes(state: State, workspaceId: string): CanvasNode[] {
  const windows: WindowNode[] = windowsIn(state, workspaceId).map((w) => ({
    id: w.id,
    type: 'window',
    position: { x: w.x, y: w.y },
    zIndex: nodeZIndex(w.z),
    width: w.width,
    height: w.height,
    dragHandle: `.${DRAG_HANDLE_CLASS}`,
    data: { windowId: w.id },
  }))
  const portals: PortalNode[] = portalsIn(state, workspaceId).map((p: Portal) => ({
    id: p.id,
    type: 'portal',
    position: { x: p.x, y: p.y },
    zIndex: nodeZIndex(p.z),
    ...PORTAL_SIZE,
    data: { portalId: p.id },
  }))
  return [...windows, ...portals]
}

/**
 * Apply React Flow node changes (drag, resize, select) to the State so the
 * layout is the single source of truth and every change persists.
 * Measurement-only dimension changes and removals are ignored.
 */
export function applyNodeChangesToState(state: State, changes: NodeChange<CanvasNode>[]): State {
  let next = state
  for (const c of changes) {
    if (c.type === 'position' && c.position) {
      next = moveElement(next, c.id, c.position)
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

/** Is this handle an element-level anchor (block header or portal) rather than a highlight? */
export function isElementHandle(handleId: string | null | undefined): boolean {
  return typeof handleId === 'string' && (handleId.startsWith('block:') || handleId.startsWith('portal:'))
}

/** Does the window show any part of the highlight? */
function windowShows(w: Window, h: Highlight): boolean {
  return w.blockId === h.blockId && (!w.range || (h.start < w.range.end && h.end > w.range.start))
}

/** Handle id used for a block end, rendered in the window header. */
export function blockHandleId(blockId: string): string {
  return `block:${blockId}`
}

/** Handle id used for a portal end, rendered inside the portal node. */
export function portalHandleId(portalId: string): string {
  return `portal:${portalId}`
}

interface Anchor {
  nodeId: string
  z: number
}

/** Canvas nodes where a link end is visible, and the handle id to attach to in each. */
function resolveEnd(state: State, windows: Window[], portals: Portal[], end: LinkEnd): { nodes: Anchor[]; handle: string } | null {
  if (end.kind === 'portal') {
    const p = portals.find((x) => x.id === end.id)
    return p ? { nodes: [{ nodeId: p.id, z: p.z }], handle: portalHandleId(p.id) } : null
  }
  if (end.kind === 'highlight') {
    const h = state.highlights.find((x) => x.id === end.id)
    if (!h) return null
    return { nodes: windows.filter((w) => windowShows(w, h)).map((w) => ({ nodeId: w.id, z: w.z })), handle: h.id }
  }
  if (!state.blocks.some((b) => b.id === end.id)) return null
  return { nodes: windows.filter((w) => w.blockId === end.id).map((w) => ({ nodeId: w.id, z: w.z })), handle: blockHandleId(end.id) }
}

/**
 * Three edges (pieces) per link for every pair of windows showing its two ends.
 * Highlight ends attach to the per-highlight handles inside a window; document
 * ends attach to the handle in the window header. Ends not visible in any window
 * draw nothing.
 */
export function linksToEdges(state: State, workspaceId: string, opts: { elevateLinkId?: string | null } = {}): LinkEdge[] {
  const edges: LinkEdge[] = []
  const windows = windowsIn(state, workspaceId)
  const portals = portalsIn(state, workspaceId)
  for (const link of linksIn(state, workspaceId)) {
    const from = resolveEnd(state, windows, portals, link.from)
    const to = resolveEnd(state, windows, portals, link.to)
    if (!from || !to) continue
    for (const a of from.nodes) {
      for (const b of to.nodes) {
        const elevated = link.id === opts.elevateLinkId
        const parts: [LinkPart, number][] = [
          ['a', nodeZIndex(a.z) + 1],
          ['mid', edgeZIndex(a.z, b.z)],
          ['b', nodeZIndex(b.z) + 1],
        ]
        for (const [part, z] of parts) {
          edges.push({
            id: `${link.id}:${a.nodeId}:${b.nodeId}:${part}`,
            type: 'link',
            zIndex: elevated ? ELEVATED_EDGE_Z_INDEX : z,
            source: a.nodeId,
            sourceHandle: from.handle,
            target: b.nodeId,
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
export function historyOptionsForChanges(changes: NodeChange<CanvasNode>[]): RecordOptions {
  for (const c of changes) {
    if (c.type === 'position') return { key: `move:${c.id}`, within: Infinity }
    if (c.type === 'dimensions' && c.resizing) return { key: `resize:${c.id}`, within: Infinity }
  }
  if (changes.length > 0 && changes.every((c) => c.type === 'select')) return { skip: true }
  return {}
}
