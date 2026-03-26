const ROMAN = ['I', 'II', 'III']

function parseAttack(raw) {
  const match = raw.match(/^\[(.+?)\]\s*(.+)$/s)
  if (match) return { source: match[1], text: match[2].trim() }
  return { source: null, text: raw }
}

export default function AttackBlock({ attacks, isStreaming }) {
  return (
    <div
      className="dialogue-block"
      style={{ borderLeft: '2px solid var(--d-maroon3)', background: 'var(--d-maroon)' }}
    >
      <div className="block-label" style={{ color: 'var(--d-gold3)' }}>Attacks</div>

      {isStreaming && !attacks?.length ? (
        <p className="block-body cursor" style={{ color: '#F0E8DC' }}>&nbsp;</p>
      ) : (
        attacks?.map((raw, i) => {
          const { source, text } = parseAttack(raw)
          return (
            <div
              key={i}
              className="attack-item"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="attack-numeral" style={{ color: 'var(--d-gold3)' }}>{ROMAN[i]}.</span>
              <p className="block-body" style={{ color: '#F0E8DC' }}>
                {text}
                {source && (
                  <span style={{
                    fontFamily: 'var(--d-serif)',
                    fontSize: 13,
                    fontStyle: 'italic',
                    color: 'var(--d-gold)',
                    marginLeft: 6,
                  }}>
                    · {source}
                  </span>
                )}
              </p>
            </div>
          )
        })
      )}
    </div>
  )
}
