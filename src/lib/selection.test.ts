// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { pointToOffset, selectionToRange } from './selection'

/** Build a container from an HTML string; text content is what offsets are measured in. */
function make(html: string): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}

// Text: "abcdefghij" split into spans at several points, with one nested span.
const html = 'ab<span>cd<span>ef</span>g</span>hi<span>j</span>'

describe('pointToOffset', () => {
  test('text node in the container root', () => {
    const c = make(html)
    expect(pointToOffset(c, c.childNodes[0], 1)).toBe(1) // "a|b"
  })

  test('text node inside a span', () => {
    const c = make(html)
    const outer = c.childNodes[1]
    expect(pointToOffset(c, outer.childNodes[0], 2)).toBe(4) // "abcd|"
  })

  test('text node inside a nested span', () => {
    const c = make(html)
    const inner = c.childNodes[1].childNodes[1]
    expect(pointToOffset(c, inner.childNodes[0], 1)).toBe(5) // "abcde|f"
  })

  test('text after a nested span', () => {
    const c = make(html)
    const outer = c.childNodes[1]
    expect(pointToOffset(c, outer.childNodes[2], 1)).toBe(7) // "abcdefg|"
  })

  test('element point at a child boundary', () => {
    const c = make(html)
    expect(pointToOffset(c, c, 1)).toBe(2) // before the first span
    expect(pointToOffset(c, c, 2)).toBe(7) // after the first span
  })

  test('element point past the last child is the end of that element', () => {
    const c = make(html)
    expect(pointToOffset(c, c, c.childNodes.length)).toBe(10)
    const outer = c.childNodes[1]
    expect(pointToOffset(c, outer, outer.childNodes.length)).toBe(7)
  })

  test('container itself at offset 0', () => {
    const c = make(html)
    expect(pointToOffset(c, c, 0)).toBe(0)
  })

  test('node outside the container yields null', () => {
    const c = make(html)
    const other = make('zzz')
    expect(pointToOffset(c, other.childNodes[0], 1)).toBeNull()
  })
})

describe('selectionToRange', () => {
  test('selection crossing span boundaries', () => {
    const c = make(html)
    const first = c.childNodes[0] // "ab"
    const last = c.childNodes[3].childNodes[0] // "j"
    expect(
      selectionToRange(c, { anchorNode: first, anchorOffset: 1, focusNode: last, focusOffset: 1 }),
    ).toEqual({ start: 1, end: 10 })
  })

  test('backwards selection is normalised', () => {
    const c = make(html)
    const first = c.childNodes[0]
    const inner = c.childNodes[1].childNodes[1].childNodes[0] // "ef"
    expect(
      selectionToRange(c, { anchorNode: inner, anchorOffset: 2, focusNode: first, focusOffset: 0 }),
    ).toEqual({ start: 0, end: 6 })
  })

  test('collapsed selection yields null', () => {
    const c = make(html)
    const t = c.childNodes[0]
    expect(selectionToRange(c, { anchorNode: t, anchorOffset: 1, focusNode: t, focusOffset: 1 })).toBeNull()
  })

  test('selection with an end outside the container yields null', () => {
    const c = make(html)
    const other = make('zzz')
    expect(
      selectionToRange(c, {
        anchorNode: c.childNodes[0],
        anchorOffset: 0,
        focusNode: other.childNodes[0],
        focusOffset: 1,
      }),
    ).toBeNull()
  })

  test('missing nodes yield null', () => {
    const c = make(html)
    expect(selectionToRange(c, { anchorNode: null, anchorOffset: 0, focusNode: null, focusOffset: 0 })).toBeNull()
  })
})
