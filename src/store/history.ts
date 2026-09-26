/**
 * Undo/redo history as a pure value: a stack of past snapshots and a stack of
 * undone ones. Snapshots share structure with each other, so keeping many is cheap.
 */
export interface History<T> {
  past: T[]
  future: T[]
  /** Coalesce key of the most recent recorded change, and when it happened. */
  lastKey: string | null
  lastAt: number
}

export interface RecordOptions {
  /** Consecutive changes with the same key fold into one undo step. */
  key?: string
  /** How long (ms) after the previous same-key change coalescing still applies. Default 1000. */
  within?: number
  /** Do not record this change at all (e.g. bring-to-front on click). */
  skip?: boolean
  /** Clock override for tests. */
  now?: number
}

export const MAX_HISTORY = 200
const DEFAULT_WITHIN = 1000

export function emptyHistory<T>(): History<T> {
  return { past: [], future: [], lastKey: null, lastAt: 0 }
}

/** Record that `current` is about to be replaced. Returns the new history. */
export function record<T>(h: History<T>, current: T, opts: RecordOptions = {}): History<T> {
  if (opts.skip) return h
  const now = opts.now ?? Date.now()
  const within = opts.within ?? DEFAULT_WITHIN
  const coalesce = opts.key !== undefined && opts.key === h.lastKey && now - h.lastAt <= within
  if (coalesce) return { ...h, lastAt: now, future: [] }
  const past = [...h.past, current].slice(-MAX_HISTORY)
  return { past, future: [], lastKey: opts.key ?? null, lastAt: now }
}

export function undo<T>(h: History<T>, current: T): { history: History<T>; state: T } | null {
  const state = h.past.at(-1)
  if (state === undefined) return null
  return {
    state,
    history: { past: h.past.slice(0, -1), future: [...h.future, current], lastKey: null, lastAt: 0 },
  }
}

export function redo<T>(h: History<T>, current: T): { history: History<T>; state: T } | null {
  const state = h.future.at(-1)
  if (state === undefined) return null
  return {
    state,
    history: { past: [...h.past, current], future: h.future.slice(0, -1), lastKey: null, lastAt: 0 },
  }
}
