import { create } from 'zustand'
import type { State } from '../model/types'
import { seedState } from '../model/seed'

// The store holds exactly one `State` object (the whole app state as plain JSON)
// plus a single `replace` action. Domain actions will be added as plain functions
// that produce a new State, so logic stays out of React components.
interface Store {
  state: State
  replace: (next: State) => void
}

export const useStore = create<Store>((set) => ({
  state: seedState,
  replace: (next) => set({ state: next }),
}))
