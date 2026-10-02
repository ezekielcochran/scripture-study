import { describe, expect, test } from 'vitest'
import {
  activePresetsFor,
  addHighlight,
  addLink,
  addPreset,
  addWorkspace,
  bringToFront,
  closeWindow,
  createBlock,
  createNote,
  createPortal,
  createWorkspaceWithPortal,
  deleteBlock,
  deleteLink,
  deletePortal,
  deletePreset,
  deleteWorkspace,
  describeLinkEnd,
  editBlock,
  findOpenWindow,
  linksIn,
  movePortal,
  movePreset,
  moveWindow,
  nextWindowPlacement,
  notePlacement,
  openBlock,
  openWindow,
  presetForShortcut,
  presetsIn,
  removeHighlight,
  renameWorkspace,
  resizeWindow,
  setBlockTitle,
  setLinkLabel,
  shortcutConflict,
  switchWorkspace,
  toggleHighlight,
  toggleLink,
  updatePreset,
  elementShowingEnd,
  windowsIn,
} from './actions'
import type { State, Window } from './types'

const hl = (id: string) => ({ kind: 'highlight' as const, id })
const bk = (id: string) => ({ kind: 'block' as const, id })
const WS = 'ws'
const win = (id: string, blockId: string, z: number, extra: Partial<Window> = {}): Window => ({
  id,
  blockId,
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  z,
  ...extra,
})

const base: State = {
  workspaces: [{ id: WS, name: 'main' }],
  blocks: [{ id: 'doc', workspaceId: WS, text: 'hello world', createdAt: '2026-01-01T00:00:00.000Z' }],
  presets: [
    { id: 'p1', workspaceId: WS, name: 'One', style: { bold: true }, shortcut: '1' },
    { id: 'p2', workspaceId: WS, name: 'Two', style: { italic: true } },
  ],
  highlights: [],
  links: [],
  windows: [],
  portals: [],
  currentWorkspaceId: WS,
}

describe('addHighlight', () => {
  test('adds a highlight and leaves the input untouched', () => {
    const next = addHighlight(base, { blockId: 'doc', start: 0, end: 5, presetId: 'p1', id: 'h' })
    expect(next.highlights).toEqual([{ id: 'h', blockId: 'doc', start: 0, end: 5, presetId: 'p1' }])
    expect(base.highlights).toEqual([])
  })

  test('generates an id when none is given', () => {
    const next = addHighlight(base, { blockId: 'doc', start: 0, end: 5, presetId: 'p1' })
    expect(next.highlights[0].id).toMatch(/^hl-/)
  })

  test('clamps to the block text', () => {
    const next = addHighlight(base, { blockId: 'doc', start: -3, end: 99, presetId: 'p1' })
    expect(next.highlights[0]).toMatchObject({ start: 0, end: 11 })
  })

  test('refuses an id that is already in use', () => {
    const once = addHighlight(base, { blockId: 'doc', start: 0, end: 5, presetId: 'p1', id: 'h' })
    expect(addHighlight(once, { blockId: 'doc', start: 6, end: 9, presetId: 'p2', id: 'h' })).toBe(once)
  })

  test('ignores empty ranges, unknown blocks, and unknown presets', () => {
    expect(addHighlight(base, { blockId: 'doc', start: 3, end: 3, presetId: 'p1' })).toBe(base)
    expect(addHighlight(base, { blockId: 'nope', start: 0, end: 3, presetId: 'p1' })).toBe(base)
    expect(addHighlight(base, { blockId: 'doc', start: 0, end: 3, presetId: 'nope' })).toBe(base)
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

describe('editBlock', () => {
  const withData: State = {
    ...base,
    blocks: [
      { id: 'doc', workspaceId: WS, text: '0123456789', createdAt: 'c' },
      { id: 'other-doc', workspaceId: WS, text: 'abc', createdAt: 'c' },
    ],
    highlights: [
      { id: 'a', blockId: 'doc', start: 2, end: 5, presetId: 'p1' },
      { id: 'b', blockId: 'doc', start: 6, end: 9, presetId: 'p2' },
      { id: 'other', blockId: 'other-doc', start: 0, end: 3, presetId: 'p1' },
    ],
    links: [
      { id: 'l1', from: hl('a'), to: hl('b') },
      { id: 'l2', from: hl('b'), to: hl('other') },
    ],
    windows: [win('w1', 'doc', 0, { range: { start: 5, end: 10 } }), win('w2', 'doc', 0)],
  }

  test('updates text and shifts ranges in one transaction', () => {
    const next = editBlock(withData, 'doc', { position: 0, deletedLength: 0, insertedText: 'XY' })
    expect(next.blocks[0].text).toBe('XY0123456789')
    expect(next.highlights.map((h) => [h.id, h.start, h.end])).toEqual([
      ['a', 4, 7],
      ['b', 8, 11],
      ['other', 0, 3],
    ])
    expect(next.windows[0].range).toEqual({ start: 7, end: 12 })
    expect(next.links).toEqual(withData.links)
  })

  test('removes a fully deleted highlight and its links', () => {
    const next = editBlock(withData, 'doc', { position: 2, deletedLength: 3, insertedText: '' })
    expect(next.blocks[0].text).toBe('0156789')
    expect(next.highlights.map((h) => h.id)).toEqual(['b', 'other'])
    expect(next.links.map((l) => l.id)).toEqual(['l2'])
  })

  test('a window whose sub-range is deleted shows the whole block', () => {
    const next = editBlock(withData, 'doc', { position: 5, deletedLength: 5, insertedText: '' })
    expect(next.windows[0]).not.toHaveProperty('range')
    expect(next.windows[1]).toEqual(withData.windows[1])
  })

  test('typing at the end of a window sub-range keeps the text in the window', () => {
    const next = editBlock(withData, 'doc', { position: 10, deletedLength: 0, insertedText: '!' })
    expect(next.windows[0].range).toEqual({ start: 5, end: 11 })
  })

  test('ignores unknown blocks and out-of-bounds edits', () => {
    expect(editBlock(withData, 'nope', { position: 0, deletedLength: 0, insertedText: 'x' })).toBe(withData)
    expect(editBlock(withData, 'doc', { position: 8, deletedLength: 5, insertedText: '' })).toBe(withData)
  })

  test('does not mutate the input state', () => {
    const snapshot = JSON.stringify(withData)
    editBlock(withData, 'doc', { position: 0, deletedLength: 10, insertedText: 'gone' })
    expect(JSON.stringify(withData)).toBe(snapshot)
  })
})

describe('createBlock / notes', () => {
  const placement = { x: 10, y: 20, width: 300, height: 200, id: 'w1' }
  const withWindow: State = { ...base, windows: [win('w0', 'doc', 5)] }

  test('adds the block and a window above existing ones', () => {
    const next = createBlock(withWindow, WS, { text: 'body', title: ' T ', id: 'd1', createdAt: 'c' }, placement)
    expect(next.blocks.at(-1)).toEqual({ id: 'd1', workspaceId: WS, text: 'body', title: 'T', createdAt: 'c' })
    expect(next.windows.at(-1)).toEqual({ id: 'w1', blockId: 'd1', x: 10, y: 20, width: 300, height: 200, z: 6 })
  })

  test('omits an empty title and generates ids', () => {
    const next = createBlock(withWindow, WS, { text: 'body', title: '  ' }, { ...placement, id: undefined })
    const block = next.blocks.at(-1)!
    expect(block).not.toHaveProperty('title')
    expect(block.id).toMatch(/^blk-/)
    expect(next.windows.at(-1)!.id).toMatch(/^win-/)
  })

  test('ignores an unknown workspace', () => {
    expect(createBlock(withWindow, 'nope', { text: 'x' }, placement)).toBe(withWindow)
  })

  test('createNote adds a note block, its window, and a link to what it is about', () => {
    const s: State = { ...base, highlights: [{ id: 'h', blockId: 'doc', start: 0, end: 3, presetId: 'p1' }] }
    const next = createNote(s, WS, { text: 'thoughts', id: 'n1' }, placement, bk('doc'))
    expect(next.blocks.at(-1)).toMatchObject({ id: 'n1', text: 'thoughts', kind: 'note', workspaceId: WS })
    expect(next.windows.at(-1)).toMatchObject({ id: 'w1', blockId: 'n1' })
    expect(next.links).toEqual([expect.objectContaining({ from: bk('n1'), to: bk('doc') })])
    const aboutHighlight = createNote(s, WS, { text: 'x', id: 'n2' }, placement, hl('h'))
    expect(aboutHighlight.links).toEqual([expect.objectContaining({ from: bk('n2'), to: hl('h') })])
    expect(createNote(s, WS, { text: 'x', id: 'n3' }, placement).links).toEqual([])
    expect(createNote(s, WS, { text: 'x' }, placement, bk('missing'))).toBe(s)
  })

  test('notePlacement and elementShowingEnd', () => {
    const source = win('w', 'doc', 1, { x: 100, y: 50, width: 340, height: 200 })
    expect(notePlacement(source, { width: 300, height: 200 })).toEqual({ x: 464, y: 50, width: 300, height: 200 })
    const s: State = {
      ...base,
      windows: [source],
      highlights: [{ id: 'h', blockId: 'doc', start: 0, end: 3, presetId: 'p1' }],
      portals: [{ id: 'pa', pairId: 'pr', workspaceId: WS, targetWorkspaceId: 'x', x: 5, y: 6, z: 1 }],
    }
    expect(elementShowingEnd(s, bk('doc'))).toMatchObject({ x: 100, y: 50 })
    expect(elementShowingEnd(s, hl('h'))).toMatchObject({ x: 100, y: 50 })
    expect(elementShowingEnd(s, { kind: 'portal', id: 'pa' })).toEqual({ x: 5, y: 6, width: 200, height: 100 })
    expect(elementShowingEnd(s, hl('nope'))).toBeUndefined()
  })

  test('nextWindowPlacement centres the first window and steps later ones diagonally', () => {
    const center = { x: 500, y: 400 }
    expect(nextWindowPlacement(0, center, { width: 400, height: 200 }, 20)).toEqual({ x: 300, y: 300, width: 400, height: 200 })
    expect(nextWindowPlacement(2, center, { width: 400, height: 200 }, 20)).toEqual({ x: 340, y: 340, width: 400, height: 200 })
  })
})

describe('presets', () => {
  const withHighlights: State = {
    ...base,
    highlights: [
      { id: 'h1', blockId: 'doc', start: 0, end: 2, presetId: 'p1' },
      { id: 'h2', blockId: 'doc', start: 3, end: 5, presetId: 'p2' },
    ],
    links: [{ id: 'l', from: hl('h1'), to: hl('h2') }],
  }

  test('addPreset appends to its workspace and omits an empty shortcut', () => {
    const next = addPreset(base, { workspaceId: WS, name: 'N', style: { italic: true }, shortcut: '', id: 'p3' })
    expect(next.presets.at(-1)).toEqual({ id: 'p3', workspaceId: WS, name: 'N', style: { italic: true } })
    expect(addPreset(base, { workspaceId: 'nope', name: 'N', style: {} })).toBe(base)
  })

  test('updatePreset merges style and can set or clear the shortcut', () => {
    let next = updatePreset(base, 'p1', { name: 'Renamed', style: { color: 'red' } })
    expect(next.presets[0]).toEqual({ id: 'p1', workspaceId: WS, name: 'Renamed', style: { bold: true, color: 'red' }, shortcut: '1' })
    next = updatePreset(next, 'p1', { shortcut: undefined })
    expect(next.presets[0]).not.toHaveProperty('shortcut')
    expect(updatePreset(base, 'nope', { name: 'x' })).toBe(base)
  })

  test('movePreset reorders within its workspace only', () => {
    const other: State = {
      ...base,
      workspaces: [...base.workspaces, { id: 'ws2', name: 'other' }],
      presets: [
        { id: 'q1', workspaceId: 'ws2', name: 'Q1', style: {} },
        ...base.presets,
        { id: 'p3', workspaceId: WS, name: 'C', style: {} },
      ],
    }
    const ids = (s: State) => s.presets.map((p) => p.id)
    expect(ids(movePreset(other, 'p3', -1))).toEqual(['q1', 'p1', 'p3', 'p2'])
    expect(ids(movePreset(other, 'p3', -5))).toEqual(['q1', 'p3', 'p1', 'p2'])
    expect(presetsIn(movePreset(other, 'p1', 1), WS).map((p) => p.id)).toEqual(['p2', 'p1', 'p3'])
    expect(movePreset(other, 'p3', 1)).toBe(other)
    expect(movePreset(other, 'nope', -1)).toBe(other)
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
  const withWindows: State = { ...base, windows: [win('a', 'doc', 1), win('b', 'doc', 2), win('c', 'doc', 3)] }

  test('moveWindow updates position only', () => {
    const next = moveWindow(withWindows, 'a', { x: 10, y: -5 })
    expect(next.windows[0]).toEqual({ ...win('a', 'doc', 1), x: 10, y: -5 })
    expect(next.windows.slice(1)).toEqual(withWindows.windows.slice(1))
    expect(moveWindow(withWindows, 'nope', { x: 1, y: 1 })).toBe(withWindows)
  })

  test('resizeWindow updates size and rejects non-positive sizes', () => {
    expect(resizeWindow(withWindows, 'b', { width: 300, height: 200 }).windows[1]).toMatchObject({ width: 300, height: 200 })
    expect(resizeWindow(withWindows, 'b', { width: 0, height: 200 })).toBe(withWindows)
  })

  test('bringToFront puts the window on top with compact z values, and is a no-op when already on top', () => {
    expect(bringToFront(withWindows, 'a').windows.map((x) => x.z)).toEqual([3, 1, 2])
    const sparse = { ...withWindows, windows: [win('a', 'doc', 10), win('b', 'doc', 50), win('c', 'doc', 70)] }
    expect(bringToFront(sparse, 'b').windows.map((x) => x.z)).toEqual([1, 3, 2])
    expect(bringToFront(withWindows, 'c')).toBe(withWindows)
    expect(bringToFront(withWindows, 'nope')).toBe(withWindows)
  })

  test('closeWindow removes only that window and keeps the block', () => {
    const next = closeWindow(withWindows, 'b')
    expect(next.windows.map((x) => x.id)).toEqual(['a', 'c'])
    expect(next.blocks).toBe(withWindows.blocks)
    expect(closeWindow(withWindows, 'nope')).toBe(withWindows)
  })

  test('openWindow adds a window for an existing block on top', () => {
    const next = openWindow(withWindows, 'doc', { x: 1, y: 2, width: 50, height: 40, id: 'd' })
    expect(next.windows.at(-1)).toEqual({ id: 'd', blockId: 'doc', x: 1, y: 2, width: 50, height: 40, z: 4 })
    expect(openWindow(withWindows, 'missing', { x: 1, y: 2, width: 50, height: 40 })).toBe(withWindows)
  })
})

describe('block rename, delete, open-or-focus', () => {
  const two: State = {
    ...base,
    blocks: [
      { id: 'd1', workspaceId: WS, title: 'One', text: 'aaaa', createdAt: 'c' },
      { id: 'd2', workspaceId: WS, text: 'bbbb', createdAt: 'c' },
    ],
    highlights: [
      { id: 'h1', blockId: 'd1', start: 0, end: 2, presetId: 'p1' },
      { id: 'h2', blockId: 'd2', start: 0, end: 2, presetId: 'p1' },
    ],
    links: [
      { id: 'l', from: hl('h1'), to: hl('h2') },
      { id: 'ld', from: bk('d2'), to: bk('d1') },
      { id: 'keep', from: bk('d2'), to: hl('h2') },
    ],
    windows: [win('w1', 'd1', 1), win('w1r', 'd1', 2, { range: { start: 0, end: 2 } }), win('w2', 'd2', 3)],
  }
  const placement = { x: 0, y: 0, width: 10, height: 10, id: 'new' }

  test('setBlockTitle sets, trims, and clears', () => {
    expect(setBlockTitle(two, 'd2', '  Two ').blocks[1].title).toBe('Two')
    expect(setBlockTitle(two, 'd1', ' ').blocks[0]).not.toHaveProperty('title')
    expect(setBlockTitle(two, 'nope', 'x')).toBe(two)
  })

  test('deleteBlock removes the block, its highlights, links touching either, and its windows', () => {
    const next = deleteBlock(two, 'd1')
    expect(next.blocks.map((b) => b.id)).toEqual(['d2'])
    expect(next.highlights.map((h) => h.id)).toEqual(['h2'])
    expect(next.links.map((l) => l.id)).toEqual(['keep'])
    expect(next.windows.map((w) => w.id)).toEqual(['w2'])
    expect(deleteBlock(two, 'nope')).toBe(two)
  })

  test('findOpenWindow ignores sub-range windows', () => {
    expect(findOpenWindow(two, 'd1')?.id).toBe('w1')
    expect(findOpenWindow({ ...two, windows: two.windows.filter((w) => w.id !== 'w1') }, 'd1')).toBeUndefined()
  })

  test('openBlock focuses an existing window instead of opening a duplicate', () => {
    const next = openBlock(two, 'd1', placement)
    expect(next.windows.map((w) => w.id)).toEqual(['w1', 'w1r', 'w2'])
    expect(next.windows.find((w) => w.id === 'w1')!.z).toBe(3)
  })

  test('openBlock opens a new window when none shows the whole block', () => {
    const closed = { ...two, windows: two.windows.filter((w) => w.id !== 'w1') }
    expect(openBlock(closed, 'd1', placement).windows.map((w) => w.id)).toEqual(['w1r', 'w2', 'new'])
  })
})

describe('links', () => {
  const withHighlights: State = {
    ...base,
    blocks: [...base.blocks, { id: 'doc2', workspaceId: WS, text: 'other', createdAt: 'c' }],
    highlights: [
      { id: 'h1', blockId: 'doc', start: 0, end: 2, presetId: 'p1' },
      { id: 'h2', blockId: 'doc', start: 3, end: 5, presetId: 'p2' },
    ],
  }

  test('addLink links two highlights and trims the label', () => {
    const next = addLink(withHighlights, { from: hl('h1'), to: hl('h2'), label: ' cf. ', id: 'l' })
    expect(next.links).toEqual([{ id: 'l', from: hl('h1'), to: hl('h2'), label: 'cf.' }])
    expect(addLink(withHighlights, { from: hl('h1'), to: hl('h2'), label: ' ' }).links[0]).not.toHaveProperty('label')
  })

  test('addLink supports every combination of highlight and block ends', () => {
    let s = addLink(withHighlights, { from: hl('h1'), to: bk('doc2'), id: 'a' })
    s = addLink(s, { from: bk('doc'), to: hl('h2'), id: 'b' })
    s = addLink(s, { from: bk('doc'), to: bk('doc2'), id: 'c' })
    expect(s.links.map((l) => [l.from.kind, l.to.kind])).toEqual([
      ['highlight', 'block'],
      ['block', 'highlight'],
      ['block', 'block'],
    ])
  })

  test('addLink rejects self-links, unknown ends, and exact duplicates', () => {
    expect(addLink(withHighlights, { from: hl('h1'), to: hl('h1') })).toBe(withHighlights)
    expect(addLink(withHighlights, { from: bk('doc'), to: bk('doc') })).toBe(withHighlights)
    expect(addLink(withHighlights, { from: hl('h1'), to: hl('nope') })).toBe(withHighlights)
    const once = addLink(withHighlights, { from: hl('h1'), to: hl('h2') })
    expect(addLink(once, { from: hl('h1'), to: hl('h2') })).toBe(once)
    expect(addLink(once, { from: hl('h2'), to: hl('h1') }).links).toHaveLength(2)
  })

  test('toggleLink removes an existing link in either direction, otherwise adds', () => {
    const once = toggleLink(withHighlights, { from: hl('h1'), to: hl('h2') })
    expect(once.links).toHaveLength(1)
    expect(toggleLink(once, { from: hl('h1'), to: hl('h2') }).links).toEqual([])
    expect(toggleLink(once, { from: hl('h2'), to: hl('h1') }).links).toEqual([])
    expect(toggleLink(once, { from: bk('doc'), to: hl('h2') }).links).toHaveLength(2)
  })

  test('setLinkLabel and deleteLink', () => {
    const linked = addLink(withHighlights, { from: hl('h1'), to: hl('h2'), id: 'l' })
    expect(setLinkLabel(linked, 'l', ' echo ').links[0].label).toBe('echo')
    expect(setLinkLabel(setLinkLabel(linked, 'l', 'x'), 'l', '').links[0]).not.toHaveProperty('label')
    expect(deleteLink(linked, 'l').links).toEqual([])
    expect(deleteLink(linked, 'nope')).toBe(linked)
  })

  test('linksIn scopes links to a workspace through their blocks', () => {
    const s: State = {
      ...withHighlights,
      workspaces: [...base.workspaces, { id: 'ws2', name: 'o' }],
      blocks: [...withHighlights.blocks, { id: 'far', workspaceId: 'ws2', text: 'f', createdAt: 'c' }],
      links: [
        { id: 'in', from: hl('h1'), to: bk('doc2') },
        { id: 'out', from: bk('far'), to: bk('far') },
      ],
    }
    expect(linksIn(s, WS).map((l) => l.id)).toEqual(['in'])
    expect(linksIn(s, 'ws2').map((l) => l.id)).toEqual(['out'])
  })
})

describe('removeHighlight / toggleHighlight', () => {
  const withData: State = {
    ...base,
    blocks: [{ id: 'doc', workspaceId: WS, text: '0123456789', createdAt: 'c' }],
    highlights: [
      { id: 'a', blockId: 'doc', start: 2, end: 8, presetId: 'p1' },
      { id: 'b', blockId: 'doc', start: 4, end: 6, presetId: 'p2' },
    ],
    links: [{ id: 'l', from: hl('a'), to: hl('b') }],
  }

  test('removeHighlight drops the highlight and its links', () => {
    const next = removeHighlight(withData, 'a')
    expect(next.highlights.map((h) => h.id)).toEqual(['b'])
    expect(next.links).toEqual([])
  })

  test('toggle on an exact match removes the highlight and its links', () => {
    const exact = toggleHighlight(withData, { blockId: 'doc', start: 2, end: 8, presetId: 'p1' })
    expect(exact.highlights.map((h) => h.id)).toEqual(['b'])
    expect(exact.links).toEqual([])
  })

  test('toggle on a partial range un-highlights just that range, keeping the id on the first piece', () => {
    const middle = toggleHighlight(withData, { blockId: 'doc', start: 3, end: 5, presetId: 'p1' })
    const pieces = middle.highlights.filter((h) => h.presetId === 'p1')
    expect(pieces.map((h) => [h.start, h.end])).toEqual([
      [2, 3],
      [5, 8],
    ])
    expect(pieces[0].id).toBe('a')
    expect(middle.links).toEqual(withData.links)
  })

  test('toggle adds when the preset differs or the range is not covered', () => {
    expect(toggleHighlight(withData, { blockId: 'doc', start: 2, end: 8, presetId: 'p2', id: 'n' }).highlights.map((h) => h.id)).toEqual(['a', 'b', 'n'])
    expect(toggleHighlight(withData, { blockId: 'doc', start: 5, end: 5, presetId: 'p1' })).toBe(withData)
  })
})

describe('queries', () => {
  const s: State = {
    ...base,
    blocks: [{ id: 'doc', workspaceId: WS, title: 'Doc', text: 'In the beginning was the Word, and the Word was with God.', createdAt: 'c' }],
    highlights: [
      { id: 'a', blockId: 'doc', start: 0, end: 16, presetId: 'p1' },
      { id: 'b', blockId: 'doc', start: 0, end: 16, presetId: 'p2' },
      { id: 'c', blockId: 'doc', start: 4, end: 10, presetId: 'p2' },
    ],
  }

  test('activePresetsFor lists presets of highlights covering the armed range', () => {
    expect([...activePresetsFor(s, 'a')].sort()).toEqual(['p1', 'p2'])
    expect([...activePresetsFor(s, 'c')].sort()).toEqual(['p1', 'p2'])
    expect(activePresetsFor(s, 'nope').size).toBe(0)
  })

  test('describeLinkEnd names blocks and quotes highlight excerpts', () => {
    expect(describeLinkEnd(s, bk('doc'))).toBe('Doc')
    expect(describeLinkEnd(s, hl('a'))).toBe('“In the beginning” (Doc)')
    expect(describeLinkEnd(s, hl('a'), 8)).toBe('“In the …” (Doc)')
    expect(describeLinkEnd(s, bk('x'))).toBe('(missing block)')
    expect(describeLinkEnd(s, hl('x'))).toBe('(missing highlight)')
  })
})

describe('workspaces and portals', () => {
  const placement = { x: 10, y: 20 }

  test('addWorkspace copies the parent presets with fresh ids; rename and switch', () => {
    const next = addWorkspace(base, '  Study  ', 'ws2', WS)
    expect(next.workspaces).toEqual([...base.workspaces, { id: 'ws2', name: 'Study' }])
    const copies = presetsIn(next, 'ws2')
    expect(copies.map((p) => p.name)).toEqual(['One', 'Two'])
    expect(copies.every((p) => p.id !== 'p1' && p.id !== 'p2')).toBe(true)
    expect(presetsIn(next, WS)).toEqual(base.presets)
    expect(addWorkspace(base, '   ', 'ws3').workspaces.at(-1)?.name).toBe('untitled')
    expect(renameWorkspace(next, 'ws2', ' Notes ').workspaces[1].name).toBe('Notes')
    expect(renameWorkspace(next, 'ws2', '  ').workspaces[1].name).toBe('Study')
    expect(switchWorkspace(next, 'ws2').currentWorkspaceId).toBe('ws2')
    expect(switchWorkspace(next, 'nope')).toBe(next)
    expect(switchWorkspace(next, WS)).toBe(next)
  })

  test('createPortal adds both sides sharing a pairId, above existing elements', () => {
    const two = addWorkspace({ ...base, windows: [win('w', 'doc', 4)] }, 'Other', 'ws2')
    const next = createPortal(two, WS, 'ws2', placement, { pairId: 'pair', ids: ['pa', 'pb'] })
    expect(next.portals).toEqual([
      { id: 'pa', pairId: 'pair', workspaceId: WS, targetWorkspaceId: 'ws2', x: 10, y: 20, z: 5 },
      { id: 'pb', pairId: 'pair', workspaceId: 'ws2', targetWorkspaceId: WS, x: 160, y: 280, z: 1 },
    ])
    expect(createPortal(two, WS, WS, placement)).toBe(two)
    expect(createPortal(two, WS, 'nope', placement)).toBe(two)
  })

  test('createWorkspaceWithPortal makes the workspace (with inherited presets) and the pair in one change', () => {
    const next = createWorkspaceWithPortal(base, WS, 'Deep', placement, { workspaceId: 'ws2', pairId: 'pair', ids: ['pa', 'pb'] })
    expect(next.workspaces.at(-1)).toEqual({ id: 'ws2', name: 'Deep' })
    expect(presetsIn(next, 'ws2')).toHaveLength(2)
    expect(next.portals.map((p) => [p.workspaceId, p.targetWorkspaceId])).toEqual([
      [WS, 'ws2'],
      ['ws2', WS],
    ])
    expect(createWorkspaceWithPortal(base, 'nope', 'x', placement)).toBe(base)
  })

  test('links can end on portals; deleting the pair prunes them', () => {
    let s = createWorkspaceWithPortal(base, WS, 'Deep', placement, { workspaceId: 'ws2', pairId: 'pair', ids: ['pa', 'pb'] })
    const pa = { kind: 'portal' as const, id: 'pa' }
    s = addLink(s, { from: bk('doc'), to: pa, id: 'l1' })
    s = addLink(s, { from: pa, to: bk('doc'), id: 'l2' })
    expect(s.links.map((l) => l.id)).toEqual(['l1', 'l2'])
    expect(addLink(s, { from: pa, to: { kind: 'portal', id: 'nope' } })).toBe(s)
    expect(describeLinkEnd(s, pa)).toBe('Portal → Deep')
    expect(describeLinkEnd(s, { kind: 'portal', id: 'nope' })).toBe('(missing portal)')
    expect(linksIn(s, WS).map((l) => l.id)).toEqual(['l1', 'l2'])
    expect(linksIn(s, 'ws2')).toEqual([])
    expect(deletePortal(s, 'pb').links).toEqual([])
    // Deleting the far workspace removes the pair and therefore the links too.
    expect(deleteWorkspace(s, 'ws2').links).toEqual([])
  })

  test('deletePortal removes both sides; movePortal moves one', () => {
    const s = createWorkspaceWithPortal(base, WS, 'Deep', placement, { workspaceId: 'ws2', pairId: 'pair', ids: ['pa', 'pb'] })
    expect(deletePortal(s, 'pb').portals).toEqual([])
    expect(deletePortal(s, 'nope')).toBe(s)
    expect(movePortal(s, 'pa', { x: 1, y: 2 }).portals[0]).toMatchObject({ x: 1, y: 2 })
    expect(movePortal(s, 'pa', { x: 1, y: 2 }).portals[1]).toEqual(s.portals[1])
  })

  test('bringToFront orders windows and portals together within a workspace', () => {
    let s = createWorkspaceWithPortal({ ...base, windows: [win('w', 'doc', 1)] }, WS, 'Deep', placement, { workspaceId: 'ws2', ids: ['pa', 'pb'] })
    expect(s.portals[0].z).toBe(2)
    s = bringToFront(s, 'w')
    expect(s.windows[0].z).toBe(2)
    expect(s.portals[0].z).toBe(1)
    expect(s.portals[1].z).toBe(1) // other workspace untouched
  })

  test('deleteWorkspace removes everything on it, portals to it, and its presets; never the last one', () => {
    let s = createWorkspaceWithPortal(base, WS, 'Deep', placement, { workspaceId: 'ws2', pairId: 'pair' })
    s = createBlock(s, 'ws2', { text: 'far', id: 'far' }, { x: 0, y: 0, width: 10, height: 10, id: 'wf' })
    s = addHighlight(s, { blockId: 'far', start: 0, end: 2, presetId: presetsIn(s, 'ws2')[0].id, id: 'hf' })
    s = addLink(s, { from: hl('hf'), to: bk('far'), id: 'lf' })
    s = switchWorkspace(s, 'ws2')
    const next = deleteWorkspace(s, 'ws2')
    expect(next.workspaces.map((w) => w.id)).toEqual([WS])
    expect(next.blocks.map((b) => b.id)).toEqual(['doc'])
    expect(next.highlights).toEqual([])
    expect(next.links).toEqual([])
    expect(next.windows).toEqual([])
    expect(next.portals).toEqual([])
    expect(presetsIn(next, 'ws2')).toEqual([])
    expect(next.currentWorkspaceId).toBe(WS)
    expect(deleteWorkspace(base, WS)).toBe(base)
    expect(windowsIn(s, 'ws2').map((w) => w.id)).toEqual(['wf'])
  })
})
