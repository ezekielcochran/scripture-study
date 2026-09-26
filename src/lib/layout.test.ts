import { describe, expect, test } from 'vitest'
import { applyNodeChangesToState, historyOptionsForChanges, layoutToNodes, linksToEdges } from './layout'
import type { State } from '../model/types'

const hl = (id: string) => ({ kind: 'highlight' as const, id })
const dc = (id: string) => ({ kind: 'document' as const, id })

const state: State = {
  documents: [{ id: 'doc', text: 'x', createdAt: 'c' }],
  presets: [],
  highlights: [],
  links: [],
  layouts: [
    {
      id: 'L',
      name: 'L',
      windows: [
        { id: 'a', documentId: 'doc', x: 0, y: 0, width: 100, height: 80, z: 1 },
        { id: 'b', documentId: 'doc', x: 5, y: 5, width: 100, height: 80, z: 2 },
      ],
    },
  ],
}

test('layoutToNodes maps windows to draggable-by-header nodes', () => {
  const nodes = layoutToNodes(state.layouts[0])
  expect(nodes[0]).toMatchObject({ id: 'a', type: 'window', position: { x: 0, y: 0 }, width: 100, height: 80, zIndex: 2 })
  expect(nodes[0].dragHandle).toBe('.window-drag-handle')
})

describe('applyNodeChangesToState', () => {
  const windows = (s: State) => s.layouts[0].windows

  test('position changes move the window', () => {
    const next = applyNodeChangesToState(state, [{ type: 'position', id: 'a', position: { x: 30, y: 40 }, dragging: true }])
    expect(windows(next)[0]).toMatchObject({ x: 30, y: 40 })
  })

  test('resizing dimension changes resize; measurement changes do not', () => {
    const resized = applyNodeChangesToState(state, [
      { type: 'dimensions', id: 'a', dimensions: { width: 200, height: 150 }, resizing: true },
    ])
    expect(windows(resized)[0]).toMatchObject({ width: 200, height: 150 })
    const measured = applyNodeChangesToState(state, [{ type: 'dimensions', id: 'a', dimensions: { width: 200, height: 150 } }])
    expect(measured).toBe(state)
  })

  test('selecting brings to front; deselecting and removal are ignored', () => {
    const next = applyNodeChangesToState(state, [{ type: 'select', id: 'a', selected: true }])
    expect(windows(next).map((w) => w.z)).toEqual([2, 1])
    expect(applyNodeChangesToState(state, [{ type: 'select', id: 'a', selected: false }])).toBe(state)
    expect(applyNodeChangesToState(state, [{ type: 'remove', id: 'a' }])).toBe(state)
  })
})

describe('linksToEdges', () => {
  const linked: State = {
    ...state,
    documents: [
      { id: 'doc', text: '0123456789', createdAt: 'c' },
      { id: 'doc2', text: 'abc', createdAt: 'c' },
    ],
    highlights: [
      { id: 'h1', documentId: 'doc', start: 0, end: 2, presetId: 'p' },
      { id: 'h2', documentId: 'doc', start: 8, end: 10, presetId: 'p' },
      { id: 'h3', documentId: 'doc2', start: 0, end: 1, presetId: 'p' },
    ],
    links: [
      { id: 'l1', from: hl('h1'), to: hl('h3'), label: 'cf.' },
      { id: 'l2', from: hl('h2'), to: hl('h1') },
      { id: 'dangling', from: hl('h1'), to: hl('gone') },
      { id: 'ld', from: dc('doc2'), to: hl('h2') },
      { id: 'dd', from: dc('doc'), to: dc('doc2') },
      { id: 'dgone', from: dc('nope'), to: dc('doc2') },
    ],
    layouts: [
      {
        id: 'L',
        name: 'L',
        windows: [
          { id: 'a', documentId: 'doc', x: 0, y: 0, width: 1, height: 1, z: 1 },
          { id: 'b', documentId: 'doc2', x: 0, y: 0, width: 1, height: 1, z: 2 },
          // Shows only the first half of doc, so h2 is not visible here.
          { id: 'c', documentId: 'doc', range: { start: 0, end: 5 }, x: 0, y: 0, width: 1, height: 1, z: 3 },
        ],
      },
    ],
  }

  /** The middle pieces only, with the part suffix stripped from ids. */
  const mids = (edges: ReturnType<typeof linksToEdges>) =>
    edges.filter((e) => e.data?.part === 'mid').map((e) => ({ ...e, id: e.id.replace(/:mid$/, '') }))

  test('produces three pieces per window pair showing both ends, with handles per highlight', () => {
    const edges = linksToEdges(linked, linked.layouts[0])
    expect(edges.length % 3).toBe(0)
    expect(mids(edges).filter((e) => e.id.startsWith('l')).map((e) => e.id).sort()).toEqual(
      ['l1:a:b', 'l1:c:b', 'l2:a:a', 'l2:a:c', 'ld:b:a'].sort(),
    )
    const e = mids(edges).find((x) => x.id === 'l1:a:b')!
    expect(e).toMatchObject({ type: 'link', source: 'a', sourceHandle: 'h1', target: 'b', targetHandle: 'h3', data: { linkId: 'l1', part: 'mid', label: 'cf.' } })
    expect(mids(edges).find((x) => x.id === 'l2:a:a')!.data).toEqual({ linkId: 'l2', part: 'mid' })
    expect(edges.filter((x) => x.id.startsWith('l1:a:b:')).map((x) => x.data?.part)).toEqual(['a', 'mid', 'b'])
  })

  test('document ends attach to the header handle of every window showing the document', () => {
    const edges = mids(linksToEdges(linked, linked.layouts[0]))
    expect(edges.find((e) => e.id === 'ld:b:a')).toMatchObject({ sourceHandle: 'doc:doc2', targetHandle: 'h2' })
    // doc is shown by windows a and c; doc2 by b.
    expect(edges.filter((e) => e.id.startsWith('dd:')).map((e) => e.id).sort()).toEqual(['dd:a:b', 'dd:c:b'])
    expect(edges.some((e) => e.id.startsWith('dgone:'))).toBe(false)
  })

  test('leads sit above their own window, spans above the lower window, unless elevated', () => {
    const edges = linksToEdges(linked, linked.layouts[0])
    // a has z 1, b has z 2, c has z 3: nodes are 2, 4, 6.
    const z = (id: string) => edges.find((e) => e.id === id)!.zIndex
    expect([z('l1:a:b:a'), z('l1:a:b:mid'), z('l1:a:b:b')]).toEqual([3, 3, 5])
    expect([z('l1:c:b:a'), z('l1:c:b:mid'), z('l1:c:b:b')]).toEqual([7, 5, 5])
    expect(z('l2:a:a:mid')).toBe(3)
    const elevated = linksToEdges(linked, linked.layouts[0], { elevateLinkId: 'l1' })
    expect(elevated.find((e) => e.id === 'l1:a:b:mid')!.zIndex).toBeGreaterThan(1000)
    expect(elevated.find((e) => e.id === 'l2:a:a:mid')!.zIndex).toBe(3)
  })

  test('skips links whose highlights are missing or not shown', () => {
    const noWindows = { ...linked, layouts: [{ id: 'L', name: 'L', windows: [] }] }
    expect(linksToEdges(noWindows, noWindows.layouts[0])).toEqual([])
  })
})

describe('historyOptionsForChanges', () => {
  test('drags and resizes coalesce per window; selection is skipped', () => {
    expect(historyOptionsForChanges([{ type: 'position', id: 'a', position: { x: 1, y: 1 }, dragging: true }])).toEqual({
      key: 'move:a',
      within: Infinity,
    })
    expect(
      historyOptionsForChanges([{ type: 'dimensions', id: 'a', dimensions: { width: 1, height: 1 }, resizing: true }]),
    ).toEqual({ key: 'resize:a', within: Infinity })
    expect(historyOptionsForChanges([{ type: 'select', id: 'a', selected: true }])).toEqual({ skip: true })
    expect(historyOptionsForChanges([])).toEqual({})
  })
})
