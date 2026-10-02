import { useEffect, type ReactNode } from 'react'
import { LINK_KEEP_ATTR } from './linking'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

/** Minimal modal: dimmed backdrop, Escape or backdrop click closes. */
export function Dialog({ title, onClose, children }: Props) {
  // useEffect: a global key listener is a side effect tied to the dialog's lifetime.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      // Clicks inside a dialog keep a pending link armed (the note dialog relies on it).
      {...{ [LINK_KEEP_ATTR]: '' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-label={title}
        className="flex max-h-[85vh] w-[36rem] max-w-[95vw] flex-col rounded border border-line bg-surface p-4 shadow-lg"
      >
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h2 className="text-base font-medium">{title}</h2>
          <button type="button" className="rounded px-2 text-muted hover:bg-surface-3" onClick={onClose}>
            ×
          </button>
        </div>
        {/* min-h-0 lets this flex child shrink so long lists scroll inside the dialog. */}
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
