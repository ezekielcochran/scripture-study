import { describe, expect, test } from 'vitest'
import { flattenSegments } from './segments'
import type { Highlight } from '../model/types'

const text = 'abcdefghij' // 10 chars, offsets 0..10

function hl(id: string, start: number, end: number, presetId = `p-${id}`): Highlight {
  return { id, blockId: 'doc', start, end, presetId }
}

/** Compact view for assertions: [text, highlightIds] per segment. */
function view(text: string, highlights: Highlight[]) {
  return flattenSegments(text, highlights).map((s) => [s.text, s.highlightIds])
}

describe('flattenSegments', () => {
  test('no highlights gives one plain segment covering the text', () => {
    expect(view(text, [])).toEqual([['abcdefghij', []]])
  })

  test('empty text gives no segments', () => {
    expect(flattenSegments('', [hl('a', 0, 0)])).toEqual([])
  })

  test('single highlight in the middle', () => {
    expect(view(text, [hl('a', 3, 6)])).toEqual([
      ['abc', []],
      ['def', ['a']],
      ['ghij', []],
    ])
  })

  test('highlight covering the whole text', () => {
    expect(view(text, [hl('a', 0, 10)])).toEqual([['abcdefghij', ['a']]])
  })

  test('nested highlights', () => {
    expect(view(text, [hl('outer', 1, 9), hl('inner', 3, 5)])).toEqual([
      ['a', []],
      ['bc', ['outer']],
      ['de', ['outer', 'inner']],
      ['fghi', ['outer']],
      ['j', []],
    ])
  })

  test('partially overlapping highlights', () => {
    expect(view(text, [hl('a', 2, 6), hl('b', 4, 8)])).toEqual([
      ['ab', []],
      ['cd', ['a']],
      ['ef', ['a', 'b']],
      ['gh', ['b']],
      ['ij', []],
    ])
  })

  test('adjacent highlights do not merge and share no segment', () => {
    expect(view(text, [hl('a', 2, 5), hl('b', 5, 8)])).toEqual([
      ['ab', []],
      ['cde', ['a']],
      ['fgh', ['b']],
      ['ij', []],
    ])
  })

  test('identical ranges share one segment, ordered by id', () => {
    expect(view(text, [hl('z', 2, 5), hl('a', 2, 5)])).toEqual([
      ['ab', []],
      ['cde', ['a', 'z']],
      ['fghij', []],
    ])
  })

  test('zero-length highlight covers nothing', () => {
    expect(view(text, [hl('a', 4, 4)])).toEqual([['abcdefghij', []]])
  })

  test('inverted range covers nothing', () => {
    expect(view(text, [hl('a', 6, 3)])).toEqual([['abcdefghij', []]])
  })

  test('out-of-bounds ranges are clamped to the text', () => {
    expect(view(text, [hl('a', -5, 2), hl('b', 8, 99)])).toEqual([
      ['ab', ['a']],
      ['cdefgh', []],
      ['ij', ['b']],
    ])
  })

  test('precedence: later-starting highlight comes last', () => {
    const segs = flattenSegments(text, [hl('late', 4, 6), hl('early', 0, 10)])
    const covered = segs.find((s) => s.start === 4)!
    expect(covered.highlightIds).toEqual(['early', 'late'])
    expect(covered.presetIds).toEqual(['p-early', 'p-late'])
  })

  test('segments tile the text exactly', () => {
    const segs = flattenSegments(text, [hl('a', 1, 4), hl('b', 3, 7), hl('c', 7, 9)])
    expect(segs[0].start).toBe(0)
    expect(segs[segs.length - 1].end).toBe(text.length)
    for (let i = 1; i < segs.length; i++) expect(segs[i].start).toBe(segs[i - 1].end)
    expect(segs.map((s) => s.text).join('')).toBe(text)
  })
})
