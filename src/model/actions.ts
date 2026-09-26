import type { Highlight, Preset, State } from './types'
import { newId } from './id'

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
