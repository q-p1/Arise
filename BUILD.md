# Building Arise

The whole game is authored in **`qudrat-quest.tsx`** — this is the single source of
truth. `index.html` is a static shell (splash screen, meta tags, PWA manifest link,
service-worker registration, crash-recovery script) with the compiled app bundle
spliced in between two markers:

```
<!-- app-bundle:start -->
<script> …compiled bundle… </script>
<!-- app-bundle:end -->
```

## To rebuild after editing `qudrat-quest.tsx`

```bash
npm install     # once, installs React 18.3.1 + esbuild (pinned)
npm run build   # bundles the source and rewrites index.html in place
```

`build.mjs` compiles `entry.jsx` (which imports the game) with esbuild in production
mode and replaces the content between the markers. Nothing else in `index.html` is
touched.

## Serving

`index.html` is fully self-contained after a build — just serve the folder statically
(e.g. `npx serve .`) or deploy it to any static host. No server code is required; the
service worker (`sw.js`) makes it work offline as a PWA.
