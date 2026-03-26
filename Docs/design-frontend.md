# Frontend Design

## 1. The Core Problems

The frontend had three distinct challenges:

1. **State-driven rendering:** The backend is a 5-step pipeline. The UI must render each step's output in real time, correctly distinguishing "currently streaming" from "finalized" state.
2. **Zero-friction entry:** An empty textarea is a barrier. Users need to reach their first argument in the shortest possible path.
3. **Visual identity:** Dialectica is not a generic chatbot. It should feel like an adversarial Socratic exchange, not a support ticket system.

---

## 2. Technical Decisions

### React 19 + Vite: Embedded in Existing Site

Dialectica is a route (`/dialectica`) inside the existing `odieyang.com` React + Vite project — not a separate deployment. No new framework was introduced. This means no Next.js, no global state library. All session state lives in the `useDialectica` hook; components are purely presentational (props in, events out).

### `useDialectica`: Single State Source

The entire dialogue state lives in one hook:

```javascript
{
  mode: 'idle' | 'streaming' | 'awaiting_input' | 'complete' | 'error',
  currentNode: null | 'understand' | 'steelman' | 'attack' | 'interrogate' | 'synthesize',
  sessionId: null | string,
  lang: 'en' | 'zh',
  coreClaim, claimAssumptions,
  steelmanText, steelmanSources,
  attacks, attackSources,
  socraticQuestions,
  synthesis, argumentMap,
  error,
}
```

`mode` is the primary rendering switch:
- `idle` → render `ClaimInput`
- `streaming` / `awaiting_input` / `complete` → render `DialogueThread`
- `error` → error banner at the bottom of `DialogueThread`

`currentNode` drives `PipelineStatus` (which node is highlighted) and whether each block is in its `isStreaming` state.

### SSE via `fetch` + Async Generator, Not `EventSource`

The native `EventSource` API only supports GET requests. Since the claim must go in the request body, `EventSource` cannot be used.

Instead, `utils/readSSE.js` wraps `fetch` as an async generator:

```javascript
export async function* readSSE(response) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      if (!part.trim()) continue
      let type = 'message', data = ''
      for (const line of part.split('\n')) {
        if (line.startsWith('event: ')) type = line.slice(7).trim()
        else if (line.startsWith('data: ')) data = line.slice(6).trim()
      }
      if (!data) continue
      try { yield { type, data: JSON.parse(data) } } catch { /* ignore malformed */ }
    }
  }
}
```

The `\r\n → \n` normalization is applied at decode time, before the buffer is split. `sse-starlette` sends `\r\n\r\n` as the event separator; without normalization, splitting on `\n\n` produces half-events with `\r` artifacts, causing `data` fields to silently parse as empty and events to be dropped.

`readSSE` is a shared utility. Both `useDialectica` and `ResponseForm` use the same function — no risk of one implementation drifting from the other.

---

## 3. Component Structure

```
src/App.jsx                                   # Root: holds claim + lang state, routes modes
src/pages/ (Dialectica is a route in App)
src/hooks/useDialectica.js                    # All SSE + session state
src/hooks/useSpeechInput.js                   # Web Speech API wrapper
src/components/
  ClaimInput.jsx                              # Idle mode: textarea, chips, categories, history
  PipelineStatus.jsx                          # Node progress bar (5 nodes)
  DialogueThread.jsx                          # Scrollable main area, renders blocks in order
  ParchmentBlock.jsx                          # Shared parchment SVG wrapper
  ReadMoreText.jsx                            # Collapsible long-text utility
  parchmentPath.js                            # SVG path generator (pure function)
  blocks/
    ClaimBlock.jsx                            # Original claim display
    UnderstandBlock.jsx                       # core_claim + claim_assumptions
    SteelmanBlock.jsx                         # steelman_text + sources
    AttackBlock.jsx                           # 3 attacks with source badges
    SocraticBlock.jsx                         # 3 questions
    ResponseForm.jsx                          # 3 textareas + stance selector + submit
    SynthesisBlock.jsx                        # Final refined argument
src/utils/
  readSSE.js                                  # SSE parser (see above)
  history.js                                  # localStorage claim history
  language.js                                 # Language detection helpers
src/i18n/
  strings.js                                  # UI string translations (en/zh)
  claims.zh.js                                # Chinese example claims + categories
src/data/
  randomClaims.js                             # English example claims + categories
```

---

## 4. Visual Design

### Color System

The palette is built around maroon (`#6B1020`) and gold (`#C9A84C`) on an off-white background (`#F3EDE4`). The aesthetic references a classical debate hall or academic manuscript — not the blue-on-white minimalism of typical AI products.

Each dialogue block has a semantic color:
- **Understand/Claim:** neutral parchment (`#F3EDE4`)
- **Steelman:** warm yellow (`#EDE0C4`) — supporting, constructive
- **Attack:** deep red (`#6B1020`) — adversarial, challenging
- **Socratic:** cream (`#FDF5E6`) — reflective, questioning
- **Synthesis:** deep gold (`#F0E8D4`) — conclusive, mature

### Parchment SVG: Giving Blocks Physical Weight

Standard rectangular cards feel too much like a dashboard. Each dialogue block is rendered as a torn-parchment shape — irregular edges, faint horizontal rules, like a page from a medieval manuscript.

**Implementation:**

`parchmentPath.js` generates an SVG `path` using `Math.random()` + per-edge perturbation parameters:
- Bottom edge: most ragged (represents a torn bottom)
- Top edge: nearly straight
- Left/right edges: slight undulation

The SVG is absolutely positioned behind the content div. Five faint dashed horizontal lines simulate ruled paper.

### Two-Phase Rendering

The biggest technical challenge: **the parchment SVG must be sized to the block's settled content height**, but that height is unknown while tokens are still arriving.

Naive approach (measure height on mount, generate SVG) fails because the block starts at cursor height, grows as tokens arrive, and the SVG would be undersized.

**Solution — two rendering paths, fully separated:**

```
isStreaming=true  →  plain <div style={{ background: cfg.fill }}>
                     Content visible immediately. No SVG.

isStreaming=false →  <div style={{ visibility: 'hidden' }}>
                     Content renders invisibly, establishing the correct layout height.
                     useEffect → requestAnimationFrame → getBoundingClientRect()
                     → parchmentPath(width, height) → setSvg(...)
                     → visibility: 'visible' + parchment-in animation
```

`requestAnimationFrame` defers the measurement to after the browser has completed layout on the just-committed DOM. Without it, `getBoundingClientRect()` returns the height from the previous paint (the streaming height), and the SVG is cut off. Cleanup cancels the rAF if the component unmounts before it fires.

The two paths are completely independent code branches — no shared conditional that could accidentally make streaming content invisible or leave a settled block without its SVG.

---

## 5. Zero-Friction Entry Points

An empty textarea is a conversion blocker. Six independent entry points all funnel through the same `handleAutoSubmit(text)` handler in `App.jsx`:

```javascript
const handleAutoSubmit = useCallback((text) => {
  if (!text || text.trim().length < 3) return
  const trimmed = text.trim()
  setClaim(trimmed)
  saveToHistory(trimmed)
  setTimeout(() => {
    startSession(trimmed)
  }, 300)
}, [startSession])
```

The 300ms delay fills the textarea visibly before the session starts — giving users a moment to see their claim before the pipeline kicks off.

| Entry point | How it triggers | Best for |
|---|---|---|
| Example chips | Click to submit | Curious first-timers |
| Category + claim cards | Pick a category → click a card | Users with a topic in mind |
| "Surprise me" button | Click to fill textarea randomly | Users who are stuck |
| History items | Click a past claim | Returning users |
| `?claim=` URL parameter | Auto-triggered on page load | Shared links |
| Speech input | Tap mic button, speak | Mobile users |

**Why `claim` state is lifted to `App`:** Initially it lived inside `ClaimInput`. Once the URL parameter and speech input entry points were added, they both needed to set the claim value from outside the `ClaimInput` component. Lifting `claim` to `App` made all six entry points operate on the same state; `ClaimInput` became a fully controlled component (`value` + `onChange`). This also prevents the subtle bug where the textarea displays one thing but submits another.

**History deduplication:** History saving only happens inside `handleAutoSubmit` and the manual `handleStart` (Begin button). `ClaimInput` itself performs no history operations. Before this consolidation, multiple entry points each had their own `saveToHistory` calls, producing duplicate entries.

---

## 6. Internationalization (en/zh)

The app supports English and Chinese via a `lang` state in `App.jsx`, defaulting to `"en"`.

- `i18n/strings.js` exports a `t(lang, key)` helper covering all UI labels
- `i18n/claims.zh.js` provides Chinese example claims and categories
- `data/randomClaims.js` provides the English equivalents
- All nodes receive `lang` through `DialecticaState`; prompts in `prompts.py` branch on `lang` to return localized system/user message templates
- `ClaimInput` passes `lang` to `useSpeechInput` for correct speech recognition locale

---

## 7. Three-Tier Socratic Assistance

The Socratic answering phase is where users most commonly stall — three philosophical questions appearing simultaneously is intimidating. `ResponseForm` implements three levels of help:

**Tier 1 — Bulk fill with stance:** The user selects a stance (defend / concede / nuanced) and clicks "Auto-fill all". The frontend calls `/dialectica/auto-respond` and receives three labeled SSE events, each filling the corresponding textarea.

**Tier 2 — Per-question streaming suggestion:** Each textarea has a "Suggest →" button. Clicking it calls `/dialectica/auto-respond-one`, which streams the response token-by-token directly into that textarea. The user can modify the text before submitting.

**Tier 3 — Perspective picker:** On the first "Suggest →" click when the textarea is empty and no perspective has been chosen, the frontend first calls `/dialectica/suggest-perspectives`, receives 3–4 contextually generated perspective options, and presents them as a small picker. Once the user selects a perspective, its description is passed as `perspective_hint` to `/dialectica/auto-respond-one`, and the LLM answers from that angle.

**State isolation:** `ResponseForm` manages its own textarea values, `suggesting` loading state, `perspectives` list, and `selectedPersp` per question. The parent component (`DialogueThread`) only sees the final responses when the user clicks Submit — it does not re-render on every keystroke. This was a deliberate trade-off: `ResponseForm` is treated as an uncontrolled-style form that only surfaces its data at submission time, keeping the parent's render tree stable during typing.

---

## 8. Bugs Fixed During Development

### Parchment SVG height too small after streaming

**Symptom:** The parchment shape rendered correctly but content overflowed the bottom edge — the SVG was shorter than the actual content.

**Root cause:** `useEffect` runs after React commits the DOM, but before the browser runs layout. `getBoundingClientRect()` returned the height from the previous paint (the still-streaming, shorter version of the block).

**Fix:** Wrapped the measurement in `requestAnimationFrame`, deferring it until the next paint when layout is complete. Added cleanup to cancel the rAF on unmount.

---

### Streaming content invisible due to `visibility: hidden`

**Symptom:** After adding the two-phase parchment logic, blocks were invisible during streaming.

**Root cause:** The `visibility: hidden` guard was applied whenever `svg === null`. Since `svg` is always `null` during streaming, the content was hidden even though it was actively receiving tokens.

**Fix:** Separated the two rendering paths entirely. If `isStreaming` is true, render a plain colored `<div>` with no SVG logic at all. The `visibility: hidden` path only activates when `isStreaming` is false, at which point the content is fully settled and can be measured safely.

---

### Duplicate history entries from multiple entry points

**Symptom:** A claim submitted via a chip or category card appeared twice in the history list.

**Root cause:** `saveToHistory` was called in multiple places: inside `handleAutoSubmit`, and also inside `ClaimInput` itself (which had its own `onChange` handler that saved on change).

**Fix:** Removed all history logic from `ClaimInput`. The single source of truth is `App.jsx`: `handleAutoSubmit` saves to history for automatic entry points, and `handleStart` saves for the manual Begin button. Since `claim` is lifted to `App`, every entry point necessarily passes through one of these two handlers.

---

## 9. Design Summary

The frontend's design principle is **predictable rendering under complex interaction**:

- **Centralized state:** `useDialectica` is the single data source; components only render what they receive
- **Separated rendering paths:** Streaming and settled states follow completely distinct code paths — no shared branch that mixes concerns
- **Unified entry:** All six zero-friction entry points converge on one `handleAutoSubmit` function with identical behavior
- **Autonomous forms:** `ResponseForm` owns its own textarea state, isolating per-keystroke updates from the parent render tree
