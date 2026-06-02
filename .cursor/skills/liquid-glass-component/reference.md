# LiquidGlass — API & Token Reference

Detailed reference for the engine in `src/liquid-glass.js` and the tokens in
`src/liquid-glass.css`. Read this when you need exact signatures, the full token
list, or the refraction internals.

## `LiquidGlassElement` base class

All components extend `LiquidGlassElement`. The base class owns the lifecycle;
subclasses override only two methods.

| Member                | Owner    | Notes                                                                                                                                                         |
| --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `constructor()`       | base     | Attaches an open Shadow DOM. **Do not override.**                                                                                                             |
| `connectedCallback()` | base     | Calls `render()`. **Do not override.**                                                                                                                        |
| `render()`            | base     | Builds the shadow tree: optional refraction `<svg>`, `<style>` (`BASE_STYLES` + `this.styles()`), and `.lg > .lg__sheen + .lg__content`. **Do not override.** |
| `styles()`            | subclass | Return a CSS string scoped to the shadow root (component layout/visuals).                                                                                     |
| `body()`              | subclass | Return the inner HTML placed inside `.lg__content`. Default: `<slot></slot>`.                                                                                 |

### Reactive attributes

If the component is configured by attributes, declare them and re-render:

```js
static get observedAttributes() {
  return ["heading", "href"]; // whatever the component reads
}
attributeChangedCallback() {
  // Guard: ignore the initial pre-connect attribute upgrades.
  if (this.shadowRoot.childElementCount) this.render();
}
```

### Shadow structure produced by `render()`

```html
<svg class="lg__filter">…refraction filter…</svg>
<!-- only when refraction is on -->
<style>
  BASE_STYLES + styles()
</style>
<div class="lg" part="surface">
  <div class="lg__sheen" part="sheen"></div>
  <div class="lg__content"><!-- body() --></div>
</div>
```

`.lg` is the glass surface (backdrop-filter, border, shadows, hover transform).
`.lg__sheen` is the static top highlight. Put component layout inside
`.lg__content` via `body()`.

## Shared attributes (all components)

| Attribute          | Type    | Effect                                                                                                                                                    |
| ------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `refraction`       | boolean | Enables the smooth edge-lens backdrop displacement. Chromium-class engines only (feature-detected via `SUPPORTS_REFRACTION`); silently skipped elsewhere. |
| `refraction-scale` | number  | Edge-lens displacement strength in px. Default `18`.                                                                                                      |

> Changing `refraction` at runtime is **not** an observed attribute. The
> playground re-applies it by calling `element.render()` after toggling the
> attribute.

## Escaping helpers

Always escape values interpolated into `body()`:

- `escHTML(value)` — escapes `& < >` for **text** content.
- `escAttr(value)` — escapes `& < > " '` for **attribute** values.

```js
body() {
  const label = this.getAttribute("label") || "Default";
  const href = this.getAttribute("href") || "#";
  return `<a class="x" href="${escAttr(href)}">${escHTML(label)}</a>`;
}
```

## Design tokens (`src/liquid-glass.css`)

Override on `:root`, a wrapper, or a single element
(`<liquid-glass style="--lg-blur: 12px">`). When a component needs a new
themeable value, add a token here and document it — do not hard-code it.

| Token                      | Default                             | Controls                                     |
| -------------------------- | ----------------------------------- | -------------------------------------------- |
| `--lg-ease`                | `cubic-bezier(0.16, 1, 0.3, 1)`     | Standard decelerate curve.                   |
| `--lg-ease-spring`         | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Springy curve (e.g. card icon).              |
| `--lg-duration`            | `0.55s`                             | Base transition time.                        |
| `--lg-duration-fast`       | `0.28s`                             | Fast transition (pills/buttons).             |
| `--lg-radius`              | `28px`                              | Corner radius.                               |
| `--lg-radius-pill`         | `999px`                             | Pill radius (buttons).                       |
| `--lg-pad`                 | `32px`                              | Default inner padding.                       |
| `--lg-tint`                | `255, 255, 255`                     | Glass tint (RGB triplet).                    |
| `--lg-tint-strength`       | `0.1`                               | Fill opacity.                                |
| `--lg-blur`                | `22px`                              | Backdrop blur radius.                        |
| `--lg-saturate`            | `180%`                              | Chroma recovery after blur.                  |
| `--lg-brightness`          | `108%`                              | Luminosity lift.                             |
| `--lg-fill`                | derived                             | Gradient fill (recomputed from tint tokens). |
| `--lg-border`              | `rgba(255,255,255,0.28)`            | Edge stroke.                                 |
| `--lg-rim`                 | `rgba(255,255,255,0.55)`            | Bright specular bevel (top).                 |
| `--lg-rim-low`             | `rgba(255,255,255,0.05)`            | Faded rim around the body.                   |
| `--lg-specular`            | inset shadow                        | Inner top highlight.                         |
| `--lg-occlusion`           | inset shadow                        | Inner bottom occlusion.                      |
| `--lg-shadow`              | layered                             | Ambient drop shadow.                         |
| `--lg-sheen`               | `0.16`                              | Strength of the fixed top-light sheen (0–1). |
| `--lg-hover-tint-strength` | `0.16`                              | Fill opacity on hover.                       |
| `--lg-hover-border`        | `rgba(255,255,255,0.5)`             | Edge on hover.                               |
| `--lg-hover-lift`          | `-6px`                              | Vertical lift on hover.                      |
| `--lg-hover-scale`         | `1.012`                             | Scale on hover.                              |
| `--lg-hover-shadow`        | layered                             | Shadow on hover.                             |
| `--lg-font`                | Plus Jakarta Sans stack             | Type family.                                 |
| `--lg-ink`                 | `#ffffff`                           | Primary text.                                |
| `--lg-ink-soft`            | `rgba(255,255,255,0.78)`            | Secondary text.                              |

Presets / utilities:

- `.lg-on-light` — wrapper preset for glass over **bright** backdrops (darker
  internals, brighter rim, stronger sheen).
- `.lg-surface` — utility class to give a plain element the glass look without a
  web component.

## Refraction internals (do not regress)

Refraction is a **smooth edge-lens**, never noise:

1. Two single-channel displacement maps are generated as inline SVG data URIs
   by `axisMapURI("x")` and `axisMapURI("y")` — a horizontal red ramp and a
   vertical blue ramp. Each is **flat (neutral 128) across the middle** and only
   ramps within the outer `LENS_EDGE` band, so only the edges bend.
2. The filter combines them with `feBlend mode="screen"`, softens with a small
   `feGaussianBlur`, then `feDisplacementMap` reads `xChannelSelector="R"` and
   `yChannelSelector="B"`.
3. The `<filter>` sets `color-interpolation-filters="sRGB"` so 128 stays a true
   neutral (linearRGB would shift it and smear the whole surface).

If you adjust refraction, keep it edge-only and smooth. **Never** reintroduce
`feTurbulence`/`fractalNoise` (it looks like water stains).

## Registration & export

At the bottom of `liquid-glass.js`:

```js
if (!customElements.get("liquid-glass-NAME")) {
  customElements.define("liquid-glass-NAME", LiquidGlassName);
}
// …
export {
  LiquidGlass,
  LiquidGlassCard,
  LiquidGlassButton,
  LiquidGlassElement,
  LiquidGlassName,
};
```
