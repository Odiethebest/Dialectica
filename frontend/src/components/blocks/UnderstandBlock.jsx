import ParchmentBlock from '../ParchmentBlock'
import { t } from '../../i18n/strings'

export default function UnderstandBlock({ coreClaim, claimAssumptions, isStreaming, lang = 'en' }) {
  return (
    <ParchmentBlock type="understand" label={t(lang, 'coreClaim')} isStreaming={isStreaming}>
      {isStreaming && !coreClaim ? (
        <p className="block-body cursor" style={{ color: 'var(--d-muted)' }}>&nbsp;</p>
      ) : (
        <>
          <p className={`block-body${isStreaming ? ' cursor' : ''}`} style={{ marginBottom: 10 }}>
            {coreClaim}
          </p>
          {claimAssumptions?.length > 0 && (
            <p className="block-source">
              {t(lang, 'assumes')} {claimAssumptions.join(' · ')}
            </p>
          )}
        </>
      )}
    </ParchmentBlock>
  )
}
