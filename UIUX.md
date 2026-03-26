# Dialectica — Frontend Design Prompt

You are building the frontend for **Dialectica**, a Socratic argument-refinement agent. This document defines the complete visual language, component behavior, and interaction design. Follow it precisely.

---

## Design Philosophy

The visual language is **philosophical and literary, not technical**. Every design decision should feel like it belongs in a well-designed academic journal or a thoughtful essay app — not a SaaS dashboard or a dev tool.

The three reference points for aesthetic decisions:
1. **A typeset philosophy book** — serif type, generous leading, classical proportions
2. **A Greek agora** — open, uncluttered, built for dialogue
3. **A legal brief** — structured, numbered, evidence-cited

This is deliberately different from the other two projects in this portfolio (Pulse = data dashboard, Raft = systems visualization). Dialectica is the one that feels like it was made by someone who reads.

---

## Color System

Dialectica runs a **fully custom warm light theme** — three colors only: maroon, gold, warm white. Completely independent of the odieyang.com site CSS variables. Do not use `--color-background-primary` or any other site-level CSS variables. Every color is hardcoded from the palette below.

The design philosophy: **Gryffindor scholarly authority**. Maroon is structural and dominant. Gold is decorative and precious — used as trim, never as fill. Warm white is the breathing canvas. Think aged Oxford leather, gold-leaf lettering, illuminated manuscript borders.

### Base palette

```css
--d-bg:      #FAF6F0    /* Page background — warm white, slightly aged */
--d-bg2:     #F3EDE4    /* Card / block surface */
--d-bg3:     #EDE4D8    /* Deeper surface — default block borders, dividers */
--d-maroon:  #6B1020    /* Primary — navbar fill, Attack block fill, H1, active node */
--d-maroon2: #8A1828    /* Secondary maroon — button borders, hover states */
--d-maroon3: #4A0A14    /* Deep maroon — darkest accent */
--d-gold:    #C4983A    /* Gold — trim, pipeline done border, steelman border */
--d-gold2:   #A8841E    /* Deep gold — borders, focus states */
--d-gold3:   #E0B84A    /* Bright gold — navbar text, hover text on maroon */
--d-goldbg:  #C4983A18  /* Gold tint — steelman bg, socratic bg */
--d-body:    #2A1810    /* Primary body text — warm near-black */
--d-mid:     #7A4A30    /* Secondary text — H2, source citations */
--d-muted:   #A07858    /* Muted — labels, placeholder, footnote */
```

### Structural elements

**Navbar** — the most important branded element:
```css
.navbar {
  background: var(--d-maroon);
  border-bottom: 2px solid var(--d-gold2);
}
.nav-wordmark { color: var(--d-gold); letter-spacing: 0.44em; }
.nav-new-btn  { color: #C4A068; }
.nav-new-btn:hover { color: var(--d-gold3); }
```

**Gold rule** — the 3px decorative line immediately below the navbar. This is the signature Gryffindor detail. Never omit it:
```css
.gold-rule {
  height: 3px;
  background: linear-gradient(90deg, transparent, var(--d-gold2), var(--d-gold3), var(--d-gold2), transparent);
}
```

**Horizontal divider** (above footnote) — same gradient, 1px:
```css
.hr-gold {
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--d-gold2), transparent);
  border: none;
}
```

### Typography
- H1 headline: `--d-maroon`, 58px serif, weight 400
- H2 subline: `--d-mid`, 58px serif, weight 400, italic
- Block body text: `--d-body`, 17px serif, line-height 1.85
- Body text inside Attack block: `#F0E8DC` (light on maroon)
- Block labels (11px uppercase): `--d-muted`
- Source citations: `--d-muted`, 13px italic
- Footnote: `--d-muted`, 14px italic
- Wordmark in navbar: `--d-gold`, 11px serif, letter-spacing 0.44em

### Interactive elements

**Buttons (Begin ↗ / Submit ↗)**:
- Default: `color: --d-maroon`, `border: 1.5px solid --d-maroon2`, transparent bg
- Hover: `background: --d-maroon`, `color: --d-gold3`, `border-color: --d-gold2`
- This hover flip (white→maroon, maroon→gold) is the signature interaction

**Textarea**: `background: --d-bg2`, `border: 1.5px solid --d-bg3`, focus `border-color: --d-gold2`

**Chips**: `color: --d-mid`, `border: 1.5px solid --d-bg3`, hover `border-color: --d-gold2`, hover `color: --d-maroon`

### Pipeline nodes

- Pending: `border: 1.5px solid --d-bg3`, `color: --d-bg3`, opacity 0.7
- Done: `border: 1.5px solid --d-gold2`, `color: --d-maroon`, `background: --d-goldbg`
- Active (live): `background: --d-maroon`, `color: --d-gold3`, `border: 1.5px solid --d-gold2`, maroon pulse animation
- Connector line: `linear-gradient(90deg, --d-gold2, --d-bg3)` — fades from gold outward

### Dialogue blocks

| Block | Left border | Background | Label color | Body text |
|---|---|---|---|---|
| Claim | `--d-bg3` | `--d-bg2` | `--d-muted` | `--d-body` |
| Understand | `--d-bg3` | `--d-bg2` | `--d-muted` | `--d-body` |
| Steelman | `--d-gold2` | `--d-goldbg` | `--d-gold2` | `--d-body` |
| Attack | `--d-maroon` | `--d-maroon` (solid) | `--d-gold3` | `#F0E8DC` |
| Socratic | `--d-maroon2` | `--d-goldbg` | `--d-maroon` | `--d-body` |
| Synthesis | `--d-gold` | `--d-bg` | `--d-gold2` | `--d-body` |

Attack block: solid maroon fill, gold labels, light warm text — the visual climax of the dialogue thread.

Synthesis block: full `border: 1.5px solid --d-bg3` plus `border-left: 2.5px solid --d-gold`.

**Response form**: `background: --d-bg2`, `border: 1.5px solid --d-bg3`, `border-top: 2px solid --d-gold2` (gold top accent only).

**Argument map cells**: `background: --d-bg2`, `border: 1px solid --d-bg3`. Confidence delta: `--d-maroon`, 26px, weight 500.

### Roman numerals in blocks
- Attack block numerals: `--d-gold3`
- Socratic block numerals: `--d-gold2`
- All other numerals: `--d-muted`

### Never do this
- Never use gold as a large background fill — it's trim only
- Never use a solid colored background except for the navbar and Attack block
- Never use the gradient on anything other than the gold-rule and hr-gold
- No `white`, `black`, `#fff`, `#000`, `#333` — always use `--d-*` variables

---

## Typography

### Font stack
```css
--d-serif: var(--font-serif, 'Georgia', 'Times New Roman', serif);
--d-sans:  var(--font-sans, system-ui, -apple-system, sans-serif);
--d-mono:  var(--font-mono, 'SF Mono', 'Menlo', monospace);
```

### Type scale

| Role | Font | Size | Weight | Style | Line height |
|---|---|---|---|---|---|
| Wordmark | serif | 13px | 400 | normal | — |
| Page headline | serif | 38px | 400 | normal | 1.15 |
| Page subline | serif | 38px | 400 | italic | 1.15 |
| Block label | sans | 10px | 500 | normal | — |
| Block body text | serif | 14–15px | 400 | normal | 1.75 |
| Source citation | serif | 11px | 400 | italic | 1.5 |
| Pipeline node label | sans | 10px | 400 | normal | — |
| Button text | sans | 12–13px | 400 | normal | — |
| Example chip | serif | 12px | 400 | italic | — |
| Argument map value | serif | 13px | 400 | normal | 1.5 |
| Confidence delta | sans | 20px | 500 | normal | — |
| Footnote | serif | 12px | 400 | italic | 1.6 |

### Rules
- Headings and labels: sentence case always. Never Title Case, never ALL CAPS (except letter-spaced microlabels at 10px)
- Block labels use `letter-spacing: 0.1em` and `text-transform: uppercase` — this is the only place ALL CAPS is used
- Roman numerals (I. II. III.) instead of Arabic numerals (1. 2. 3.) in all user-facing lists inside dialogue blocks
- No bold mid-sentence. Bold is only for labels and headings.

---

## Layout

### Page container
```css
max-width: 720px;
margin: 0 auto;
padding: 0 24px 4rem;
```

Single column always. No sidebars. No multi-column layouts. The page is a scroll — the dialogue unfolds linearly downward, like reading an argument on a page.

### Spacing rhythm
- Between major sections: `2rem`
- Between dialogue blocks: `14px`
- Internal block padding: `14px 16px`
- Pipeline node gap: `0` (nodes connected by a line, not spaced apart)

---

## Page Modes

### Mode 1 — Idle (before submission)

The page presents a clean prompt interface. No chrome, no distractions.

**Elements (top to bottom):**

1. **Wordmark** — `⚔ Dialectica` in 13px serif, letter-spaced 0.3em, uppercase, `--color-text-secondary`. Top of page, flush left.

2. **Headline pair** — Two lines stacked:
    - Line 1: `Make an argument.` — 38px serif, normal weight, `--color-text-primary`
    - Line 2: `We'll make it harder.` — 38px serif, italic, `--color-text-secondary`
    - No margin between the two lines

3. **Textarea** — 3–4 rows. Placeholder text: `Enter a claim, thesis, or position you want to defend…` in italic, `--color-text-tertiary`. Font is serif. `border: 0.5px solid var(--color-border-secondary)`. On focus: `border-color: var(--d-gold)` with no glow or shadow. No resize handle (`resize: none`).

4. **Action row** — Flex row, space-between:
    - Left: three clickable chips (example claims). Chip style: serif italic, 12px, `border-radius: 20px`, `border: 0.5px solid var(--color-border-tertiary)`. On hover: border becomes `--color-border-secondary`.
    - Right: `Begin ↗` button. Style: 13px sans, uppercase, `letter-spacing: 0.08em`, `color: var(--d-gold)`, `border: 0.5px solid var(--d-gold)`, transparent background. On hover: `background: var(--d-gold-dim)`. No fill, ever.

5. **Divider** — `border-top: 0.5px solid var(--color-border-tertiary)`, margin `2.5rem 0`

6. **Footnote** — 12px serif italic, `--color-text-tertiary`. One or two short lines explaining the Socratic premise. Example: *"Dialectica does not validate your thinking — it challenges it. The engine attacks your claim, questions your assumptions, and returns a stronger argument."*

---

### Mode 2 — Active (after submission)

The page transitions from Idle to Active. The textarea and headline fade out; the pipeline and dialogue thread fade in. Use a simple CSS opacity + translateY transition (150ms ease-out).

**Elements (top to bottom):**

1. **Top bar** — Flex row, space-between. Left: `⚔ Dialectica` wordmark. Right: `New argument` button in muted gray text, 12px. No border on this button — it's a ghost link.

2. **Pipeline status strip** — See Pipeline section below.

3. **Dialogue thread** — Vertically stacked blocks that appear as nodes complete. See Dialogue Blocks section below.

---

## Pipeline Status Strip

A horizontal row of 5 nodes connected by thin lines. Sits at the top of Active mode.

### Node states

| State | Visual |
|---|---|
| Pending | 28px circle, `border: 0.5px solid var(--color-border-secondary)`, muted label, opacity 0.4 |
| Active | 28px circle, `background: var(--d-gold)`, white center dot `●`, pulsing ring animation, label in `--d-gold` |
| Complete | 28px circle, `background: var(--d-gold-dim)`, `border: 0.5px solid var(--d-gold)`, checkmark `✓` in `--d-gold` |

### Pulse animation (active node only)
```css
@keyframes pulse-gold {
  0%, 100% { box-shadow: 0 0 0 0 rgba(184, 150, 46, 0.4); }
  50%       { box-shadow: 0 0 0 8px rgba(184, 150, 46, 0); }
}
```

### Connectors
Thin horizontal line `0.5px solid var(--color-border-tertiary)`, width 32px, vertically centered between nodes.

### Node labels
10px sans, `letter-spacing: 0.06em`, uppercase. Pending: `--color-text-tertiary`. Active: `--d-gold`. Complete: `--color-text-secondary`.

### Node names (in order)
Understand → Steelman → Attack → Interrogate → Synthesize

---

## Dialogue Blocks

Each block follows the same base structure, differentiated by a colored left border and label color.

### Base block style
```css
border-left: 2px solid [type-color];
border-radius: 0 var(--border-radius-md) var(--border-radius-md) 0;
background: var(--color-background-secondary);
padding: 14px 16px;
margin-bottom: 14px;
```

### Block appearance animation
Each block fades in as its node completes:
```css
@keyframes block-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
animation: block-in 200ms ease-out forwards;
```

### Block label style
```css
font-size: 10px;
letter-spacing: 0.1em;
text-transform: uppercase;
font-weight: 500;
color: [type-color];
margin-bottom: 6px;
```

### Block types

**1. Claim block** (appears immediately on submission)
- Border: `var(--color-border-secondary)`
- Label color: `--color-text-secondary`
- Label: `Your claim`
- Content: The user's original input in serif, 15px

**2. Understand block** (after Understand node)
- Border: `var(--color-border-secondary)`
- Label: `Core claim · Assumptions`
- Content: Distilled claim in serif, 14px. Below it, a source-style line in 11px italic listing the extracted assumptions.

**3. Steelman block**
- Border color: `--d-steelman` (#4a9e84)
- Label: `Steelman`
- Content: Steelman argument in serif, 14px
- Below text: Source citation line in 11px italic `--color-text-tertiary`

**4. Attack block**
- Border color: `--d-attack` (#9e4a4a)
- Label: `Attacks`
- Content: Three attack items, each formatted as:
    - Roman numeral (`I.`) in 12px serif `--color-text-tertiary`, float left
    - Attack text in serif 14px
    - Inline source citation: 11px italic, same color as surrounding text but slightly muted, appended at end of paragraph with a `·` separator

**5. Socratic block**
- Border color: `--d-gold`
- Label: `Socratic questions`
- Content: Three questions. Roman numeral in 12px serif `--d-gold`, italic. Question text in serif 14px.

**6. Response form** (appears directly below Socratic block when `awaiting_input = true`)
- Style: `background: var(--color-background-primary)`, `border: 0.5px solid var(--color-border-secondary)`, `border-radius: var(--border-radius-md)`, `padding: 16px`
- Label: `Your responses` in 11px uppercase sans
- Three textareas, one per question. Each has a placeholder matching its question number (`Response to question I…`). Min-height 52px. Font is serif.
- Submit button: bottom-right aligned. `Submit responses ↗`. Same gold outline style as `Begin ↗` button.
- No submit button press without all three textareas having content. On empty submit attempt: flash the empty textarea border to `--d-attack` (red-ish) for 400ms.

**7. Synthesis block**
- Different from all others: `background: var(--color-background-primary)`, full border `0.5px solid var(--color-border-secondary)`, plus `border-left: 2px solid var(--d-synthesis)`
- Label: `Refined argument`
- Content: Synthesis text in serif 14px
- Below: Argument Map (see below)

---

## Argument Map

Rendered inside the Synthesis block, below the synthesis text.

2×2 grid of small cells, `gap: 10px`. Each cell:
```css
background: var(--color-background-secondary);
border-radius: var(--border-radius-md);
padding: 10px 12px;
```

Cell label: 10px sans uppercase `--color-text-tertiary`
Cell value: serif 13px `--color-text-primary`

The four cells (fixed layout):

| Position | Label | Content |
|---|---|---|
| Top-left | Conceded | What the claim gave up |
| Top-right | Retained | What survived the attacks |
| Bottom-left | Vulnerability | What remains exposed |
| Bottom-right | Confidence delta | `+N%` in 20px sans 500 weight, color `--d-steelman` (green) |

---

## Streaming Text Behavior

While a node is streaming tokens, the text appears character by character inside the block. Show a cursor at the end of the current text:

```css
.cursor::after {
  content: '|';
  animation: blink 1s step-end infinite;
  color: var(--d-gold);
  margin-left: 1px;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
```

Remove the cursor class when `node_end` event is received for that block.

For the Attack block specifically: stream each attack item sequentially. The first attack appears and streams to completion, then the second begins, then the third — not all three simultaneously.

---

## Transitions and Motion

Keep motion minimal and purposeful. No decorative animations.

| Transition | Duration | Easing |
|---|---|---|
| Idle → Active | 150ms | ease-out |
| Block appearing | 200ms | ease-out |
| Textarea focus | 150ms | ease |
| Button hover | 100ms | ease |
| Pipeline node state change | 200ms | ease |

No bounce, no spring, no elastic. Classical restraint.

---

## Responsive Behavior

The design is primarily desktop (720px max-width). On mobile:

- Pipeline strip: `overflow-x: auto`, `-webkit-overflow-scrolling: touch`, hidden scrollbar
- Idle headline: scale down to 28px on `max-width: 480px`
- Example chips: wrap to multiple rows, `flex-wrap: wrap`
- Argument map: collapse from 2×2 grid to single column
- Textarea: full width, min-height increases to 80px for thumb-friendliness
- Action row: stack vertically (chips above, button below)

---

## What Not to Do

- No gradients anywhere
- No box shadows (except `0 0 0 Npx` focus rings)
- No icons from icon libraries (Lucide, FontAwesome, etc.) — use text characters: `⚔`, `✓`, `●`, `○`, `↗`
- No card hover effects — blocks are static, not interactive surfaces
- No color fills on the Begin or Submit buttons — outline only
- No AI "sparkle" iconography (`✨`, `🤖`, `💡`) — this is a philosophy tool, not a chatbot
- No loading spinners — use the pipeline node pulse animation as the sole progress indicator
- No toast notifications — errors appear inline below the relevant input
- No modal dialogs
- Do not replicate Pulse's multi-column layout or Raft's dark canvas aesthetic