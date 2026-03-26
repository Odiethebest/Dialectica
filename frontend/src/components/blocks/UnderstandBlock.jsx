export default function UnderstandBlock({ coreClaim, claimAssumptions, isStreaming }) {
  return (
    <div
      className="dialogue-block"
      style={{ borderLeft: '2px solid var(--d-bg3)', background: 'var(--d-bg2)' }}
    >
      <div className="block-label" style={{ color: 'var(--d-muted)' }}>
        Core claim · Assumptions
      </div>

      {isStreaming && !coreClaim ? (
        <p className="block-body cursor" style={{ color: 'var(--d-muted)' }}>&nbsp;</p>
      ) : (
        <>
          <p className={`block-body${isStreaming ? ' cursor' : ''}`} style={{ marginBottom: 10 }}>
            {coreClaim}
          </p>
          {claimAssumptions?.length > 0 && (
            <p className="block-source">
              Assumes: {claimAssumptions.join(' · ')}
            </p>
          )}
        </>
      )}
    </div>
  )
}
