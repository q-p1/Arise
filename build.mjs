/* Build script for Arise.
 *
 * The entire game is authored in qudrat-quest.tsx (single source of truth).
 * index.html is a static shell (splash, meta tags, service-worker + crash
 * recovery) with the compiled app bundle spliced between two markers:
 *   <!-- app-bundle:start -->  ...compiled <script>...  <!-- app-bundle:end -->
 *
 * Usage:  npm install   (once)   then   node build.mjs
 *
 * Pinned to React 18.3.1 (the version the original bundle shipped) and esbuild,
 * both declared in package.json, so the output stays reproducible.
 */
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const START = "<!-- app-bundle:start -->";
const END = "<!-- app-bundle:end -->";

const result = await build({
  entryPoints: ["entry.jsx"],
  bundle: true,
  minify: true,
  format: "iife",
  jsx: "automatic",
  target: "es2019",
  legalComments: "inline",
  define: { "process.env.NODE_ENV": '"production"' },
  write: false,
});

const bundle = result.outputFiles[0].text;

const html = readFileSync("index.html", "utf8");
const i = html.indexOf(START);
const j = html.indexOf(END);
if (i === -1 || j === -1) {
  throw new Error("Could not find app-bundle markers in index.html");
}
const next =
  html.slice(0, i) +
  START +
  "\n<script>\n" +
  bundle +
  "\n</script>\n" +
  END +
  html.slice(j + END.length);

writeFileSync("index.html", next);
console.log("Built app bundle:", (bundle.length / 1024).toFixed(1) + "kb → index.html");
