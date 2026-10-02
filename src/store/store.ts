import { create } from 'zustand'
import type { State } from '../model/types'
import { seedState } from '../model/seed'
import { emptyHistory, record, redo, undo, type History, type RecordOptions } from './history'

// The store holds exactly one `State` object (the whole app state as plain JSON).
// All changes go through `update` with a pure State -> State function from
// src/model/actions.ts, so business logic never lives in React components.
// Every change is recorded for undo/redo unless the caller opts out.
interface Store {
  state: State
  history: History<State>
  update: (fn: (s: State) => State, opts?: RecordOptions) => void
  replace: (next: State, opts?: RecordOptions) => void
  undo: () => void
  redo: () => void
}

/**
 * Undo/redo should not teleport the user between workspaces: keep the current
 * one unless the restored state no longer has it.
 */
function keepWorkspace(restored: State, current: State): State {
  const id = current.currentWorkspaceId
  if (restored.currentWorkspaceId === id || !restored.workspaces.some((w) => w.id === id)) return restored
  return { ...restored, currentWorkspaceId: id }
}

export const useStore = create<Store>((set) => ({
  state: seedState,
  history: emptyHistory(),
  update: (fn, opts) =>
    set((s) => {
      const next = fn(s.state)
      if (next === s.state) return s
      return { state: next, history: record(s.history, s.state, opts) }
    }),
  replace: (next, opts) =>
    set((s) => (next === s.state ? s : { state: next, history: record(s.history, s.state, opts) })),
  undo: () =>
    set((s) => {
      const r = undo(s.history, s.state)
      return r ? { state: keepWorkspace(r.state, s.state), history: r.history } : s
    }),
  redo: () =>
    set((s) => {
      const r = redo(s.history, s.state)
      return r ? { state: keepWorkspace(r.state, s.state), history: r.history } : s
    }),
}))
