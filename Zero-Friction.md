# Dialectica — Zero-Friction Entry: Implementation Spec

Every feature in this document solves one problem: **the user is too lazy to type**. Implement all six in order of priority. Do not skip steps.

---

## Priority Order

| # | Feature | Effort | Impact |
|---|---|---|---|
| 1 | Chips auto-submit | 30 min | High |
| 2 | URL param deep-link | 1 hr | High |
| 3 | Random claim generator | 2 hr | Medium |
| 4 | Topic category picker | 2 hr | Medium |
| 5 | History (localStorage) | 1 hr | Medium |
| 6 | Voice input | 1 hr | Medium |

---

## Feature 1 — Chips Auto-Submit

### What
Clicking an example chip fills the textarea **and immediately submits**. No extra button press.

### Current behavior
Chips fill the textarea. User still has to click BEGIN.

### Target behavior
Click chip → textarea fills → 300ms delay (so user sees what was filled) → auto-submit fires.

### Implementation

```jsx
// In ClaimInput.jsx
const EXAMPLES = [
  "AI will replace most creative jobs",
  "Democracy is the best system of government",
  "Remote work reduces productivity",
  "Social media has made people more polarized",
  "Free will is an illusion",
];

function ChipList({ onAutoSubmit }) {
  const handleChipClick = (example) => {
    onAutoSubmit(example); // sets claim + triggers begin after 300ms
  };

  return (
    <div className="d-chips">
      {EXAMPLES.map(ex => (
        <button
          key={ex}
          className="d-chip"
          onClick={() => handleChipClick(ex)}
        >
          {ex}
        </button>
      ))}
    </div>
  );
}

// In parent (Dialectica.jsx / useDialectica.js)
const handleAutoSubmit = (claim) => {
  setClaim(claim);
  setTimeout(() => handleBegin(claim), 300);
};
```

### UX detail
- The textarea must visibly fill before submission — the 300ms delay is intentional, not a race condition workaround
- Do NOT show a loading state during the 300ms — let the user see the chip text appear naturally
- After auto-submit, the chips disappear along with the rest of the idle UI

---

## Feature 2 — URL Parameter Deep-Link

### What
`odieyang.com/dialectica?claim=AI+will+replace+creative+jobs` pre-fills the claim and auto-starts the session.

### Why
This is the most important feature for portfolio impact. Every "Try it →" button on your Work page, GitHub README, and resume points here with a pre-loaded claim. Visitors arrive already inside the experience.

### Implementation

```jsx
// In Dialectica.jsx — on mount
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const claimParam = params.get('claim');
  if (claimParam && claimParam.trim().length > 0) {
    const decoded = decodeURIComponent(claimParam.trim());
    setClaim(decoded);
    // Auto-start after a short delay so the page renders first
    setTimeout(() => handleBegin(decoded), 600);
  }
}, []);
```

### URL generation helper

```js
// utils/dialecticaUrl.js
export function dialecticaUrl(claim, baseUrl = 'https://odieyang.com/dialectica') {
  return `${baseUrl}?claim=${encodeURIComponent(claim)}`;
}

// Usage examples:
dialecticaUrl("AI will replace most creative jobs")
// → https://odieyang.com/dialectica?claim=AI%20will%20replace%20most%20creative%20jobs

dialecticaUrl("Remote work reduces productivity")
// → https://odieyang.com/dialectica?claim=Remote%20work%20reduces%20productivity
```

### Suggested pre-built deep-links for your portfolio

Add these to `Work` page Dialectica card and GitHub README:

```
Try: "AI will replace creative jobs"
→ /dialectica?claim=AI+will+replace+most+creative+jobs

Try: "Social media causes polarization"
→ /dialectica?claim=Social+media+has+made+people+more+politically+polarized

Try: "Free will is an illusion"
→ /dialectica?claim=Free+will+is+an+illusion
```

### UX detail
- Show a subtle "Starting with: [claim]" banner for 1.5s before the pipeline activates — so the user understands what's happening
- If the URL param claim is very long (>200 chars), silently truncate to 200 and proceed
- Clean the URL after reading the param: `window.history.replaceState({}, '', '/dialectica')` — removes the query string so sharing the current URL doesn't re-trigger auto-start

---

## Feature 3 — Random Claim Generator

### What
A "Surprise me →" button fills the textarea with a random arguable claim. No thinking required.

### Implementation

```js
// data/randomClaims.js
export const RANDOM_CLAIMS = [
  // Technology
  "AI will replace most creative jobs within a decade",
  "Social media companies should be regulated like utilities",
  "Cryptocurrency will replace fiat currency",
  "Remote work is permanently better than office work",
  "Autonomous vehicles will reduce road deaths",

  // Society
  "Social media has made people more politically polarized",
  "Universal basic income would reduce productivity",
  "The four-day work week should be the global standard",
  "Affirmative action does more harm than good",
  "Cancel culture has gone too far",

  // Philosophy
  "Free will is an illusion",
  "Consciousness cannot be replicated by machines",
  "Moral relativism leads to nihilism",
  "Democracy is the best possible system of government",
  "Privacy is more important than national security",

  // Science & Environment
  "Nuclear energy is essential to solving climate change",
  "Gene editing of human embryos should be permitted",
  "Space exploration is a waste of resources",
  "Veganism is a moral obligation",

  // Culture
  "Art generated by AI is not real art",
  "Standardized testing is an accurate measure of intelligence",
  "Video games are a legitimate art form",
  "Celebrity culture is harmful to society",
];

export function getRandomClaim(exclude = '') {
  const filtered = RANDOM_CLAIMS.filter(c => c !== exclude);
  return filtered[Math.floor(Math.random() * filtered.length)];
}
```

```jsx
// In ClaimInput.jsx
<button
  className="d-btn-random"
  onClick={() => {
    const next = getRandomClaim(claim);
    setClaim(next);
    // Focus the textarea so the user sees it filled
    textareaRef.current?.focus();
  }}
>
  Surprise me →
</button>
```

### Styling
- Sits below the chips row, left-aligned
- Style: 13px, italic, `color: --d-muted`, no border, no background — a ghost link not a button
- On hover: `color: --d-maroon`
- Does NOT auto-submit — fills only, lets user read what was picked before committing

### UX detail
Clicking multiple times cycles through different claims (never repeats the currently showing one). This lets curious users browse before committing.

---

## Feature 4 — Topic Category Picker

### What
Five category buttons above the chips. Clicking a category replaces the chip row with 3 claims from that domain and shows them as large, tappable cards.

### Categories

```js
export const CATEGORIES = {
  Politics:    { icon: '⚖', color: '#8A1828' },
  Technology:  { icon: '⚙', color: '#1A3460' },
  Society:     { icon: '◎', color: '#2A5A3A' },
  Philosophy:  { icon: '∞', color: '#6B4A20' },
  Science:     { icon: '◈', color: '#2A4A60' },
};

export const CLAIMS_BY_CATEGORY = {
  Politics: [
    "Democracy is the best system of government",
    "Affirmative action does more harm than good",
    "Privacy is more important than national security",
  ],
  Technology: [
    "AI will replace most creative jobs",
    "Social media companies should be regulated like utilities",
    "Autonomous vehicles will eliminate human error on roads",
  ],
  Society: [
    "Social media has made people more politically polarized",
    "Cancel culture has gone too far",
    "The four-day work week should be the global standard",
  ],
  Philosophy: [
    "Free will is an illusion",
    "Consciousness cannot be replicated by machines",
    "Moral relativism inevitably leads to nihilism",
  ],
  Science: [
    "Nuclear energy is essential to solving climate change",
    "Gene editing of human embryos should be permitted",
    "Space exploration is a misallocation of resources",
  ],
};
```

```jsx
// In ClaimInput.jsx
const [activeCategory, setActiveCategory] = useState(null);

// Category bar
<div className="d-category-bar">
  {Object.entries(CATEGORIES).map(([name, { icon, color }]) => (
    <button
      key={name}
      className={`d-category-btn ${activeCategory === name ? 'active' : ''}`}
      style={{ '--cat-color': color }}
      onClick={() => setActiveCategory(activeCategory === name ? null : name)}
    >
      <span className="d-cat-icon">{icon}</span>
      <span className="d-cat-label">{name}</span>
    </button>
  ))}
</div>

// Category claims (replaces default chips when category selected)
{activeCategory && (
  <div className="d-category-claims">
    {CLAIMS_BY_CATEGORY[activeCategory].map(c => (
      <button
        key={c}
        className="d-category-claim-card"
        onClick={() => handleAutoSubmit(c)}
      >
        {c}
      </button>
    ))}
  </div>
)}
```

### Styling

Category bar:
- Horizontal flex row, `gap: 8px`, sits between wordmark and textarea in idle layout
- Each button: 12px sans, `border: 1px solid --d-bg3`, `border-radius: 20px`, `padding: 6px 14px`
- Active state: `background: var(--cat-color)`, `color: white`, `border-color: var(--cat-color)`

Category claim cards:
- Full-width stacked cards, `padding: 14px 18px`
- `background: --d-bg2`, `border: 1px solid --d-bg3`, `border-radius: 8px`
- Font: 15px serif, `color: --d-body`
- On hover: `border-color: --d-maroon2`
- Clicking auto-submits (same as chips)

### Mobile
Category bar wraps to 2 rows on `max-width: 480px`. Claim cards stay full-width.

---

## Feature 5 — History (localStorage)

### What
The last 5 submitted claims are stored locally. On return visits, a "Recent" section appears below the chips showing past claims as one-click cards.

### Implementation

```js
// utils/history.js
const HISTORY_KEY = 'dialectica_history';
const MAX_HISTORY = 5;

export function saveToHistory(claim) {
  if (!claim || claim.trim().length < 5) return;
  const existing = getHistory();
  const filtered = existing.filter(c => c !== claim); // dedup
  const updated = [claim, ...filtered].slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    // localStorage unavailable — fail silently
  }
}

export function getHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function clearHistory() {
  try { localStorage.removeItem(HISTORY_KEY); } catch (e) {}
}
```

```jsx
// In ClaimInput.jsx
const history = getHistory();

{history.length > 0 && (
  <div className="d-history">
    <div className="d-history-label">Recent</div>
    {history.map(h => (
      <button
        key={h}
        className="d-history-item"
        onClick={() => handleAutoSubmit(h)}
      >
        {h}
      </button>
    ))}
    <button
      className="d-history-clear"
      onClick={() => { clearHistory(); forceUpdate(); }}
    >
      Clear
    </button>
  </div>
)}
```

### When to save
Call `saveToHistory(claim)` inside `handleBegin()`, before the session starts. Save the raw claim string, not the processed version.

### Styling
- Sits below the horizontal divider, above the footnote
- Label "Recent" in 10px uppercase `--d-muted`
- Each item: 14px serif italic, ghost button, left-aligned, `color: --d-mid`
- On hover: `color: --d-maroon`, `text-decoration: underline`
- "Clear" button: 11px, far right, `color: --d-muted`

### UX detail
- If the current page has a URL param claim, do NOT show history — the user arrived with intent
- History items auto-submit on click (same as chips), no extra step

---

## Feature 6 — Voice Input

### What
A microphone button beside the textarea. On click, activates browser speech recognition. Transcription fills the textarea in real time. User says their claim, taps stop (or silence timeout), then taps BEGIN.

### Implementation

```jsx
// hooks/useSpeechInput.js
export function useSpeechInput(onTranscript) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const start = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice input is not supported in this browser. Try Chrome or Safari.');
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.continuous = false;
    r.interimResults = true;
    r.lang = 'en-US';

    r.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(result => result[0].transcript)
        .join('');
      onTranscript(transcript);
    };

    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);

    r.start();
    recognitionRef.current = r;
    setListening(true);
  };

  const stop = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  return { listening, start, stop };
}
```

```jsx
// In ClaimInput.jsx
const { listening, start, stop } = useSpeechInput((t) => setClaim(t));

// Microphone button — sits inside the textarea border, bottom-right corner
<div className="d-textarea-wrapper">
  <textarea ... />
  <button
    className={`d-mic-btn ${listening ? 'active' : ''}`}
    onClick={listening ? stop : start}
    title={listening ? 'Stop recording' : 'Speak your claim'}
  >
    {listening ? '■' : '◎'}
  </button>
</div>
```

### Styling

```css
.d-textarea-wrapper {
  position: relative;
}
.d-mic-btn {
  position: absolute;
  bottom: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--d-bg3);
  background: var(--d-bg);
  color: var(--d-muted);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms;
}
.d-mic-btn.active {
  border-color: var(--d-maroon2);
  color: var(--d-maroon);
  animation: mic-pulse 1s ease-in-out infinite;
}
@keyframes mic-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(107, 16, 32, 0.3); }
  50%       { box-shadow: 0 0 0 6px rgba(107, 16, 32, 0); }
}
```

### Language support
Default `r.lang = 'en-US'`. If user's browser locale is Chinese, set `r.lang = 'zh-CN'` automatically:

```js
r.lang = navigator.language.startsWith('zh') ? 'zh-CN' : 'en-US';
```

### UX detail
- Voice input does NOT auto-submit — the user hears the transcription fill in, then taps BEGIN themselves. Accidental submissions are annoying.
- If the browser does not support Web Speech API (Firefox, most non-Chrome desktop): show a tooltip "Voice input requires Chrome or Safari" instead of the button
- Silence timeout: `r.continuous = false` means recognition auto-stops after ~3s of silence. No manual stop needed in the happy path.

---

## Implementation Order

Do these in sequence, not in parallel:

1. **Feature 1** (chips auto-submit) — foundational, every other feature depends on the same `handleAutoSubmit` pattern
2. **Feature 5** (history) — pure localStorage, no UI complexity, high return-user value
3. **Feature 2** (URL deep-link) — critical for portfolio impact, implement before sharing the project publicly
4. **Feature 3** (random claim) — one function + one button, fast win
5. **Feature 4** (category picker) — more UI work, do after the simpler features are stable
6. **Feature 6** (voice input) — browser API dependency, test across devices last

---

## Shared Pattern: `handleAutoSubmit`

Features 1, 2, 3, 4, and 5 all use the same auto-submit pattern. Define it once:

```js
// In useDialectica.js
const handleAutoSubmit = useCallback((claim) => {
  if (!claim || claim.trim().length < 3) return;
  setClaim(claim.trim());
  saveToHistory(claim.trim());
  setTimeout(() => startSession(claim.trim()), 300);
}, [startSession]);
```

Pass `handleAutoSubmit` down to all input components. Never duplicate the logic.