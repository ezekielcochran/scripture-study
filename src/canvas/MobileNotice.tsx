import { useEffect, useState } from 'react'

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
  // Fixed and above the canvas (which has its own stacking contexts), so nothing on it can overlap.
  return (
    <div
      role="alert"
      className="fixed top-3 left-1/2 z-[100000] flex w-[min(92vw,28rem)] -translate-x-1/2 items-start gap-3 rounded-md border-2 border-warn-line bg-warn-bg px-4 py-3 text-sm text-warn-ink shadow-lg"
    >
      <span className="grow">
        This app is designed for a desktop browser with a keyboard. It may be hard to use on a phone.
      </span>
      <button
        type="button"
        className="shrink-0 rounded px-2 text-lg leading-none hover:opacity-70"
        title="Dismiss"
        onClick={() => {
          localStorage.setItem(DISMISSED_KEY, '1')
          setShow(false)
        }}
      >
        ×
      </button>
    </div>
  )
}
