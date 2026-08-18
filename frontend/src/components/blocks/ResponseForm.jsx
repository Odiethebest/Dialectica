import { useState } from 'react'
import { readSSE } from '../../utils/readSSE'
import { t } from '../../i18n/strings'
import { numeral, allAnswered } from '../../utils/responses'

// ── ResponseTextarea (Tier 2 + Tier 3) ────────────────────────────────────────

function ResponseTextarea({ index, value, onChange, sessionId, stance, lang }) {
  const [suggesting, setSuggesting] = useState(false)
  const [showPerspectives, setShowPerspectives] = useState(false)
  const [perspectives, setPerspectives] = useState([])
  const [loadingPersp, setLoadingPersp] = useState(false)
  const [selectedPersp, setSelectedPersp] = useState(null)
  const [error, setError] = useState(null)

  const hasSuggestion = value.trim().length > 0

  const generate = async (stanceId, perspHint = '') => {
    setSuggesting(true)
    setError(null)
    onChange('')
    try {
      const res = await fetch('/dialectica/auto-respond-one', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          question_index: index,
          stance: stanceId,
          perspective_hint: perspHint,
        }),
      })
      let accumulated = ''
      for await (const { type, data } of readSSE(res)) {
        if (type === 'token') {
          accumulated += data.text
          onChange(accumulated)
        } else if (type === 'error') {
          setError(data.message)
          break
        }
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setSuggesting(false)
    }
  }

  const handleSuggestClick = async () => {
    if (hasSuggestion || selectedPersp) {
      const p = selectedPersp
      await generate(p ? p.id : stance, p ? p.hint : '')
      return
    }

    setLoadingPersp(true)
    setError(null)
    try {
      const res = await fetch('/dialectica/suggest-perspectives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, question_index: index }),
      })
      const data = await res.json()
      if (data.perspectives) {
        setPerspectives(data.perspectives)
        setShowPerspectives(true)
      } else {
        await generate(stance)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingPersp(false)
    }
  }

  const handlePerspectiveSelect = async (p) => {
    setShowPerspectives(false)
    setSelectedPersp(p)
    await generate(p.id, p.hint)
  }

  const btnLabel = suggesting
    ? t(lang, 'writing')
    : loadingPersp
    ? t(lang, 'loading')
    : hasSuggestion || selectedPersp
    ? t(lang, 'regenerateBtn')
    : t(lang, 'suggestBtn')

  return (
    <div className="d-response-field">
      <div className="d-response-qnum">{numeral(index)}.</div>
      <div className="d-response-right">
        <textarea
          className="d-textarea d-response-ta"
          rows={3}
          placeholder={t(lang, 'responsePlaceholder')(numeral(index))}
          value={value}
          onChange={e => onChange(e.target.value)}
        />

        {showPerspectives && (
          <div className="d-perspective-picker">
            <div className="d-persp-label">{t(lang, 'suggestAs')}</div>
            {perspectives.map(p => (
              <button
                key={p.id}
                className="d-persp-option"
                onClick={() => handlePerspectiveSelect(p)}
                title={p.hint}
              >
                {p.label}
              </button>
            ))}
            <button className="d-persp-cancel" onClick={() => setShowPerspectives(false)}>
              {t(lang, 'cancelBtn')}
            </button>
          </div>
        )}

        <div className="d-suggest-row">
          {error && <span className="d-suggest-error">{error}</span>}
          <button
            className="d-suggest-btn"
            onClick={handleSuggestClick}
            disabled={suggesting || loadingPersp}
          >
            {btnLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ResponseForm (Tier 1 + orchestrates Tier 2 & 3) ──────────────────────────

export default function ResponseForm({ questions, sessionId, onSubmit, lang = 'en' }) {
  const [stance, setStance] = useState('nuanced')
  // One slot per question — never a fixed three
  const [responses, setResponses] = useState(() => questions.map(() => ''))
  const [autoFilling, setAutoFilling] = useState(false)
  const [autoFillError, setAutoFillError] = useState(null)

  const STANCES = [
    { id: 'defend',  label: t(lang, 'stanceDefend')  },
    { id: 'nuanced', label: t(lang, 'stanceNuanced') },
    { id: 'concede', label: t(lang, 'stanceConcede') },
  ]

  const setResponse = (i, val) => {
    if (i < 0 || i >= questions.length) return
    setResponses(prev => { const next = [...prev]; next[i] = val; return next })
  }

  const complete = allAnswered(questions, responses)

  const handleAutoFillAll = async () => {
    setAutoFilling(true)
    setAutoFillError(null)
    let filled = 0
    let failure = null
    try {
      const res = await fetch('/dialectica/auto-respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, stance }),
      })
      for await (const { type, data } of readSSE(res)) {
        const slot = /^response_(\d+)$/.exec(type)
        if (slot) {
          const i = Number(slot[1]) - 1
          if (i >= 0 && i < questions.length) { setResponse(i, data.text); filled++ }
        } else if (type === 'error') { failure = data.message; break }
      }
      // A run that ends without emitting any response is a failure too — the
      // backend swallows JSON-parse errors into an `error` frame, but an empty
      // stream would otherwise leave the user with no feedback at all.
      if (failure || filled === 0) {
        setAutoFillError(failure || t(lang, 'autoRespondError'))
      }
    } catch (e) {
      setAutoFillError(e.message || t(lang, 'autoRespondError'))
    } finally {
      setAutoFilling(false)
    }
  }

  const handleSubmit = () => {
    if (!complete) return
    onSubmit(responses)
  }

  return (
    <div className="response-form">
      {/* Tier 1 — Stance selector */}
      <div className="d-stance-row">
        <span className="d-rlbl">{t(lang, 'yourResponses')}</span>
        <div className="d-stance-btns">
          {STANCES.map(s => (
            <button
              key={s.id}
              className={`d-stance-btn${stance === s.id ? ' active' : ''}`}
              onClick={() => setStance(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          className="d-btn-autofill"
          onClick={handleAutoFillAll}
          disabled={autoFilling}
        >
          {autoFilling ? t(lang, 'generating') : t(lang, 'autoFillAll')}
        </button>
      </div>

      {autoFillError && <p className="d-autofill-error">{autoFillError}</p>}

      {/* Tier 2 + 3 — Per-question textareas */}
      {questions.map((_, i) => (
        <ResponseTextarea
          key={i}
          index={i}
          value={responses[i]}
          onChange={(val) => setResponse(i, val)}
          sessionId={sessionId}
          stance={stance}
          lang={lang}
        />
      ))}

      {/* Submit */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button
          className="d-btn-primary btn-submit"
          onClick={handleSubmit}
          disabled={!complete}
        >
          {t(lang, 'submitBtn')}
        </button>
      </div>
    </div>
  )
}
