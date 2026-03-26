import ParchmentBlock from '../ParchmentBlock'
import ReadMoreText from '../ReadMoreText'

export default function SynthesisBlock({ synthesis, argumentMap, isStreaming }) {
  return (
    <ParchmentBlock type="synthesis" label="Refined argument" isStreaming={isStreaming}>
      {isStreaming && !synthesis ? (
        <p className="block-body cursor" style={{ color: 'var(--d-muted)' }}>&nbsp;</p>
      ) : (
        <ReadMoreText
          text={synthesis}
          className={`block-body${isStreaming ? ' cursor' : ''}`}
        />
      )}

      {argumentMap && <ArgumentMapGrid map={argumentMap} />}
    </ParchmentBlock>
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
