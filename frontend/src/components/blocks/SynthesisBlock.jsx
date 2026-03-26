export default function SynthesisBlock({ synthesis, argumentMap, isStreaming }) {
  return (
    <div style={{
      border: '1px solid var(--d-gold2)',
      borderLeft: '2px solid var(--d-gold)',
      borderRadius: `0 var(--border-radius-md) var(--border-radius-md) 0`,
      background: 'var(--d-bg)',
      padding: '22px 24px',
      marginBottom: 16,
      animation: 'block-in 200ms ease-out both',
    }}>
      <div className="block-label" style={{ color: 'var(--d-gold2)' }}>
        Refined argument
      </div>

      {isStreaming && !synthesis ? (
        <p className="block-body cursor" style={{ color: 'var(--d-muted)' }}>&nbsp;</p>
      ) : (
        <p className={`block-body${isStreaming ? ' cursor' : ''}`}>{synthesis}</p>
      )}

      {argumentMap && <ArgumentMapGrid map={argumentMap} />}
    </div>
  )
}

function ArgumentMapGrid({ map }) {
  const conceded      = map.concessions?.join('; ')               || '—'
  const retained      = map.warrants?.join('; ')                   || '—'
  const vulnerability = map.remaining_vulnerabilities?.join('; ')  || '—'
  const delta         = map.confidence_delta                       || '—'

  return (
    <div className="argument-map">
      <Cell label="Conceded"         value={conceded} />
      <Cell label="Retained"         value={retained} />
      <Cell label="Vulnerability"    value={vulnerability} />
      <Cell label="Confidence delta" value={
        <span className="arg-map-delta">{delta}</span>
      } />
    </div>
  )
}

function Cell({ label, value }) {
  return (
    <div className="arg-map-cell">
      <div className="arg-map-label">{label}</div>
      <div className="arg-map-value">{value}</div>
    </div>
  )
}
