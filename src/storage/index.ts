// The one place that decides where state lives. To move to a backend, build a
// StorageAdapter for it and return it here; nothing else in the app changes.
import type { StorageAdapter } from './adapter'
import { createLocalStorageAdapter } from './localStorageAdapter'

export type { StorageAdapter } from './adapter'
export { startPersistence } from './persist'
export { downloadStateFile, readStateFile } from './file'

export function createStorageAdapter(): StorageAdapter {
  return createLocalStorageAdapter()
}
