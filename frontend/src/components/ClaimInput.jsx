import { useRef, useState } from 'react'
import { getRandomClaim, CATEGORIES, CLAIMS_BY_CATEGORY } from '../data/randomClaims'
import { getRandomZhClaim, ZH_CATEGORIES, ZH_CLAIMS_BY_CATEGORY, ZH_DEFAULT_CHIPS } from '../i18n/claims.zh'
import { getHistory, clearHistory } from '../utils/history'
import { useSpeechInput } from '../hooks/useSpeechInput'
import { t } from '../i18n/strings'

export default function ClaimInput({ claim, onChange, onSubmit, onAutoSubmit, lang = 'en' }) {
  const textareaRef = useRef(null)
  const [activeCategory, setActiveCategory] = useState(null)
  const [history, setHistory] = useState(() => getHistory())

  const { listening, start, stop, supported: speechSupported } = useSpeechInput(onChange, lang)

  const handleKey = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSubmit(claim)
  }

  const handleClearHistory = () => {
    clearHistory()
    setHistory([])
  }

  const handleSurpriseMe = () => {
    const next = lang === 'zh' ? getRandomZhClaim(claim) : getRandomClaim(claim)
    onChange(next)
    textareaRef.current?.focus()
  }

  // EN-only short labels for mobile (ZH categories are already compact)
  const EN_SHORT_LABELS = { Technology: 'Tech', Philosophy: 'Phil.' }

  // Switch category/claim data based on lang
  const categories    = lang === 'zh' ? ZH_CATEGORIES    : CATEGORIES
  const claimsByCategory = lang === 'zh' ? ZH_CLAIMS_BY_CATEGORY : CLAIMS_BY_CATEGORY
  const defaultChips  = lang === 'zh' ? ZH_DEFAULT_CHIPS : [
    'AI will replace most creative jobs',
    'Democracy is the best system of government',
    'Remote work reduces productivity',
    'Social media has made people more polarized',
    'Free will is an illusion',
  ]

  // Reset active category when switching language
  const chips = activeCategory && claimsByCategory[activeCategory]
    ? claimsByCategory[activeCategory]
    : defaultChips

  return (
    <div className="idle-container">

      <p className="h1">{t(lang, 'headline1')}</p>
      <p className="h2">{t(lang, 'headline2')}</p>

      {/* Category bar */}
      <div className="d-category-bar">
        {Object.entries(categories).map(([name, { icon, color }]) => (
          <button
            key={name}
            className={`d-category-btn${activeCategory === name ? ' active' : ''}`}
            style={{ '--cat-color': color }}
            onClick={() => setActiveCategory(activeCategory === name ? null : name)}
          >
            <span className="d-cat-icon">{icon}</span>
            {lang === 'en' ? (
              <span
                className="d-cat-label"
                data-label-full={name}
                data-label-short={EN_SHORT_LABELS[name] ?? name}
              />
            ) : (
              <span className="d-cat-label">{name}</span>
            )}
          </button>
        ))}
      </div>

      {/* Textarea with optional mic button */}
      <div className="d-textarea-wrapper">
        <textarea
          ref={textareaRef}
          className="d-textarea"
          rows={4}
          placeholder={t(lang, 'placeholder')}
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
      {activeCategory && claimsByCategory[activeCategory] ? (
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
          {t(lang, 'surpriseBtn')}
        </button>
        <button
          className="d-btn-primary"
          style={{ marginLeft: 'auto' }}
          onClick={() => onSubmit(claim)}
          disabled={!claim.trim()}
          type="button"
        >
          {t(lang, 'beginBtn')}
        </button>
      </div>

      <hr className="d-hr-gold" />

      {/* History */}
      {history.length > 0 && (
        <div className="d-history">
          <div className="d-history-header">
            <span className="d-history-label">{t(lang, 'recentLabel')}</span>
            <button className="d-history-clear" onClick={handleClearHistory}>
              {t(lang, 'clearBtn')}
            </button>
          </div>
          {history.map(h => (
            <button key={h} className="d-history-item" onClick={() => onAutoSubmit(h)}>
              {h}
            </button>
          ))}
        </div>
      )}

      <p className="footnote" style={{ marginTop: history.length > 0 ? 20 : 0 }}>
        {t(lang, 'footnote')}
      </p>

    </div>
  )
}
