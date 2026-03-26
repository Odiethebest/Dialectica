import { useRef, useState } from 'react'
import { getRandomClaim, CATEGORIES, CLAIMS_BY_CATEGORY } from '../data/randomClaims'
import { getHistory, clearHistory } from '../utils/history'
import { useSpeechInput } from '../hooks/useSpeechInput'

const DEFAULT_CHIPS = [
  'AI will replace most creative jobs',
  'Democracy is the best system of government',
  'Remote work reduces productivity',
  'Social media has made people more polarized',
  'Free will is an illusion',
]

export default function ClaimInput({ claim, onChange, onSubmit, onAutoSubmit }) {
  const textareaRef = useRef(null)
  const [activeCategory, setActiveCategory] = useState(null)
  const [history, setHistory] = useState(() => getHistory())

  const { listening, start, stop, supported: speechSupported } = useSpeechInput(onChange)

  const handleKey = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSubmit(claim)
  }

  const handleClearHistory = () => {
    clearHistory()
    setHistory([])
  }

  const handleSurpriseMe = () => {
    const next = getRandomClaim(claim)
    onChange(next)
    textareaRef.current?.focus()
  }

  const chips = activeCategory ? CLAIMS_BY_CATEGORY[activeCategory] : DEFAULT_CHIPS

  return (
    <div className="idle-container">

      <p className="h1">Make an argument.</p>
      <p className="h2">We'll make it harder.</p>

      {/* Category bar */}
      <div className="d-category-bar">
        {Object.entries(CATEGORIES).map(([name, { icon, color }]) => (
          <button
            key={name}
            className={`d-category-btn${activeCategory === name ? ' active' : ''}`}
            style={{ '--cat-color': color }}
            onClick={() => setActiveCategory(activeCategory === name ? null : name)}
          >
            <span className="d-cat-icon">{icon}</span>
            <span className="d-cat-label">{name}</span>
          </button>
        ))}
      </div>

      {/* Textarea with optional mic button */}
      <div className="d-textarea-wrapper">
        <textarea
          ref={textareaRef}
          className="d-textarea"
          rows={4}
          placeholder="Enter a claim, thesis, or position you want to defend…"
          value={claim}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKey}
        />
        {speechSupported ? (
          <button
            className={`d-mic-btn${listening ? ' active' : ''}`}
            onClick={listening ? stop : start}
            title={listening ? 'Stop recording' : 'Speak your claim'}
            type="button"
          >
            {listening ? '■' : '◎'}
          </button>
        ) : null}
      </div>

      {/* Chips / category claims */}
      {activeCategory ? (
        <div className="d-category-claims">
          {chips.map(c => (
            <button key={c} className="d-category-claim-card" onClick={() => onAutoSubmit(c)}>
              {c}
            </button>
          ))}
        </div>
      ) : (
        <div className="chips-row">
          {chips.map(ex => (
            <button key={ex} className="d-chip" onClick={() => onAutoSubmit(ex)}>
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* Surprise me + Begin row */}
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 16 }}>
        <button className="d-btn-random" onClick={handleSurpriseMe} type="button">
          Surprise me →
        </button>
        <button
          className="d-btn-primary"
          style={{ marginLeft: 'auto' }}
          onClick={() => onSubmit(claim)}
          disabled={!claim.trim()}
          type="button"
        >
          Begin ↗
        </button>
      </div>

      <hr className="d-hr-gold" />

      {/* History */}
      {history.length > 0 && (
        <div className="d-history">
          <div className="d-history-header">
            <span className="d-history-label">Recent</span>
            <button className="d-history-clear" onClick={handleClearHistory}>Clear</button>
          </div>
          {history.map(h => (
            <button key={h} className="d-history-item" onClick={() => onAutoSubmit(h)}>
              {h}
            </button>
          ))}
        </div>
      )}

      <p className="footnote" style={{ marginTop: history.length > 0 ? 20 : 0 }}>
        Dialectica does not validate your thinking — it challenges it. The engine
        attacks your claim, questions your assumptions, and returns a stronger
        argument.
      </p>

    </div>
  )
}
