import { useRef, useState } from 'react'
import { Panel, useReactFlow } from '@xyflow/react'
import { useStore } from '../store/store'
import { nextWindowPlacement, openWindow } from '../model/actions'
import { downloadStateFile, readStateFile } from '../storage'
import { NewDocumentDialog } from './NewDocumentDialog'
import { PresetEditor } from './PresetEditor'

type Open = 'document' | 'presets' | null

/** Top-right actions: new document, presets, export, import. */
export function Toolbar() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [open, setOpen] = useState<Open>(null)
  const documents = useStore((s) => s.state.documents)
  const { screenToFlowPosition } = useReactFlow()

  function openDocument(documentId: string) {
    const { state, update } = useStore.getState()
    const layout = state.layouts[0]
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    update((s) => openWindow(s, layout.id, documentId, nextWindowPlacement(layout.windows, center)))
  }

  function onExport() {
    downloadStateFile(useStore.getState().state)
  }

  async function onFileChosen(file: File | undefined) {
    if (!file) return
    const result = await readStateFile(file)
    if (result.ok) {
      useStore.getState().replace(result.state)
      setMessage(`Imported ${file.name}`)
    } else {
      setMessage(`Import failed: ${result.error}`)
    }
    // Reset so choosing the same file again fires onChange.
    if (fileInput.current) fileInput.current.value = ''
  }

  const button = 'rounded border border-gray-300 bg-white px-2 py-1 text-sm shadow hover:bg-gray-50'
  return (
    <>
      <Panel position="top-right" className="flex items-center gap-2">
        {message && <span className="text-xs text-gray-600">{message}</span>}
        <button type="button" className={button} onClick={() => setOpen('document')}>
          New document
        </button>
        {/* A native select keeps this keyboard-accessible with no extra code. Value is
            reset to '' so the same document can be opened again. */}
        <select
          className={button}
          value=""
          disabled={documents.length === 0}
          onChange={(e) => e.target.value && openDocument(e.target.value)}
        >
          <option value="">Open document…</option>
          {documents.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title ?? 'Untitled'}
            </option>
          ))}
        </select>
        <button type="button" className={button} onClick={() => setOpen('presets')}>
          Presets
        </button>
        <button type="button" className={button} onClick={onExport}>
          Export JSON
        </button>
        <button type="button" className={button} onClick={() => fileInput.current?.click()}>
          Import JSON
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void onFileChosen(e.target.files?.[0])}
        />
      </Panel>
      {open === 'document' && <NewDocumentDialog onClose={() => setOpen(null)} />}
      {open === 'presets' && <PresetEditor onClose={() => setOpen(null)} />}
    </>
  )
}
