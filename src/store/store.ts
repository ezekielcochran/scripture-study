import { create } from 'zustand'
import type { State } from '../model/types'
import { seedState } from '../model/seed'

// The store holds exactly one `State` object (the whole app state as plain JSON).
// All changes go through `update` with a pure State -> State function from
// src/model/actions.ts, so business logic never lives in React components.
interface Store {
  state: State
  update: (fn: (s: State) => State) => void
  replace: (next: State) => void
}

export const useStore = create<Store>((set) => ({
  state: seedState,
  update: (fn) => set((s) => ({ state: fn(s.state) })),
  replace: (next) => set({ state: next }),
}))
