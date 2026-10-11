# MaktabatyPro Landing Page

Landing page for **MaktabatyPro** — the professional productivity suite for Moroccan professionals.

Built with vanilla HTML, Tailwind CSS (CDN), and vanilla JavaScript.

## Features

- Full i18n support (English, French, Arabic) with RTL
- Interactive multi-template demo using the real app panel + template HTML (one pair per template under `demo/panels/*.html` and `demo/templates/*.html`); after editing them run `node scripts/build-demo.mjs` to regenerate `demo/parts.js`. Theme tokens for the panel live in `css/demo-theme.css`.
- AI node board (`#flowboard`): Source Word document + Prompt rules -> AI model -> TemplateFlow output -> live demo, joined by animated circuit lines.
  - `js/ai-flow.js` + `css/ai-flow.css`. Everything inside the nodes is derived from `demo/templates/*.html`, so after editing a template and running `node scripts/build-demo.mjs` the source text, the generated TemplateFlow and the stats update by themselves.
  - Node texts live under `ai.flow.*` in `lang/*.json` (and `lang/all.js`, the file:// fallback). Edit the JSON, not all.js's structure.
  - `js/demo.js` exposes `window.__demo` and fires a `demo:template` event; the board uses them to deliver a template into the demo and to stay in sync with the demo's own buttons.
- Site-wide interaction layer (`js/site-fx.js` + `css/site-fx.css`):
  - Interactive circuit background (`#fx-bg`): grid lights up around the cursor, pulses travel along it, click/tap sends a burst. Static when the visitor prefers reduced motion. `window.burstAt(x, y)` lets other scripts trigger a burst.
  - Scroll progress bar, section rail (`#fx-rail`, edit the list in index.html and the `order` array in site-fx.js), current-section highlight in the top nav, cursor spotlight on cards, hero tilt (`data-tilt`).
  - Hours-saved calculator (`#fx-calc`) in the "Time saved" section. It uses the site's own claim of about 1 minute per document and 20 working days a month; change those two numbers in `target()` if your claims change.
- Board interactions (`js/ai-flow.js`): hover/focus/click a prompt rule to highlight where it was applied in the output (with match counts); click a template token to jump to its field in the demo; typing in the demo lights the matching token and sends a signal along the preview line; a live badge on the paper reports "ready to print" (driven by the `demo:progress` event from demo.js).
- First visit flow (js/ai-flow.js): nothing is chosen at first. The source node is empty, the demo sits behind a "waiting for a template" veil (`#fb-veil`) and a template-picker popup opens the first time the board or the demo scrolls into view. Choosing a card (or a tab, or the demo's own button) starts the animation, and the veil lifts when the template lands. The 3 tabs in the source node stay available to switch template at any time. Esc or "Not now" dismisses the popup; "Choose a template" buttons reopen it. Popup texts are the `ai.flow.pick.*` / `ai.flow.veil.*` keys in lang/*.json.
- Section order: hero, AI + demo, time saved, who it is for, features, inside the app, toolbox (overview, archive, PDF), privacy (hidden), pricing, tutorials + docs, FAQ, CTA.
- Responsive design
- Count-up statistics animation
- Purchase/license modal
- Auto-detect platform download button

## Structure

```
index.html   — Single-page landing page
assets/      — Screenshots and images
```
