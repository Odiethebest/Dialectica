import { useState } from 'react'
import { readSSE } from '../../utils/readSSE'

const ROMAN = ['I', 'II', 'III']

const STANCES = [
  { id: 'defend',  label: 'Defend my claim' },
  { id: 'nuanced', label: 'Nuanced' },
  { id: 'concede', label: 'Concede the attacks' },
]

// ── ResponseTextarea (Tier 2 + Tier 3) ────────────────────────────────────────

function ResponseTextarea({ index, question, value, onChange, sessionId, stance }) {
  const [suggesting, setSuggesting] = useState(false)
  const [showPerspectives, setShowPerspectives] = useState(false)
  const [perspectives, setPerspectives] = useState([])
  const [loadingPersp, setLoadingPersp] = useState(false)
  const [selectedPersp, setSelectedPersp] = useState(null) // for regeneration
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
    // Already has content or already had a perspective → regenerate directly
    if (hasSuggestion || selectedPersp) {
      const p = selectedPersp
      await generate(p ? p.id : stance, p ? p.hint : '')
      return
    }

    // First time: fetch perspective options (Tier 3)
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
        // Fallback: generate directly with global stance
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
    ? 'Writing…'
    : loadingPersp
    ? 'Loading…'
    : hasSuggestion || selectedPersp
    ? 'Regenerate ↺'
    : 'Suggest →'

  return (
    <div className="d-response-field">
      <div className="d-response-qnum">{ROMAN[index]}.</div>
      <div className="d-response-right">
        <textarea
          className={`d-textarea d-response-ta`}
          rows={3}
          placeholder={`Response to question ${ROMAN[index]}…`}
          value={value}
          onChange={e => onChange(e.target.value)}
        />

        {showPerspectives && (
          <div className="d-perspective-picker">
            <div className="d-persp-label">Suggest as:</div>
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
              Cancel
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

export default function ResponseForm({ questions, sessionId, onSubmit }) {
  const [stance, setStance] = useState('nuanced')
  const [responses, setResponses] = useState(['', '', ''])
  const [autoFilling, setAutoFilling] = useState(false)
  const [errors, setErrors] = useState([false, false, false])

  const setResponse = (i, val) =>
    setResponses(prev => { const next = [...prev]; next[i] = val; return next })

  const handleAutoFillAll = async () => {
    setAutoFilling(true)
    try {
      const res = await fetch('/dialectica/auto-respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, stance }),
      })
      for await (const { type, data } of readSSE(res)) {
        if (type === 'response_1') setResponse(0, data.text)
        else if (type === 'response_2') setResponse(1, data.text)
        else if (type === 'response_3') setResponse(2, data.text)
      }
    } catch (e) {
      // fail silently — textareas keep whatever partial state they have
    } finally {
      setAutoFilling(false)
    }
  }

  const handleSubmit = () => {
    const newErrors = responses.map(r => !r.trim())
    if (newErrors.some(Boolean)) {
      setErrors(newErrors)
      setTimeout(() => setErrors([false, false, false]), 400)
      return
    }
    onSubmit(responses)
  }

  return (
    <div className="response-form">
      {/* Tier 1 — Stance selector */}
      <div className="d-stance-row">
        <span className="d-rlbl">Your stance</span>
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
          {autoFilling ? 'Generating…' : 'Auto-fill all ↗'}
        </button>
      </div>

      {/* Tier 2 + 3 — Per-question textareas */}
      {questions.map((q, i) => (
        <ResponseTextarea
          key={i}
          index={i}
          question={q}
          value={responses[i]}
          onChange={(val) => setResponse(i, val)}
          sessionId={sessionId}
          stance={stance}
        />
      ))}

      {/* Submit */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button
          className="d-btn-primary btn-submit"
          onClick={handleSubmit}
          disabled={responses.some(r => !r.trim())}
        >
          Submit responses ↗
        </button>
      </div>
    </div>
  )
}
