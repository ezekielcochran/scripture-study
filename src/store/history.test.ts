import { describe, expect, test } from 'vitest'
import { emptyHistory, MAX_HISTORY, record, redo, undo } from './history'

describe('history', () => {
  test('record pushes the outgoing state; undo and redo walk the stacks', () => {
    let h = emptyHistory<number>()
    h = record(h, 1)
    h = record(h, 2)
    expect(h.past).toEqual([1, 2])

    const u1 = undo(h, 3)!
    expect(u1.state).toBe(2)
    expect(u1.history.past).toEqual([1])
    expect(u1.history.future).toEqual([3])

    const u2 = undo(u1.history, u1.state)!
    expect(u2.state).toBe(1)
    expect(undo(u2.history, u2.state)).toBeNull()

    const r1 = redo(u2.history, u2.state)!
    expect(r1.state).toBe(2)
    const r2 = redo(r1.history, r1.state)!
    expect(r2.state).toBe(3)
    expect(redo(r2.history, r2.state)).toBeNull()
  })

  test('a new change after undo clears the redo stack', () => {
    let h = record(emptyHistory<number>(), 1)
    const u = undo(h, 2)!
    h = record(u.history, u.state)
    expect(h.future).toEqual([])
    expect(h.past).toEqual([1])
  })

  test('same-key changes within the window coalesce into one step', () => {
    let h = record(emptyHistory<string>(), 'a', { key: 'edit', now: 0 })
    h = record(h, 'ab', { key: 'edit', now: 200 })
    h = record(h, 'abc', { key: 'edit', now: 400 })
    expect(h.past).toEqual(['a'])
    // After a pause, a new step starts.
    h = record(h, 'abcd', { key: 'edit', now: 2000 })
    expect(h.past).toEqual(['a', 'abcd'])
    // A different key always starts a new step.
    h = record(h, 'x', { key: 'other', now: 2100 })
    expect(h.past).toEqual(['a', 'abcd', 'x'])
    // An unkeyed change breaks the run, so the next keyed change is a new step.
    h = record(h, 'y', { now: 2200 })
    h = record(h, 'z', { key: 'other', now: 2300 })
    expect(h.past).toEqual(['a', 'abcd', 'x', 'y', 'z'])
  })

  test('within can be extended for long-running gestures', () => {
    let h = record(emptyHistory<number>(), 1, { key: 'drag', within: Infinity, now: 0 })
    h = record(h, 2, { key: 'drag', within: Infinity, now: 60_000 })
    expect(h.past).toEqual([1])
  })

  test('skip records nothing', () => {
    const h = record(emptyHistory<number>(), 1, { skip: true })
    expect(h.past).toEqual([])
  })

  test('undo resets coalescing so the next change is a fresh step', () => {
    let h = record(emptyHistory<number>(), 1, { key: 'k', now: 0 })
    const u = undo(h, 2)!
    h = record(u.history, u.state, { key: 'k', now: 10 })
    expect(h.past).toEqual([1])
    expect(h.future).toEqual([])
  })

  test('history is capped', () => {
    let h = emptyHistory<number>()
    for (let i = 0; i < MAX_HISTORY + 50; i++) h = record(h, i)
    expect(h.past).toHaveLength(MAX_HISTORY)
    expect(h.past[0]).toBe(50)
  })
})
