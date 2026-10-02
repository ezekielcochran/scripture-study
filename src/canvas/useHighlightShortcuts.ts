import { useEffect } from 'react'
import { useStore } from '../store/store'
import { presetForShortcut } from '../model/actions'
import { applyPreset } from './applyPreset'

export { WINDOW_TEXT_ATTR } from './applyPreset'

/**
 * Keyboard-first highlighting: select text in a window, press a preset's shortcut.
 * Pressing it again on text inside that highlight removes it. With no selection,
 * a highlight armed by clicking (the link source) is used as the target instead.
 * Installs one document-level keydown listener while the component is mounted.
 */
export function useHighlightShortcuts() {
  // useEffect: subscribing to a global DOM event is a side effect that must be
  // set up after render and torn down on unmount.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable]')) return
      const preset = presetForShortcut(useStore.getState().state.presets, e.key)
      if (!preset) return
      if (applyPreset(preset.id)) e.preventDefault()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])
}
