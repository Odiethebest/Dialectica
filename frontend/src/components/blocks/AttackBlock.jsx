import ParchmentBlock from '../ParchmentBlock'
import ReadMoreText from '../ReadMoreText'

const ROMAN = ['I', 'II', 'III']

function parseAttack(raw) {
  const match = raw.match(/^\[(.+?)\]\s*(.+)$/s)
  if (match) return { source: match[1], text: match[2].trim() }
  return { source: null, text: raw }
}

export default function AttackBlock({ attacks, isStreaming }) {
  return (
    <ParchmentBlock type="attack" label="Attacks" isStreaming={isStreaming}>
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
                <ReadMoreText text={text} className="block-body" />
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
