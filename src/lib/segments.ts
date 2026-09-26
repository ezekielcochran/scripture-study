import type { Highlight } from '../model/types'

/**
 * A run of text covered by a fixed set of highlights.
 * Segments are non-overlapping, ordered, and together cover all of `text`.
 */
export interface Segment {
  start: number
  end: number
  text: string
  /** Highlights covering this segment, in precedence order (last wins). */
  highlightIds: string[]
  /** Presets of those highlights, in the same order. May contain duplicates. */
  presetIds: string[]
}

/**
 * Precedence order for highlights covering the same segment:
 * earlier start first, then earlier end, then id. So the highlight that
 * starts latest (the "innermost" one) comes last and wins in style merging.
 */
function byPrecedence(a: Highlight, b: Highlight): number {
  return a.start - b.start || a.end - b.end || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

/**
 * Flatten `highlights` over `text` into ordered, non-overlapping segments.
 * Ranges are clamped to the text; zero-length or inverted ranges cover nothing.
 * Empty text yields no segments.
 */
export function flattenSegments(text: string, highlights: Highlight[]): Segment[] {
  const len = text.length
  if (len === 0) return []

  const clamp = (n: number) => Math.min(Math.max(n, 0), len)
  const active = highlights
    .map((h) => ({ ...h, start: clamp(h.start), end: clamp(h.end) }))
    .filter((h) => h.start < h.end)
    .sort(byPrecedence)

  const cuts = new Set<number>([0, len])
  for (const h of active) {
    cuts.add(h.start)
    cuts.add(h.end)
  }
  const bounds = [...cuts].sort((a, b) => a - b)

  const segments: Segment[] = []
  for (let i = 0; i < bounds.length - 1; i++) {
    const start = bounds[i]
    const end = bounds[i + 1]
    const covering = active.filter((h) => h.start <= start && h.end >= end)
    segments.push({
      start,
      end,
      text: text.slice(start, end),
      highlightIds: covering.map((h) => h.id),
      presetIds: covering.map((h) => h.presetId),
    })
  }
  return segments
}
