import { useStore } from '../store/store'
import { useUiStore } from '../store/uiStore'
import { toggleHighlight } from '../model/actions'
import { selectionToRange } from '../lib/selection'

/** Attribute set on each window's text container so a selection can be traced back to its window. */
export const WINDOW_TEXT_ATTR = 'data-window-id'

interface Target {
  blockId: string
  start: number
  end: number
}

/** The document range the current text selection covers, if it lies inside a window. */
function selectionTarget(
  sel: Selection | null,
  windows: { id: string; blockId: string; range?: { start: number } }[],
): Target | null {
  const anchorEl = sel?.anchorNode instanceof Element ? sel.anchorNode : sel?.anchorNode?.parentElement
  const container = anchorEl?.closest<HTMLElement>(`[${WINDOW_TEXT_ATTR}]`)
  if (!sel || !container) return null
  const win = windows.find((w) => w.id === container.getAttribute(WINDOW_TEXT_ATTR))
  const range = win && selectionToRange(container, sel)
  if (!win || !range) return null
  // The window may show a sub-range; shift back to document offsets.
  const base = win.range?.start ?? 0
  return { blockId: win.blockId, start: base + range.start, end: base + range.end }
}

/**
 * Toggle a preset on the current text selection, or on the armed highlight when
 * nothing is selected. Shared by the keyboard shortcuts and the tappable legend.
 * Returns false when there was nothing to apply it to.
 */
export function applyPreset(presetId: string): boolean {
  const { state, update } = useStore.getState()
  const { linkSource, setLinkSource } = useUiStore.getState()
  const sel = window.getSelection()
  const armed = linkSource?.kind === 'highlight' ? state.highlights.find((h) => h.id === linkSource.id) : undefined
  // Only the range of the armed highlight, never its id: the toggle may create a new highlight.
  const target =
    selectionTarget(sel, state.windows) ?? (armed && { blockId: armed.blockId, start: armed.start, end: armed.end })
  if (!target) return false

  update((s) => toggleHighlight(s, { ...target, presetId }))
  sel?.removeAllRanges()
  // The armed highlight may have just been removed by its own preset.
  if (armed && !useStore.getState().state.highlights.some((h) => h.id === armed.id)) setLinkSource(null)
  return true
}
