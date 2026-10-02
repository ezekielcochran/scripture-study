import { describe, expect, test } from 'vitest'
import { applyNodeChangesToState, historyOptionsForChanges, layoutToNodes, linksToEdges } from './layout'
import type { State } from '../model/types'

const hl = (id: string) => ({ kind: 'highlight' as const, id })
const bk = (id: string) => ({ kind: 'block' as const, id })
const WS = 'ws'

const state: State = {
  workspaces: [{ id: WS, name: 'main' }, { id: 'ws2', name: 'other' }],
  blocks: [
    { id: 'doc', workspaceId: WS, text: '0123456789', createdAt: 'c' },
    { id: 'doc2', workspaceId: WS, text: 'abc', createdAt: 'c' },
    { id: 'far', workspaceId: 'ws2', text: 'far away', createdAt: 'c' },
  ],
  presets: [],
  highlights: [],
  links: [],
  windows: [
    { id: 'a', blockId: 'doc', x: 0, y: 0, width: 100, height: 80, z: 1 },
    { id: 'b', blockId: 'doc2', x: 5, y: 5, width: 100, height: 80, z: 2 },
    { id: 'f', blockId: 'far', x: 0, y: 0, width: 100, height: 80, z: 1 },
  ],
  portals: [
    { id: 'pa', pairId: 'pr', workspaceId: WS, targetWorkspaceId: 'ws2', x: 300, y: 300, z: 3 },
    { id: 'pb', pairId: 'pr', workspaceId: 'ws2', targetWorkspaceId: WS, x: 30, y: 30, z: 2 },
  ],
  currentWorkspaceId: WS,
}

test('layoutToNodes maps a workspace’s windows and portals to nodes', () => {
  const nodes = layoutToNodes(state, WS)
  expect(nodes.map((n) => [n.id, n.type])).toEqual([
    ['a', 'window'],
    ['b', 'window'],
    ['pa', 'portal'],
  ])
  expect(nodes[0]).toMatchObject({ position: { x: 0, y: 0 }, width: 100, height: 80, zIndex: 2, dragHandle: '.window-drag-handle' })
  expect(nodes[2]).toMatchObject({ position: { x: 300, y: 300 }, zIndex: 6, data: { portalId: 'pa' } })
  expect(layoutToNodes(state, 'ws2').map((n) => n.id)).toEqual(['f', 'pb'])
})

describe('applyNodeChangesToState', () => {
  test('position changes move windows and portals', () => {
    const next = applyNodeChangesToState(state, [
      { type: 'position', id: 'a', position: { x: 30, y: 40 }, dragging: true },
      { type: 'position', id: 'pa', position: { x: 1, y: 2 }, dragging: true },
    ])
    expect(next.windows[0]).toMatchObject({ x: 30, y: 40 })
    expect(next.portals[0]).toMatchObject({ x: 1, y: 2 })
  })

  test('resizing dimension changes resize; measurement changes do not', () => {
    const resized = applyNodeChangesToState(state, [{ type: 'dimensions', id: 'a', dimensions: { width: 200, height: 150 }, resizing: true }])
    expect(resized.windows[0]).toMatchObject({ width: 200, height: 150 })
    expect(applyNodeChangesToState(state, [{ type: 'dimensions', id: 'a', dimensions: { width: 200, height: 150 } }])).toBe(state)
  })

  test('selecting brings to front across windows and portals; deselecting and removal are ignored', () => {
    const next = applyNodeChangesToState(state, [{ type: 'select', id: 'a', selected: true }])
    expect(next.windows.filter((w) => w.blockId !== 'far').map((w) => w.z)).toEqual([3, 1])
    expect(next.portals[0].z).toBe(2)
    expect(applyNodeChangesToState(state, [{ type: 'select', id: 'a', selected: false }])).toBe(state)
    expect(applyNodeChangesToState(state, [{ type: 'remove', id: 'a' }])).toBe(state)
  })
})

describe('historyOptionsForChanges', () => {
  test('drags and resizes coalesce per element; selection is skipped', () => {
    expect(historyOptionsForChanges([{ type: 'position', id: 'a', position: { x: 1, y: 1 }, dragging: true }])).toEqual({ key: 'move:a', within: Infinity })
    expect(historyOptionsForChanges([{ type: 'dimensions', id: 'a', dimensions: { width: 1, height: 1 }, resizing: true }])).toEqual({ key: 'resize:a', within: Infinity })
    expect(historyOptionsForChanges([{ type: 'select', id: 'a', selected: true }])).toEqual({ skip: true })
    expect(historyOptionsForChanges([])).toEqual({})
  })
})

describe('linksToEdges', () => {
  const linked: State = {
    ...state,
    highlights: [
      { id: 'h1', blockId: 'doc', start: 0, end: 2, presetId: 'p' },
      { id: 'h2', blockId: 'doc', start: 8, end: 10, presetId: 'p' },
      { id: 'h3', blockId: 'doc2', start: 0, end: 1, presetId: 'p' },
    ],
    links: [
      { id: 'l1', from: hl('h1'), to: hl('h3'), label: 'cf.' },
      { id: 'l2', from: hl('h2'), to: hl('h1') },
      { id: 'dangling', from: hl('h1'), to: hl('gone') },
      { id: 'ld', from: bk('doc2'), to: hl('h2') },
      { id: 'dd', from: bk('doc'), to: bk('doc2') },
      { id: 'far', from: bk('far'), to: bk('far') },
    ],
    windows: [
      ...state.windows,
      // Shows only the first half of doc, so h2 is not visible here.
      { id: 'c', blockId: 'doc', range: { start: 0, end: 5 }, x: 0, y: 0, width: 1, height: 1, z: 3 },
    ],
  }
  const mids = (edges: ReturnType<typeof linksToEdges>) =>
    edges.filter((e) => e.data?.part === 'mid').map((e) => ({ ...e, id: e.id.replace(/:mid$/, '') }))

  test('produces three pieces per window pair showing both ends, scoped to the workspace', () => {
    const edges = linksToEdges(linked, WS)
    expect(edges.length % 3).toBe(0)
    expect(mids(edges).filter((e) => e.id.startsWith('l')).map((e) => e.id).sort()).toEqual(
      ['l1:a:b', 'l1:c:b', 'l2:a:a', 'l2:a:c', 'ld:b:a'].sort(),
    )
    expect(mids(edges).find((x) => x.id === 'l1:a:b')).toMatchObject({ source: 'a', sourceHandle: 'h1', target: 'b', targetHandle: 'h3', data: { linkId: 'l1', part: 'mid', label: 'cf.' } })
    expect(edges.some((e) => e.id.startsWith('far:'))).toBe(false)
    expect(mids(linksToEdges(linked, 'ws2')).map((e) => e.id)).toEqual(['far:f:f'])
  })

  test('block ends attach to the header handle of every window showing the block', () => {
    const edges = mids(linksToEdges(linked, WS))
    expect(edges.find((e) => e.id === 'ld:b:a')).toMatchObject({ sourceHandle: 'block:doc2', targetHandle: 'h2' })
    expect(edges.filter((e) => e.id.startsWith('dd:')).map((e) => e.id).sort()).toEqual(['dd:a:b', 'dd:c:b'])
  })

  test('leads sit above their own window, spans above the lower window, unless elevated', () => {
    const edges = linksToEdges(linked, WS)
    const z = (id: string) => edges.find((e) => e.id === id)!.zIndex
    expect([z('l1:a:b:a'), z('l1:a:b:mid'), z('l1:a:b:b')]).toEqual([3, 3, 5])
    expect([z('l1:c:b:a'), z('l1:c:b:mid'), z('l1:c:b:b')]).toEqual([7, 5, 5])
    const elevated = linksToEdges(linked, WS, { elevateLinkId: 'l1' })
    expect(elevated.find((e) => e.id === 'l1:a:b:mid')!.zIndex).toBeGreaterThan(1000)
    expect(elevated.find((e) => e.id === 'l2:a:a:mid')!.zIndex).toBe(3)
  })
})
