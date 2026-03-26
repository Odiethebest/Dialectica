import ParchmentBlock from '../ParchmentBlock'
import ReadMoreText from '../ReadMoreText'
import { t } from '../../i18n/strings'

export default function SteelmanBlock({ steelmanText, steelmanSources, isStreaming, lang = 'en' }) {
  return (
    <ParchmentBlock type="steelman" label={t(lang, 'steelman')} isStreaming={isStreaming}>
      {isStreaming && !steelmanText ? (
        <p className="block-body cursor" style={{ color: 'var(--d-muted)' }}>&nbsp;</p>
      ) : (
        <>
          <ReadMoreText
            text={steelmanText}
            className={`block-body${isStreaming ? ' cursor' : ''}`}
            lang={lang}
          />
          {steelmanSources?.length > 0 && (
            <p className="block-source">{steelmanSources.join(' · ')}</p>
          )}
        </>
      )}
    </ParchmentBlock>
  )
}
