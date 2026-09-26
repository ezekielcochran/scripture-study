import { useState } from 'react'
import { useStore } from '../store/store'
import { addPreset, deletePreset, shortcutConflict, updatePreset } from '../model/actions'
import type { Preset, PresetStyle } from '../model/types'
import { Dialog } from './Dialog'

/** Edit presets in place; every change is applied to the store immediately. */
export function PresetEditor({ onClose }: { onClose: () => void }) {
  const presets = useStore((s) => s.state.presets)
  const highlights = useStore((s) => s.state.highlights)
  const update = useStore((s) => s.update)
  const [conflict, setConflict] = useState<string | null>(null)

  function setShortcut(p: Preset, key: string | undefined) {
    const other = key ? shortcutConflict(presets, key, p.id) : undefined
    if (other) {
      setConflict(`"${key}" is already used by ${other.name}`)
      return
    }
    setConflict(null)
    update((s) => updatePreset(s, p.id, { shortcut: key }))
  }

  function remove(p: Preset) {
    const used = highlights.filter((h) => h.presetId === p.id).length
    const ok =
      used === 0 ||
      window.confirm(`Delete "${p.name}"? ${used} highlight${used === 1 ? '' : 's'} using it will be removed.`)
    if (ok) update((s) => deletePreset(s, p.id))
  }

  const setStyle = (p: Preset, style: PresetStyle) => update((s) => updatePreset(s, p.id, { style }))
  const field = 'rounded border border-gray-300 px-1.5 py-0.5 text-sm focus:border-gray-500 focus:outline-none'

  return (
    <Dialog title="Presets" onClose={onClose}>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-gray-500">
          <tr>
            <th className="pb-1 font-normal">Name</th>
            <th className="pb-1 font-normal">Key</th>
            <th className="pb-1 font-normal">Text</th>
            <th className="pb-1 font-normal">Fill</th>
            <th className="pb-1 text-center font-normal">B</th>
            <th className="pb-1 text-center font-normal">I</th>
            <th className="pb-1 text-center font-normal">U</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {presets.map((p) => (
            <tr key={p.id} className="align-middle">
              <td className="py-1 pr-2">
                <input
                  className={`${field} w-full`}
                  value={p.name}
                  onChange={(e) => update((s) => updatePreset(s, p.id, { name: e.target.value }))}
                />
              </td>
              <td className="py-1 pr-2">
                {/* Captures the pressed key instead of typing into the field. */}
                <input
                  className={`${field} w-10 text-center font-mono`}
                  value={p.shortcut ?? ''}
                  placeholder="–"
                  readOnly
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' || e.key === 'Delete') setShortcut(p, undefined)
                    else if (e.key.length === 1) setShortcut(p, e.key)
                    else return
                    e.preventDefault()
                  }}
                />
              </td>
              <td className="py-1 pr-2">
                <ColorField value={p.style.color} onChange={(color) => setStyle(p, { color })} />
              </td>
              <td className="py-1 pr-2">
                <ColorField value={p.style.background} onChange={(background) => setStyle(p, { background })} />
              </td>
              {(['bold', 'italic', 'underline'] as const).map((flag) => (
                <td key={flag} className="py-1 text-center">
                  <input
                    type="checkbox"
                    checked={p.style[flag] ?? false}
                    onChange={(e) => setStyle(p, { [flag]: e.target.checked || undefined })}
                  />
                </td>
              ))}
              <td className="py-1 pl-2 text-right">
                <button type="button" className="rounded px-2 text-gray-500 hover:bg-gray-100" onClick={() => remove(p)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {conflict && <div className="mt-2 text-xs text-red-600">{conflict}</div>}
      <div className="mt-3 flex justify-between">
        <button
          type="button"
          className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          onClick={() => update((s) => addPreset(s, { name: 'New preset', style: { background: '#e0f2fe' } }))}
        >
          Add preset
        </button>
        <button type="button" className="rounded bg-gray-800 px-3 py-1 text-sm text-white hover:bg-gray-700" onClick={onClose}>
          Done
        </button>
      </div>
    </Dialog>
  )
}

/** A colour picker with a clear button, since "no colour" is a valid preset value. */
function ColorField({ value, onChange }: { value: string | undefined; onChange: (v: string | undefined) => void }) {
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="color"
        className={`h-6 w-8 cursor-pointer border-0 bg-transparent p-0 ${value ? '' : 'opacity-25'}`}
        title={value ?? 'Not set'}
        value={value ?? '#000000'}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className={`rounded px-1 text-xs text-gray-400 hover:bg-gray-100 ${value ? '' : 'invisible'}`}
        title="Clear"
        onClick={() => onChange(undefined)}
      >
        ×
      </button>
    </span>
  )
}
