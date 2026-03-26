import ParchmentBlock from '../ParchmentBlock'

export default function UnderstandBlock({ coreClaim, claimAssumptions, isStreaming }) {
  return (
    <ParchmentBlock type="understand" label="Core claim · Assumptions" isStreaming={isStreaming}>
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
    </ParchmentBlock>
  )
}
