import { beforeEach, describe, expect, test } from 'vitest'
import { useStore } from './store'
import { emptyHistory } from './history'
import { seedState } from '../model/seed'
import { addPreset, createWorkspaceWithPortal, switchWorkspace } from '../model/actions'

beforeEach(() => useStore.setState({ state: seedState, history: emptyHistory() }))

describe('store undo/redo', () => {
  test('update records history; undo and redo restore states', () => {
    const { update, undo, redo } = useStore.getState()
    update((s) => addPreset(s, { workspaceId: 'ws-main', name: 'A', style: {}, id: 'a' }))
    update((s) => addPreset(s, { workspaceId: 'ws-main', name: 'B', style: {}, id: 'b' }))
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
    useStore.getState().replace({ ...seedState, blocks: [] })
    useStore.getState().undo()
    expect(useStore.getState().state).toBe(seedState)
  })

  test('skip and coalesce options are honoured', () => {
    const { update } = useStore.getState()
    update((s) => addPreset(s, { workspaceId: 'ws-main', name: 'A', style: {}, id: 'a' }), { skip: true })
    expect(useStore.getState().history.past).toEqual([])
    update((s) => addPreset(s, { workspaceId: 'ws-main', name: 'B', style: {}, id: 'b' }), { key: 'k' })
    update((s) => addPreset(s, { workspaceId: 'ws-main', name: 'C', style: {}, id: 'c' }), { key: 'k' })
    expect(useStore.getState().history.past).toHaveLength(1)
    useStore.getState().undo()
    expect(useStore.getState().state.presets.map((p) => p.id)).toEqual([...seedState.presets.map((p) => p.id), 'a'])
  })
})

describe('undo/redo keeps the current workspace', () => {
  test('undoing a change made elsewhere does not switch workspaces', () => {
    const { update } = useStore.getState()
    update((s) => createWorkspaceWithPortal(s, 'ws-main', 'Deep', { x: 0, y: 0 }, { workspaceId: 'ws2' }))
    update((s) => switchWorkspace(s, 'ws2'), { skip: true })
    update((s) => addPreset(s, { workspaceId: 'ws2', name: 'X', style: {}, id: 'x' }))
    useStore.getState().undo()
    expect(useStore.getState().state.currentWorkspaceId).toBe('ws2')
    expect(useStore.getState().state.presets.some((p) => p.id === 'x')).toBe(false)
    // Undoing the workspace's creation falls back to a workspace that exists.
    useStore.getState().undo()
    expect(useStore.getState().state.currentWorkspaceId).toBe('ws-main')
  })
})
