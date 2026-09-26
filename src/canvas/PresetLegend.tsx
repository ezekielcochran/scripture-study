import { Panel } from '@xyflow/react'
import { useStore } from '../store/store'
import { useUiStore } from '../store/uiStore'
import { presetStyleToCss } from '../lib/style'
import { activePresetsFor } from '../model/actions'

/** Lists presets and their shortcuts so the keyboard flow is discoverable. */
export function PresetLegend() {
  const presets = useStore((s) => s.state.presets)
  const state = useStore((s) => s.state)
  const linkSource = useUiStore((s) => s.linkSource)
  // While a highlight is armed, mark the presets its key would toggle off.
  const active = linkSource?.kind === 'highlight' ? activePresetsFor(state, linkSource.id) : new Set<string>()
  return (
    <Panel position="top-left" className="rounded border border-line bg-surface px-3 py-2 text-sm shadow">
      <div className="mb-1 text-xs text-muted">Select text, then press a key.<br />Click highlights or window Link buttons to connect them.</div>
      <ul className="space-y-0.5">
        {presets.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <kbd
              className={`rounded border px-1 font-mono text-xs ${
                active.has(p.id) ? 'border-accent bg-accent-soft font-bold' : 'border-line bg-surface-2'
              }`}
              title={active.has(p.id) ? 'Applied to the armed highlight' : undefined}
            >
              {p.shortcut ?? '–'}
            </kbd>
            <span className="rounded px-1" style={presetStyleToCss(p.style)}>
              {p.name}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
