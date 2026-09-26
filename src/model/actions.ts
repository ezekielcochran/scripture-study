import type { Document, Highlight, Layout, Link, Preset, PresetStyle, State, Window } from './types'
import { newId } from './id'
import { adjustRange, applyEditToText, type Edit } from '../lib/ranges'

// Every action is a pure function State -> State. Components call them through
// the store's `update`, never mutating state themselves.

export interface NewHighlight {
  documentId: string
  start: number
  end: number
  presetId: string
  id?: string
}

/** Add a highlight over [start, end) of a document. Empty or invalid ranges are ignored. */
export function addHighlight(state: State, h: NewHighlight): State {
  const doc = state.documents.find((d) => d.id === h.documentId)
  if (!doc) return state
  const start = Math.max(0, h.start)
  const end = Math.min(doc.text.length, h.end)
  if (start >= end) return state
  if (!state.presets.some((p) => p.id === h.presetId)) return state

  const highlight: Highlight = {
    id: h.id ?? newId('hl'),
    documentId: h.documentId,
    start,
    end,
    presetId: h.presetId,
  }
  return { ...state, highlights: [...state.highlights, highlight] }
}

/** Remove a highlight together with any links that reference it. */
export function removeHighlight(state: State, id: string): State {
  if (!state.highlights.some((h) => h.id === id)) return state
  return {
    ...state,
    highlights: state.highlights.filter((h) => h.id !== id),
    links: state.links.filter((l) => l.fromHighlightId !== id && l.toHighlightId !== id),
  }
}

/**
 * Keyboard toggle: if the range lies within an existing highlight of the same
 * preset, remove that highlight; otherwise add a new one.
 */
export function toggleHighlight(state: State, h: NewHighlight): State {
  const doc = state.documents.find((d) => d.id === h.documentId)
  if (!doc) return state
  const start = Math.max(0, h.start)
  const end = Math.min(doc.text.length, h.end)
  if (start >= end) return state
  const existing = state.highlights.find(
    (x) => x.documentId === h.documentId && x.presetId === h.presetId && x.start <= start && x.end >= end,
  )
  return existing ? removeHighlight(state, existing.id) : addHighlight(state, h)
}

/** Find the preset bound to a keyboard shortcut, if any. */
export function presetForShortcut(presets: Preset[], key: string): Preset | undefined {
  return presets.find((p) => p.shortcut !== undefined && p.shortcut === key)
}

/**
 * Apply a text edit to a document. In the same transaction, every highlight and
 * window sub-range over the document is adjusted; highlights whose text is
 * entirely deleted are removed together with their links, and a window whose
 * sub-range is entirely deleted falls back to showing the whole document.
 * Out-of-bounds edits are ignored.
 */
export function editDocument(state: State, documentId: string, edit: Edit): State {
  const doc = state.documents.find((d) => d.id === documentId)
  if (!doc) return state
  let text: string
  try {
    text = applyEditToText(doc.text, edit)
  } catch {
    return state
  }

  const removed = new Set<string>()
  const highlights: Highlight[] = []
  for (const h of state.highlights) {
    if (h.documentId !== documentId) {
      highlights.push(h)
      continue
    }
    const next = adjustRange(h, edit)
    if (next) highlights.push({ ...h, ...next })
    else removed.add(h.id)
  }
  const links = state.links.filter((l) => !removed.has(l.fromHighlightId) && !removed.has(l.toHighlightId))

  const layouts = state.layouts.map((layout) => ({
    ...layout,
    windows: layout.windows.map((w) => {
      if (w.documentId !== documentId || !w.range) return w
      const next = adjustRange(w.range, edit, { inclusive: true })
      if (next) return { ...w, range: next }
      const { range: _dropped, ...rest } = w
      return rest
    }),
  }))

  return {
    ...state,
    documents: state.documents.map((d) => (d.id === documentId ? { ...d, text } : d)),
    highlights,
    links,
    layouts,
  }
}

// ---- Documents and windows ----------------------------------------------

export interface NewDocument {
  text: string
  title?: string
  id?: string
  createdAt?: string
}

export interface WindowPlacement {
  x: number
  y: number
  width: number
  height: number
  id?: string
}

/** Add a document and open a window for it in the given layout, as one change. */
export function createDocument(
  state: State,
  layoutId: string,
  doc: NewDocument,
  placement: WindowPlacement,
): State {
  const layout = state.layouts.find((l) => l.id === layoutId)
  if (!layout) return state
  const document: Document = {
    id: doc.id ?? newId('doc'),
    text: doc.text,
    createdAt: doc.createdAt ?? new Date().toISOString(),
    ...(doc.title?.trim() ? { title: doc.title.trim() } : {}),
  }
  return openWindow({ ...state, documents: [...state.documents, document] }, layoutId, document.id, placement)
}

/**
 * Where to put the next window so it does not sit exactly on top of the last
 * one: centred on `center`, stepped diagonally by the number of windows.
 */
export function nextWindowPlacement(
  windows: Window[],
  center: { x: number; y: number },
  size = { width: 420, height: 260 },
  step = 24,
): WindowPlacement {
  const offset = (windows.length % 8) * step
  return {
    x: Math.round(center.x - size.width / 2 + offset),
    y: Math.round(center.y - size.height / 2 + offset),
    ...size,
  }
}

// ---- Presets -------------------------------------------------------------

export interface NewPreset {
  name: string
  style: PresetStyle
  shortcut?: string
  id?: string
}

export function addPreset(state: State, p: NewPreset): State {
  const preset: Preset = {
    id: p.id ?? newId('preset'),
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

/** Remove a preset together with every highlight that uses it and those highlights' links. */
export function deletePreset(state: State, id: string): State {
  if (!state.presets.some((p) => p.id === id)) return state
  const removed = new Set(state.highlights.filter((h) => h.presetId === id).map((h) => h.id))
  return {
    ...state,
    presets: state.presets.filter((p) => p.id !== id),
    highlights: state.highlights.filter((h) => !removed.has(h.id)),
    links: state.links.filter((l) => !removed.has(l.fromHighlightId) && !removed.has(l.toHighlightId)),
  }
}

/** The other preset already using `shortcut`, if any. */
export function shortcutConflict(presets: Preset[], shortcut: string, excludeId?: string): Preset | undefined {
  return presets.find((p) => p.id !== excludeId && p.shortcut !== undefined && p.shortcut === shortcut)
}

// ---- Windows -------------------------------------------------------------

function mapWindow(state: State, windowId: string, fn: (w: Window, layout: Layout) => Window): State {
  return {
    ...state,
    layouts: state.layouts.map((layout) => ({
      ...layout,
      windows: layout.windows.map((w) => (w.id === windowId ? fn(w, layout) : w)),
    })),
  }
}

function hasWindow(state: State, windowId: string): boolean {
  return state.layouts.some((l) => l.windows.some((w) => w.id === windowId))
}

export function moveWindow(state: State, windowId: string, pos: { x: number; y: number }): State {
  if (!hasWindow(state, windowId)) return state
  return mapWindow(state, windowId, (w) => ({ ...w, x: pos.x, y: pos.y }))
}

export function resizeWindow(state: State, windowId: string, size: { width: number; height: number }): State {
  if (!hasWindow(state, windowId) || size.width <= 0 || size.height <= 0) return state
  return mapWindow(state, windowId, (w) => ({ ...w, width: size.width, height: size.height }))
}

/**
 * Give the window the highest z in its layout, renumbering the others compactly
 * from 1 so z values stay small. No change if it is already alone on top.
 */
export function bringToFront(state: State, windowId: string): State {
  const layout = state.layouts.find((l) => l.windows.some((w) => w.id === windowId))
  if (!layout) return state
  const top = Math.max(...layout.windows.map((w) => w.z))
  const win = layout.windows.find((w) => w.id === windowId)!
  if (win.z === top && layout.windows.filter((w) => w.z === top).length === 1) return state
  const order = [...layout.windows].sort((a, b) => a.z - b.z).filter((w) => w.id !== windowId)
  order.push(win)
  const z = new Map(order.map((w, i) => [w.id, i + 1]))
  return {
    ...state,
    layouts: state.layouts.map((l) =>
      l.id === layout.id ? { ...l, windows: l.windows.map((w) => ({ ...w, z: z.get(w.id)! })) } : l,
    ),
  }
}

/** Remove a window. The document and its highlights are untouched. */
export function closeWindow(state: State, windowId: string): State {
  if (!hasWindow(state, windowId)) return state
  return {
    ...state,
    layouts: state.layouts.map((layout) => ({
      ...layout,
      windows: layout.windows.filter((w) => w.id !== windowId),
    })),
  }
}

/** Open a new window showing an existing document, above the others in the layout. */
export function openWindow(state: State, layoutId: string, documentId: string, placement: WindowPlacement): State {
  const layout = state.layouts.find((l) => l.id === layoutId)
  if (!layout || !state.documents.some((d) => d.id === documentId)) return state
  const window: Window = {
    id: placement.id ?? newId('win'),
    documentId,
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
    z: layout.windows.reduce((max, w) => Math.max(max, w.z), 0) + 1,
  }
  return {
    ...state,
    layouts: state.layouts.map((l) => (l.id === layoutId ? { ...l, windows: [...l.windows, window] } : l)),
  }
}

// ---- Links ---------------------------------------------------------------

export interface NewLink {
  fromHighlightId: string
  toHighlightId: string
  label?: string
  id?: string
}

/** Link two distinct existing highlights. An identical link (same direction) is not added twice. */
export function addLink(state: State, l: NewLink): State {
  if (l.fromHighlightId === l.toHighlightId) return state
  const ids = new Set(state.highlights.map((h) => h.id))
  if (!ids.has(l.fromHighlightId) || !ids.has(l.toHighlightId)) return state
  if (state.links.some((x) => x.fromHighlightId === l.fromHighlightId && x.toHighlightId === l.toHighlightId)) {
    return state
  }
  const link: Link = {
    id: l.id ?? newId('link'),
    fromHighlightId: l.fromHighlightId,
    toHighlightId: l.toHighlightId,
    ...(l.label?.trim() ? { label: l.label.trim() } : {}),
  }
  return { ...state, links: [...state.links, link] }
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

// ---- Documents: rename, delete, open-or-focus ---------------------------

/** Set a document's title; an empty title removes it. */
export function setDocumentTitle(state: State, id: string, title: string): State {
  if (!state.documents.some((d) => d.id === id)) return state
  const trimmed = title.trim()
  return {
    ...state,
    documents: state.documents.map((d) => {
      if (d.id !== id) return d
      const { title: _old, ...rest } = d
      return trimmed ? { ...rest, title: trimmed } : rest
    }),
  }
}

/** Remove a document with its highlights, the links touching them, and every window showing it. */
export function deleteDocument(state: State, id: string): State {
  if (!state.documents.some((d) => d.id === id)) return state
  const removed = new Set(state.highlights.filter((h) => h.documentId === id).map((h) => h.id))
  return {
    ...state,
    documents: state.documents.filter((d) => d.id !== id),
    highlights: state.highlights.filter((h) => h.documentId !== id),
    links: state.links.filter((l) => !removed.has(l.fromHighlightId) && !removed.has(l.toHighlightId)),
    layouts: state.layouts.map((l) => ({ ...l, windows: l.windows.filter((w) => w.documentId !== id) })),
  }
}

/** The window showing the whole of a document in this layout, if one is open. */
export function findOpenWindow(layout: Layout, documentId: string): Window | undefined {
  return layout.windows.find((w) => w.documentId === documentId && !w.range)
}

/**
 * Show a document: bring its existing whole-document window to the front, or
 * open a new one if there is none. Never opens a duplicate.
 */
export function openDocument(state: State, layoutId: string, documentId: string, placement: WindowPlacement): State {
  const layout = state.layouts.find((l) => l.id === layoutId)
  if (!layout) return state
  const existing = findOpenWindow(layout, documentId)
  return existing ? bringToFront(state, existing.id) : openWindow(state, layoutId, documentId, placement)
}
