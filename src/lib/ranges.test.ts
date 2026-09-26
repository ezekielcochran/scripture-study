import { describe, expect, test } from 'vitest'
import { adjustRange, applyEditToText, diffEdit, type Edit } from './ranges'

const r = { start: 10, end: 20 }
const ins = (position: number, text: string): Edit => ({ position, deletedLength: 0, insertedText: text })
const del = (position: number, n: number): Edit => ({ position, deletedLength: n, insertedText: '' })
const rep = (position: number, n: number, text: string): Edit => ({ position, deletedLength: n, insertedText: text })

describe('adjustRange', () => {
  test('edit after the range leaves it unchanged', () => {
    expect(adjustRange(r, ins(25, 'xx'))).toEqual(r)
    expect(adjustRange(r, del(20, 3))).toEqual(r)
    expect(adjustRange(r, ins(20, 'xx'))).toEqual(r) // insertion at the end does not extend
  })

  test('edit before the range shifts it', () => {
    expect(adjustRange(r, ins(3, 'xx'))).toEqual({ start: 12, end: 22 })
    expect(adjustRange(r, del(3, 4))).toEqual({ start: 6, end: 16 })
    expect(adjustRange(r, rep(0, 10, 'ab'))).toEqual({ start: 2, end: 12 }) // deletion ends exactly at start
    expect(adjustRange(r, ins(10, 'xx'))).toEqual({ start: 12, end: 22 }) // insertion at start shifts
  })

  test('edit inside the range resizes it', () => {
    expect(adjustRange(r, ins(15, 'xyz'))).toEqual({ start: 10, end: 23 })
    expect(adjustRange(r, del(12, 5))).toEqual({ start: 10, end: 15 })
    expect(adjustRange(r, rep(10, 3, 'q'))).toEqual({ start: 10, end: 18 }) // replacing the first chars
    expect(adjustRange(r, rep(17, 3, 'longer'))).toEqual({ start: 10, end: 23 }) // replacing the last chars
  })

  test('edit spanning the start truncates the front', () => {
    expect(adjustRange(r, del(5, 8))).toEqual({ start: 5, end: 12 })
    expect(adjustRange(r, rep(5, 8, 'ab'))).toEqual({ start: 7, end: 14 })
  })

  test('edit spanning the end truncates the back', () => {
    expect(adjustRange(r, del(15, 10))).toEqual({ start: 10, end: 15 })
    expect(adjustRange(r, rep(15, 10, 'ab'))).toEqual({ start: 10, end: 15 })
  })

  test('edit deleting the whole range removes it', () => {
    expect(adjustRange(r, del(10, 10))).toBeNull()
    expect(adjustRange(r, del(0, 30))).toBeNull()
    expect(adjustRange(r, rep(10, 10, 'replacement'))).toBeNull()
  })

  test('inclusive ranges absorb insertions at either edge', () => {
    expect(adjustRange(r, ins(10, 'xx'), { inclusive: true })).toEqual({ start: 10, end: 22 })
    expect(adjustRange(r, ins(20, 'xx'), { inclusive: true })).toEqual({ start: 10, end: 22 })
    // Deletions at the edges behave as usual.
    expect(adjustRange(r, del(20, 2), { inclusive: true })).toEqual(r)
    expect(adjustRange(r, del(8, 2), { inclusive: true })).toEqual({ start: 8, end: 18 })
  })

  test('adjusted ranges are never empty', () => {
    const edits = [ins(10, 'a'), ins(20, 'a'), del(9, 2), del(19, 2), rep(10, 1, 'b'), rep(19, 1, 'b')]
    for (const e of edits) {
      const out = adjustRange(r, e)
      if (out) expect(out.end).toBeGreaterThan(out.start)
    }
  })
})

describe('applyEditToText', () => {
  test('inserts, deletes, and replaces', () => {
    expect(applyEditToText('hello world', ins(5, ','))).toBe('hello, world')
    expect(applyEditToText('hello world', del(5, 6))).toBe('hello')
    expect(applyEditToText('hello world', rep(6, 5, 'there'))).toBe('hello there')
  })

  test('rejects out-of-bounds edits', () => {
    expect(() => applyEditToText('abc', del(2, 5))).toThrow(RangeError)
    expect(() => applyEditToText('abc', ins(-1, 'x'))).toThrow(RangeError)
  })
})

describe('diffEdit', () => {
  test('returns null for identical text', () => {
    expect(diffEdit('abc', 'abc')).toBeNull()
  })

  test('detects insertion, deletion, and replacement', () => {
    expect(diffEdit('hello world', 'hello, world')).toEqual(ins(5, ','))
    expect(diffEdit('hello world', 'hello')).toEqual(del(5, 6))
    expect(diffEdit('hello world', 'hello there')).toEqual(rep(6, 5, 'there'))
    expect(diffEdit('', 'new')).toEqual(ins(0, 'new'))
    expect(diffEdit('old', '')).toEqual(del(0, 3))
  })

  test('uses the caret to place edits in repeated text', () => {
    expect(diffEdit('aaa', 'aaaa', 1)).toEqual(ins(0, 'a'))
    expect(diffEdit('aaa', 'aaaa', 4)).toEqual(ins(3, 'a'))
    expect(diffEdit('aaa', 'aa', 1)).toEqual(del(1, 1)) // backspace after the second a
    expect(diffEdit('aaa', 'aa', 0)).toEqual(del(0, 1)) // forward-delete at the start
  })

  test('falls back to prefix/suffix when the caret is inconsistent with the change', () => {
    expect(diffEdit('hello world', 'hello, world', 0)).toEqual(ins(5, ','))
  })

  test('round-trips: applying the diff reproduces the text', () => {
    const cases: [string, string, number | undefined][] = [
      ['the cat sat', 'the dog sat', 7],
      ['abcabc', 'abcxabc', 4],
      ['abcabc', 'abc', 3],
      ['x', 'yyy', 3],
      ['same', 'same', undefined],
    ]
    for (const [before, after, cursor] of cases) {
      const e = diffEdit(before, after, cursor)
      expect(e ? applyEditToText(before, e) : before).toBe(after)
    }
  })
})
