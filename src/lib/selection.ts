import type { Range } from '../model/types'

/**
 * Offset of a DOM point (node, offset) within `container`, measured in characters
 * of the container's text content. Works regardless of how the text is split
 * into styled spans: it counts the text of every node that precedes the point.
 * Returns null when the point is outside the container.
 */
export function pointToOffset(container: Node, node: Node, offset: number): number | null {
  if (!container.contains(node)) return null

  // Normalise an element point (offset = child index) to a concrete boundary:
  // "everything before child[offset]", or the end of the element if offset is past the last child.
  let before: Node | null
  let within = 0
  if (node.nodeType === Node.TEXT_NODE) {
    before = node
    within = offset
  } else {
    const child = node.childNodes[offset]
    if (child) {
      before = child
    } else {
      // Past the last child: count all text inside `node`, then everything before `node`.
      within = node.textContent?.length ?? 0
      before = node
    }
  }

  // Sum the text length of every node that ends before `before` in document order.
  let total = within
  let cur: Node | null = before
  while (cur && cur !== container) {
    let sib: Node | null = cur.previousSibling
    while (sib) {
      total += sib.textContent?.length ?? 0
      sib = sib.previousSibling
    }
    cur = cur.parentNode
  }
  return total
}

export interface SelectionPoints {
  anchorNode: Node | null
  anchorOffset: number
  focusNode: Node | null
  focusOffset: number
}

/**
 * Map a browser selection to a [start, end) range of characters within `container`.
 * Returns null if either end is outside the container or the selection is empty.
 * Handles backwards selections (focus before anchor).
 */
export function selectionToRange(container: Node, sel: SelectionPoints): Range | null {
  if (!sel.anchorNode || !sel.focusNode) return null
  const a = pointToOffset(container, sel.anchorNode, sel.anchorOffset)
  const b = pointToOffset(container, sel.focusNode, sel.focusOffset)
  if (a === null || b === null || a === b) return null
  return { start: Math.min(a, b), end: Math.max(a, b) }
}
