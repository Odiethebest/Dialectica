# Dialectica — Auto-Response: Implementation Spec

This document defines the auto-response feature for the Socratic Q&A form. The user is presented with three hard questions and may not want to — or know how to — answer them. This feature removes that friction without removing the intellectual engagement.

---

## Three-Tier System

Implement all three tiers in priority order.

| Tier | Feature | Where | Effort |
|---|---|---|---|
| 1 | Stance selector + Auto-fill all | Above response form | 2 hr |
| 2 | Per-question "Suggest" button | Per textarea | 1 hr |
| 3 | Perspective picker per question | Per textarea expanded | 1 hr |

---

## Tier 1 — Stance Selector + Auto-Fill All

### Concept

Before the response form, the user picks their stance. Then one click generates all three responses aligned to that stance.

```
┌─ YOUR STANCE ──────────────────────────────────────────┐
│  How do you want to respond to these challenges?       │
│                                                        │
│  [Defend my claim]  [Concede the attacks]  [Nuanced]   │
│                                   ↑ default            │
│                    [Auto-fill all responses ↗]         │
└────────────────────────────────────────────────────────┘
```

### Stance definitions

| Stance | Behavior | Best for |
|---|---|---|
| Defend | Generated responses hold the original claim, push back on attacks, find weaknesses in the counterarguments | Users who are confident in their position |
| Concede | Generated responses acknowledge the attacks have merit, soften the original claim, seek middle ground | Users who found the attacks convincing |
| Nuanced | Generated responses defend some aspects, concede others — AI decides which attacks are strongest and which are weakest | Default, produces the most interesting synthesis |

### Backend: `/dialectica/auto-respond` endpoint

```python
# POST /dialectica/auto-respond
# Request body:
{
  "session_id": "abc123",
  "stance": "nuanced"  # "defend" | "concede" | "nuanced"
}

# Response: SSE stream, one event per question
event: response_1
data: {"question": "I", "text": "Even granting that polarization..."}

event: response_2
data: {"question": "II", "text": "The evidence I'd point to is..."}

event: response_3
data: {"question": "III", "text": "Polarization isn't inherently..."}

event: complete
data: {}
```

### LLM prompt for auto-respond node

```
You are generating responses to Socratic questions on behalf of the user.

Original claim: {original_claim}
Socratic questions: {socratic_questions}
Attacks that challenged the claim: {attacks}
Stance: {stance}

Stance behavior:
- "defend": Push back on each question. Find weaknesses in the premise of the question itself. Hold the original claim firmly.
- "concede": Acknowledge that each question identifies a real weakness. Soften the claim in response to each.
- "nuanced": For the strongest attack, concede. For the weakest, defend. Evaluate each question independently.

Output rules:
- One response per question, in order
- Each response is 2-4 sentences maximum
- Sound like a thoughtful person speaking, not an essay
- Start each response with the user's position, not a restatement of the question
- Never open with "That's a great question" or "I understand your concern"
- Format: return a JSON array of 3 strings, one per question, in order

Return ONLY valid JSON. No preamble. No markdown.
[
  "Response to question I...",
  "Response to question II...",
  "Response to question III..."
]
```

### Frontend implementation

```jsx
// ResponseForm.jsx

const STANCES = [
  { id: 'defend',  label: 'Defend my claim' },
  { id: 'nuanced', label: 'Nuanced',          default: true },
  { id: 'concede', label: 'Concede the attacks' },
];

function ResponseForm({ questions, sessionId, onSubmit }) {
  const [stance, setStance] = useState('nuanced');
  const [responses, setResponses] = useState(['', '', '']);
  const [autoFilling, setAutoFilling] = useState(false);

  const handleAutoFillAll = async () => {
    setAutoFilling(true);
    const res = await fetch('/dialectica/auto-respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, stance }),
    });
    // Stream responses in, filling textareas one by one
    const reader = res.body.getReader();
    // ... parse SSE, call setResponses([r1, r2, r3]) as each arrives
    setAutoFilling(false);
  };

  return (
    <div className="d-response-form">
      <div className="d-stance-row">
        <span className="d-rlbl">YOUR STANCE</span>
        <div className="d-stance-btns">
          {STANCES.map(s => (
            <button
              key={s.id}
              className={`d-stance-btn ${stance === s.id ? 'active' : ''}`}
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
          {autoFilling ? 'Generating...' : 'Auto-fill all ↗'}
        </button>
      </div>

      {questions.map((q, i) => (
        <ResponseTextarea
          key={i}
          index={i}
          question={q}
          value={responses[i]}
          onChange={(v) => {
            const next = [...responses];
            next[i] = v;
            setResponses(next);
          }}
          sessionId={sessionId}
          stance={stance}
          originalClaim={originalClaim}
          attacks={attacks}
        />
      ))}

      <button
        className="d-btn-submit"
        onClick={() => onSubmit(responses)}
        disabled={responses.some(r => r.trim().length === 0)}
      >
        SUBMIT RESPONSES ↗
      </button>
    </div>
  );
}
```

### Styling — stance buttons

```css
.d-stance-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.d-stance-btns {
  display: flex;
  gap: 8px;
}

.d-stance-btn {
  font-family: Georgia, serif;
  font-size: 13px;
  font-style: italic;
  color: var(--d-mid);
  border: 1px solid var(--d-bg3);
  border-radius: 20px;
  padding: 6px 14px;
  background: none;
  cursor: pointer;
  transition: all 120ms;
}
.d-stance-btn.active {
  background: var(--d-maroon);
  color: #F5EAD8;
  border-color: var(--d-maroon);
}

.d-btn-autofill {
  font-size: 13px;
  letter-spacing: 0.06em;
  color: var(--d-maroon);
  border: 1px solid var(--d-maroon2);
  border-radius: 6px;
  padding: 8px 18px;
  background: none;
  cursor: pointer;
  margin-left: auto;
  transition: all 120ms;
}
.d-btn-autofill:hover {
  background: var(--d-maroon);
  color: #E0B84A;
  border-color: #A8841E;
}
.d-btn-autofill:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

## Tier 2 — Per-Question "Suggest" Button

### Concept

Each textarea has a small "Suggest →" ghost link. Clicking generates a response for that question only, using the currently selected stance.

```
Response to question I
┌──────────────────────────────────────────┐
│ Even granting that polarization...       │  ← streamed in
│                                          │
└──────────────────────────────────────────┘
                                Suggest → (regenerate ↺)
```

### Backend: `/dialectica/auto-respond-one` endpoint

```python
# POST /dialectica/auto-respond-one
{
  "session_id": "abc123",
  "question_index": 0,       # 0, 1, or 2
  "stance": "defend"
}

# Response: plain SSE token stream (same as other nodes)
event: token
data: {"text": "Even granting that..."}

event: complete
data: {}
```

### Frontend

```jsx
function ResponseTextarea({ index, question, value, onChange, sessionId, stance }) {
  const [suggesting, setSuggesting] = useState(false);

  const handleSuggest = async () => {
    setSuggesting(true);
    onChange(''); // Clear first
    const res = await fetch('/dialectica/auto-respond-one', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        question_index: index,
        stance,
      }),
    });
    // Stream tokens, append to textarea value
    // ... SSE parsing, call onChange(accumulated) on each token
    setSuggesting(false);
  };

  const hasSuggestion = value.trim().length > 0;

  return (
    <div className="d-response-field">
      <div className="d-response-qnum">
        {['I', 'II', 'III'][index]}.
      </div>
      <div className="d-response-right">
        <textarea
          className="d-response-ta"
          placeholder={`Response to question ${['I', 'II', 'III'][index]}…`}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        <div className="d-suggest-row">
          <button
            className="d-suggest-btn"
            onClick={handleSuggest}
            disabled={suggesting}
          >
            {suggesting ? 'Writing...' : hasSuggestion ? 'Regenerate ↺' : 'Suggest →'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Styling

```css
.d-response-field {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.d-response-qnum {
  font-family: Georgia, serif;
  font-style: italic;
  font-size: 14px;
  color: var(--d-gold2);
  min-width: 18px;
  padding-top: 14px;
}
.d-response-right {
  flex: 1;
}
.d-suggest-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}
.d-suggest-btn {
  font-size: 12px;
  font-style: italic;
  color: var(--d-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: color 100ms;
}
.d-suggest-btn:hover { color: var(--d-maroon); }
.d-suggest-btn:disabled { opacity: 0.4; cursor: not-allowed; }
```

---

## Tier 3 — Perspective Picker Per Question

### Concept

When a user clicks "Suggest →", instead of immediately generating, a small inline picker appears with 2-3 perspective options specific to that question. User picks one, then generation fires.

```
┌── Suggest as: ─────────────────────────────────┐
│  [Push back on the premise]                    │
│  [Acknowledge and reframe]                     │
│  [Concede this point]                          │
└────────────────────────────────────────────────┘
```

### Backend: `/dialectica/suggest-perspectives` endpoint

```python
# POST /dialectica/suggest-perspectives
{
  "session_id": "abc123",
  "question_index": 0
}

# Response JSON (not streaming):
{
  "perspectives": [
    {
      "id": "push_back",
      "label": "Push back on the premise",
      "hint": "Challenge whether polarization actually predated social media at the same scale"
    },
    {
      "id": "reframe",
      "label": "Acknowledge and reframe",
      "hint": "Concede the timeline point but argue social media changed the nature of polarization"
    },
    {
      "id": "concede",
      "label": "Concede this point",
      "hint": "Accept that social media is an accelerant, not a cause"
    }
  ]
}
```

The LLM generates these 3 perspective options dynamically based on the specific question and the attacks. They are not hardcoded.

### Frontend

```jsx
function ResponseTextarea({ ... }) {
  const [showPerspectives, setShowPerspectives] = useState(false);
  const [perspectives, setPerspectives] = useState([]);
  const [loadingPersp, setLoadingPersp] = useState(false);

  const handleSuggestClick = async () => {
    if (hasSuggestion) {
      // Already has content — regenerate directly with same stance
      handleGenerate(stance);
      return;
    }
    // First time — fetch perspective options
    setLoadingPersp(true);
    const res = await fetch('/dialectica/suggest-perspectives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, question_index: index }),
    });
    const data = await res.json();
    setPerspectives(data.perspectives);
    setShowPerspectives(true);
    setLoadingPersp(false);
  };

  const handlePerspectiveSelect = (perspId) => {
    setShowPerspectives(false);
    handleGenerate(perspId); // pass perspective id to generation
  };

  return (
    <div className="d-response-field">
      ...
      {showPerspectives && (
        <div className="d-perspective-picker">
          <div className="d-persp-label">Suggest as:</div>
          {perspectives.map(p => (
            <button
              key={p.id}
              className="d-persp-option"
              onClick={() => handlePerspectiveSelect(p.id)}
              title={p.hint}
            >
              {p.label}
            </button>
          ))}
          <button
            className="d-persp-cancel"
            onClick={() => setShowPerspectives(false)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
```

### Styling

```css
.d-perspective-picker {
  background: var(--d-bg);
  border: 1px solid var(--d-bg3);
  border-top: 2px solid var(--d-gold2);
  border-radius: 0 0 8px 8px;
  padding: 12px 14px;
  margin-top: -1px;
}
.d-persp-label {
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--d-muted);
  margin-bottom: 8px;
  font-family: system-ui, sans-serif;
  font-weight: 500;
}
.d-persp-option {
  display: block;
  width: 100%;
  text-align: left;
  font-family: Georgia, serif;
  font-size: 14px;
  font-style: italic;
  color: var(--d-mid);
  background: none;
  border: none;
  padding: 7px 0;
  cursor: pointer;
  border-bottom: 1px solid var(--d-bg3);
  transition: color 100ms;
}
.d-persp-option:last-of-type { border-bottom: none; }
.d-persp-option:hover { color: var(--d-maroon); }
.d-persp-cancel {
  font-size: 11px;
  color: var(--d-muted);
  background: none;
  border: none;
  cursor: pointer;
  margin-top: 6px;
  padding: 0;
}
```

---

## State Flow Summary

```
User sees Socratic block
        ↓
ResponseForm mounts with stance = "nuanced" (default)
        ↓
Option A: User types manually → SUBMIT
Option B: User clicks "Auto-fill all" → backend generates 3 responses → textareas fill → SUBMIT
Option C: User clicks "Suggest →" on one question
        ↓
  First time → perspective picker appears (3 options)
  User picks → backend generates 1 response → textarea fills
  Subsequent → "Regenerate ↺" → regenerates directly, no picker
        ↓
User edits any textarea freely → SUBMIT
```

---

## Rules

- Auto-generated responses are **always editable** — the user can modify any auto-filled text before submitting
- The SUBMIT button is disabled until all three textareas have content (even one character)
- Never auto-submit after auto-fill — the user must press SUBMIT consciously
- If auto-generation fails (API error), show a brief inline error below the textarea and restore the "Suggest →" button
- Streaming tokens append character by character to the textarea — same cursor blink animation as other blocks