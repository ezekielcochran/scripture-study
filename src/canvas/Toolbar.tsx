import { useRef, useState } from 'react'
import { Panel } from '@xyflow/react'
import { useStore } from '../store/store'
import { downloadStateFile, readStateFile } from '../storage'
import { NewDocumentDialog } from './NewDocumentDialog'
import { PresetEditor } from './PresetEditor'

type Open = 'document' | 'presets' | null

/** Top-right actions: new document, presets, export, import. */
export function Toolbar() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [open, setOpen] = useState<Open>(null)

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
