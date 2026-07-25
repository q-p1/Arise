# Fonts

**IBM Plex Sans Arabic** — © 2017 IBM Corp., licensed under the SIL Open Font
License v1.1 (full text in `OFL.txt`). The OFL permits bundling and
redistribution with this application.

## Why this typeface

Arise renders Arabic UI and English exam content side by side on nearly every
screen (analogies, grammar drills, AWL vocabulary). IBM Plex Sans Arabic is
drawn as a matched companion to IBM Plex Sans Latin, so the two scripts share
metrics, weight and voice instead of colliding.

## What is bundled

Four `woff2` subsets — Arabic and Latin, in Regular and Bold:

| File | Script | Weight | Size |
|---|---|---|---|
| `plex-ar-arabic-400.woff2` | Arabic | 400 | 42 KB |
| `plex-ar-arabic-700.woff2` | Arabic | 700 | 44 KB |
| `plex-ar-latin-400.woff2`  | Latin  | 400 | 19 KB |
| `plex-ar-latin-700.woff2`  | Latin  | 700 | 20 KB |

Two weights, not four. The UI only uses 400 for body text and 800/900 for
headings, so the `@font-face` rules in `index.html` declare weight *ranges*
(`400 500` and `600 900`). Anything from 600 to 900 resolves exactly onto the
Bold file, which keeps the heavy headings sharp and prevents the browser from
faking a heavier weight by smearing the outlines.

`unicode-range` splits Arabic from Latin so a device only downloads the script
it is actually painting.

## Offline

The files are self-hosted (no CDN) and listed in `sw.js` `CORE`, so the first
offline launch renders with the real typeface rather than falling back.

## Replacing or adding a weight

1. Drop the new `woff2` in this directory.
2. Add its `@font-face` block to the `<head>` of `index.html` — note that the
   build script only rewrites the region between the `app-bundle` markers, so
   edits to `<head>` are preserved.
3. Add the filename to `CORE` in `sw.js` and bump the cache version `V`.
