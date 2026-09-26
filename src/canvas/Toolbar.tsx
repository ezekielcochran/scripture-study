import { useRef, useState } from 'react'
import { Panel } from '@xyflow/react'
import { useStore } from '../store/store'
import { downloadStateFile, readStateFile } from '../storage'
import { NewDocumentDialog } from './NewDocumentDialog'
import { DocumentsDialog } from './DocumentsDialog'
import { PresetEditor } from './PresetEditor'

type Open = 'new' | 'documents' | 'presets' | null

/** Top-right actions: new document, presets, export, import. */
export function Toolbar() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [open, setOpen] = useState<Open>(null)
  const canUndo = useStore((s) => s.history.past.length > 0)
  const canRedo = useStore((s) => s.history.future.length > 0)

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

  const button = 'rounded border border-line bg-surface px-2 py-1 text-sm shadow hover:bg-surface-3'
  return (
    <>
      <Panel position="top-right" className="flex items-center gap-2">
        {message && <span className="text-xs text-muted">{message}</span>}
        <button
          type="button"
          className={`${button} disabled:opacity-40`}
          disabled={!canUndo}
          title="Undo (⌘Z / Ctrl+Z)"
          onClick={() => useStore.getState().undo()}
        >
          Undo
        </button>
        <button
          type="button"
          className={`${button} disabled:opacity-40`}
          disabled={!canRedo}
          title="Redo (⇧⌘Z / Ctrl+Y)"
          onClick={() => useStore.getState().redo()}
        >
          Redo
        </button>
        <button type="button" className={button} onClick={() => setOpen('new')}>
          New document
        </button>
        <button type="button" className={button} onClick={() => setOpen('documents')}>
          Documents
        </button>
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
      {open === 'new' && <NewDocumentDialog onClose={() => setOpen(null)} />}
      {open === 'documents' && <DocumentsDialog onClose={() => setOpen(null)} />}
      {open === 'presets' && <PresetEditor onClose={() => setOpen(null)} />}
    </>
  )
}
