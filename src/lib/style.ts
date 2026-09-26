import type { CSSProperties } from 'react'
import type { Preset, PresetStyle } from '../model/types'

/**
 * Merge styles in order. Precedence rule:
 * - `color` and `background`: the last style that sets the property wins.
 * - `bold`, `italic`, `underline`: true if any style sets it true.
 * Properties nobody sets are left out of the result.
 */
export function mergeStyles(styles: PresetStyle[]): PresetStyle {
  const out: PresetStyle = {}
  for (const s of styles) {
    if (s.color !== undefined) out.color = s.color
    if (s.background !== undefined) out.background = s.background
    if (s.bold) out.bold = true
    if (s.italic) out.italic = true
    if (s.underline) out.underline = true
  }
  return out
}

/**
 * Combined style for the presets covering a segment. Priority is the preset
 * list order: when two presets contradict (both set `color`, or both set
 * `background`), the one earlier in the list wins. Flags still combine.
 * Unknown ids are ignored; the order of `presetIds` does not matter.
 */
export function styleForPresetIds(presetIds: string[], presets: Preset[]): PresetStyle {
  const wanted = new Set(presetIds)
  // List order is priority order; merge lowest priority first so the highest applies last.
  const inPriority = presets.filter((p) => wanted.has(p.id)).reverse()
  return mergeStyles(inPriority.map((p) => p.style))
}

/**
 * CSS for a merged preset style. A preset with a fill but no text colour gets a
 * dark text colour, since fills are typically light and must stay readable in dark mode.
 */
export function presetStyleToCss(s: PresetStyle): CSSProperties {
  return {
    color: s.color ?? (s.background ? 'var(--ink-on-highlight)' : undefined),
    backgroundColor: s.background,
    fontWeight: s.bold ? 'bold' : undefined,
    fontStyle: s.italic ? 'italic' : undefined,
    textDecoration: s.underline ? 'underline' : undefined,
  }
}
