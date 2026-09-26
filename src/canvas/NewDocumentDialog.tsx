import { useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useStore } from '../store/store'
import { createDocument, nextWindowPlacement } from '../model/actions'
import { Dialog } from './Dialog'

export function NewDocumentDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  // useReactFlow gives access to the viewport so the new window lands where the user is looking.
  const { screenToFlowPosition } = useReactFlow()

  function create() {
    if (!text.trim()) return
    const { state, update } = useStore.getState()
    const layout = state.layouts[0]
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    update((s) => createDocument(s, layout.id, { title, text }, nextWindowPlacement(layout.windows, center)))
    onClose()
  }

  const field = 'w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-gray-500 focus:outline-none'
  return (
    <Dialog title="New document" onClose={onClose}>
      <label className="mb-2 block text-sm">
        <span className="mb-1 block text-gray-600">Title (optional)</span>
        <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </label>
      <label className="mb-3 block text-sm">
        <span className="mb-1 block text-gray-600">Text</span>
        <textarea
          className={`${field} h-56 resize-y font-serif`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste or type the passage here"
        />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" className="rounded px-3 py-1 text-sm hover:bg-gray-100" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="rounded bg-gray-800 px-3 py-1 text-sm text-white hover:bg-gray-700 disabled:opacity-40"
          disabled={!text.trim()}
          onClick={create}
        >
          Create
        </button>
      </div>
    </Dialog>
  )
}
