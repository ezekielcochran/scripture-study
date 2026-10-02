import { useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useStore } from '../store/store'
import { createBlock, createNote, elementShowingEnd, elementsIn, nextWindowPlacement, notePlacement } from '../model/actions'
import type { LinkEnd } from '../model/types'
import { useUiStore } from '../store/uiStore'
import { Dialog } from './Dialog'

interface Props {
  onClose: () => void
  /**
   * Note mode. `about` links the new note to that highlight or block and
   * places the note beside its window; omitted means a standalone note.
   */
  note?: { about?: LinkEnd }
}

/** Create a block, or (in note mode) a note linked to an existing block or highlight. */
export function NewBlockDialog({ onClose, note }: Props) {
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  // useReactFlow gives access to the viewport so a new window lands where the user is looking.
  const { screenToFlowPosition } = useReactFlow()

  function create() {
    if (!text.trim()) return
    const { state, update } = useStore.getState()
    const ws = state.currentWorkspaceId
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    const centred = nextWindowPlacement(elementsIn(state, ws).length, center)
    if (note) {
      const source = note.about && elementShowingEnd(state, note.about)
      const placement = source ? notePlacement(source) : centred
      update((s) => createNote(s, ws, { title, text }, placement, note.about))
      // The armed end has been used; disarm it.
      if (note.about) useUiStore.getState().setLinkSource(null)
    } else {
      update((s) => createBlock(s, ws, { title, text }, centred))
    }
    onClose()
  }

  const field = 'w-full rounded border border-line bg-surface px-2 py-1 text-ink text-sm focus:border-muted focus:outline-none'
  return (
    <Dialog title={note ? (note.about ? 'New linked note' : 'New note') : 'New block'} onClose={onClose}>
      <label className="mb-2 block text-sm">
        <span className="mb-1 block text-muted">Title (optional)</span>
        <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </label>
      <label className="mb-3 block text-sm">
        <span className="mb-1 block text-muted">Text</span>
        <textarea
          className={`${field} h-56 resize-y font-serif`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={note ? 'Write your note here' : 'Paste or type the passage here'}
        />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" className="rounded px-3 py-1 text-sm hover:bg-surface-3" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="rounded bg-ink px-3 py-1 text-sm text-bg hover:opacity-90 disabled:opacity-40"
          disabled={!text.trim()}
          onClick={create}
        >
          Create
        </button>
      </div>
    </Dialog>
  )
}
