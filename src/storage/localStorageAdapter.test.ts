import { describe, expect, test } from 'vitest'
import { createLocalStorageAdapter } from './localStorageAdapter'
import { seedState } from '../model/seed'

function fakeStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    map,
  }
}

describe('localStorage adapter', () => {
  test('load returns null when nothing is saved', async () => {
    expect(await createLocalStorageAdapter(fakeStorage()).load()).toBeNull()
  })

  test('save then load round-trips', async () => {
    const adapter = createLocalStorageAdapter(fakeStorage())
    await adapter.save(seedState)
    expect(await adapter.load()).toEqual(seedState)
  })

  test('corrupt saved data is ignored rather than thrown', async () => {
    const s = fakeStorage()
    s.setItem('k', '{broken')
    expect(await createLocalStorageAdapter(s, 'k').load()).toBeNull()
  })
})
