<div align="center">

# LiquidGlass UI 🌊

### Apple-style *liquid glass* for the open web — native Web Components, zero dependencies.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Web Components](https://img.shields.io/badge/Web%20Components-Native-orange.svg)](https://developer.mozilla.org/en-US/docs/Web/API/Web_components)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](package.json)
[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-2088FF.svg)](.github/workflows/ci.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-blueviolet.svg)](CONTRIBUTING.md)

**[▶ Live demo](https://hwyuanzi.github.io/liquid-glass-ui/)** · [Quick start](#-quick-start) · [Components](#-components) · [Design tokens](#️-design-tokens) · [Contributing](CONTRIBUTING.md)

</div>

---

**LiquidGlass UI** recreates Apple's *liquid glass* material on the open web. It
ships as plain `.js` + `.css` built on the native **Custom Elements** and
**Shadow DOM** APIs — **no build step, no framework, no runtime dependencies.**

Most CSS "glassmorphism" stops at `blur()` + a translucent fill. LiquidGlass UI
models how light actually behaves on a curved pane of glass:

- 🪞 **Specular rim highlights** — a bright bevel traces the edge and rotates to chase the cursor.
- ✨ **Pointer-tracked glare** — a soft, screen-blended hotspot follows the pointer like a real reflection.
- 🌀 **Optical refraction** *(opt-in)* — an SVG `feDisplacementMap` bends the **backdrop** at the edges, so content behind the glass distorts the way it would through a real lens.
- 🎛️ **3D tilt** — surfaces lean toward the cursor with a spring-loaded parallax.
- ⚡ **Compositor-friendly** — every surface gets its own GPU layer and pointer updates are throttled to one `requestAnimationFrame`, keeping blur cheap during scroll.
- 🎨 **Design-token driven** — re-theme the entire system from a handful of CSS custom properties.
- ♿ **Accessible** — honours `prefers-reduced-motion`, exposes focus states, escapes injected markup, and uses semantic HTML.

## 📑 Table of contents

- [Live demo](#-live-demo)
- [Install](#-install)
- [Quick start](#-quick-start)
- [Components](#-components)
- [Design tokens](#️-design-tokens)
- [Theming & framework use](#-theming--framework-use)
- [Local environment](#-local-environment)
- [How it works](#️-how-it-works)
- [Browser support](#-browser-support)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#️-license)

## 🎬 Live demo

The interactive playground (live token sliders + four switchable backdrops) is
auto-deployed to GitHub Pages on every push to `main`:

> **https://hwyuanzi.github.io/liquid-glass-ui/**

To run it yourself, see [Local environment](#-local-environment).

## 📦 Install

LiquidGlass UI has **no dependencies**. Pick whichever fits your setup:

**A. CDN (no install)** — import the module straight from jsDelivr:

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/gh/hwyuanzi/liquid-glass-ui/src/liquid-glass.css"
/>
<script type="module">
  import "https://cdn.jsdelivr.net/gh/hwyuanzi/liquid-glass-ui/src/liquid-glass.js";
</script>
```

**B. npm**

```bash
npm install liquid-glass-ui
```

```js
import "liquid-glass-ui";          // registers the custom elements
import "liquid-glass-ui/css";       // the design tokens stylesheet
```

**C. Vendor the files** — copy `src/liquid-glass.js` and `src/liquid-glass.css`
into your project and reference them locally.

## 🚀 Quick start

```html
<link rel="stylesheet" href="src/liquid-glass.css" />
<script type="module" src="src/liquid-glass.js"></script>

<liquid-glass-card
  heading="ADS Technical Audit"
  link="https://github.com/hwyuanzi/repo"
  cta="View repository"
  tilt="4"
  refraction
>
  <svg slot="icon" viewBox="0 0 120 120" fill="none">
    <circle cx="60" cy="60" r="34" fill="rgba(255,255,255,0.18)"
            stroke="white" stroke-width="3" />
  </svg>
  <span slot="description">
    A rigorous audit covering <strong>intersectional fairness</strong> and
    <strong>differential privacy</strong> frameworks.
  </span>
</liquid-glass-card>
```

> ⚠️ The components are **ES modules**, so load them with
> `<script type="module">` and serve over `http://` (not `file://`) so the
> import resolves.

## 🧩 Components

| Element | Purpose |
| --- | --- |
| `<liquid-glass>` | A blank glass surface — slot in any markup. |
| `<liquid-glass-card>` | Icon + heading + description + action pill. |
| `<liquid-glass-button>` | A pill-shaped glass control (renders `<a>` if `href` is set, else `<button>`). |

### Shared attributes (every component)

| Attribute | Type | Effect |
| --- | --- | --- |
| `refraction` | boolean | Enables the SVG backdrop-displacement lens (Chromium-class engines; silently skipped elsewhere). |
| `refraction-scale` | number | Displacement strength (default `14`). |
| `tilt` | number | Max parallax tilt in degrees toward the cursor (e.g. `tilt="6"`). Disabled under reduced-motion. |

### `<liquid-glass-card>`

| Attribute | Default | Description |
| --- | --- | --- |
| `heading` | `"Untitled Project"` | Card title. *(Prefer this over `title`, which also fires a native browser tooltip.)* |
| `link` | `"#"` | URL the action pill points to. |
| `cta` | `"Explore Project"` | Action-pill label. |

**Slots:** `icon` (an SVG/image) and `description` (rich text — `<strong>` is styled).

### `<liquid-glass-button>`

| Attribute | Description |
| --- | --- |
| `href` | If present, renders an `<a>` (opens in a new tab); otherwise a `<button>`. |

Slot in text and/or an SVG icon:

```html
<liquid-glass-button href="https://github.com" tilt="8">
  <svg viewBox="0 0 24 24" fill="currentColor"><!-- icon --></svg>
  Star on GitHub
</liquid-glass-button>
```

### Styling internals with `::part`

Each surface exposes CSS `part`s so you can style internals from outside the
Shadow DOM: `part="surface"`, `part="glare"`, and (button) `part="control"`.

```css
liquid-glass-card::part(surface) { border-radius: 40px; }
```

## 🎛️ Design tokens

Override any token on `:root`, a wrapper, or a single element
(`<liquid-glass style="--lg-blur: 12px">`).

| Token | Default | Controls |
| --- | --- | --- |
| `--lg-blur` | `22px` | Backdrop blur radius. |
| `--lg-saturate` | `180%` | Chroma recovery after blur. |
| `--lg-brightness` | `108%` | Luminosity lift. |
| `--lg-tint` | `255, 255, 255` | Glass tint (RGB triplet). |
| `--lg-tint-strength` | `0.10` | Fill opacity. |
| `--lg-radius` | `28px` | Corner radius. |
| `--lg-border` | `rgba(255,255,255,0.28)` | Edge stroke. |
| `--lg-rim` | `rgba(255,255,255,0.55)` | Bright specular bevel. |
| `--lg-glare` | `rgba(255,255,255,0.18)` | Pointer-tracked hotspot. |
| `--lg-ease` | `cubic-bezier(0.16, 1, 0.3, 1)` | Apple-standard decelerate curve. |
| `--lg-duration` | `0.55s` | Base transition time. |

There's also:

- **`.lg-on-light`** — a wrapper preset for placing glass over **bright** backdrops (darker internals, brighter rim).
- **`.lg-surface`** — a utility class to give any plain element the glass look without a web component.

## 🎨 Theming & framework use

**Re-theme in one block:**

```css
:root {
  --lg-tint: 120, 180, 255;   /* cool blue glass */
  --lg-tint-strength: 0.14;
  --lg-blur: 30px;
  --lg-radius: 36px;
}
```

**React / Next.js** — custom elements are just DOM, so they work as-is. Import
once (e.g. in your root layout) and use the tags. In JSX, `class` →
`className` is irrelevant here since you pass through attributes:

```jsx
import "liquid-glass-ui";
import "liquid-glass-ui/css";

export default function Card() {
  return (
    <liquid-glass-card heading="My project" link="https://…" tilt="4" refraction>
      <span slot="description">Built with <strong>Web Components</strong>.</span>
    </liquid-glass-card>
  );
}
```

**Vue / Svelte / Angular** — register the element import once; all three treat
unknown hyphenated tags as custom elements (configure
`compilerOptions.isCustomElement` in Vue, `customElement` schema in Angular).

## 💻 Local environment

**Prerequisites**

- A modern browser.
- Node.js **18+** (only for the syntax check + Prettier).
- Python 3 _or_ any static server.

**Run**

```bash
git clone https://github.com/hwyuanzi/liquid-glass-ui.git
cd liquid-glass-ui
npm run dev          # → http://localhost:8080  (then open /examples/)
```

No `npm install` is required to run — there are no dependencies. Prettier is
fetched on demand via `npx` only when you format.

**Scripts**

| Script | Does |
| --- | --- |
| `npm run dev` / `npm start` | Serve the repo at `http://localhost:8080`. |
| `npm run check` | `node --check` the engine (syntax). |

> No Python? Use any static server instead, e.g. `npx serve` or the VS Code
> "Live Server" extension.

**Continuous integration & deployment**

- **`ci.yml`** runs on every push/PR: syntax check, required-asset check, and `prettier --check`.
- **`deploy.yml`** publishes the playground to GitHub Pages on every push to `main`. Enable it once via **Settings → Pages → Source: GitHub Actions**.

## 🏗️ How it works

```text
liquid-glass-ui/
├── .github/workflows/
│   ├── ci.yml              # syntax + asset + format checks
│   └── deploy.yml          # GitHub Pages deploy of the playground
├── src/
│   ├── liquid-glass.css    # design tokens + utility classes
│   └── liquid-glass.js     # LiquidGlassElement base + the 3 elements
├── examples/index.html     # interactive playground
├── CONTRIBUTING.md
├── LICENSE                 # MIT
├── package.json
└── README.md
```

`liquid-glass.js` defines a small `LiquidGlassElement` base class. Each
component subclass supplies only its layout (`styles()` + `body()`); the base
class handles the shared glass surface, pointer tracking (writing
`--lg-mx`/`--lg-my` and a rotating rim angle), the optional refraction filter,
the lift/tilt transform math, and input escaping. Adding a new component is a
few dozen lines — see [CONTRIBUTING.md](CONTRIBUTING.md).

## 🌐 Browser support

| Feature | Support |
| --- | --- |
| Glass, specular rim, glare, tilt, hover | All evergreen browsers (Chrome, Edge, Safari, Firefox). |
| `refraction` (backdrop displacement) | Chromium-class engines; **gracefully skipped** elsewhere, leaving a clean blurred surface. |

## 🗺️ Roadmap

- [ ] `<liquid-glass-toggle>` and `<liquid-glass-modal>`
- [ ] Pre-built light/dark theme presets
- [ ] Published npm package + versioned CDN
- [ ] Visual regression tests (Playwright)

Ideas and PRs welcome.

## 🤝 Contributing

Contributions are very welcome — see **[CONTRIBUTING.md](CONTRIBUTING.md)** for
the dev setup and conventions. If this project helped you, a ⭐ goes a long way!

## ⚖️ License

[MIT](LICENSE) — free for personal and commercial use.
