import { useEffect } from 'react'
import { useStore } from '../store/store'
import { presetForShortcut, toggleHighlight } from '../model/actions'
import { selectionToRange } from '../lib/selection'

/** Attribute set on each window's text container so a selection can be traced back to its window. */
export const WINDOW_TEXT_ATTR = 'data-window-id'

/**
 * Keyboard-first highlighting: select text in a window, press a preset's shortcut.
 * Pressing it again on text inside that highlight removes it.
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

      const sel = window.getSelection()
      const anchorEl =
        sel?.anchorNode instanceof Element ? sel.anchorNode : sel?.anchorNode?.parentElement
      const container = anchorEl?.closest<HTMLElement>(`[${WINDOW_TEXT_ATTR}]`)
      if (!sel || !container) return

      const win = state.layouts
        .flatMap((l) => l.windows)
        .find((w) => w.id === container.getAttribute(WINDOW_TEXT_ATTR))
      if (!win) return

      const range = selectionToRange(container, sel)
      if (!range) return

      // The window may show a sub-range; shift back to document offsets.
      const base = win.range?.start ?? 0
      e.preventDefault()
      update((s) =>
        toggleHighlight(s, {
          documentId: win.documentId,
          start: base + range.start,
          end: base + range.end,
          presetId: preset.id,
        }),
      )
      sel.removeAllRanges()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])
}
