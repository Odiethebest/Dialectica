import ParchmentBlock from '../ParchmentBlock'
import ReadMoreText from '../ReadMoreText'
import { t } from '../../i18n/strings'

export default function SynthesisBlock({ synthesis, argumentMap, isStreaming, lang = 'en' }) {
  return (
    <ParchmentBlock type="synthesis" label={t(lang, 'refinedArg')} isStreaming={isStreaming}>
      {isStreaming && !synthesis ? (
        <p className="block-body cursor" style={{ color: 'var(--d-muted)' }}>&nbsp;</p>
      ) : (
        <ReadMoreText
          text={synthesis}
          className={`block-body${isStreaming ? ' cursor' : ''}`}
          lang={lang}
        />
      )}

      {argumentMap && <ArgumentMapGrid map={argumentMap} lang={lang} />}
    </ParchmentBlock>
  )
}

function ArgumentMapGrid({ map, lang }) {
  const conceded      = map.concessions?.join('; ')               || '—'
  const retained      = map.warrants?.join('; ')                   || '—'
  const vulnerability = map.remaining_vulnerabilities?.join('; ')  || '—'
  const delta         = map.confidence_delta                       || '—'

  return (
    <div className="argument-map">
      <Cell label={t(lang, 'mapConceded')}  value={conceded} />
      <Cell label={t(lang, 'mapRetained')}  value={retained} />
      <Cell label={t(lang, 'mapVulnerable')} value={vulnerability} />
      <Cell label={t(lang, 'mapDelta')}     value={
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
