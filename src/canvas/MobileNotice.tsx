import { useEffect, useState } from 'react'
import { Panel } from '@xyflow/react'

const QUERY = '(pointer: coarse) and (max-width: 900px)'
const DISMISSED_KEY = 'text-study:mobile-notice-dismissed'

/** One-time warning on small touch devices; the app is built for a keyboard and a large screen. */
export function MobileNotice() {
  const [show, setShow] = useState(false)

  // useEffect: matchMedia and localStorage are browser APIs, read after mount.
  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return
    const mq = window.matchMedia(QUERY)
    const apply = () => setShow(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  if (!show) return null
  return (
    <Panel position="top-center" className="mt-16! max-w-[90vw] rounded border border-accent bg-surface px-3 py-2 text-sm shadow">
      <div className="flex items-start gap-3">
        <span>This app is designed for a desktop browser with a keyboard. It may be hard to use on a phone.</span>
        <button
          type="button"
          className="shrink-0 rounded px-1.5 text-muted hover:bg-surface-3"
          title="Dismiss"
          onClick={() => {
            localStorage.setItem(DISMISSED_KEY, '1')
            setShow(false)
          }}
        >
          ×
        </button>
      </div>
    </Panel>
  )
}
