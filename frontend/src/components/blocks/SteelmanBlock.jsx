export default function SteelmanBlock({ steelmanText, steelmanSources, isStreaming }) {
  return (
    <div
      className="dialogue-block"
      style={{ borderLeft: '2px solid var(--d-gold2)', background: 'var(--d-goldbg)' }}
    >
      <div className="block-label" style={{ color: 'var(--d-gold2)' }}>Steelman</div>

      {isStreaming && !steelmanText ? (
        <p className="block-body cursor" style={{ color: 'var(--d-muted)' }}>&nbsp;</p>
      ) : (
        <>
          <p className={`block-body${isStreaming ? ' cursor' : ''}`}>{steelmanText}</p>
          {steelmanSources?.length > 0 && (
            <p className="block-source">{steelmanSources.join(' · ')}</p>
          )}
        </>
      )}
    </div>
  )
}
