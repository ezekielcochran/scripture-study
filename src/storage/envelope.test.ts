import { describe, expect, test } from 'vitest'
import { CURRENT_VERSION, deserialize, serialize, validateState, wrap } from './envelope'
import { seedState } from '../model/seed'

describe('serialize / deserialize', () => {
  test('round-trips the seed state', () => {
    const result = deserialize(serialize(seedState))
    expect(result).toEqual({ ok: true, state: seedState })
  })

  test('envelope carries app, version, and timestamp', () => {
    const now = new Date('2026-09-26T12:00:00.000Z')
    expect(wrap(seedState, now)).toMatchObject({
      app: 'text-study',
      version: CURRENT_VERSION,
      savedAt: '2026-09-26T12:00:00.000Z',
    })
  })

  test('rejects invalid JSON', () => {
    expect(deserialize('{not json')).toEqual({ ok: false, error: 'Not valid JSON' })
  })

  test('rejects non-objects and foreign files', () => {
    expect(deserialize('[]').ok).toBe(false)
    expect(deserialize('{"app":"other","version":1,"state":{}}')).toEqual({
      ok: false,
      error: 'Not a Text Study file',
    })
  })

  test('migrates a version 1 file with highlight-only links', () => {
    const v1 = {
      app: 'text-study',
      version: 1,
      savedAt: 'x',
      state: {
        ...seedState,
        documents: [{ id: 'd', text: 'abc', createdAt: 'c' }],
        highlights: [
          { id: 'h1', documentId: 'd', start: 0, end: 1, presetId: 'p' },
          { id: 'h2', documentId: 'd', start: 1, end: 2, presetId: 'p' },
        ],
        links: [{ id: 'l', fromHighlightId: 'h1', toHighlightId: 'h2', label: 'cf.' }],
      },
    }
    const result = deserialize(JSON.stringify(v1))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.links).toEqual([
        { id: 'l', from: { kind: 'highlight', id: 'h1' }, to: { kind: 'highlight', id: 'h2' }, label: 'cf.' },
      ])
    }
  })

  test('rejects a version newer than the app', () => {
    const json = JSON.stringify({ ...wrap(seedState), version: CURRENT_VERSION + 1 })
    expect(deserialize(json).ok).toBe(false)
  })

  test('rejects a malformed state and names the bad item', () => {
    const bad = { ...seedState, highlights: [{ id: 'x' }] }
    const json = JSON.stringify(wrap(bad as never))
    expect(deserialize(json)).toEqual({ ok: false, error: 'highlights[0] is malformed' })
  })
})

describe('validateState', () => {
  test('accepts the empty state', () => {
    expect(validateState({ documents: [], presets: [], highlights: [], links: [], layouts: [] })).toBeNull()
  })

  test('accepts optional fields when present and well-typed', () => {
    const s = {
      ...seedState,
      documents: [{ id: 'd', title: 't', text: 'abc', createdAt: 'c' }],
      highlights: [{ id: 'h', documentId: 'd', start: 0, end: 1, presetId: 'p', note: 'n' }],
      layouts: [
        {
          id: 'l',
          name: 'L',
          windows: [{ id: 'w', documentId: 'd', range: { start: 0, end: 3 }, x: 0, y: 0, width: 1, height: 1, z: 0 }],
        },
      ],
    }
    expect(validateState(s)).toBeNull()
  })

  test('rejects missing collections and wrong types', () => {
    expect(validateState({})).toBe('documents must be an array')
    expect(validateState({ ...seedState, documents: [{ id: 'd', text: 't', createdAt: 'c', kind: 'memo' }] })).toBe(
      'documents[0] is malformed',
    )
    expect(validateState({ ...seedState, documents: [{ id: 'd', text: 't', createdAt: 'c', kind: 'note' }] })).toBeNull()
    expect(validateState({ ...seedState, presets: [{ id: 'p', name: 'P', style: { bold: 'yes' } }] })).toBe(
      'presets[0] is malformed',
    )
    expect(validateState({ ...seedState, layouts: [{ id: 'l', name: 'L', windows: [{ id: 'w' }] }] })).toBe(
      'layouts[0] is malformed',
    )
    expect(validateState({ ...seedState, links: [{ id: 'l', from: { kind: 'window', id: 'x' }, to: { kind: 'document', id: 'd' } }] })).toBe(
      'links[0] is malformed',
    )
  })
})
