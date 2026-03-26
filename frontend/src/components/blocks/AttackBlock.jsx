import ParchmentBlock from '../ParchmentBlock'
import ReadMoreText from '../ReadMoreText'
import { t } from '../../i18n/strings'

const ROMAN = ['I', 'II', 'III']

function parseAttack(raw) {
  const match = raw.match(/^\[(.+?)\]\s*(.+)$/s)
  if (match) return { source: match[1], text: match[2].trim() }
  return { source: null, text: raw }
}

export default function AttackBlock({ attacks, isStreaming, lang = 'en' }) {
  return (
    <ParchmentBlock type="attack" label={t(lang, 'attacks')} isStreaming={isStreaming}>
      {isStreaming && !attacks?.length ? (
        <p className="block-body cursor">&nbsp;</p>
      ) : (
        attacks?.map((raw, i) => {
          const { source, text } = parseAttack(raw)
          return (
            <div
              key={i}
              className="attack-item"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="attack-numeral">{ROMAN[i]}.</span>
              <div>
                <ReadMoreText text={text} className="block-body" lang={lang} />
                {source && (
                  <p className="block-source" style={{ marginTop: 4 }}>· {source}</p>
                )}
              </div>
            </div>
          )
        })
      )}
    </ParchmentBlock>
  )
}
