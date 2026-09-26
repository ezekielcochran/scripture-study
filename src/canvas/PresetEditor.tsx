import { useState } from 'react'
import { useStore } from '../store/store'
import { addPreset, deletePreset, movePreset, shortcutConflict, updatePreset } from '../model/actions'
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

  // Colour pickers fire continuously while dragging; fold each into one step.
  const setStyle = (p: Preset, style: PresetStyle) =>
    update((s) => updatePreset(s, p.id, { style }), { key: `preset-style:${p.id}:${Object.keys(style).join()}` })
  const field = 'rounded border border-line bg-surface px-1.5 py-0.5 text-ink text-sm focus:border-muted focus:outline-none'

  return (
    <Dialog title="Presets" onClose={onClose}>
      <p className="mb-2 text-xs text-muted">
        Where highlights overlap, their styles combine. If two presets contradict (both set a text colour, or both a
        fill), the one higher in this list wins.
      </p>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted">
          <tr>
            <th />
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
          {presets.map((p, i) => (
            <tr key={p.id} className="align-middle">
              <td className="py-1 pr-1">
                <span className="flex flex-col leading-none">
                  <button
                    type="button"
                    className="rounded px-1 text-xs text-muted hover:bg-surface-3 disabled:opacity-30"
                    title="Move up (higher priority)"
                    disabled={i === 0}
                    onClick={() => update((s) => movePreset(s, p.id, -1))}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="rounded px-1 text-xs text-muted hover:bg-surface-3 disabled:opacity-30"
                    title="Move down (lower priority)"
                    disabled={i === presets.length - 1}
                    onClick={() => update((s) => movePreset(s, p.id, 1))}
                  >
                    ▼
                  </button>
                </span>
              </td>
              <td className="py-1 pr-2">
                <input
                  className={`${field} w-full`}
                  value={p.name}
                  onChange={(e) => update((s) => updatePreset(s, p.id, { name: e.target.value }), { key: `preset-name:${p.id}` })}
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
                <button type="button" className="rounded px-2 text-muted hover:bg-surface-3" onClick={() => remove(p)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {conflict && <div className="mt-2 text-xs text-danger">{conflict}</div>}
      <div className="mt-3 flex justify-between">
        <button
          type="button"
          className="rounded border border-line px-3 py-1 text-sm hover:bg-surface-3"
          onClick={() => update((s) => addPreset(s, { name: 'New preset', style: { background: '#e0f2fe' } }))}
        >
          Add preset
        </button>
        <button type="button" className="rounded bg-ink px-3 py-1 text-sm text-bg hover:opacity-90" onClick={onClose}>
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
        className={`rounded px-1 text-xs text-muted hover:bg-surface-3 ${value ? '' : 'invisible'}`}
        title="Clear"
        onClick={() => onChange(undefined)}
      >
        ×
      </button>
    </span>
  )
}
