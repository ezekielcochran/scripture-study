import { describe, expect, test } from 'vitest'
import {
  activePresetsFor,
  addHighlight,
  addLink,
  addPreset,
  bringToFront,
  closeWindow,
  createDocument,
  createNote,
  deleteDocument,
  deleteLink,
  deletePreset,
  describeLinkEnd,
  editDocument,
  findOpenWindow,
  movePreset,
  moveWindow,
  nextWindowPlacement,
  notePlacement,
  openDocument,
  openWindow,
  presetForShortcut,
  removeHighlight,
  resizeWindow,
  setDocumentTitle,
  setLinkLabel,
  shortcutConflict,
  toggleHighlight,
  toggleLink,
  updatePreset,
  windowShowingEnd,
} from './actions'
import type { State } from './types'

const hl = (id: string) => ({ kind: 'highlight' as const, id })
const dc = (id: string) => ({ kind: 'document' as const, id })

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

  test('refuses an id that is already in use', () => {
    const once = addHighlight(base, { documentId: 'doc', start: 0, end: 5, presetId: 'p1', id: 'h' })
    expect(addHighlight(once, { documentId: 'doc', start: 6, end: 9, presetId: 'p2', id: 'h' })).toBe(once)
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
      { id: 'l1', from: hl('a'), to: hl('b') },
      { id: 'l2', from: hl('b'), to: hl('other') },
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

  test('createNote adds a note document, its window, and a link to what it is about', () => {
    const withDoc: State = {
      ...withLayout,
      documents: [{ id: 'doc', text: 'source', createdAt: 'c' }],
      highlights: [{ id: 'h', documentId: 'doc', start: 0, end: 3, presetId: 'p1' }],
    }
    const next = createNote(withDoc, 'L', { text: 'thoughts', id: 'n1' }, placement, dc('doc'))
    expect(next.documents.at(-1)).toMatchObject({ id: 'n1', text: 'thoughts', kind: 'note' })
    expect(next.layouts[0].windows.at(-1)).toMatchObject({ id: 'w1', documentId: 'n1' })
    expect(next.links).toEqual([expect.objectContaining({ from: dc('n1'), to: dc('doc') })])
    const aboutHighlight = createNote(withDoc, 'L', { text: 'x', id: 'n2' }, placement, hl('h'))
    expect(aboutHighlight.links).toEqual([expect.objectContaining({ from: dc('n2'), to: hl('h') })])
    const standalone = createNote(withDoc, 'L', { text: 'x', id: 'n3' }, placement)
    expect(standalone.links).toEqual([])
    expect(standalone.documents.at(-1)?.kind).toBe('note')
    expect(createNote(withDoc, 'L', { text: 'x' }, placement, dc('missing'))).toBe(withDoc)
  })

  test('windowShowingEnd finds the window for a document or a highlight', () => {
    const s: State = {
      ...withLayout,
      documents: [{ id: 'doc', text: 'source', createdAt: 'c' }],
      highlights: [{ id: 'h', documentId: 'doc', start: 0, end: 3, presetId: 'p1' }],
    }
    expect(windowShowingEnd(s, s.layouts[0], dc('doc'))?.id).toBe('w0')
    expect(windowShowingEnd(s, s.layouts[0], hl('h'))?.id).toBe('w0')
    expect(windowShowingEnd(s, s.layouts[0], hl('nope'))).toBeUndefined()
  })

  test('notePlacement puts the note beside its source window', () => {
    const source = { id: 'w', documentId: 'd', x: 100, y: 50, width: 340, height: 200, z: 1 }
    expect(notePlacement(source, { width: 300, height: 200 })).toEqual({ x: 464, y: 50, width: 300, height: 200 })
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
    links: [{ id: 'l', from: hl('h1'), to: hl('h2') }],
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

  test('movePreset reorders within bounds', () => {
    const three = addPreset(base, { name: 'C', style: {}, id: 'p3' })
    const ids = (s: State) => s.presets.map((p) => p.id)
    expect(ids(movePreset(three, 'p3', -1))).toEqual(['p1', 'p3', 'p2'])
    expect(ids(movePreset(three, 'p3', -5))).toEqual(['p3', 'p1', 'p2'])
    expect(ids(movePreset(three, 'p1', 1))).toEqual(['p2', 'p1', 'p3'])
    expect(movePreset(three, 'p3', 1)).toBe(three)
    expect(movePreset(three, 'nope', -1)).toBe(three)
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

describe('window management', () => {
  const w = (id: string, z: number) => ({ id, documentId: 'doc', x: 0, y: 0, width: 100, height: 80, z })
  const withWindows: State = {
    ...base,
    documents: [{ id: 'doc', text: 'hello', createdAt: 'c' }],
    layouts: [{ id: 'L', name: 'L', windows: [w('a', 1), w('b', 2), w('c', 3)] }],
  }
  const windows = (s: State) => s.layouts[0].windows

  test('moveWindow updates position only', () => {
    const next = moveWindow(withWindows, 'a', { x: 10, y: -5 })
    expect(windows(next)[0]).toEqual({ ...w('a', 1), x: 10, y: -5 })
    expect(windows(next).slice(1)).toEqual(windows(withWindows).slice(1))
    expect(moveWindow(withWindows, 'nope', { x: 1, y: 1 })).toBe(withWindows)
  })

  test('resizeWindow updates size and rejects non-positive sizes', () => {
    expect(windows(resizeWindow(withWindows, 'b', { width: 300, height: 200 }))[1]).toMatchObject({ width: 300, height: 200 })
    expect(resizeWindow(withWindows, 'b', { width: 0, height: 200 })).toBe(withWindows)
  })

  test('bringToFront puts the window on top with compact z values, and is a no-op when already on top', () => {
    const next = bringToFront(withWindows, 'a')
    expect(windows(next).map((x) => x.z)).toEqual([3, 1, 2])
    const sparse = { ...withWindows, layouts: [{ id: 'L', name: 'L', windows: [w('a', 10), w('b', 50), w('c', 70)] }] }
    expect(windows(bringToFront(sparse, 'b')).map((x) => x.z)).toEqual([1, 3, 2])
    expect(bringToFront(withWindows, 'c')).toBe(withWindows)
    expect(bringToFront(withWindows, 'nope')).toBe(withWindows)
  })

  test('closeWindow removes only that window and keeps the document', () => {
    const next = closeWindow(withWindows, 'b')
    expect(windows(next).map((x) => x.id)).toEqual(['a', 'c'])
    expect(next.documents).toBe(withWindows.documents)
    expect(closeWindow(withWindows, 'nope')).toBe(withWindows)
  })

  test('openWindow adds a window for an existing document on top', () => {
    const next = openWindow(withWindows, 'L', 'doc', { x: 1, y: 2, width: 50, height: 40, id: 'd' })
    expect(windows(next).at(-1)).toEqual({ id: 'd', documentId: 'doc', x: 1, y: 2, width: 50, height: 40, z: 4 })
    expect(openWindow(withWindows, 'L', 'missing', { x: 1, y: 2, width: 50, height: 40 })).toBe(withWindows)
    expect(openWindow(withWindows, 'nope', 'doc', { x: 1, y: 2, width: 50, height: 40 })).toBe(withWindows)
  })
})

describe('links', () => {
  const withHighlights: State = {
    ...base,
    documents: [
      { id: 'doc', text: 'hello world', createdAt: 'c' },
      { id: 'doc2', text: 'other', createdAt: 'c' },
    ],
    highlights: [
      { id: 'h1', documentId: 'doc', start: 0, end: 2, presetId: 'p1' },
      { id: 'h2', documentId: 'doc', start: 3, end: 5, presetId: 'p2' },
    ],
  }

  test('addLink links two highlights and trims the label', () => {
    const next = addLink(withHighlights, { from: hl('h1'), to: hl('h2'), label: ' cf. ', id: 'l' })
    expect(next.links).toEqual([{ id: 'l', from: hl('h1'), to: hl('h2'), label: 'cf.' }])
    const noLabel = addLink(withHighlights, { from: hl('h1'), to: hl('h2'), label: ' ' })
    expect(noLabel.links[0]).not.toHaveProperty('label')
    expect(noLabel.links[0].id).toMatch(/^link-/)
  })

  test('addLink supports every combination of highlight and document ends', () => {
    let s = addLink(withHighlights, { from: hl('h1'), to: dc('doc2'), id: 'a' })
    s = addLink(s, { from: dc('doc'), to: hl('h2'), id: 'b' })
    s = addLink(s, { from: dc('doc'), to: dc('doc2'), id: 'c' })
    expect(s.links.map((l) => [l.from.kind, l.to.kind])).toEqual([
      ['highlight', 'document'],
      ['document', 'highlight'],
      ['document', 'document'],
    ])
  })

  test('addLink rejects self-links, unknown ends, and exact duplicates', () => {
    expect(addLink(withHighlights, { from: hl('h1'), to: hl('h1') })).toBe(withHighlights)
    expect(addLink(withHighlights, { from: dc('doc'), to: dc('doc') })).toBe(withHighlights)
    expect(addLink(withHighlights, { from: hl('h1'), to: hl('nope') })).toBe(withHighlights)
    expect(addLink(withHighlights, { from: hl('h1'), to: dc('nope') })).toBe(withHighlights)
    // A highlight and a document with the same id string are different ends.
    const once = addLink(withHighlights, { from: hl('h1'), to: hl('h2') })
    expect(addLink(once, { from: hl('h1'), to: hl('h2') })).toBe(once)
    // The reverse direction is a different link.
    expect(addLink(once, { from: hl('h2'), to: hl('h1') }).links).toHaveLength(2)
  })

  test('toggleLink removes an existing link in either direction, otherwise adds', () => {
    const once = toggleLink(withHighlights, { from: hl('h1'), to: hl('h2') })
    expect(once.links).toHaveLength(1)
    expect(toggleLink(once, { from: hl('h1'), to: hl('h2') }).links).toEqual([])
    expect(toggleLink(once, { from: hl('h2'), to: hl('h1') }).links).toEqual([])
    const other = toggleLink(once, { from: dc('doc'), to: hl('h2') })
    expect(other.links).toHaveLength(2)
    expect(toggleLink(withHighlights, { from: hl('h1'), to: hl('h1') })).toBe(withHighlights)
  })

  test('setLinkLabel sets, replaces, and clears the label', () => {
    const linked = addLink(withHighlights, { from: hl('h1'), to: hl('h2'), id: 'l' })
    expect(setLinkLabel(linked, 'l', ' echo ').links[0].label).toBe('echo')
    expect(setLinkLabel(setLinkLabel(linked, 'l', 'x'), 'l', '').links[0]).not.toHaveProperty('label')
    expect(setLinkLabel(linked, 'nope', 'x')).toBe(linked)
  })

  test('deleteLink removes only that link', () => {
    let s = addLink(withHighlights, { from: hl('h1'), to: hl('h2'), id: 'a' })
    s = addLink(s, { from: hl('h2'), to: hl('h1'), id: 'b' })
    expect(deleteLink(s, 'a').links.map((l) => l.id)).toEqual(['b'])
    expect(deleteLink(s, 'nope')).toBe(s)
  })
})

describe('window management', () => {
  const w = (id: string, z: number) => ({ id, documentId: 'doc', x: 0, y: 0, width: 100, height: 80, z })
  const withWindows: State = {
    ...base,
    documents: [{ id: 'doc', text: 'hello', createdAt: 'c' }],
    layouts: [{ id: 'L', name: 'L', windows: [w('a', 1), w('b', 2), w('c', 3)] }],
  }
  const windows = (s: State) => s.layouts[0].windows

  test('moveWindow updates position only', () => {
    const next = moveWindow(withWindows, 'a', { x: 10, y: -5 })
    expect(windows(next)[0]).toEqual({ ...w('a', 1), x: 10, y: -5 })
    expect(windows(next).slice(1)).toEqual(windows(withWindows).slice(1))
    expect(moveWindow(withWindows, 'nope', { x: 1, y: 1 })).toBe(withWindows)
  })

  test('resizeWindow updates size and rejects non-positive sizes', () => {
    expect(windows(resizeWindow(withWindows, 'b', { width: 300, height: 200 }))[1]).toMatchObject({ width: 300, height: 200 })
    expect(resizeWindow(withWindows, 'b', { width: 0, height: 200 })).toBe(withWindows)
  })

  test('bringToFront puts the window on top with compact z values, and is a no-op when already on top', () => {
    const next = bringToFront(withWindows, 'a')
    expect(windows(next).map((x) => x.z)).toEqual([3, 1, 2])
    const sparse = { ...withWindows, layouts: [{ id: 'L', name: 'L', windows: [w('a', 10), w('b', 50), w('c', 70)] }] }
    expect(windows(bringToFront(sparse, 'b')).map((x) => x.z)).toEqual([1, 3, 2])
    expect(bringToFront(withWindows, 'c')).toBe(withWindows)
    expect(bringToFront(withWindows, 'nope')).toBe(withWindows)
  })

  test('closeWindow removes only that window and keeps the document', () => {
    const next = closeWindow(withWindows, 'b')
    expect(windows(next).map((x) => x.id)).toEqual(['a', 'c'])
    expect(next.documents).toBe(withWindows.documents)
    expect(closeWindow(withWindows, 'nope')).toBe(withWindows)
  })

  test('openWindow adds a window for an existing document on top', () => {
    const next = openWindow(withWindows, 'L', 'doc', { x: 1, y: 2, width: 50, height: 40, id: 'd' })
    expect(windows(next).at(-1)).toEqual({ id: 'd', documentId: 'doc', x: 1, y: 2, width: 50, height: 40, z: 4 })
    expect(openWindow(withWindows, 'L', 'missing', { x: 1, y: 2, width: 50, height: 40 })).toBe(withWindows)
    expect(openWindow(withWindows, 'nope', 'doc', { x: 1, y: 2, width: 50, height: 40 })).toBe(withWindows)
  })
})

describe('links', () => {
  const withHighlights: State = {
    ...base,
    documents: [{ id: 'doc', text: 'hello world', createdAt: 'c' }],
    highlights: [
      { id: 'h1', documentId: 'doc', start: 0, end: 2, presetId: 'p1' },
      { id: 'h2', documentId: 'doc', start: 3, end: 5, presetId: 'p2' },
    ],
  }

  test('addLink links two highlights and trims the label', () => {
    const next = addLink(withHighlights, { from: hl('h1'), to: hl('h2'), label: ' cf. ', id: 'l' })
    expect(next.links).toEqual([{ id: 'l', from: hl('h1'), to: hl('h2'), label: 'cf.' }])
    const noLabel = addLink(withHighlights, { from: hl('h1'), to: hl('h2'), label: ' ' })
    expect(noLabel.links[0]).not.toHaveProperty('label')
    expect(noLabel.links[0].id).toMatch(/^link-/)
  })

  test('addLink rejects self-links, unknown highlights, and exact duplicates', () => {
    expect(addLink(withHighlights, { from: hl('h1'), to: hl('h1') })).toBe(withHighlights)
    expect(addLink(withHighlights, { from: hl('h1'), to: hl('nope') })).toBe(withHighlights)
    const once = addLink(withHighlights, { from: hl('h1'), to: hl('h2') })
    expect(addLink(once, { from: hl('h1'), to: hl('h2') })).toBe(once)
    // The reverse direction is a different link.
    expect(addLink(once, { from: hl('h2'), to: hl('h1') }).links).toHaveLength(2)
  })

  test('toggleLink removes an existing link in either direction, otherwise adds', () => {
    const once = toggleLink(withHighlights, { from: hl('h1'), to: hl('h2') })
    expect(once.links).toHaveLength(1)
    expect(toggleLink(once, { from: hl('h1'), to: hl('h2') }).links).toEqual([])
    expect(toggleLink(once, { from: hl('h2'), to: hl('h1') }).links).toEqual([])
    const other = toggleLink(once, { from: dc('doc'), to: hl('h2') })
    expect(other.links).toHaveLength(2)
    expect(toggleLink(withHighlights, { from: hl('h1'), to: hl('h1') })).toBe(withHighlights)
  })

  test('setLinkLabel sets, replaces, and clears the label', () => {
    const linked = addLink(withHighlights, { from: hl('h1'), to: hl('h2'), id: 'l' })
    expect(setLinkLabel(linked, 'l', ' echo ').links[0].label).toBe('echo')
    expect(setLinkLabel(setLinkLabel(linked, 'l', 'x'), 'l', '').links[0]).not.toHaveProperty('label')
    expect(setLinkLabel(linked, 'nope', 'x')).toBe(linked)
  })

  test('deleteLink removes only that link', () => {
    let s = addLink(withHighlights, { from: hl('h1'), to: hl('h2'), id: 'a' })
    s = addLink(s, { from: hl('h2'), to: hl('h1'), id: 'b' })
    expect(deleteLink(s, 'a').links.map((l) => l.id)).toEqual(['b'])
    expect(deleteLink(s, 'nope')).toBe(s)
  })
})

describe('removeHighlight / toggleHighlight', () => {
  const withData: State = {
    ...base,
    documents: [{ id: 'doc', text: '0123456789', createdAt: 'c' }],
    highlights: [
      { id: 'a', documentId: 'doc', start: 2, end: 8, presetId: 'p1' },
      { id: 'b', documentId: 'doc', start: 4, end: 6, presetId: 'p2' },
    ],
    links: [{ id: 'l', from: hl('a'), to: hl('b') }],
  }

  test('removeHighlight drops the highlight and its links', () => {
    const next = removeHighlight(withData, 'a')
    expect(next.highlights.map((h) => h.id)).toEqual(['b'])
    expect(next.links).toEqual([])
    expect(removeHighlight(withData, 'nope')).toBe(withData)
  })

  test('toggle on an exact match removes the highlight and its links', () => {
    const exact = toggleHighlight(withData, { documentId: 'doc', start: 2, end: 8, presetId: 'p1' })
    expect(exact.highlights.map((h) => h.id)).toEqual(['b'])
    expect(exact.links).toEqual([])
  })

  test('toggle on a partial range un-highlights just that range, keeping the id on the first piece', () => {
    const middle = toggleHighlight(withData, { documentId: 'doc', start: 3, end: 5, presetId: 'p1' })
    const pieces = middle.highlights.filter((h) => h.presetId === 'p1')
    expect(pieces.map((h) => [h.start, h.end])).toEqual([
      [2, 3],
      [5, 8],
    ])
    expect(pieces[0].id).toBe('a')
    expect(pieces[1].id).not.toBe('a')
    expect(middle.links).toEqual(withData.links) // link to 'a' survives on the left piece
    const fromStart = toggleHighlight(withData, { documentId: 'doc', start: 2, end: 4, presetId: 'p1' })
    expect(fromStart.highlights.find((h) => h.presetId === 'p1')).toMatchObject({ id: 'a', start: 4, end: 8 })
    const toEnd = toggleHighlight(withData, { documentId: 'doc', start: 6, end: 8, presetId: 'p1' })
    expect(toEnd.highlights.find((h) => h.presetId === 'p1')).toMatchObject({ id: 'a', start: 2, end: 6 })
  })

  test('toggle adds when the preset differs or the range is not covered', () => {
    const other = toggleHighlight(withData, { documentId: 'doc', start: 2, end: 8, presetId: 'p2', id: 'n' })
    expect(other.highlights.map((h) => h.id)).toEqual(['a', 'b', 'n'])
    const wider = toggleHighlight(withData, { documentId: 'doc', start: 1, end: 9, presetId: 'p1', id: 'w' })
    expect(wider.highlights.map((h) => h.id)).toEqual(['a', 'b', 'w'])
    expect(toggleHighlight(withData, { documentId: 'doc', start: 5, end: 5, presetId: 'p1' })).toBe(withData)
  })
})

describe('document rename, delete, open-or-focus', () => {
  const two: State = {
    ...base,
    documents: [
      { id: 'd1', title: 'One', text: 'aaaa', createdAt: 'c' },
      { id: 'd2', text: 'bbbb', createdAt: 'c' },
    ],
    highlights: [
      { id: 'h1', documentId: 'd1', start: 0, end: 2, presetId: 'p1' },
      { id: 'h2', documentId: 'd2', start: 0, end: 2, presetId: 'p1' },
    ],
    links: [
      { id: 'l', from: hl('h1'), to: hl('h2') },
      { id: 'ld', from: dc('d2'), to: dc('d1') },
      { id: 'keep', from: dc('d2'), to: hl('h2') },
    ],
    layouts: [
      {
        id: 'L',
        name: 'L',
        windows: [
          { id: 'w1', documentId: 'd1', x: 0, y: 0, width: 1, height: 1, z: 1 },
          { id: 'w1r', documentId: 'd1', range: { start: 0, end: 2 }, x: 0, y: 0, width: 1, height: 1, z: 2 },
          { id: 'w2', documentId: 'd2', x: 0, y: 0, width: 1, height: 1, z: 3 },
        ],
      },
    ],
  }
  const placement = { x: 0, y: 0, width: 10, height: 10, id: 'new' }

  test('setDocumentTitle sets, trims, and clears', () => {
    expect(setDocumentTitle(two, 'd2', '  Two ').documents[1].title).toBe('Two')
    expect(setDocumentTitle(two, 'd1', ' ').documents[0]).not.toHaveProperty('title')
    expect(setDocumentTitle(two, 'nope', 'x')).toBe(two)
  })

  test('deleteDocument removes the document, its highlights, links touching either, and its windows', () => {
    const next = deleteDocument(two, 'd1')
    expect(next.documents.map((d) => d.id)).toEqual(['d2'])
    expect(next.highlights.map((h) => h.id)).toEqual(['h2'])
    expect(next.links.map((l) => l.id)).toEqual(['keep'])
    expect(next.layouts[0].windows.map((w) => w.id)).toEqual(['w2'])
    expect(deleteDocument(two, 'nope')).toBe(two)
  })

  test('findOpenWindow ignores sub-range windows', () => {
    expect(findOpenWindow(two.layouts[0], 'd1')?.id).toBe('w1')
    const onlyRange = { ...two.layouts[0], windows: two.layouts[0].windows.filter((w) => w.id !== 'w1') }
    expect(findOpenWindow(onlyRange, 'd1')).toBeUndefined()
  })

  test('openDocument focuses an existing window instead of opening a duplicate', () => {
    const next = openDocument(two, 'L', 'd1', placement)
    const windows = next.layouts[0].windows
    expect(windows.map((w) => w.id)).toEqual(['w1', 'w1r', 'w2'])
    expect(windows.find((w) => w.id === 'w1')!.z).toBe(3)
  })

  test('openDocument opens a new window when none shows the whole document', () => {
    const closed = { ...two, layouts: [{ ...two.layouts[0], windows: two.layouts[0].windows.filter((w) => w.id !== 'w1') }] }
    const next = openDocument(closed, 'L', 'd1', placement)
    expect(next.layouts[0].windows.map((w) => w.id)).toEqual(['w1r', 'w2', 'new'])
    expect(openDocument(two, 'nope', 'd1', placement)).toBe(two)
  })
})

describe('queries', () => {
  const s: State = {
    ...base,
    documents: [{ id: 'doc', title: 'Doc', text: 'In the beginning was the Word, and the Word was with God.', createdAt: 'c' }],
    highlights: [
      { id: 'a', documentId: 'doc', start: 0, end: 16, presetId: 'p1' },
      { id: 'b', documentId: 'doc', start: 0, end: 16, presetId: 'p2' }, // same range, other preset
      { id: 'c', documentId: 'doc', start: 4, end: 10, presetId: 'p2' }, // inside a
      { id: 'd', documentId: 'doc', start: 21, end: 29, presetId: 'p1' }, // elsewhere
    ],
  }

  test('activePresetsFor lists presets of highlights covering the armed range', () => {
    expect([...activePresetsFor(s, 'a')].sort()).toEqual(['p1', 'p2'])
    expect([...activePresetsFor(s, 'c')].sort()).toEqual(['p1', 'p2']) // a and b cover c
    expect([...activePresetsFor(s, 'd')]).toEqual(['p1'])
    expect(activePresetsFor(s, 'nope').size).toBe(0)
  })

  test('describeLinkEnd names documents and quotes highlight excerpts', () => {
    expect(describeLinkEnd(s, { kind: 'document', id: 'doc' })).toBe('Doc')
    expect(describeLinkEnd(s, { kind: 'highlight', id: 'a' })).toBe('“In the beginning” (Doc)')
    expect(describeLinkEnd(s, { kind: 'highlight', id: 'a' }, 8)).toBe('“In the …” (Doc)')
    expect(describeLinkEnd(s, { kind: 'document', id: 'x' })).toBe('(missing document)')
    expect(describeLinkEnd(s, { kind: 'highlight', id: 'x' })).toBe('(missing highlight)')
  })
})
