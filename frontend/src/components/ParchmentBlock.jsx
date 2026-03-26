import { useEffect, useRef, useState } from 'react'
import { parchmentPath } from './parchmentPath'

const TYPE_CONFIG = {
  claim:      { fill: '#F3EDE4', stroke: '#C4A048', strokeOpacity: 0.6, roughness: 6  },
  understand: { fill: '#F3EDE4', stroke: '#C4A048', strokeOpacity: 0.6, roughness: 6  },
  steelman:   { fill: '#EDE0C4', stroke: '#C4A048', strokeOpacity: 0.8, roughness: 6  },
  attack:     { fill: '#6B1020', stroke: '#A8841E', strokeOpacity: 1.0, roughness: 10 },
  socratic:   { fill: '#FDF5E6', stroke: '#C4A048', strokeOpacity: 0.7, roughness: 6  },
  synthesis:  { fill: '#F0E8D4', stroke: '#A8841E', strokeOpacity: 1.0, roughness: 6  },
}

export default function ParchmentBlock({ type = 'claim', label, isStreaming, children }) {
  const containerRef = useRef(null)
  const [svg, setSvg] = useState(null)

  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.claim
  const isDark = type === 'attack'

  // (Re-)generate SVG once streaming stops and layout is settled
  useEffect(() => {
    if (isStreaming) {
      setSvg(null)
      return
    }
    const el = containerRef.current
    if (!el) return

    // rAF ensures layout is complete before measuring
    const raf = requestAnimationFrame(() => {
      const { width, height } = el.getBoundingClientRect()
      if (width === 0 || height === 0) return
      const d = parchmentPath(width, height, cfg.roughness)
      setSvg({ d, width, height })
    })
    return () => cancelAnimationFrame(raf)
  }, [isStreaming, cfg.roughness])

  // While streaming: render content plainly (no SVG, no hidden)
  if (isStreaming) {
    return (
      <div
        ref={containerRef}
        className={`parchment-block parchment-streaming${isDark ? ' parchment-dark' : ''}`}
        style={{ background: cfg.fill }}
      >
        <div className="parchment-content">
          {label && <div className="block-label parchment-label">{label}</div>}
          {children}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`parchment-block${svg ? ' parchment-ready' : ''}${isDark ? ' parchment-dark' : ''}`}
      style={{ visibility: svg ? 'visible' : 'hidden' }}
    >
      {svg && (
        <svg
          className="parchment-svg"
          width={svg.width}
          height={svg.height}
          viewBox={`0 0 ${svg.width} ${svg.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d={svg.d}
            fill={cfg.fill}
            stroke={cfg.stroke}
            strokeOpacity={cfg.strokeOpacity}
            strokeWidth="1.2"
          />
          {Array.from({ length: 5 }).map((_, i) => (
            <line
              key={i}
              x1="16" y1={44 + i * 26}
              x2={svg.width - 16} y2={44 + i * 26}
              stroke="#C4A048"
              strokeWidth="0.3"
              strokeDasharray="4,14"
              opacity="0.35"
            />
          ))}
        </svg>
      )}
      <div className="parchment-content">
        {label && <div className="block-label parchment-label">{label}</div>}
        {children}
      </div>
    </div>
  )
}
