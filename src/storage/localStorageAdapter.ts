import type { State } from '../model/types'
import type { StorageAdapter } from './adapter'
import { deserialize, serialize } from './envelope'

export const STORAGE_KEY = 'text-study:state'

export function createLocalStorageAdapter(
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  key = STORAGE_KEY,
): StorageAdapter {
  return {
    async load() {
      const json = storage.getItem(key)
      if (json === null) return null
      const result = deserialize(json)
      if (!result.ok) {
        console.warn(`Ignoring saved state: ${result.error}`)
        return null
      }
      return result.state
    },
    async save(state: State) {
      storage.setItem(key, serialize(state))
    },
  }
}
