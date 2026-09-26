import { describe, expect, test } from 'vitest'
import {
  addHighlight,
  addPreset,
  createDocument,
  deletePreset,
  editDocument,
  nextWindowPlacement,
  presetForShortcut,
  shortcutConflict,
  updatePreset,
} from './actions'
import type { State } from './types'

const base: State = {
  documents: [{ id: 'doc', text: 'hello world', createdAt: '2026-01-01T00:00:00.000Z' }],
  presets: [
    { id: 'p1', name: 'One', style: { bold: true }, shortcut: '1' },
    { id: 'p2', name: 'Two', style: { italic: true } },
  ],
  highlights: [],
  links: [],
  layouts: [],
}

describe('addHighlight', () => {
  test('adds a highlight and leaves the input untouched', () => {
    const next = addHighlight(base, { documentId: 'doc', start: 0, end: 5, presetId: 'p1', id: 'h' })
    expect(next.highlights).toEqual([{ id: 'h', documentId: 'doc', start: 0, end: 5, presetId: 'p1' }])
    expect(base.highlights).toEqual([])
  })

  test('generates an id when none is given', () => {
    const next = addHighlight(base, { documentId: 'doc', start: 0, end: 5, presetId: 'p1' })
    expect(next.highlights[0].id).toMatch(/^hl-/)
  })

  test('clamps to the document text', () => {
    const next = addHighlight(base, { documentId: 'doc', start: -3, end: 99, presetId: 'p1' })
    expect(next.highlights[0]).toMatchObject({ start: 0, end: 11 })
  })

  test('ignores empty ranges, unknown documents, and unknown presets', () => {
    expect(addHighlight(base, { documentId: 'doc', start: 3, end: 3, presetId: 'p1' })).toBe(base)
    expect(addHighlight(base, { documentId: 'nope', start: 0, end: 3, presetId: 'p1' })).toBe(base)
    expect(addHighlight(base, { documentId: 'doc', start: 0, end: 3, presetId: 'nope' })).toBe(base)
  })
})

describe('presetForShortcut', () => {
  test('finds a preset by shortcut', () => {
    expect(presetForShortcut(base.presets, '1')?.id).toBe('p1')
  })

  test('returns undefined for unbound keys and never matches a preset with no shortcut', () => {
    expect(presetForShortcut(base.presets, '2')).toBeUndefined()
    expect(presetForShortcut(base.presets, 'undefined')).toBeUndefined()
  })
})

describe('editDocument', () => {
  const withData: State = {
    ...base,
    documents: [{ id: 'doc', text: '0123456789', createdAt: '2026-01-01T00:00:00.000Z' }],
    highlights: [
      { id: 'a', documentId: 'doc', start: 2, end: 5, presetId: 'p1' },
      { id: 'b', documentId: 'doc', start: 6, end: 9, presetId: 'p2' },
      { id: 'other', documentId: 'other-doc', start: 0, end: 3, presetId: 'p1' },
    ],
    links: [
      { id: 'l1', fromHighlightId: 'a', toHighlightId: 'b' },
      { id: 'l2', fromHighlightId: 'b', toHighlightId: 'other' },
    ],
    layouts: [
      {
        id: 'L',
        name: 'L',
        windows: [
          { id: 'w1', documentId: 'doc', range: { start: 5, end: 10 }, x: 0, y: 0, width: 1, height: 1, z: 0 },
          { id: 'w2', documentId: 'doc', x: 0, y: 0, width: 1, height: 1, z: 0 },
        ],
      },
    ],
  }

  test('updates text and shifts ranges in one transaction', () => {
    const next = editDocument(withData, 'doc', { position: 0, deletedLength: 0, insertedText: 'XY' })
    expect(next.documents[0].text).toBe('XY0123456789')
    expect(next.highlights.map((h) => [h.id, h.start, h.end])).toEqual([
      ['a', 4, 7],
      ['b', 8, 11],
      ['other', 0, 3],
    ])
    expect(next.layouts[0].windows[0].range).toEqual({ start: 7, end: 12 })
    expect(next.links).toEqual(withData.links)
  })

  test('removes a fully deleted highlight and its links', () => {
    const next = editDocument(withData, 'doc', { position: 2, deletedLength: 3, insertedText: '' })
    expect(next.documents[0].text).toBe('0156789')
    expect(next.highlights.map((h) => h.id)).toEqual(['b', 'other'])
    expect(next.links.map((l) => l.id)).toEqual(['l2'])
  })

  test('a window whose sub-range is deleted shows the whole document', () => {
    const next = editDocument(withData, 'doc', { position: 5, deletedLength: 5, insertedText: '' })
    expect(next.layouts[0].windows[0]).not.toHaveProperty('range')
    expect(next.layouts[0].windows[1]).toEqual(withData.layouts[0].windows[1])
  })

  test('typing at the end of a window sub-range keeps the text in the window', () => {
    const next = editDocument(withData, 'doc', { position: 10, deletedLength: 0, insertedText: '!' })
    expect(next.layouts[0].windows[0].range).toEqual({ start: 5, end: 11 })
    expect(next.highlights.find((h) => h.id === 'b')).toMatchObject({ start: 6, end: 9 })
  })

  test('ignores unknown documents and out-of-bounds edits', () => {
    expect(editDocument(withData, 'nope', { position: 0, deletedLength: 0, insertedText: 'x' })).toBe(withData)
    expect(editDocument(withData, 'doc', { position: 8, deletedLength: 5, insertedText: '' })).toBe(withData)
  })

  test('does not mutate the input state', () => {
    const snapshot = JSON.stringify(withData)
    editDocument(withData, 'doc', { position: 0, deletedLength: 10, insertedText: 'gone' })
    expect(JSON.stringify(withData)).toBe(snapshot)
  })
})

describe('createDocument', () => {
  const withLayout: State = {
    ...base,
    layouts: [
      { id: 'L', name: 'L', windows: [{ id: 'w0', documentId: 'doc', x: 0, y: 0, width: 1, height: 1, z: 5 }] },
    ],
  }
  const placement = { x: 10, y: 20, width: 300, height: 200, id: 'w1' }

  test('adds the document and a window above existing ones', () => {
    const next = createDocument(withLayout, 'L', { text: 'body', title: ' T ', id: 'd1', createdAt: 'c' }, placement)
    expect(next.documents.at(-1)).toEqual({ id: 'd1', text: 'body', title: 'T', createdAt: 'c' })
    expect(next.layouts[0].windows.at(-1)).toEqual({ id: 'w1', documentId: 'd1', x: 10, y: 20, width: 300, height: 200, z: 6 })
  })

  test('omits an empty title and generates ids', () => {
    const next = createDocument(withLayout, 'L', { text: 'body', title: '  ' }, { ...placement, id: undefined })
    const doc = next.documents.at(-1)!
    expect(doc).not.toHaveProperty('title')
    expect(doc.id).toMatch(/^doc-/)
    expect(next.layouts[0].windows.at(-1)!.id).toMatch(/^win-/)
  })

  test('ignores an unknown layout', () => {
    expect(createDocument(withLayout, 'nope', { text: 'x' }, placement)).toBe(withLayout)
  })
})

describe('nextWindowPlacement', () => {
  test('centres the first window and steps later ones diagonally', () => {
    const center = { x: 500, y: 400 }
    expect(nextWindowPlacement([], center, { width: 400, height: 200 }, 20)).toEqual({ x: 300, y: 300, width: 400, height: 200 })
    const two = [{}, {}] as State['layouts'][0]['windows']
    expect(nextWindowPlacement(two, center, { width: 400, height: 200 }, 20)).toEqual({ x: 340, y: 340, width: 400, height: 200 })
  })
})

describe('presets', () => {
  const withHighlights: State = {
    ...base,
    documents: [{ id: 'doc', text: 'hello world', createdAt: 'c' }],
    highlights: [
      { id: 'h1', documentId: 'doc', start: 0, end: 2, presetId: 'p1' },
      { id: 'h2', documentId: 'doc', start: 3, end: 5, presetId: 'p2' },
    ],
    links: [{ id: 'l', fromHighlightId: 'h1', toHighlightId: 'h2' }],
  }

  test('addPreset appends and omits an empty shortcut', () => {
    const next = addPreset(base, { name: 'N', style: { italic: true }, shortcut: '', id: 'p3' })
    expect(next.presets.at(-1)).toEqual({ id: 'p3', name: 'N', style: { italic: true } })
  })

  test('updatePreset merges style and can set or clear the shortcut', () => {
    let next = updatePreset(base, 'p1', { name: 'Renamed', style: { color: 'red' } })
    expect(next.presets[0]).toEqual({ id: 'p1', name: 'Renamed', style: { bold: true, color: 'red' }, shortcut: '1' })
    next = updatePreset(next, 'p1', { shortcut: undefined })
    expect(next.presets[0]).not.toHaveProperty('shortcut')
    next = updatePreset(next, 'p1', { shortcut: 'q' })
    expect(next.presets[0].shortcut).toBe('q')
    expect(updatePreset(base, 'nope', { name: 'x' })).toBe(base)
  })

  test('deletePreset removes its highlights and their links', () => {
    const next = deletePreset(withHighlights, 'p1')
    expect(next.presets.map((p) => p.id)).toEqual(['p2'])
    expect(next.highlights.map((h) => h.id)).toEqual(['h2'])
    expect(next.links).toEqual([])
    expect(deletePreset(withHighlights, 'nope')).toBe(withHighlights)
  })

  test('shortcutConflict finds another preset using the key', () => {
    expect(shortcutConflict(base.presets, '1')?.id).toBe('p1')
    expect(shortcutConflict(base.presets, '1', 'p1')).toBeUndefined()
    expect(shortcutConflict(base.presets, 'z')).toBeUndefined()
  })
})
