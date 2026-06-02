# Contributing to LiquidGlass UI

Thanks for your interest in improving LiquidGlass UI! This project is
intentionally dependency-free — it's plain ES modules and CSS — so getting set
up takes seconds.

## Development environment

**Requirements**

- A modern browser (Chrome / Edge / Safari / Firefox).
- Node.js **18+** — only used for the syntax check and Prettier.
- Python 3 _or_ any static file server (to serve the playground locally).

**Run the playground**

```bash
git clone https://github.com/hwyuanzi/liquid-glass-ui.git
cd liquid-glass-ui
npm run dev            # serves the repo on http://localhost:8080
# open http://localhost:8080/examples/
```

> The components are ES modules, so they must be served over `http://`
> (opening `index.html` as a `file://` will block the `import`).
> Any server works — e.g. `npx serve` or the VS Code "Live Server" extension.

## Before you open a PR

```bash
npm run check                         # node --check on the engine
npx prettier --write "src/**/*.{js,css}" "examples/**/*.html"
```

CI runs the same syntax check, an asset-presence check, and `prettier --check`,
so formatting must be clean for the build to go green.

## Project layout

| Path | What it is |
| --- | --- |
| `src/liquid-glass.css` | Design tokens + utility classes (the single source of truth for the look). |
| `src/liquid-glass.js` | The `LiquidGlassElement` base class + the three custom elements. |
| `examples/index.html` | The interactive playground. |

## Adding a new component

1. Subclass `LiquidGlassElement` in `src/liquid-glass.js`.
2. Override `styles()` (component-specific CSS) and `body()` (the slotted markup).
   The base class already provides the glass surface, the fixed specular
   bevel + top sheen, whole-element hover, and the optional edge refraction.
3. Register it with a guarded `customElements.define(...)`.
4. Demo it in `examples/index.html` and document it in the README.

## Coding conventions

- No runtime dependencies. Keep it vanilla.
- Escape any value interpolated into `innerHTML` (`escHTML` / `escAttr`).
- Read everything visual from a CSS custom property so the whole system stays
  themeable from `:root`.
- Respect `prefers-reduced-motion`.

## Reporting bugs

Open an issue with the browser/OS, a description of what you expected, and a
minimal reproduction (a CodePen or a snippet is ideal).
