import { expect, test } from 'vitest'
import { exportFileName, readStateFile } from './file'
import { serialize } from './envelope'
import { seedState } from '../model/seed'

test('export file name is dated', () => {
  expect(exportFileName(new Date('2026-09-26T23:59:00.000Z'))).toBe('text-study-2026-09-26.json')
})

test('readStateFile parses a Blob', async () => {
  const blob = new Blob([serialize(seedState)], { type: 'application/json' })
  expect(await readStateFile(blob)).toEqual({ ok: true, state: seedState })
})

test('readStateFile reports errors instead of throwing', async () => {
  expect((await readStateFile(new Blob(['nope']))).ok).toBe(false)
})
