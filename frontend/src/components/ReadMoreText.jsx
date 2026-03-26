import { useState } from 'react'
import { t } from '../i18n/strings'

export default function ReadMoreText({ text, className, style, lang = 'en' }) {
  const [expanded, setExpanded] = useState(false)
  const threshold = lang === 'zh' ? 80 : 160

  if (!text || text.length <= threshold) {
    return <p className={className} style={style}>{text}</p>
  }

  return (
    <p className={className} style={style}>
      {expanded ? text : text.slice(0, threshold).trimEnd() + '…'}
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
        {expanded ? t(lang, 'readLess') : t(lang, 'readMore')}
      </button>
    </p>
  )
}
