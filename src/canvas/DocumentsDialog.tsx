import { useReactFlow } from '@xyflow/react'
import { useStore } from '../store/store'
import {
  deleteDocument,
  findOpenWindow,
  nextWindowPlacement,
  openDocument,
  pruneLinks,
  setDocumentTitle,
} from '../model/actions'
import type { Document } from '../model/types'
import { Dialog } from './Dialog'

/** List, retitle, open (or focus), and delete documents. Edits apply immediately. */
export function DocumentsDialog({ onClose }: { onClose: () => void }) {
  const state = useStore((s) => s.state)
  const update = useStore((s) => s.update)
  const { screenToFlowPosition, setCenter, getZoom } = useReactFlow()
  const layout = state.layouts[0]

  function show(doc: Document) {
    const existing = findOpenWindow(layout, doc.id)
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    // Focusing an already-open window is not worth an undo step; opening a new one is.
    update((s) => openDocument(s, layout.id, doc.id, nextWindowPlacement(layout.windows, center)), { skip: !!existing })
    if (existing) {
      // Pan to the window that was brought to the front, keeping the current zoom.
      void setCenter(existing.x + existing.width / 2, existing.y + existing.height / 2, {
        zoom: getZoom(),
        duration: 300,
      })
    }
    onClose()
  }

  function remove(doc: Document) {
    const ids = new Set(state.highlights.filter((h) => h.documentId === doc.id).map((h) => h.id))
    const links = state.links.length - pruneLinks(state.links, { highlights: ids, documents: new Set([doc.id]) }).length
    const name = doc.title ?? 'Untitled'
    const detail = ids.size || links ? ` ${ids.size} highlight(s) and ${links} link(s) will be removed.` : ''
    if (window.confirm(`Delete "${name}"?${detail}`)) update((s) => deleteDocument(s, doc.id))
  }

  const field = 'w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-gray-500 focus:outline-none'
  const button = 'rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50'

  return (
    <Dialog title="Documents" onClose={onClose}>
      {state.documents.length === 0 ? (
        <div className="text-sm text-gray-500">No documents yet.</div>
      ) : (
        <ul className="space-y-2">
          {state.documents.map((doc) => {
            const open = findOpenWindow(layout, doc.id) !== undefined
            return (
              <li key={doc.id} className="flex items-center gap-2">
                <input
                  className={field}
                  value={doc.title ?? ''}
                  placeholder="Untitled"
                  onChange={(e) => update((s) => setDocumentTitle(s, doc.id, e.target.value), { key: `title:${doc.id}` })}
                />
                <span className="w-24 shrink-0 truncate text-xs text-gray-400" title={doc.text}>
                  {doc.text.length} chars
                </span>
                <button type="button" className={`${button} w-16 shrink-0`} onClick={() => show(doc)}>
                  {open ? 'Show' : 'Open'}
                </button>
                <button type="button" className={`${button} shrink-0 text-gray-500`} onClick={() => remove(doc)}>
                  Delete
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Dialog>
  )
}
