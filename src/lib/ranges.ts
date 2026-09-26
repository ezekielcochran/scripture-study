import type { Range } from '../model/types'

/** A single contiguous edit: delete `deletedLength` chars at `position`, then insert `insertedText` there. */
export interface Edit {
  position: number
  deletedLength: number
  insertedText: string
}

export interface AdjustOptions {
  /**
   * When true, text inserted exactly at the range's start or end becomes part of
   * the range. Used for window sub-ranges, so typing at the edge of an excerpt
   * stays inside the window. Highlights use the default (false): typing next to
   * a highlight does not extend it.
   */
  inclusive?: boolean
}

/**
 * Return `range` as it should be after `edit`, or null if the edit deleted all
 * of the range's text. Rules, for a range [start, end):
 * - Edit entirely after the range: unchanged.
 * - Edit entirely before the range: shifted by the edit's net length change.
 * - Edit entirely inside the range: the range grows or shrinks to keep covering the same text,
 *   and inserted text is inside it.
 * - Edit overlapping the range's start: the range begins after the inserted text.
 * - Edit overlapping the range's end: the range is truncated at the edit position.
 * - Edit covering the whole range: null.
 */
export function adjustRange(range: Range, edit: Edit, options: AdjustOptions = {}): Range | null {
  const { start, end } = range
  const { position, deletedLength, insertedText } = edit
  const delEnd = position + deletedLength
  const delta = insertedText.length - deletedLength
  const inclusive = options.inclusive === true

  if (inclusive && deletedLength === 0 && (position === start || position === end)) {
    return { start, end: end + insertedText.length }
  }
  if (position >= end) return range
  if (delEnd <= start) return { start: start + delta, end: end + delta }
  if (position <= start && delEnd >= end) return null
  if (position < start) return { start: position + insertedText.length, end: end + delta }
  if (delEnd > end) return { start, end: position }
  return { start, end: end + delta }
}

/** Apply `edit` to `text`. Throws on an out-of-bounds edit. */
export function applyEditToText(text: string, edit: Edit): string {
  const { position, deletedLength, insertedText } = edit
  if (position < 0 || deletedLength < 0 || position + deletedLength > text.length) {
    throw new RangeError(`Edit out of bounds: ${position}+${deletedLength} in ${text.length}`)
  }
  return text.slice(0, position) + insertedText + text.slice(position + deletedLength)
}

/**
 * Describe the change from `before` to `after` as a single Edit, or null if equal.
 * `cursorAfter` (the caret position in `after`, e.g. a textarea's selectionStart)
 * disambiguates edits in repeated text: typing "a" before "aaa" is reported at
 * position 0 rather than 3.
 */
export function diffEdit(before: string, after: string, cursorAfter?: number): Edit | null {
  if (before === after) return null
  const max = Math.min(before.length, after.length)
  let prefix = 0
  while (prefix < max && before[prefix] === after[prefix]) prefix++

  // Preferred: the inserted text ends at the caret, so the untouched suffix is what follows it.
  if (cursorAfter !== undefined && cursorAfter >= 0 && cursorAfter <= after.length) {
    const suffix = after.length - cursorAfter
    if (suffix <= before.length && before.slice(before.length - suffix) === after.slice(cursorAfter)) {
      const p = Math.min(prefix, cursorAfter, before.length - suffix)
      return {
        position: p,
        deletedLength: before.length - suffix - p,
        insertedText: after.slice(p, cursorAfter),
      }
    }
  }

  // Fallback: longest common prefix and suffix.
  let suffix = 0
  while (
    suffix < max - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix++
  }
  return {
    position: prefix,
    deletedLength: before.length - prefix - suffix,
    insertedText: after.slice(prefix, after.length - suffix),
  }
}
