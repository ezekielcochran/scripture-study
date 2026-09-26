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

/** Look up presets by id (unknown ids are ignored) and merge their styles in order. */
export function styleForPresetIds(presetIds: string[], presets: Preset[]): PresetStyle {
  const byId = new Map(presets.map((p) => [p.id, p]))
  const styles: PresetStyle[] = []
  for (const id of presetIds) {
    const p = byId.get(id)
    if (p) styles.push(p.style)
  }
  return mergeStyles(styles)
}
