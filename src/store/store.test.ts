import { beforeEach, describe, expect, test } from 'vitest'
import { useStore } from './store'
import { emptyHistory } from './history'
import { seedState } from '../model/seed'
import { addPreset } from '../model/actions'

beforeEach(() => useStore.setState({ state: seedState, history: emptyHistory() }))

describe('store undo/redo', () => {
  test('update records history; undo and redo restore states', () => {
    const { update, undo, redo } = useStore.getState()
    update((s) => addPreset(s, { name: 'A', style: {}, id: 'a' }))
    update((s) => addPreset(s, { name: 'B', style: {}, id: 'b' }))
    expect(useStore.getState().state.presets.map((p) => p.id)).toContain('b')
    undo()
    expect(useStore.getState().state.presets.map((p) => p.id)).not.toContain('b')
    undo()
    expect(useStore.getState().state).toBe(seedState)
    undo() // nothing left; no-op
    expect(useStore.getState().state).toBe(seedState)
    redo()
    redo()
    expect(useStore.getState().state.presets.map((p) => p.id)).toContain('b')
  })

  test('no-op updates are not recorded', () => {
    useStore.getState().update((s) => s)
    expect(useStore.getState().history.past).toEqual([])
  })

  test('replace is undoable', () => {
    useStore.getState().replace({ ...seedState, documents: [] })
    useStore.getState().undo()
    expect(useStore.getState().state).toBe(seedState)
  })

  test('skip and coalesce options are honoured', () => {
    const { update } = useStore.getState()
    update((s) => addPreset(s, { name: 'A', style: {}, id: 'a' }), { skip: true })
    expect(useStore.getState().history.past).toEqual([])
    update((s) => addPreset(s, { name: 'B', style: {}, id: 'b' }), { key: 'k' })
    update((s) => addPreset(s, { name: 'C', style: {}, id: 'c' }), { key: 'k' })
    expect(useStore.getState().history.past).toHaveLength(1)
    useStore.getState().undo()
    expect(useStore.getState().state.presets.map((p) => p.id)).toEqual(['preset-key-term', 'preset-emphasis', 'a'])
  })
})
