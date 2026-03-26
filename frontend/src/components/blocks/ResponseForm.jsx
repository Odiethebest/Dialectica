import { useState } from 'react'

const ROMAN = ['I', 'II', 'III']

export default function ResponseForm({ questions, responses, onChange, onSubmit }) {
  const [errors, setErrors] = useState([false, false, false])

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
      <div className="response-form-title">Your responses</div>

      {questions.map((_, i) => (
        <div key={i} style={{ marginBottom: i < questions.length - 1 ? 16 : 0 }}>
          <div className="response-q-label">Response to question {ROMAN[i]}</div>
          <textarea
            className={`d-textarea response-textarea${errors[i] ? ' flash-error' : ''}`}
            rows={3}
            placeholder={`Response to question ${ROMAN[i]}…`}
            value={responses[i] ?? ''}
            onChange={e => onChange(i, e.target.value)}
          />
        </div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="d-btn-primary btn-submit" onClick={handleSubmit}>
          Submit responses ↗
        </button>
      </div>
    </div>
  )
}
