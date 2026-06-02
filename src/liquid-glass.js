/**
 * LiquidGlass UI — Core Engine
 * ----------------------------
 * A tiny (dependency-free) layer of native Custom Elements that render
 * Apple-style "liquid glass" surfaces. Everything is built on three ideas:
 *
 *   1. A real specular model — a bright top bevel + a pointer-tracked glare
 *      that behaves like light skating across a curved pane of glass.
 *   2. Optional optical refraction — an SVG displacement filter applied to
 *      the *backdrop* so the content behind the glass appears to bend at the
 *      edges (the detail most CSS glassmorphism misses).
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

const PREFERS_REDUCED_MOTION =
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

let FILTER_UID = 0;

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

/* The shared visual layer. Component subclasses only add layout on top. */
const BASE_STYLES = `
  :host {
    display: block;
    box-sizing: border-box;
    perspective: 1100px;
    --_ty: 0px;
    --_sc: 1;
    --_rx: 0deg;
    --_ry: 0deg;
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
    transform: translate3d(0, var(--_ty), 0) scale(var(--_sc)) rotateX(var(--_rx)) rotateY(var(--_ry));
    transform-style: preserve-3d;
    will-change: transform, box-shadow, background;
    transition:
      transform var(--lg-duration) var(--lg-ease),
      box-shadow var(--lg-duration) var(--lg-ease),
      border-color var(--lg-duration) var(--lg-ease),
      background var(--lg-duration) var(--lg-ease);
    -webkit-font-smoothing: antialiased;
  }

  /* Bright curved bevel running around the rim — the "edge of the glass". */
  .lg::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(
      var(--_rim-angle, 145deg),
      var(--lg-rim) 0%,
      var(--lg-rim-low) 32%,
      var(--lg-rim-low) 70%,
      var(--lg-rim) 100%
    );
    -webkit-mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    mask-composite: exclude;
    opacity: 0.9;
    pointer-events: none;
    z-index: 3;
    transition: opacity var(--lg-duration) var(--lg-ease);
  }

  /* Pointer-tracked specular glare. */
  .lg__glare {
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    background: radial-gradient(
      220px circle at var(--lg-mx) var(--lg-my),
      var(--lg-glare) 0%,
      rgba(255, 255, 255, 0) 60%
    );
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--lg-duration-fast) var(--lg-ease);
    z-index: 2;
    mix-blend-mode: screen;
  }

  .lg__content {
    position: relative;
    z-index: 4;
    display: block;
  }

  /* Hover / focus interaction. */
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
  :host(:hover) .lg__glare,
  :host(:focus-within) .lg__glare { opacity: 1; }
  :host(:hover) .lg::after { opacity: 1; }

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
    this._frame = 0;
    this._onMove = this._onMove.bind(this);
    this._onLeave = this._onLeave.bind(this);
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
    this._bindPointer();
  }

  disconnectedCallback() {
    this._unbindPointer();
    cancelAnimationFrame(this._frame);
  }

  render() {
    const refract = this.hasAttribute("refraction") && SUPPORTS_REFRACTION;
    const uid = `lg-refract-${++FILTER_UID}`;
    const scale = Number(this.getAttribute("refraction-scale")) || 14;

    const filterSvg = refract
      ? `<svg class="lg__filter" aria-hidden="true">
           <filter id="${uid}" x="-20%" y="-20%" width="140%" height="140%">
             <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012"
                           numOctaves="2" seed="7" result="noise"/>
             <feGaussianBlur in="noise" stdDeviation="2" result="soft"/>
             <feDisplacementMap in="SourceGraphic" in2="soft" scale="${scale}"
                                xChannelSelector="R" yChannelSelector="G"/>
           </filter>
         </svg>`
      : "";

    this.shadowRoot.innerHTML = `
      ${filterSvg}
      <style>${BASE_STYLES}${this.styles()}</style>
      <div class="lg${refract ? " lg--refract" : ""}" part="surface">
        <div class="lg__glare" part="glare"></div>
        <div class="lg__content">${this.body()}</div>
      </div>`;

    this._surface = this.shadowRoot.querySelector(".lg");
    if (refract) this._surface.style.setProperty("--_refract", `url(#${uid})`);
  }

  _bindPointer() {
    this.addEventListener("pointermove", this._onMove, { passive: true });
    this.addEventListener("pointerleave", this._onLeave, { passive: true });
  }

  _unbindPointer() {
    this.removeEventListener("pointermove", this._onMove);
    this.removeEventListener("pointerleave", this._onLeave);
  }

  _onMove(event) {
    if (this._frame) return; // throttle to one update per frame
    this._frame = requestAnimationFrame(() => {
      this._frame = 0;
      const rect = this.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const px = (event.clientX - rect.left) / rect.width; // 0..1
      const py = (event.clientY - rect.top) / rect.height; // 0..1

      this.style.setProperty("--lg-mx", `${(px * 100).toFixed(2)}%`);
      this.style.setProperty("--lg-my", `${(py * 100).toFixed(2)}%`);
      // Rotate the rim highlight to chase the cursor.
      const angle = Math.round(
        (Math.atan2(py - 0.5, px - 0.5) * 180) / Math.PI + 90,
      );
      this.style.setProperty("--_rim-angle", `${angle}deg`);

      if (this.hasAttribute("tilt") && !PREFERS_REDUCED_MOTION) {
        const max = Number(this.getAttribute("tilt")) || 5;
        this.style.setProperty(
          "--_ry",
          `${((px - 0.5) * 2 * max).toFixed(2)}deg`,
        );
        this.style.setProperty(
          "--_rx",
          `${((0.5 - py) * 2 * max).toFixed(2)}deg`,
        );
      }
    });
  }

  _onLeave() {
    this.style.setProperty("--lg-mx", "50%");
    this.style.setProperty("--lg-my", "0%");
    this.style.removeProperty("--_rim-angle");
    this.style.setProperty("--_rx", "0deg");
    this.style.setProperty("--_ry", "0deg");
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
