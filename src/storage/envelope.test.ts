import { describe, expect, test } from 'vitest'
import { CURRENT_VERSION, deserialize, serialize, validateState, wrap } from './envelope'
import { seedState } from '../model/seed'

const v2Sample = {
  documents: [{ id: 'd', title: 't', text: 'abc', createdAt: 'c' }],
  presets: [{ id: 'p', name: 'P', style: { bold: true }, shortcut: '1' }],
  highlights: [{ id: 'h', documentId: 'd', start: 0, end: 1, presetId: 'p', note: 'n' }],
  links: [{ id: 'l', from: { kind: 'document', id: 'd' }, to: { kind: 'highlight', id: 'h' }, label: 'cf.' }],
  layouts: [{ id: 'L', name: 'Default', windows: [{ id: 'w', documentId: 'd', range: { start: 0, end: 3 }, x: 0, y: 0, width: 1, height: 1, z: 0 }] }],
}

describe('serialize / deserialize', () => {
  test('round-trips the seed state', () => {
    const result = deserialize(serialize(seedState))
    expect(result).toEqual({ ok: true, state: seedState })
  })

  test('envelope carries app, version, and timestamp', () => {
    const now = new Date('2026-09-26T12:00:00.000Z')
    expect(wrap(seedState, now)).toMatchObject({ app: 'text-study', version: CURRENT_VERSION, savedAt: '2026-09-26T12:00:00.000Z' })
  })

  test('rejects invalid JSON, non-objects, and foreign files', () => {
    expect(deserialize('{not json')).toEqual({ ok: false, error: 'Not valid JSON' })
    expect(deserialize('[]').ok).toBe(false)
    expect(deserialize('{"app":"other","version":1,"state":{}}')).toEqual({ ok: false, error: 'Not a Text Study file' })
  })

  test('migrates a version 2 file into one "main" workspace with blocks', () => {
    const result = deserialize(JSON.stringify({ app: 'text-study', version: 2, savedAt: 'x', state: v2Sample }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const s = result.state
    expect(s.workspaces).toEqual([{ id: 'ws-main', name: 'main' }])
    expect(s.currentWorkspaceId).toBe('ws-main')
    expect(s.blocks).toEqual([{ id: 'd', workspaceId: 'ws-main', title: 't', text: 'abc', createdAt: 'c' }])
    expect(s.presets[0]).toMatchObject({ id: 'p', workspaceId: 'ws-main' })
    expect(s.highlights).toEqual([{ id: 'h', blockId: 'd', start: 0, end: 1, presetId: 'p', note: 'n' }])
    expect(s.links).toEqual([{ id: 'l', from: { kind: 'block', id: 'd' }, to: { kind: 'highlight', id: 'h' }, label: 'cf.' }])
    expect(s.windows).toEqual([{ id: 'w', blockId: 'd', range: { start: 0, end: 3 }, x: 0, y: 0, width: 1, height: 1, z: 0 }])
    expect(s.portals).toEqual([])
  })

  test('migrates a version 1 file through both steps', () => {
    const v1 = {
      ...v2Sample,
      links: [{ id: 'l', fromHighlightId: 'h', toHighlightId: 'h', label: 'cf.' }],
    }
    const result = deserialize(JSON.stringify({ app: 'text-study', version: 1, savedAt: 'x', state: v1 }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.links).toEqual([{ id: 'l', from: { kind: 'highlight', id: 'h' }, to: { kind: 'highlight', id: 'h' }, label: 'cf.' }])
    }
  })

  test('rejects a version newer than the app', () => {
    const json = JSON.stringify({ ...wrap(seedState), version: CURRENT_VERSION + 1 })
    expect(deserialize(json).ok).toBe(false)
  })

  test('rejects a malformed state and names the bad item', () => {
    const bad = { ...seedState, highlights: [{ id: 'x' }] }
    expect(deserialize(JSON.stringify(wrap(bad as never)))).toEqual({ ok: false, error: 'highlights[0] is malformed' })
  })
})

describe('validateState', () => {
  test('accepts the seed and a fully populated state', () => {
    expect(validateState(seedState)).toBeNull()
    const s = {
      ...seedState,
      workspaces: [...seedState.workspaces, { id: 'w2', name: 'two' }],
      blocks: [{ id: 'd', workspaceId: 'ws-main', title: 't', text: 'abc', createdAt: 'c', kind: 'note' }],
      highlights: [{ id: 'h', blockId: 'd', start: 0, end: 1, presetId: 'p', note: 'n' }],
      links: [
        { id: 'l', from: { kind: 'block', id: 'd' }, to: { kind: 'highlight', id: 'h' } },
        { id: 'l2', from: { kind: 'portal', id: 'p' }, to: { kind: 'block', id: 'd' } },
      ],
      windows: [{ id: 'w', blockId: 'd', range: { start: 0, end: 3 }, x: 0, y: 0, width: 1, height: 1, z: 0 }],
      portals: [{ id: 'p', pairId: 'pr', workspaceId: 'ws-main', targetWorkspaceId: 'w2', x: 0, y: 0, z: 1 }],
    }
    expect(validateState(s)).toBeNull()
  })

  test('rejects missing collections and wrong types', () => {
    expect(validateState({})).toBe('workspaces must be a non-empty array')
    expect(validateState({ ...seedState, blocks: 5 })).toBe('blocks must be an array')
    expect(validateState({ ...seedState, blocks: [{ id: 'd', text: 't', createdAt: 'c' }] })).toBe('blocks[0] is malformed')
    expect(validateState({ ...seedState, blocks: [{ id: 'd', workspaceId: 'ws-main', text: 't', createdAt: 'c', kind: 'memo' }] })).toBe('blocks[0] is malformed')
    expect(validateState({ ...seedState, presets: [{ id: 'p', workspaceId: 'ws-main', name: 'P', style: { bold: 'yes' } }] })).toBe('presets[0] is malformed')
    expect(validateState({ ...seedState, links: [{ id: 'l', from: { kind: 'document', id: 'x' }, to: { kind: 'block', id: 'd' } }] })).toBe('links[0] is malformed')
    expect(validateState({ ...seedState, portals: [{ id: 'p' }] })).toBe('portals[0] is malformed')
    expect(validateState({ ...seedState, currentWorkspaceId: 3 })).toBe('currentWorkspaceId must be a string')
  })
})
