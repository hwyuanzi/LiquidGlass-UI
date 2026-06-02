/**
 * LiquidGlass UI — Core Engine
 * ----------------------------
 * A tiny (dependency-free) layer of native Custom Elements that render
 * Apple-style "liquid glass" surfaces. Everything is built on three ideas:
 *
 *   1. A static specular model — a fixed light source from above gives a
 *      bright top bevel and a soft top sheen. The surface reacts to hover as a
 *      whole (lift + brighten), like macOS — nothing tracks the cursor.
 *   2. Optional optical refraction — a smooth edge-lens SVG displacement filter
 *      applied to the *backdrop* so content behind the glass bends only at the
 *      curved edges (the detail most CSS glassmorphism misses).
 *   3. Strict encapsulation — each element lives in its own Shadow DOM and is
 *      promoted to its own GPU compositor layer, so blur stays cheap while the
 *      page scrolls.
 *
 * Public elements:  <liquid-glass>  <liquid-glass-card>  <liquid-glass-button>
 */

/* feDisplacementMap on a *backdrop* filter only paints in Chromium-class
 * engines today, so refraction is treated as a progressive enhancement. */
const SUPPORTS_REFRACTION =
  typeof CSS !== "undefined" &&
  CSS.supports &&
  CSS.supports("backdrop-filter", "url(#x)");

let FILTER_UID = 0;

/* ---------------------------------------------------------------------------
 * Edge-lens displacement maps.
 *
 * Real glass bends light at its curved edges and leaves the centre clear, so
 * we drive feDisplacementMap with a *smooth* bevel — never fractal noise (which
 * reads as blotchy water stains). The displacement vector is split across two
 * channels: a horizontal ramp in red (x) and a vertical ramp in blue (y).
 * Each ramp is flat (neutral 128) across the middle and only bends within the
 * outer `edge` band, so the surface magnifies the backdrop right at the rim.
 * The two single-channel images are combined at filter time with `feBlend`
 * (a core SVG primitive — no reliance on CSS blend modes inside the map).
 * ------------------------------------------------------------------------- */
const LENS_EDGE = 0.18; // fraction of each side that refracts (0 = none)

const axisMapURI = (axis, edge = LENS_EDGE) => {
  const e = edge.toFixed(3);
  const f = (1 - edge).toFixed(3);
  const horizontal = axis === "x";
  const dir = horizontal
    ? 'x1="0" y1="0" x2="1" y2="0"'
    : 'x1="0" y1="0" x2="0" y2="1"';
  const mid = horizontal ? "rgb(128,0,0)" : "rgb(0,0,128)";
  const hi = horizontal ? "rgb(255,0,0)" : "rgb(0,0,255)";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" preserveAspectRatio="none">` +
    `<defs><linearGradient id="g" ${dir}>` +
    `<stop offset="0" stop-color="rgb(0,0,0)"/>` +
    `<stop offset="${e}" stop-color="${mid}"/>` +
    `<stop offset="${f}" stop-color="${mid}"/>` +
    `<stop offset="1" stop-color="${hi}"/>` +
    `</linearGradient></defs>` +
    `<rect width="100" height="100" fill="black"/>` +
    `<rect width="100" height="100" fill="url(#g)"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const LENS_MAP_X = axisMapURI("x");
const LENS_MAP_Y = axisMapURI("y");

/* Escape interpolated values so an attribute containing quotes or angle
 * brackets can never break out of its markup context. */
const escHTML = (value) =>
  String(value).replace(
    /[&<>]/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch],
  );
const escAttr = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[ch],
  );

/* The shared visual layer. Component subclasses only add layout on top.
 *
 * The lighting model is *static*, like macOS: a fixed light source from above
 * gives a bright top bevel and a soft top sheen. Nothing tracks the cursor —
 * the surface simply lifts and brightens as a whole on hover. */
const BASE_STYLES = `
  :host {
    display: block;
    box-sizing: border-box;
    --_ty: 0px;
    --_sc: 1;
  }
  :host([hidden]) { display: none; }
  * { box-sizing: border-box; }

  .lg {
    position: relative;
    isolation: isolate;
    border-radius: var(--lg-radius);
    background: var(--lg-fill);
    border: 1px solid var(--lg-border);
    box-shadow: var(--lg-shadow), var(--lg-specular), var(--lg-occlusion);
    -webkit-backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-saturate)) brightness(var(--lg-brightness));
    backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-saturate)) brightness(var(--lg-brightness));
    overflow: hidden;
    transform: translate3d(0, var(--_ty), 0) scale(var(--_sc));
    will-change: transform, box-shadow, background;
    transition:
      transform var(--lg-duration) var(--lg-ease),
      box-shadow var(--lg-duration) var(--lg-ease),
      border-color var(--lg-duration) var(--lg-ease),
      background var(--lg-duration) var(--lg-ease);
    -webkit-font-smoothing: antialiased;
  }

  /* Fixed bevel: bright along the top edge, faint elsewhere, with a soft
     reflected glow at the very bottom — a single light source from above. */
  .lg::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(
      180deg,
      var(--lg-rim) 0%,
      var(--lg-rim-low) 35%,
      var(--lg-rim-low) 72%,
      color-mix(in srgb, var(--lg-rim) 60%, transparent) 100%
    );
    -webkit-mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    mask-composite: exclude;
    opacity: 0.85;
    pointer-events: none;
    z-index: 3;
    transition: opacity var(--lg-duration) var(--lg-ease);
  }

  /* Static top sheen — light pooling on the upper third of the pane. */
  .lg__sheen {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, var(--lg-sheen)) 0%,
      rgba(255, 255, 255, 0) 42%
    );
    opacity: 0.9;
    pointer-events: none;
    transition: opacity var(--lg-duration) var(--lg-ease);
    z-index: 2;
  }

  .lg__content {
    position: relative;
    z-index: 4;
    display: block;
  }

  /* Hover / focus: the whole element reacts — a gentle lift + brighter glass
     and edges. No cursor tracking. */
  :host(:hover) .lg,
  :host(:focus-within) .lg {
    --_ty: var(--lg-hover-lift);
    --_sc: var(--lg-hover-scale);
    /* Re-deriving --lg-fill with a stronger tint deepens the glass on hover. */
    --lg-tint-strength: var(--lg-hover-tint-strength);
    background: var(--lg-fill);
    border-color: var(--lg-hover-border);
    box-shadow: var(--lg-hover-shadow), var(--lg-specular);
  }
  :host(:hover) .lg::after,
  :host(:focus-within) .lg::after { opacity: 1; }
  :host(:hover) .lg__sheen,
  :host(:focus-within) .lg__sheen { opacity: 1; }

  /* Refraction enhancement: bend the backdrop with a displacement map. */
  .lg--refract {
    -webkit-backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-saturate)) brightness(var(--lg-brightness)) var(--_refract);
    backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-saturate)) brightness(var(--lg-brightness)) var(--_refract);
  }

  .lg__filter { position: absolute; width: 0; height: 0; pointer-events: none; }

  @media (prefers-reduced-motion: reduce) {
    .lg { transition-duration: 0.001s; }
  }
`;

class LiquidGlassElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  /* Subclasses override these two. */
  styles() {
    return "";
  }
  body() {
    return "<slot></slot>";
  }

  connectedCallback() {
    if (!this.isConnected) return;
    this.render();
  }

  render() {
    const refract = this.hasAttribute("refraction") && SUPPORTS_REFRACTION;
    const uid = `lg-refract-${++FILTER_UID}`;
    const scale = Number(this.getAttribute("refraction-scale")) || 18;

    // `color-interpolation-filters="sRGB"` keeps 128 a true neutral, so the
    // flat centre of the map produces zero displacement (linearRGB would shift
    // it and smear the whole surface).
    const filterSvg = refract
      ? `<svg class="lg__filter" aria-hidden="true">
           <filter id="${uid}" x="-8%" y="-8%" width="116%" height="116%"
                   color-interpolation-filters="sRGB">
             <feImage href="${LENS_MAP_X}" preserveAspectRatio="none"
                      x="0" y="0" width="100%" height="100%" result="mx"/>
             <feImage href="${LENS_MAP_Y}" preserveAspectRatio="none"
                      x="0" y="0" width="100%" height="100%" result="my"/>
             <feBlend in="mx" in2="my" mode="screen" result="map"/>
             <feGaussianBlur in="map" stdDeviation="0.5" result="smap"/>
             <feDisplacementMap in="SourceGraphic" in2="smap" scale="${scale}"
                                xChannelSelector="R" yChannelSelector="B"/>
           </filter>
         </svg>`
      : "";

    this.shadowRoot.innerHTML = `
      ${filterSvg}
      <style>${BASE_STYLES}${this.styles()}</style>
      <div class="lg${refract ? " lg--refract" : ""}" part="surface">
        <div class="lg__sheen" part="sheen"></div>
        <div class="lg__content">${this.body()}</div>
      </div>`;

    this._surface = this.shadowRoot.querySelector(".lg");
    if (refract) this._surface.style.setProperty("--_refract", `url(#${uid})`);
  }
}

/* --------------------------------------------------------------------- */
/* <liquid-glass> — the generic surface. Drop any markup inside.          */
/* --------------------------------------------------------------------- */
class LiquidGlass extends LiquidGlassElement {
  styles() {
    return `
      :host { --lg-pad-local: var(--lg-pad); }
      .lg { padding: var(--lg-pad-local); }
      .lg__content { color: var(--lg-ink); font-family: var(--lg-font); }
    `;
  }
}

/* --------------------------------------------------------------------- */
/* <liquid-glass-card> — icon + title + description + action pill.        */
/* --------------------------------------------------------------------- */
class LiquidGlassCard extends LiquidGlassElement {
  static get observedAttributes() {
    return ["heading", "title", "link", "cta"];
  }
  attributeChangedCallback() {
    if (this.shadowRoot.childElementCount) this.render();
  }

  styles() {
    return `
      :host { max-width: 880px; }
      .lg { padding: var(--lg-pad); }
      .row {
        display: flex; align-items: center; gap: 32px;
        font-family: var(--lg-font); color: var(--lg-ink);
      }
      .icon {
        flex: 0 0 auto; width: 116px; height: 116px;
        display: grid; place-items: center;
        border-radius: 24px;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.18);
        box-shadow: inset 0 1px 2px rgba(255,255,255,0.22);
        transition: transform var(--lg-duration) var(--lg-ease-spring);
      }
      :host(:hover) .icon { transform: rotate(-3deg) scale(1.06); }
      ::slotted([slot="icon"]) {
        width: 84px; height: 84px;
        filter: drop-shadow(0 6px 16px rgba(0,0,0,0.35));
      }
      .stack { display: flex; flex-direction: column; min-width: 0; }
      .title {
        margin: 0 0 10px; font-size: 25px; font-weight: 800;
        letter-spacing: -0.5px; line-height: 1.1; color: var(--lg-ink);
        text-shadow: 0 2px 14px rgba(0,0,0,0.28);
      }
      .desc {
        margin: 0; font-size: 15px; line-height: 1.6; font-weight: 500;
        color: var(--lg-ink-soft);
      }
      ::slotted([slot="description"] strong),
      ::slotted(strong) { color: var(--lg-ink); font-weight: 700; }
      .actions { margin-top: 22px; display: flex; gap: 12px; flex-wrap: wrap; }
      .pill {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 10px 20px; border-radius: var(--lg-radius-pill);
        font: 700 13.5px/1 var(--lg-font); color: var(--lg-ink);
        text-decoration: none; cursor: pointer;
        background: rgba(255,255,255,0.16);
        border: 1px solid rgba(255,255,255,0.26);
        box-shadow: inset 0 1px 1px rgba(255,255,255,0.2);
        transition: all var(--lg-duration-fast) var(--lg-ease);
      }
      .pill:hover {
        background: rgba(255,255,255,0.95); color: #0b0d16;
        border-color: #fff; box-shadow: 0 8px 20px rgba(255,255,255,0.28);
      }
      .pill:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
      .pill svg { width: 15px; height: 15px; }
      @media (max-width: 640px) {
        .row { flex-direction: column; align-items: flex-start; gap: 22px; }
        .icon { width: 92px; height: 92px; }
        ::slotted([slot="icon"]) { width: 64px; height: 64px; }
        .title { font-size: 21px; }
      }
    `;
  }

  body() {
    // `heading` is preferred; `title` is kept as a fallback but is discouraged
    // because it also triggers the browser's native tooltip on the host.
    const heading =
      this.getAttribute("heading") ||
      this.getAttribute("title") ||
      "Untitled Project";
    const link = this.getAttribute("link") || "#";
    const cta = this.getAttribute("cta") || "Explore Project";
    const arrow = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    return `
      <div class="row">
        <div class="icon"><slot name="icon"></slot></div>
        <div class="stack">
          <h3 class="title">${escHTML(heading)}</h3>
          <p class="desc"><slot name="description"></slot></p>
          <div class="actions">
            <a class="pill" href="${escAttr(link)}" target="_blank" rel="noopener noreferrer">${escHTML(cta)} ${arrow}</a>
          </div>
        </div>
      </div>`;
  }
}

/* --------------------------------------------------------------------- */
/* <liquid-glass-button> — a pill-shaped glass control.                   */
/* --------------------------------------------------------------------- */
class LiquidGlassButton extends LiquidGlassElement {
  static get observedAttributes() {
    return ["href"];
  }
  attributeChangedCallback() {
    if (this.shadowRoot.childElementCount) this.render();
  }

  styles() {
    return `
      :host { display: inline-block; --lg-radius: var(--lg-radius-pill); }
      .lg { padding: 0; }
      .control {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 13px 26px; border: 0; background: transparent;
        font: 700 14px/1 var(--lg-font); color: var(--lg-ink);
        letter-spacing: 0.2px; cursor: pointer; text-decoration: none;
        white-space: nowrap;
      }
      .control:focus-visible { outline: 2px solid #fff; outline-offset: 4px; border-radius: inherit; }
      ::slotted(svg) { width: 18px; height: 18px; }
    `;
  }

  body() {
    const href = this.getAttribute("href");
    const tag = href ? "a" : "button";
    const attrs = href
      ? `href="${escAttr(href)}" target="_blank" rel="noopener noreferrer"`
      : `type="button"`;
    return `<${tag} class="control" part="control" ${attrs}><slot></slot></${tag}>`;
  }
}

if (!customElements.get("liquid-glass")) {
  customElements.define("liquid-glass", LiquidGlass);
}
if (!customElements.get("liquid-glass-card")) {
  customElements.define("liquid-glass-card", LiquidGlassCard);
}
if (!customElements.get("liquid-glass-button")) {
  customElements.define("liquid-glass-button", LiquidGlassButton);
}

export { LiquidGlass, LiquidGlassCard, LiquidGlassButton, LiquidGlassElement };
