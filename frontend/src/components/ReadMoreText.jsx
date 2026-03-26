import { useState } from 'react'

const THRESHOLD = 160

export default function ReadMoreText({ text, className, style }) {
  const [expanded, setExpanded] = useState(false)

  if (!text || text.length <= THRESHOLD) {
    return <p className={className} style={style}>{text}</p>
  }

  return (
    <p className={className} style={style}>
      {expanded ? text : text.slice(0, THRESHOLD).trimEnd() + '…'}
      {' '}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontFamily: 'var(--d-sans)',
          fontSize: 12,
          color: 'var(--d-muted)',
          letterSpacing: '0.02em',
        }}
      >
        {expanded ? 'Read less ←' : 'Read more →'}
      </button>
    </p>
  )
}
