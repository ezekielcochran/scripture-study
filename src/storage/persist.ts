import type { StoreApi } from 'zustand'
import type { State } from '../model/types'
import type { StorageAdapter } from './adapter'

interface PersistableStore {
  state: State
  replace: (next: State) => void
}

export interface PersistenceHandle {
  /** Save immediately if there is an unsaved change. */
  flush(): Promise<void>
  /** Stop listening to the store. */
  stop(): void
}

/**
 * Load saved state into the store (if any), then save every change after a
 * debounce. The store and adapter are passed in so this is testable and the
 * adapter is swappable.
 */
export async function startPersistence(
  store: StoreApi<PersistableStore>,
  adapter: StorageAdapter,
  debounceMs = 500,
): Promise<PersistenceHandle> {
  const loaded = await adapter.load()
  if (loaded) store.getState().replace(loaded)

  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: State | null = null

  async function flush() {
    if (timer) clearTimeout(timer)
    timer = null
    if (!pending) return
    const toSave = pending
    pending = null
    await adapter.save(toSave)
  }

  const unsubscribe = store.subscribe((cur, prev) => {
    if (cur.state === prev.state) return
    pending = cur.state
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void flush(), debounceMs)
  })

  return {
    flush,
    stop() {
      unsubscribe()
      if (timer) clearTimeout(timer)
      timer = null
      pending = null
    },
  }
}
