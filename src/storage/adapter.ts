import type { State } from '../model/types'

/**
 * Where the State JSON lives. This is the only seam a backend needs to fill:
 * implement load/save against a remote store and swap it in at src/storage/index.ts.
 * Both methods are async so a network-backed adapter fits without changing callers.
 */
export interface StorageAdapter {
  /** Returns the saved state, or null if nothing has been saved yet. */
  load(): Promise<State | null>
  save(state: State): Promise<void>
}
