/* Arise test runner.
 *
 * The app is authored as one browser-targeted TSX file. Rather than restructure
 * it, we bundle it for Node (stubbing the browser-only globals it touches at
 * module scope) and import its `__test` surface. That keeps the tests running
 * against the real shipped code paths — not a reimplementation.
 *
 * Usage:  npm test
 */
import { build } from "esbuild";
import { readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSync, mkdtempSync } from "node:fs";

/* ---- minimal browser stubs: the module body touches these at import time ---- */
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.document = { getElementById: () => null, createElement: () => ({ style: {}, appendChild() {}, remove() {} }), body: { appendChild() {}, removeChild() {} } };
try { globalThis.navigator ??= { clipboard: null, userAgent: "node" }; } catch { /* Node ≥21 defines navigator read-only — fine, it already exists */ }
globalThis.speechSynthesis = { cancel() {}, speak() {} };
globalThis.SpeechSynthesisUtterance = class {};
globalThis.AudioContext = class { createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: { value: 0, setValueAtTime() {} }, type: "" }; } createGain() { return { connect() {}, gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} } }; } get destination() { return {}; } get currentTime() { return 0; } close() {} };

const dir = mkdtempSync(join(tmpdir(), "arise-test-"));
const outfile = join(dir, "app.mjs");

await build({
  entryPoints: ["qudrat-quest.tsx"],
  bundle: true,
  format: "esm",
  platform: "neutral",
  jsx: "automatic",
  target: "es2022",
  outfile,
  // Bundle React in too: the temp dir has no node_modules to resolve against,
  // and nothing here renders — we only need the module to evaluate.
  external: ["react-dom/client"],
  define: { "process.env.NODE_ENV": '"test"' },
  logLevel: "error",
});

const { __test } = await import(pathToFileURL(outfile).href);

/* ---- tiny assertion harness (no dependency, deterministic output) ---- */
let passed = 0, failed = 0, current = "";
const failures = [];
export function test(name, fn) {
  current = name;
  try { fn(); passed++; process.stdout.write("."); }
  catch (e) { failed++; failures.push({ name, msg: e.message }); process.stdout.write("F"); }
}
export const assert = {
  ok(v, m = "expected truthy") { if (!v) throw new Error(`${m} (got ${JSON.stringify(v)})`); },
  eq(a, b, m = "not equal") { if (a !== b) throw new Error(`${m}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
  near(a, b, tol, m = "not near") { if (Math.abs(a - b) > tol) throw new Error(`${m}: ${a} vs ${b} (tol ${tol})`); },
  gt(a, b, m = "not greater") { if (!(a > b)) throw new Error(`${m}: ${a} !> ${b}`); },
  gte(a, b, m = "not >=") { if (!(a >= b)) throw new Error(`${m}: ${a} !>= ${b}`); },
  lte(a, b, m = "not <=") { if (!(a <= b)) throw new Error(`${m}: ${a} !<= ${b}`); },
  throws(fn, m = "expected throw") { let t = false; try { fn(); } catch { t = true; } if (!t) throw new Error(m); },
};

const files = readdirSync(new URL(".", import.meta.url)).filter(f => f.endsWith(".test.mjs")).sort();
for (const f of files) {
  const mod = await import(pathToFileURL(new URL(f, import.meta.url).pathname).href);
  process.stdout.write(`\n${f}  `);
  await mod.default({ test, assert, T: __test });
}

console.log(`\n\n${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log("\nFailures:");
  failures.forEach(f => console.log(`  ✗ ${f.name}\n    ${f.msg}`));
  process.exit(1);
}
