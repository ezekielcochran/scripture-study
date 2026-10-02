import { useCallback, useRef } from 'react'

/**
 * Wheel handling for scrollable text inside a canvas window. A plain scroll is
 * consumed by the text only when it can actually scroll that way; otherwise, and
 * for pinch gestures (ctrl/meta + wheel), the event reaches the canvas so zooming
 * never feels stuck over a window. Attach the returned ref to the element.
 */
export function useSmartWheel() {
  const cleanup = useRef<(() => void) | null>(null)
  // Callback ref: the element changes when a window toggles edit mode, so the
  // listener must follow whichever element is currently mounted.
  return useCallback((el: HTMLElement | null) => {
    cleanup.current?.()
    cleanup.current = null
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return
      const up = e.deltaY < 0
      const canScroll = up ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1
      if (canScroll) e.stopPropagation()
    }
    // Native listener: React Flow's zoom listener sits on an ancestor and would
    // otherwise see the event before a React handler could stop it.
    el.addEventListener('wheel', onWheel, { passive: true })
    cleanup.current = () => el.removeEventListener('wheel', onWheel)
  }, [])
}
