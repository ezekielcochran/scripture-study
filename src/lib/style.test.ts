import { describe, expect, test } from 'vitest'
import { mergeStyles, styleForPresetIds } from './style'
import type { Preset } from '../model/types'

describe('mergeStyles', () => {
  test('empty input gives empty style', () => {
    expect(mergeStyles([])).toEqual({})
  })

  test('single style passes through', () => {
    expect(mergeStyles([{ color: 'red', bold: true }])).toEqual({ color: 'red', bold: true })
  })

  test('later color and background win', () => {
    expect(mergeStyles([{ color: 'red', background: 'yellow' }, { color: 'blue' }])).toEqual({
      color: 'blue',
      background: 'yellow',
    })
  })

  test('unset properties do not override earlier ones', () => {
    expect(mergeStyles([{ color: 'red' }, {}, { background: 'yellow' }])).toEqual({
      color: 'red',
      background: 'yellow',
    })
  })

  test('boolean flags are OR-ed, and false never clears true', () => {
    expect(mergeStyles([{ bold: true, italic: false }, { bold: false, underline: true }])).toEqual({
      bold: true,
      underline: true,
    })
  })
})

describe('styleForPresetIds', () => {
  const presets: Preset[] = [
    { id: 'a', name: 'A', style: { background: 'yellow' } },
    { id: 'b', name: 'B', style: { color: 'red', bold: true } },
  ]

  test('merges presets in the given order', () => {
    expect(styleForPresetIds(['a', 'b'], presets)).toEqual({
      background: 'yellow',
      color: 'red',
      bold: true,
    })
  })

  test('ignores unknown preset ids', () => {
    expect(styleForPresetIds(['missing', 'a'], presets)).toEqual({ background: 'yellow' })
  })
})
