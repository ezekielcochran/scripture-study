import { create } from 'zustand'
import type { LinkEnd } from '../model/types'

// Transient view state that is not part of the exported State: what the user is
// in the middle of doing. Never persisted.
interface UiStore {
  /** The end the user picked first when creating a link, if any. */
  linkSource: LinkEnd | null
  /** Link whose label is currently being edited, if any. */
  editingLinkId: string | null
  setLinkSource: (end: LinkEnd | null) => void
  setEditingLink: (id: string | null) => void
}

export const useUiStore = create<UiStore>((set) => ({
  linkSource: null,
  editingLinkId: null,
  setLinkSource: (linkSource) => set({ linkSource }),
  setEditingLink: (editingLinkId) => set({ editingLinkId }),
}))
