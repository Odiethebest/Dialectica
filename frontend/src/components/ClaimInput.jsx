import { useState } from 'react'

const EXAMPLES = [
  'Remote work reduces productivity',
  'Democracy is the best system of government',
  'AI will replace most creative jobs',
]

export default function ClaimInput({ onSubmit }) {
  const [value, setValue] = useState('')

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (trimmed) onSubmit(trimmed)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
  }

  return (
    <div className="dialectica-page">
      <div className="idle-container">

        <p className="h1">Make an argument.</p>
        <p className="h2">We'll make it harder.</p>

        <textarea
          className="d-textarea"
          rows={4}
          placeholder="Enter a claim, thesis, or position you want to defend…"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKey}
        />

        <div className="chips-row">
          {EXAMPLES.map(ex => (
            <button key={ex} className="d-chip" onClick={() => setValue(ex)}>
              {ex}
            </button>
          ))}
        </div>

        <button
          className="d-btn-primary d-btn-begin"
          onClick={handleSubmit}
          disabled={!value.trim()}
        >
          Begin ↗
        </button>

        <hr className="d-hr-gold" />

        <p className="footnote">
          Dialectica does not validate your thinking — it challenges it. The engine
          attacks your claim, questions your assumptions, and returns a stronger
          argument.
        </p>

      </div>
    </div>
  )
}
