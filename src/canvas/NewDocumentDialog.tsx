import { useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useStore } from '../store/store'
import { createDocument, createNote, nextWindowPlacement, notePlacement } from '../model/actions'
import type { Window } from '../model/types'
import { Dialog } from './Dialog'

interface Props {
  onClose: () => void
  /** When set, creates a note linked to this document, placed beside the given window. */
  note?: { aboutDocumentId: string; source: Window }
}

/** Create a document, or (in note mode) a note linked to an existing document. */
export function NewDocumentDialog({ onClose, note }: Props) {
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  // useReactFlow gives access to the viewport so a new window lands where the user is looking.
  const { screenToFlowPosition } = useReactFlow()

  function create() {
    if (!text.trim()) return
    const { state, update } = useStore.getState()
    const layout = state.layouts[0]
    if (note) {
      update((s) => createNote(s, layout.id, { title, text }, notePlacement(note.source), note.aboutDocumentId))
    } else {
      const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
      update((s) => createDocument(s, layout.id, { title, text }, nextWindowPlacement(layout.windows, center)))
    }
    onClose()
  }

  const field = 'w-full rounded border border-line bg-surface px-2 py-1 text-ink text-sm focus:border-muted focus:outline-none'
  return (
    <Dialog title={note ? 'New note' : 'New document'} onClose={onClose}>
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
