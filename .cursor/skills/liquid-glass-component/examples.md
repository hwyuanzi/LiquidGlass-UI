# LiquidGlass — Worked Examples

Concrete, copy-ready examples. The end-to-end example shows the exact pattern to
follow when adding a new component.

## End-to-end: add `<liquid-glass-toggle>`

A pill switch built on the base class. This demonstrates every required step.

### 1. Component class (in `src/liquid-glass.js`)

```js
/* --------------------------------------------------------------------- */
/* <liquid-glass-toggle> — a glass on/off switch.                         */
/* --------------------------------------------------------------------- */
class LiquidGlassToggle extends LiquidGlassElement {
  static get observedAttributes() {
    return ["checked", "label"];
  }
  attributeChangedCallback() {
    if (this.shadowRoot.childElementCount) this.render();
  }

  styles() {
    return `
      :host { display: inline-block; --lg-radius: var(--lg-radius-pill); }
      .lg { padding: 6px; }
      .toggle {
        display: inline-flex; align-items: center; gap: 12px;
        padding: 6px 14px 6px 8px; cursor: pointer;
        font: 700 13.5px/1 var(--lg-font); color: var(--lg-ink);
      }
      .track {
        position: relative; width: 44px; height: 26px; flex: 0 0 auto;
        border-radius: 999px; background: rgba(255,255,255,0.18);
        border: 1px solid var(--lg-border);
        transition: background var(--lg-duration-fast) var(--lg-ease);
      }
      .knob {
        position: absolute; top: 2px; left: 2px; width: 20px; height: 20px;
        border-radius: 50%; background: #fff;
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
        transition: transform var(--lg-duration-fast) var(--lg-ease);
      }
      :host([checked]) .track { background: #34c759; }
      :host([checked]) .knob { transform: translateX(18px); }
    `;
  }

  body() {
    const label = this.getAttribute("label") || "Toggle";
    return `
      <button class="toggle" part="control" type="button"
              role="switch" aria-checked="${this.hasAttribute("checked")}">
        <span class="track"><span class="knob"></span></span>
        <span>${escHTML(label)}</span>
      </button>`;
  }
}
```

### 2. Wire the interaction

Because the base class re-renders on observed-attribute changes, toggle the
`checked` attribute on click. Add this inside `connectedCallback` only if the
component needs listeners; otherwise prefer delegating in `render()`. The
minimal approach — a click handler attached after render — is handled by adding
to the base lifecycle only when necessary. For this component, attach in a tiny
override that still calls `super`:

```js
connectedCallback() {
  super.connectedCallback();
  this.shadowRoot.addEventListener("click", () => {
    this.toggleAttribute("checked");
    this.dispatchEvent(new CustomEvent("change", {
      detail: { checked: this.hasAttribute("checked") }, bubbles: true,
    }));
  });
}
```

> Note: `render()` replaces `shadowRoot.innerHTML`, but a listener on the
> `shadowRoot` itself survives re-renders, so attach it there (not on inner
> nodes).

### 3. Register + export (bottom of file)

```js
if (!customElements.get("liquid-glass-toggle")) {
  customElements.define("liquid-glass-toggle", LiquidGlassToggle);
}

export {
  LiquidGlass,
  LiquidGlassCard,
  LiquidGlassButton,
  LiquidGlassToggle,
  LiquidGlassElement,
};
```

### 4. Demo (in `examples/index.html`)

```html
<section id="toggles">
  <div class="section-head">
    <h2 class="section-title">Toggles</h2>
    <span class="section-note">&lt;liquid-glass-toggle&gt;</span>
  </div>
  <div class="btn-row">
    <liquid-glass-toggle label="Wi-Fi" checked></liquid-glass-toggle>
    <liquid-glass-toggle label="Bluetooth"></liquid-glass-toggle>
  </div>
</section>
```

### 5. Document (in `README.md`)

Add a row to the components table and an attributes table:

```md
| `<liquid-glass-toggle>` | A glass on/off switch (emits a `change` event). |
```

### 6. Validate

```bash
node .cursor/skills/liquid-glass-component/scripts/validate.mjs
npm run check
npx prettier --write "src/**/*.{js,css}" "examples/**/*.html"
```

## Usage snippets

### Card

```html
<liquid-glass-card heading="My Project" link="https://…" cta="View" refraction>
  <svg slot="icon" viewBox="0 0 120 120"><!-- icon --></svg>
  <span slot="description">Built with <strong>Web Components</strong>.</span>
</liquid-glass-card>
```

### Button

```html
<liquid-glass-button href="https://…">
  <svg viewBox="0 0 24 24"><!-- optional icon --></svg>
  Click me
</liquid-glass-button>
```

### Generic surface + theming

```html
<liquid-glass
  style="--lg-tint: 120,180,255; --lg-tint-strength: 0.14; --lg-blur: 30px"
>
  <p>Any markup here inherits the full glass treatment.</p>
</liquid-glass>
```
