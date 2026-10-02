import type { Block, Highlight, Link, LinkEnd, Portal, Preset, PresetStyle, State, Window, Workspace } from './types'
import { newId } from './id'
import { adjustRange, applyEditToText, type Edit } from '../lib/ranges'

// Every action is a pure function State -> State. Components call them through
// the store's `update`, never mutating state themselves.

// ---- Highlights ----------------------------------------------------------

export interface NewHighlight {
  blockId: string
  start: number
  end: number
  presetId: string
  id?: string
}

/** Add a highlight over [start, end) of a block. Empty or invalid ranges are ignored. */
export function addHighlight(state: State, h: NewHighlight): State {
  const block = state.blocks.find((b) => b.id === h.blockId)
  if (!block) return state
  const start = Math.max(0, h.start)
  const end = Math.min(block.text.length, h.end)
  if (start >= end) return state
  if (!state.presets.some((p) => p.id === h.presetId)) return state
  if (h.id !== undefined && state.highlights.some((x) => x.id === h.id)) return state

  const highlight: Highlight = {
    id: h.id ?? newId('hl'),
    blockId: h.blockId,
    start,
    end,
    presetId: h.presetId,
  }
  return { ...state, highlights: [...state.highlights, highlight] }
}

export function sameEnd(a: LinkEnd, b: LinkEnd): boolean {
  return a.kind === b.kind && a.id === b.id
}

/** Links that touch none of the given highlights or blocks. */
export function pruneLinks(links: Link[], removed: { highlights?: Set<string>; blocks?: Set<string> }): Link[] {
  const gone = (e: LinkEnd) =>
    e.kind === 'highlight' ? removed.highlights?.has(e.id) === true : removed.blocks?.has(e.id) === true
  return links.filter((l) => !gone(l.from) && !gone(l.to))
}

/** Remove a highlight together with any links that reference it. */
export function removeHighlight(state: State, id: string): State {
  if (!state.highlights.some((h) => h.id === id)) return state
  return {
    ...state,
    highlights: state.highlights.filter((h) => h.id !== id),
    links: pruneLinks(state.links, { highlights: new Set([id]) }),
  }
}

/**
 * Keyboard toggle. If the range lies within an existing highlight of the same
 * preset: an exact match removes it; a partial range un-highlights just that
 * range, splitting the highlight (the original id stays on the first remaining
 * piece so links survive). Otherwise a new highlight is added.
 */
export function toggleHighlight(state: State, h: NewHighlight): State {
  const block = state.blocks.find((b) => b.id === h.blockId)
  if (!block) return state
  const start = Math.max(0, h.start)
  const end = Math.min(block.text.length, h.end)
  if (start >= end) return state
  const existing = state.highlights.find(
    (x) => x.blockId === h.blockId && x.presetId === h.presetId && x.start <= start && x.end >= end,
  )
  if (!existing) return addHighlight(state, h)
  if (existing.start === start && existing.end === end) return removeHighlight(state, existing.id)
  const pieces: Highlight[] = []
  if (existing.start < start) pieces.push({ ...existing, end: start })
  if (end < existing.end) pieces.push({ ...existing, start: end, id: pieces.length ? newId('hl') : existing.id })
  return { ...state, highlights: state.highlights.flatMap((x) => (x.id === existing.id ? pieces : [x])) }
}

/** Find the preset bound to a keyboard shortcut, if any. */
export function presetForShortcut(presets: Preset[], key: string): Preset | undefined {
  return presets.find((p) => p.shortcut !== undefined && p.shortcut === key)
}

// ---- Text editing --------------------------------------------------------

/**
 * Apply a text edit to a block. In the same transaction, every highlight and
 * window sub-range over the block is adjusted; highlights whose text is
 * entirely deleted are removed together with their links, and a window whose
 * sub-range is entirely deleted falls back to showing the whole block.
 * Out-of-bounds edits are ignored.
 */
export function editBlock(state: State, blockId: string, edit: Edit): State {
  const block = state.blocks.find((b) => b.id === blockId)
  if (!block) return state
  let text: string
  try {
    text = applyEditToText(block.text, edit)
  } catch {
    return state
  }

  const removed = new Set<string>()
  const highlights: Highlight[] = []
  for (const h of state.highlights) {
    if (h.blockId !== blockId) {
      highlights.push(h)
      continue
    }
    const next = adjustRange(h, edit)
    if (next) highlights.push({ ...h, ...next })
    else removed.add(h.id)
  }

  const windows = state.windows.map((w) => {
    if (w.blockId !== blockId || !w.range) return w
    const next = adjustRange(w.range, edit, { inclusive: true })
    if (next) return { ...w, range: next }
    const { range: _dropped, ...rest } = w
    return rest
  })

  return {
    ...state,
    blocks: state.blocks.map((b) => (b.id === blockId ? { ...b, text } : b)),
    highlights,
    links: pruneLinks(state.links, { highlights: removed }),
    windows,
  }
}

// ---- Workspaces ----------------------------------------------------------

export function currentWorkspace(state: State): Workspace {
  return state.workspaces.find((w) => w.id === state.currentWorkspaceId) ?? state.workspaces[0]
}

/** Blocks belonging to a workspace. */
export function blocksIn(state: State, workspaceId: string): Block[] {
  return state.blocks.filter((b) => b.workspaceId === workspaceId)
}

/** Windows on a workspace's canvas (a window lives where its block does). */
export function windowsIn(state: State, workspaceId: string): Window[] {
  const ids = new Set(blocksIn(state, workspaceId).map((b) => b.id))
  return state.windows.filter((w) => ids.has(w.blockId))
}

export function portalsIn(state: State, workspaceId: string): Portal[] {
  return state.portals.filter((p) => p.workspaceId === workspaceId)
}

/** A workspace's presets, in priority order. */
export function presetsIn(state: State, workspaceId: string): Preset[] {
  return state.presets.filter((p) => p.workspaceId === workspaceId)
}

/** Workspace of a link end, via its block. */
export function workspaceOfEnd(state: State, end: LinkEnd): string | undefined {
  const blockId = end.kind === 'block' ? end.id : state.highlights.find((h) => h.id === end.id)?.blockId
  return state.blocks.find((b) => b.id === blockId)?.workspaceId
}

/** Links whose ends are in a workspace. */
export function linksIn(state: State, workspaceId: string): Link[] {
  return state.links.filter((l) => workspaceOfEnd(state, l.from) === workspaceId || workspaceOfEnd(state, l.to) === workspaceId)
}

/**
 * Add a workspace. When `copyPresetsFrom` names an existing workspace, the new
 * one starts with copies of its presets (fresh ids, same order).
 */
export function addWorkspace(state: State, name: string, id = newId('ws'), copyPresetsFrom?: string): State {
  const trimmed = name.trim() || 'untitled'
  const copies: Preset[] = copyPresetsFrom
    ? presetsIn(state, copyPresetsFrom).map((p) => ({ ...p, id: newId('preset'), workspaceId: id, style: { ...p.style } }))
    : []
  return { ...state, workspaces: [...state.workspaces, { id, name: trimmed }], presets: [...state.presets, ...copies] }
}

export function renameWorkspace(state: State, id: string, name: string): State {
  if (!state.workspaces.some((w) => w.id === id)) return state
  const trimmed = name.trim()
  return { ...state, workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, name: trimmed || w.name } : w)) }
}

export function switchWorkspace(state: State, id: string): State {
  if (id === state.currentWorkspaceId || !state.workspaces.some((w) => w.id === id)) return state
  return { ...state, currentWorkspaceId: id }
}

/**
 * Delete a workspace with everything on it: its blocks, their highlights and
 * links, their windows, and every portal on it or leading to it (both sides).
 * The last remaining workspace cannot be deleted.
 */
export function deleteWorkspace(state: State, id: string): State {
  if (!state.workspaces.some((w) => w.id === id) || state.workspaces.length <= 1) return state
  const blockIds = new Set(blocksIn(state, id).map((b) => b.id))
  const highlightIds = new Set(state.highlights.filter((h) => blockIds.has(h.blockId)).map((h) => h.id))
  const pairs = new Set(
    state.portals.filter((p) => p.workspaceId === id || p.targetWorkspaceId === id).map((p) => p.pairId),
  )
  const workspaces = state.workspaces.filter((w) => w.id !== id)
  return {
    ...state,
    workspaces,
    presets: state.presets.filter((p) => p.workspaceId !== id),
    blocks: state.blocks.filter((b) => !blockIds.has(b.id)),
    highlights: state.highlights.filter((h) => !highlightIds.has(h.id)),
    links: pruneLinks(state.links, { highlights: highlightIds, blocks: blockIds }),
    windows: state.windows.filter((w) => !blockIds.has(w.blockId)),
    portals: state.portals.filter((p) => !pairs.has(p.pairId)),
    currentWorkspaceId: state.currentWorkspaceId === id ? workspaces[0].id : state.currentWorkspaceId,
  }
}

// ---- Portals -------------------------------------------------------------

export interface Placement {
  x: number
  y: number
}

/** Top z on a workspace's canvas, across windows and portals. */
function topZ(state: State, workspaceId: string): number {
  return Math.max(0, ...windowsIn(state, workspaceId).map((w) => w.z), ...portalsIn(state, workspaceId).map((p) => p.z))
}

/**
 * Create a two-sided portal between two different workspaces: one side at
 * `placement` on `fromWorkspaceId`, its counterpart on the target (placed by
 * `counterpartPlacement`, defaulting to a cascade near the origin).
 */
export function createPortal(
  state: State,
  fromWorkspaceId: string,
  targetWorkspaceId: string,
  placement: Placement,
  opts: { pairId?: string; ids?: [string, string]; counterpartPlacement?: Placement } = {},
): State {
  if (fromWorkspaceId === targetWorkspaceId) return state
  const exists = (id: string) => state.workspaces.some((w) => w.id === id)
  if (!exists(fromWorkspaceId) || !exists(targetWorkspaceId)) return state
  const pairId = opts.pairId ?? newId('pair')
  const [idA, idB] = opts.ids ?? [newId('portal'), newId('portal')]
  // Counterparts cascade from below the legend's corner so the first one is not hidden under it.
  const back = opts.counterpartPlacement ?? nextPlacement(elementsIn(state, targetWorkspaceId).length, { x: 160, y: 280 })
  const a: Portal = { id: idA, pairId, workspaceId: fromWorkspaceId, targetWorkspaceId, ...placement, z: topZ(state, fromWorkspaceId) + 1 }
  const b: Portal = { id: idB, pairId, workspaceId: targetWorkspaceId, targetWorkspaceId: fromWorkspaceId, ...back, z: topZ(state, targetWorkspaceId) + 1 }
  return { ...state, portals: [...state.portals, a, b] }
}

/** Create a new named workspace and a portal pair joining it to `fromWorkspaceId`, as one change. */
export function createWorkspaceWithPortal(
  state: State,
  fromWorkspaceId: string,
  name: string,
  placement: Placement,
  opts: { workspaceId?: string; pairId?: string; ids?: [string, string] } = {},
): State {
  if (!state.workspaces.some((w) => w.id === fromWorkspaceId)) return state
  const workspaceId = opts.workspaceId ?? newId('ws')
  const next = addWorkspace(state, name, workspaceId, fromWorkspaceId)
  return createPortal(next, fromWorkspaceId, workspaceId, placement, opts)
}

/** Remove a portal and its counterpart. */
export function deletePortal(state: State, id: string): State {
  const portal = state.portals.find((p) => p.id === id)
  if (!portal) return state
  return { ...state, portals: state.portals.filter((p) => p.pairId !== portal.pairId) }
}

export function movePortal(state: State, id: string, pos: Placement): State {
  if (!state.portals.some((p) => p.id === id)) return state
  return { ...state, portals: state.portals.map((p) => (p.id === id ? { ...p, x: pos.x, y: pos.y } : p)) }
}

// ---- Blocks and windows --------------------------------------------------

export interface NewBlock {
  text: string
  title?: string
  id?: string
  createdAt?: string
  kind?: 'note'
}

export function isNote(b: Block): boolean {
  return b.kind === 'note'
}

export function blockLabel(b: Block): string {
  return b.title ?? (isNote(b) ? 'Untitled note' : 'Untitled')
}

export interface WindowPlacement {
  x: number
  y: number
  width: number
  height: number
  id?: string
}

/** Everything occupying a workspace's canvas, for cascading placement. */
export function elementsIn(state: State, workspaceId: string): { x: number; y: number }[] {
  return [...windowsIn(state, workspaceId), ...portalsIn(state, workspaceId)]
}

/** Step a position diagonally by how many elements already exist, so new ones do not stack exactly. */
export function nextPlacement(count: number, center: Placement, step = 24): Placement {
  const offset = (count % 8) * step
  return { x: Math.round(center.x + offset), y: Math.round(center.y + offset) }
}

/** Where to put the next window: centred on `center`, cascaded by the number of existing elements. */
export function nextWindowPlacement(
  count: number,
  center: Placement,
  size = { width: 420, height: 260 },
  step = 24,
): WindowPlacement {
  const p = nextPlacement(count, { x: center.x - size.width / 2, y: center.y - size.height / 2 }, step)
  return { ...p, ...size }
}

/** Open a new window showing an existing block, above the others on its workspace. */
export function openWindow(state: State, blockId: string, placement: WindowPlacement): State {
  const block = state.blocks.find((b) => b.id === blockId)
  if (!block) return state
  const window: Window = {
    id: placement.id ?? newId('win'),
    blockId,
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
    z: topZ(state, block.workspaceId) + 1,
  }
  return { ...state, windows: [...state.windows, window] }
}

/** Add a block to a workspace and open a window for it, as one change. */
export function createBlock(state: State, workspaceId: string, block: NewBlock, placement: WindowPlacement): State {
  if (!state.workspaces.some((w) => w.id === workspaceId)) return state
  const b: Block = {
    id: block.id ?? newId('blk'),
    workspaceId,
    text: block.text,
    createdAt: block.createdAt ?? new Date().toISOString(),
    ...(block.title?.trim() ? { title: block.title.trim() } : {}),
    ...(block.kind ? { kind: block.kind } : {}),
  }
  return openWindow({ ...state, blocks: [...state.blocks, b] }, b.id, placement)
}

function endExists(state: State, e: LinkEnd): boolean {
  return e.kind === 'highlight' ? state.highlights.some((h) => h.id === e.id) : state.blocks.some((b) => b.id === e.id)
}

/**
 * Create a note on a workspace: a note block and a window for it, plus (when
 * `about` is given) a link from the note to that highlight or block, as one change.
 */
export function createNote(
  state: State,
  workspaceId: string,
  note: Omit<NewBlock, 'kind'>,
  placement: WindowPlacement,
  about?: LinkEnd,
): State {
  if (about && !endExists(state, about)) return state
  const id = note.id ?? newId('note')
  const next = createBlock(state, workspaceId, { ...note, id, kind: 'note' }, placement)
  if (next === state) return state
  return about ? addLink(next, { from: { kind: 'block', id }, to: about }) : next
}

/** Where to put a note window: to the right of the window it was created from. */
export function notePlacement(source: Window, size = { width: 300, height: 200 }): WindowPlacement {
  return { x: source.x + source.width + 24, y: source.y, ...size }
}

/** The window (if any) that shows a link end, for placing related windows nearby. */
export function windowShowingEnd(state: State, end: LinkEnd): Window | undefined {
  if (end.kind === 'block') return state.windows.find((w) => w.blockId === end.id)
  const h = state.highlights.find((x) => x.id === end.id)
  return h && state.windows.find((w) => w.blockId === h.blockId)
}

/** Set a block's title; an empty title removes it. */
export function setBlockTitle(state: State, id: string, title: string): State {
  if (!state.blocks.some((b) => b.id === id)) return state
  const trimmed = title.trim()
  return {
    ...state,
    blocks: state.blocks.map((b) => {
      if (b.id !== id) return b
      const { title: _old, ...rest } = b
      return trimmed ? { ...rest, title: trimmed } : rest
    }),
  }
}

/** Remove a block with its highlights, the links touching either, and every window showing it. */
export function deleteBlock(state: State, id: string): State {
  if (!state.blocks.some((b) => b.id === id)) return state
  const removed = new Set(state.highlights.filter((h) => h.blockId === id).map((h) => h.id))
  return {
    ...state,
    blocks: state.blocks.filter((b) => b.id !== id),
    highlights: state.highlights.filter((h) => h.blockId !== id),
    links: pruneLinks(state.links, { highlights: removed, blocks: new Set([id]) }),
    windows: state.windows.filter((w) => w.blockId !== id),
  }
}

/** The window showing the whole of a block, if one is open. */
export function findOpenWindow(state: State, blockId: string): Window | undefined {
  return state.windows.find((w) => w.blockId === blockId && !w.range)
}

/**
 * Show a block: bring its existing whole-block window to the front, or open a
 * new one if there is none. Never opens a duplicate.
 */
export function openBlock(state: State, blockId: string, placement: WindowPlacement): State {
  const existing = findOpenWindow(state, blockId)
  return existing ? bringToFront(state, existing.id) : openWindow(state, blockId, placement)
}

// ---- Window management ---------------------------------------------------

export function moveWindow(state: State, windowId: string, pos: Placement): State {
  if (!state.windows.some((w) => w.id === windowId)) return state
  return { ...state, windows: state.windows.map((w) => (w.id === windowId ? { ...w, x: pos.x, y: pos.y } : w)) }
}

/** Move whichever canvas element (window or portal) has this id. */
export function moveElement(state: State, id: string, pos: Placement): State {
  return state.windows.some((w) => w.id === id) ? moveWindow(state, id, pos) : movePortal(state, id, pos)
}

export function resizeWindow(state: State, windowId: string, size: { width: number; height: number }): State {
  if (!state.windows.some((w) => w.id === windowId) || size.width <= 0 || size.height <= 0) return state
  return {
    ...state,
    windows: state.windows.map((w) => (w.id === windowId ? { ...w, width: size.width, height: size.height } : w)),
  }
}

/**
 * Put a window or portal on top of everything else on its workspace, renumbering
 * z values compactly from 1. No change if it is already alone on top.
 */
export function bringToFront(state: State, id: string): State {
  const win = state.windows.find((w) => w.id === id)
  const portal = state.portals.find((p) => p.id === id)
  const workspaceId = win ? state.blocks.find((b) => b.id === win.blockId)?.workspaceId : portal?.workspaceId
  if (!workspaceId) return state
  const elements: { id: string; z: number }[] = [...windowsIn(state, workspaceId), ...portalsIn(state, workspaceId)]
  const top = Math.max(...elements.map((e) => e.z))
  const me = elements.find((e) => e.id === id)!
  if (me.z === top && elements.filter((e) => e.z === top).length === 1) return state
  const order = elements.filter((e) => e.id !== id).sort((a, b) => a.z - b.z)
  order.push(me)
  const z = new Map(order.map((e, i) => [e.id, i + 1]))
  return {
    ...state,
    windows: state.windows.map((w) => (z.has(w.id) ? { ...w, z: z.get(w.id)! } : w)),
    portals: state.portals.map((p) => (z.has(p.id) ? { ...p, z: z.get(p.id)! } : p)),
  }
}

/** Remove a window. The block and its highlights are untouched. */
export function closeWindow(state: State, windowId: string): State {
  if (!state.windows.some((w) => w.id === windowId)) return state
  return { ...state, windows: state.windows.filter((w) => w.id !== windowId) }
}

// ---- Presets -------------------------------------------------------------

export interface NewPreset {
  workspaceId: string
  name: string
  style: PresetStyle
  shortcut?: string
  id?: string
}

export function addPreset(state: State, p: NewPreset): State {
  if (!state.workspaces.some((w) => w.id === p.workspaceId)) return state
  const preset: Preset = {
    id: p.id ?? newId('preset'),
    workspaceId: p.workspaceId,
    name: p.name,
    style: { ...p.style },
    ...(p.shortcut ? { shortcut: p.shortcut } : {}),
  }
  return { ...state, presets: [...state.presets, preset] }
}

/** Patch a preset's name, style, or shortcut. Setting `shortcut` to undefined clears it. */
export function updatePreset(
  state: State,
  id: string,
  patch: { name?: string; style?: PresetStyle; shortcut?: string | undefined },
): State {
  if (!state.presets.some((p) => p.id === id)) return state
  return {
    ...state,
    presets: state.presets.map((p) => {
      if (p.id !== id) return p
      const next: Preset = { ...p }
      if (patch.name !== undefined) next.name = patch.name
      if (patch.style !== undefined) next.style = { ...p.style, ...patch.style }
      if ('shortcut' in patch) {
        if (patch.shortcut) next.shortcut = patch.shortcut
        else delete next.shortcut
      }
      return next
    }),
  }
}

/**
 * Move a preset up (delta < 0) or down (delta > 0) within its workspace's list.
 * List order is the priority used to resolve conflicting styles where highlights overlap.
 */
export function movePreset(state: State, id: string, delta: number): State {
  const preset = state.presets.find((p) => p.id === id)
  if (!preset) return state
  const mine = presetsIn(state, preset.workspaceId)
  const from = mine.findIndex((p) => p.id === id)
  const to = Math.min(Math.max(from + delta, 0), mine.length - 1)
  if (to === from) return state
  const reordered = [...mine]
  const [p] = reordered.splice(from, 1)
  reordered.splice(to, 0, p)
  // Keep other workspaces' presets where they are; slot the reordered ones into this workspace's positions.
  const slots = state.presets.map((x, i) => (x.workspaceId === preset.workspaceId ? i : -1)).filter((i) => i >= 0)
  const presets = [...state.presets]
  slots.forEach((slot, i) => (presets[slot] = reordered[i]))
  return { ...state, presets }
}

/** Remove a preset together with every highlight that uses it and those highlights' links. */
export function deletePreset(state: State, id: string): State {
  if (!state.presets.some((p) => p.id === id)) return state
  const removed = new Set(state.highlights.filter((h) => h.presetId === id).map((h) => h.id))
  return {
    ...state,
    presets: state.presets.filter((p) => p.id !== id),
    highlights: state.highlights.filter((h) => !removed.has(h.id)),
    links: pruneLinks(state.links, { highlights: removed }),
  }
}

/** The other preset already using `shortcut`, if any. */
export function shortcutConflict(presets: Preset[], shortcut: string, excludeId?: string): Preset | undefined {
  return presets.find((p) => p.id !== excludeId && p.shortcut !== undefined && p.shortcut === shortcut)
}

// ---- Links ---------------------------------------------------------------

export interface NewLink {
  from: LinkEnd
  to: LinkEnd
  label?: string
  id?: string
}

/**
 * Link two distinct existing ends (highlights and/or blocks).
 * An identical link (same ends, same direction) is not added twice.
 */
export function addLink(state: State, l: NewLink): State {
  if (sameEnd(l.from, l.to)) return state
  if (!endExists(state, l.from) || !endExists(state, l.to)) return state
  if (state.links.some((x) => sameEnd(x.from, l.from) && sameEnd(x.to, l.to))) return state
  const link: Link = {
    id: l.id ?? newId('link'),
    from: { ...l.from },
    to: { ...l.to },
    ...(l.label?.trim() ? { label: l.label.trim() } : {}),
  }
  return { ...state, links: [...state.links, link] }
}

/** Click-to-link toggle: if a link already joins these two ends (in either direction) remove it, otherwise add one. */
export function toggleLink(state: State, l: NewLink): State {
  const existing = state.links.find(
    (x) => (sameEnd(x.from, l.from) && sameEnd(x.to, l.to)) || (sameEnd(x.from, l.to) && sameEnd(x.to, l.from)),
  )
  return existing ? deleteLink(state, existing.id) : addLink(state, l)
}

/** Set a link's label; an empty label removes it. */
export function setLinkLabel(state: State, id: string, label: string): State {
  if (!state.links.some((l) => l.id === id)) return state
  const trimmed = label.trim()
  return {
    ...state,
    links: state.links.map((l) => {
      if (l.id !== id) return l
      const { label: _old, ...rest } = l
      return trimmed ? { ...rest, label: trimmed } : rest
    }),
  }
}

export function deleteLink(state: State, id: string): State {
  if (!state.links.some((l) => l.id === id)) return state
  return { ...state, links: state.links.filter((l) => l.id !== id) }
}

// ---- Queries -------------------------------------------------------------

/**
 * Presets whose key would remove a highlight if pressed with `highlightId`
 * armed: those with a highlight of that preset covering the armed range.
 */
export function activePresetsFor(state: State, highlightId: string): Set<string> {
  const armed = state.highlights.find((h) => h.id === highlightId)
  if (!armed) return new Set()
  return new Set(
    state.highlights
      .filter((h) => h.blockId === armed.blockId && h.start <= armed.start && h.end >= armed.end)
      .map((h) => h.presetId),
  )
}

/** Human-readable description of a link end, for lists. */
export function describeLinkEnd(state: State, end: LinkEnd, excerptLength = 40): string {
  if (end.kind === 'block') {
    const block = state.blocks.find((b) => b.id === end.id)
    return block ? blockLabel(block) : '(missing block)'
  }
  const h = state.highlights.find((x) => x.id === end.id)
  const block = h && state.blocks.find((b) => b.id === h.blockId)
  if (!h || !block) return '(missing highlight)'
  const raw = block.text.slice(h.start, h.end).replace(/\s+/g, ' ').trim()
  const excerpt = raw.length > excerptLength ? `${raw.slice(0, excerptLength - 1)}…` : raw
  return `“${excerpt}” (${blockLabel(block)})`
}
