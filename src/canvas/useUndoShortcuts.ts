import { useEffect } from 'react'
import { useStore } from '../store/store'

/**
 * Cmd/Ctrl+Z undoes, Cmd/Ctrl+Shift+Z or Ctrl+Y redoes. Ignored while typing in
 * a field so the browser's own text undo keeps working there.
 */
export function useUndoShortcuts() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable]')) return
      const key = e.key.toLowerCase()
      const isUndo = key === 'z' && !e.shiftKey
      const isRedo = (key === 'z' && e.shiftKey) || (key === 'y' && e.ctrlKey)
      if (!isUndo && !isRedo) return
      e.preventDefault()
      if (isUndo) useStore.getState().undo()
      else useStore.getState().redo()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])
}
