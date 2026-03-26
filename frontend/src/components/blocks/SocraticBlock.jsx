const ROMAN = ['I', 'II', 'III']

export default function SocraticBlock({ questions, isStreaming }) {
  return (
    <div
      className="dialogue-block"
      style={{ borderLeft: '2px solid var(--d-maroon2)', background: 'var(--d-goldbg)' }}
    >
      <div className="block-label" style={{ color: 'var(--d-maroon)' }}>
        Socratic questions
      </div>

      {isStreaming && !questions?.length ? (
        <p className="block-body cursor" style={{ color: 'var(--d-muted)' }}>&nbsp;</p>
      ) : (
        questions?.map((q, i) => (
          <div key={i} style={{
            display: 'flex',
            gap: 12,
            marginBottom: i < questions.length - 1 ? 12 : 0,
          }}>
            <span style={{
              fontFamily: 'var(--d-serif)',
              fontSize: 14,
              fontStyle: 'italic',
              color: 'var(--d-maroon2)',
              flexShrink: 0,
              paddingTop: 3,
              minWidth: 22,
            }}>
              {ROMAN[i]}.
            </span>
            <p className="block-body" style={{ margin: 0 }}>{q}</p>
          </div>
        ))
      )}
    </div>
  )
}
