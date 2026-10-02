import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createStore } from 'zustand/vanilla'
import type { State } from '../model/types'
import type { StorageAdapter } from './adapter'
import { startPersistence } from './persist'
import { seedState } from '../model/seed'

const empty: State = {
  workspaces: [{ id: 'ws', name: 'main' }],
  blocks: [],
  presets: [],
  highlights: [],
  links: [],
  windows: [],
  portals: [],
  currentWorkspaceId: 'ws',
}

function makeStore(initial: State) {
  return createStore<{ state: State; replace: (n: State) => void }>((set) => ({
    state: initial,
    replace: (next) => set({ state: next }),
  }))
}

function memoryAdapter(initial: State | null = null) {
  const saves: State[] = []
  const adapter: StorageAdapter = {
    load: async () => initial,
    save: async (s) => void saves.push(s),
  }
  return { adapter, saves }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('startPersistence', () => {
  test('loads saved state into the store on start', async () => {
    const store = makeStore(empty)
    const { adapter } = memoryAdapter(seedState)
    await startPersistence(store, adapter)
    expect(store.getState().state).toBe(seedState)
  })

  test('keeps the initial state when nothing is saved', async () => {
    const store = makeStore(seedState)
    await startPersistence(store, memoryAdapter(null).adapter)
    expect(store.getState().state).toBe(seedState)
  })

  test('debounces saves: many changes, one save with the latest state', async () => {
    const store = makeStore(empty)
    const { adapter, saves } = memoryAdapter()
    await startPersistence(store, adapter, 100)

    const a = { ...empty, blocks: [] }
    const b = { ...empty, links: [] }
    store.getState().replace(a)
    await vi.advanceTimersByTimeAsync(50)
    store.getState().replace(b)
    await vi.advanceTimersByTimeAsync(99)
    expect(saves).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(saves).toEqual([b])
  })

  test('flush saves immediately and is a no-op with nothing pending', async () => {
    const store = makeStore(empty)
    const { adapter, saves } = memoryAdapter()
    const handle = await startPersistence(store, adapter, 100)
    await handle.flush()
    expect(saves).toEqual([])

    const next = { ...empty }
    store.getState().replace(next)
    await handle.flush()
    expect(saves).toEqual([next])
    await vi.advanceTimersByTimeAsync(200)
    expect(saves).toEqual([next])
  })

  test('stop unsubscribes and drops pending saves', async () => {
    const store = makeStore(empty)
    const { adapter, saves } = memoryAdapter()
    const handle = await startPersistence(store, adapter, 100)
    store.getState().replace({ ...empty })
    handle.stop()
    await vi.advanceTimersByTimeAsync(200)
    store.getState().replace({ ...empty })
    await vi.advanceTimersByTimeAsync(200)
    expect(saves).toEqual([])
  })
})
