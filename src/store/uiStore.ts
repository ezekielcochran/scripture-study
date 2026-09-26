import { create } from 'zustand'

// Transient view state that is not part of the exported State: what the user is
// in the middle of doing. Never persisted.
interface UiStore {
  /** Highlight the user clicked first when creating a link, if any. */
  linkSource: string | null
  /** Link whose label is currently being edited, if any. */
  editingLinkId: string | null
  setLinkSource: (id: string | null) => void
  setEditingLink: (id: string | null) => void
}

export const useUiStore = create<UiStore>((set) => ({
  linkSource: null,
  editingLinkId: null,
  setLinkSource: (linkSource) => set({ linkSource }),
  setEditingLink: (editingLinkId) => set({ editingLinkId }),
}))
