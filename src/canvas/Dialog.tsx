import { useEffect, type ReactNode } from 'react'

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
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-label={title}
        className="w-[36rem] max-w-[95vw] rounded border border-gray-300 bg-white p-4 shadow-lg"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-medium">{title}</h2>
          <button type="button" className="rounded px-2 text-gray-500 hover:bg-gray-100" onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
