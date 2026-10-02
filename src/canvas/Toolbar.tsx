import { useRef, useState } from 'react'
import { Panel } from '@xyflow/react'
import { useStore } from '../store/store'
import { useUiStore } from '../store/uiStore'
import { downloadStateFile, readStateFile } from '../storage'
import { NewBlockDialog } from './NewBlockDialog'
import { BlocksDialog } from './BlocksDialog'
import { LINK_KEEP_ATTR } from './linking'
import { PortalDialog } from './PortalDialog'
import { PresetEditor } from './PresetEditor'

type Open = 'new' | 'note' | 'portal' | 'blocks' | 'presets' | null

/** Top-right actions: undo/redo, presets, new block, new note, blocks, export, import. */
export function Toolbar() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [open, setOpen] = useState<Open>(null)
  const canUndo = useStore((s) => s.history.past.length > 0)
  const canRedo = useStore((s) => s.history.future.length > 0)
  const linkSource = useUiStore((s) => s.linkSource)

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
      {/* Wraps into rows on narrow screens; the max width keeps it clear of the legend on the left. */}
      <Panel position="top-right" className="flex max-w-[calc(100vw-330px)] flex-wrap items-center justify-end gap-2">
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
        <button type="button" className={button} onClick={() => setOpen('presets')}>
          Presets
        </button>
        <button type="button" className={button} onClick={() => setOpen('new')}>
          New block
        </button>
        <button
          type="button"
          className={`${button} ${linkSource ? 'border-accent' : ''}`}
          title={linkSource ? 'Create a note linked to the armed highlight or block' : 'Create a note'}
          {...{ [LINK_KEEP_ATTR]: '' }}
          onClick={() => setOpen('note')}
        >
          New note
        </button>
        <button type="button" className={button} title="Add a portal to another workspace" onClick={() => setOpen('portal')}>
          New portal
        </button>
        <button type="button" className={button} onClick={() => setOpen('blocks')}>
          Blocks
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
      {open === 'new' && <NewBlockDialog onClose={() => setOpen(null)} />}
      {open === 'note' && <NewBlockDialog note={{ about: linkSource ?? undefined }} onClose={() => setOpen(null)} />}
      {open === 'portal' && <PortalDialog onClose={() => setOpen(null)} />}
      {open === 'blocks' && <BlocksDialog onClose={() => setOpen(null)} />}
      {open === 'presets' && <PresetEditor onClose={() => setOpen(null)} />}
    </>
  )
}
