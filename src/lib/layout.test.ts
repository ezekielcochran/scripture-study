import { describe, expect, test } from 'vitest'
import { applyNodeChangesToState, layoutToNodes } from './layout'
import type { State } from '../model/types'

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
  expect(nodes[0]).toMatchObject({ id: 'a', type: 'window', position: { x: 0, y: 0 }, width: 100, height: 80, zIndex: 1 })
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
    expect(windows(next)[0].z).toBe(3)
    expect(applyNodeChangesToState(state, [{ type: 'select', id: 'a', selected: false }])).toBe(state)
    expect(applyNodeChangesToState(state, [{ type: 'remove', id: 'a' }])).toBe(state)
  })
})
