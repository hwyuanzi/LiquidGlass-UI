#!/usr/bin/env node
/**
 * LiquidGlass project-invariant validator.
 *
 * Enforces the conventions described in SKILL.md so new or edited components
 * stay consistent. Exits non-zero (and prints actionable messages) on failure.
 *
 * Usage:
 *   node .cursor/skills/liquid-glass-component/scripts/validate.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const read = (rel) => readFileSync(resolve(ROOT, rel), "utf8");

const problems = [];
const fail = (msg) => problems.push(msg);
let defines = [];

// --- Required assets --------------------------------------------------------
for (const f of [
  "src/liquid-glass.js",
  "src/liquid-glass.css",
  "examples/index.html",
  "README.md",
]) {
  if (!existsSync(resolve(ROOT, f))) fail(`Missing required file: ${f}`);
}
if (problems.length) {
  report();
}

const js = read("src/liquid-glass.js");
const css = read("src/liquid-glass.css");
const readme = read("README.md");
const demo = read("examples/index.html");

// --- The engine must export the base class ---------------------------------
if (!/export\s*\{[^}]*LiquidGlassElement/.test(js)) {
  fail("src/liquid-glass.js must export LiquidGlassElement.");
}

// --- Refraction must stay a smooth edge-lens, never noise ------------------
if (/feTurbulence|fractalNoise/.test(js)) {
  fail(
    "Refraction must be a smooth edge-lens. Remove feTurbulence/fractalNoise " +
      "(it reads as blotchy water stains).",
  );
}

// --- The lighting model is static: no cursor tracking / tilt ---------------
for (const banned of [
  "pointermove",
  "--lg-mx",
  "--lg-my",
  "rotateX",
  "rotateY",
]) {
  if (js.includes(banned)) {
    fail(
      `Found "${banned}" in the engine. The lighting model is static (macOS-` +
        "style) — no cursor tracking, glare-follows-mouse, or 3D tilt.",
    );
  }
}

// --- Every defined element must be guarded + present in README -------------
defines = [...js.matchAll(/customElements\.define\(\s*"([^"]+)"/g)].map(
  (m) => m[1],
);
const guards = (js.match(/customElements\.get\(/g) || []).length;
if (defines.length === 0) fail("No custom elements are registered.");
if (guards < defines.length) {
  fail(
    `Each customElements.define must be guarded by customElements.get(...). ` +
      `Found ${defines.length} define(s) but only ${guards} guard(s).`,
  );
}
for (const tag of defines) {
  if (!readme.includes(tag)) {
    fail(`Element <${tag}> is registered but not documented in README.md.`);
  }
  if (!demo.includes(tag)) {
    fail(`Element <${tag}> is not demonstrated in examples/index.html.`);
  }
}

// --- Tokens sanity ----------------------------------------------------------
if (!/--lg-fill\s*:/.test(css)) {
  fail("src/liquid-glass.css must define the --lg-fill token.");
}

report();

function report() {
  if (problems.length === 0) {
    console.log(`✓ LiquidGlass invariants OK (${defines.length} elements).`);
    process.exit(0);
  }
  console.error("✗ LiquidGlass validation failed:\n");
  for (const p of problems) console.error(`  • ${p}`);
  console.error("");
  process.exit(1);
}
