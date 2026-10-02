import { Panel } from '@xyflow/react'
import { useStore } from '../store/store'
import { useUiStore } from '../store/uiStore'
import { presetStyleToCss } from '../lib/style'
import { activePresetsFor } from '../model/actions'
import { applyPreset } from './applyPreset'
import { LINK_KEEP_ATTR } from './linking'

/**
 * Lists presets with their shortcuts. Each row is also a button that applies the
 * preset to the current selection (or the armed highlight), for touch and mouse use.
 */
export function PresetLegend() {
  const presets = useStore((s) => s.state.presets)
  const state = useStore((s) => s.state)
  const linkSource = useUiStore((s) => s.linkSource)
  // While a highlight is armed, mark the presets its key would toggle off.
  const active = linkSource?.kind === 'highlight' ? activePresetsFor(state, linkSource.id) : new Set<string>()
  return (
    <Panel position="top-left" className="rounded border border-line bg-surface px-3 py-2 text-sm shadow select-none">
      <div className="mb-1 text-xs text-muted">
        Select text, then press a key or tap a preset.
        <br />
        Click highlights or window Link buttons to connect them.
      </div>
      <ul className="space-y-0.5">
        {presets.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-surface-3 active:bg-surface-3"
              title="Apply to the selection"
              // Valid target while a highlight is armed: tapping must not disarm it.
              {...{ [LINK_KEEP_ATTR]: '' }}
              // Prevent the default so the tap/click does not collapse the text selection
              // or move focus before the preset is applied.
              onPointerDown={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyPreset(p.id)}
            >
              <kbd
                className={`rounded border px-1 font-mono text-xs ${
                  active.has(p.id) ? 'border-accent bg-accent-soft font-bold' : 'border-line bg-surface-2'
                }`}
              >
                {p.shortcut ?? '–'}
              </kbd>
              <span className="rounded px-1" style={presetStyleToCss(p.style)}>
                {p.name}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
