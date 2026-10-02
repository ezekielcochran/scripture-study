import { useId } from 'react'

const W = 200
const H = 100
const CX = W / 2
const CY = H / 2

/**
 * Points along a logarithmic spiral r = r0·e^(kθ), squashed vertically so it
 * fits the oval. `phase` rotates the arm; `turns` sets how far it winds out.
 */
function spiralPath(phase: number, turns = 1.6, r0 = 3, squash = 0.5): string {
  const thetaMax = turns * 2 * Math.PI
  const rMax = CX - 6
  const k = Math.log(rMax / r0) / thetaMax
  const pts: string[] = []
  for (let t = 0; t <= thetaMax + 1e-6; t += 0.12) {
    const r = r0 * Math.exp(k * t)
    const x = CX + r * Math.cos(t + phase)
    const y = CY + r * Math.sin(t + phase) * squash
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return `M ${pts.join(' L ')}`
}

const ARMS = [spiralPath(0), spiralPath(Math.PI)]
const FAINT_ARMS = [spiralPath(Math.PI / 2, 1.3), spiralPath((3 * Math.PI) / 2, 1.3)]

// Fixed pseudo-random stars so the glyph is stable between renders.
const STARS = Array.from({ length: 26 }, (_, i) => {
  const a = i * 2.399963 // golden angle: even spread
  const r = 0.35 + ((i * 7919) % 100) / 160
  return {
    x: CX + Math.cos(a) * r * CX * 0.95,
    y: CY + Math.sin(a) * r * CY * 0.95,
    s: 0.5 + ((i * 104729) % 10) / 12,
    o: 0.4 + ((i * 31) % 6) / 10,
  }
})

/** The galaxy artwork for a portal: fills its box, decorative only. */
export function PortalGlyph() {
  // useId keeps gradient/filter ids unique when many portals are on the canvas.
  const uid = useId().replace(/:/g, '')
  const g = (name: string) => `${uid}-${name}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
      <defs>
        <radialGradient id={g('disc')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3b2a7a" />
          <stop offset="55%" stopColor="#1a1246" />
          <stop offset="100%" stopColor="#090518" />
        </radialGradient>
        <radialGradient id={g('core')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="25%" stopColor="#ffe9c4" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#c084fc" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={g('arm')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="40%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
        </linearGradient>
        <filter id={g('glow')} x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <filter id={g('haze')} x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <clipPath id={g('clip')}>
          <ellipse cx={CX} cy={CY} rx={CX} ry={CY} />
        </clipPath>
      </defs>

      {/* Outer glow and the dark disc of space. */}
      <ellipse cx={CX} cy={CY} rx={CX} ry={CY} fill="#7c3aed" opacity="0.45" filter={`url(#${g('haze')})`} />
      <ellipse cx={CX} cy={CY} rx={CX} ry={CY} fill={`url(#${g('disc')})`} />

      <g clipPath={`url(#${g('clip')})`}>
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#fff" opacity={s.o} />
        ))}
        {/* Spiral arms rotate slowly around the core (paused when motion is reduced). */}
        <g className="portal-arms" style={{ transformOrigin: `${CX}px ${CY}px` }}>
          {FAINT_ARMS.map((d, i) => (
            <path key={`f${i}`} d={d} fill="none" stroke="#a78bfa" strokeOpacity="0.35" strokeWidth="5" filter={`url(#${g('haze')})`} />
          ))}
          {ARMS.map((d, i) => (
            <g key={i}>
              <path d={d} fill="none" stroke="#c4b5fd" strokeOpacity="0.55" strokeWidth="6" strokeLinecap="round" filter={`url(#${g('glow')})`} />
              <path d={d} fill="none" stroke={`url(#${g('arm')})`} strokeWidth="1.8" strokeLinecap="round" />
            </g>
          ))}
        </g>
        <ellipse cx={CX} cy={CY} rx="30" ry="14" fill={`url(#${g('core')})`} />
      </g>

      {/* Thin rim so the oval reads as an object on the canvas. */}
      <ellipse cx={CX} cy={CY} rx={CX - 0.5} ry={CY - 0.5} fill="none" stroke="#e9d5ff" strokeOpacity="0.6" />
    </svg>
  )
}
