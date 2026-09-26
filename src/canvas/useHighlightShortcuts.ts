import { useEffect } from 'react'
import { useStore } from '../store/store'
import { useUiStore } from '../store/uiStore'
import { presetForShortcut, toggleHighlight } from '../model/actions'
import { selectionToRange } from '../lib/selection'

/** Attribute set on each window's text container so a selection can be traced back to its window. */
export const WINDOW_TEXT_ATTR = 'data-window-id'

interface Target {
  documentId: string
  start: number
  end: number
}

/** The document range the current text selection covers, if it lies inside a window. */
function selectionTarget(sel: Selection | null, windows: { id: string; documentId: string; range?: { start: number } }[]): Target | null {
  const anchorEl = sel?.anchorNode instanceof Element ? sel.anchorNode : sel?.anchorNode?.parentElement
  const container = anchorEl?.closest<HTMLElement>(`[${WINDOW_TEXT_ATTR}]`)
  if (!sel || !container) return null
  const win = windows.find((w) => w.id === container.getAttribute(WINDOW_TEXT_ATTR))
  const range = win && selectionToRange(container, sel)
  if (!win || !range) return null
  // The window may show a sub-range; shift back to document offsets.
  const base = win.range?.start ?? 0
  return { documentId: win.documentId, start: base + range.start, end: base + range.end }
}

/**
 * Keyboard-first highlighting: select text in a window, press a preset's shortcut.
 * Pressing it again on text inside that highlight removes it. With no selection,
 * a highlight armed by clicking (the link source) is used as the target instead,
 * so a click followed by a key toggles presets on that highlight.
 * Installs one document-level keydown listener while the component is mounted.
 */
export function useHighlightShortcuts() {
  // useEffect: subscribing to a global DOM event is a side effect that must be
  // set up after render and torn down on unmount.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable]')) return

      const { state, update } = useStore.getState()
      const preset = presetForShortcut(state.presets, e.key)
      if (!preset) return

      const { linkSource, setLinkSource } = useUiStore.getState()
      const sel = window.getSelection()
      const armed = linkSource !== null ? state.highlights.find((h) => h.id === linkSource) : undefined
      const target = selectionTarget(sel, state.layouts.flatMap((l) => l.windows)) ?? armed
      if (!target) return

      e.preventDefault()
      update((s) => toggleHighlight(s, { ...target, presetId: preset.id }))
      sel?.removeAllRanges()
      // The armed highlight may have just been removed by its own key.
      if (armed && !useStore.getState().state.highlights.some((h) => h.id === armed.id)) setLinkSource(null)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])
}
