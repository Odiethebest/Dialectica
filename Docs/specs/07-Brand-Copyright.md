# Dialectica — Attribution & Copyright: Implementation Prompt

Two placements, two purposes. Implement both. Do not combine them into one element.

---

## Placement 1 — Navbar署名 (Brand Attribution)

### Position
Inside the navbar, directly below the wordmark `D I A L E C T I C A`. Visible on every page state (idle and active).

### Markup

```jsx
<nav className="d-navbar-simple">
  <div className="d-navbar-left">
    <span className="d-navbar-wordmark">D I A L E C T I C A</span>
    <span className="d-navbar-byline">by Odie Yang</span>
  </div>
  <div className="d-navbar-right">
    <button className="d-lang-btn">中文 / EN</button>
    {isActive && (
      <button className="d-navbar-new-btn">New argument</button>
    )}
  </div>
</nav>
```

### CSS

```css
.d-navbar-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.d-navbar-byline {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 9px;
  font-style: italic;
  letter-spacing: 0.12em;
  color: #A8841E;           /* --d-gold2 */
  opacity: 0.8;
  line-height: 1;
  padding-left: 1px;        /* optical alignment with wordmark */
}
```

### Rules
- Never bold, never uppercase
- Font size must stay at 9px — any larger competes with the wordmark
- Italic serif only — matches the philosophical tone of the project
- The `×` sword prefix stays on the wordmark line, not the byline line
- On mobile: byline stays, but letter-spacing reduces to `0.06em`

---

## Placement 2 — Footer版权声明 (Legal Attribution)

### Position
At the very bottom of the page, below the gold footnote divider. Visible only when the user scrolls to the bottom of the idle view. In active view, it appears below the Synthesis block.

### Markup

```jsx
{/* At the bottom of both IdleView and ActiveView */}
<footer className="d-footer">
  <div className="d-footer-rule" />
  <p className="d-footer-text">
    © {new Date().getFullYear()} Odie Yang · All rights reserved
  </p>
</footer>
```

### CSS

```css
.d-footer {
  margin-top: 56px;
  padding-bottom: 40px;
}

.d-footer-rule {
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    #A8841E 30%,
    #C4983A 50%,
    #A8841E 70%,
    transparent 100%
  );
  margin-bottom: 18px;
}

.d-footer-text {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 11px;
  letter-spacing: 0.06em;
  color: #A07858;           /* --d-muted */
  text-align: center;
  margin: 0;
  user-select: none;
}
```

### Rules
- Use `new Date().getFullYear()` — never hardcode the year
- The gold rule is the same `d-footer-rule` gradient used elsewhere in the design — reuse the existing class, do not create a new one
- `text-align: center` — centered feels more formal for a copyright line
- `user-select: none` — prevents accidental selection when scrolling

---

## Chinese (中文) variants

When `lang === 'zh'`, swap the text:

```jsx
// Navbar byline
<span className="d-navbar-byline">
  {lang === 'zh' ? '作者：Odie Yang' : 'by Odie Yang'}
</span>

// Footer
<p className="d-footer-text">
  {lang === 'zh'
    ? `© ${new Date().getFullYear()} Odie Yang · 保留所有权利`
    : `© ${new Date().getFullYear()} Odie Yang · All rights reserved`}
</p>
```

---

## Visual hierarchy summary

```
[ NAVBAR ]
× D I A L E C T I C A        ← 11px serif, gold, letter-spaced
  by Odie Yang                ← 9px serif italic, gold2, subtle

[ PAGE CONTENT ]
...

[ FOOTER ]
────── gold gradient rule ──────
   © 2026 Odie Yang · All rights reserved   ← 11px sans, muted, centered
```

The two placements never compete. The navbar byline is a brand signal — seen immediately, always present. The footer copyright is a legal signal — seen at the end, understated.