import ParchmentBlock from '../ParchmentBlock'
import ReadMoreText from '../ReadMoreText'

export default function SteelmanBlock({ steelmanText, steelmanSources, isStreaming }) {
  return (
    <ParchmentBlock type="steelman" label="Steelman" isStreaming={isStreaming}>
      {isStreaming && !steelmanText ? (
        <p className="block-body cursor" style={{ color: 'var(--d-muted)' }}>&nbsp;</p>
      ) : (
        <>
          <ReadMoreText
            text={steelmanText}
            className={`block-body${isStreaming ? ' cursor' : ''}`}
          />
          {steelmanSources?.length > 0 && (
            <p className="block-source">{steelmanSources.join(' · ')}</p>
          )}
        </>
      )}
    </ParchmentBlock>
  )
}
