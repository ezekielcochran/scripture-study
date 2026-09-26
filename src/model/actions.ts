import type { Highlight, Preset, State } from './types'
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
