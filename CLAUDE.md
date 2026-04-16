# CLAUDE.md

## MANDATORY: Use td for Task Management

Run td usage --new-session at conversation start (or after /clear). This tells you what to work on next.

Sessions are automatic (based on terminal/agent context). Optional:
- td session "name" to label the current session
- td session --new to force a new session in the same context

Use td usage -q after first read.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build           # tsc --noEmit + esbuild bundle → dist/           (Chrome target)
npm run build:firefox   # tsc --noEmit + esbuild bundle → dist-firefox/   (Firefox target)
npm run build:all       # Build both targets
npm run dev             # esbuild watch, Chrome target (no type-check)
npm run dev:firefox     # esbuild watch, Firefox target
npm run android:run     # web-ext run → install dist-firefox/ on USB/WiFi-connected Firefox Nightly
npm run typecheck       # tsc --noEmit
npm run clean           # rm -rf dist dist-firefox
```

The build must stay green on both steps. `tsc --noEmit` runs before esbuild in `build` — type errors fail the build.

**Dual target**: `build.mjs` accepts `--target=chrome|firefox` and picks the corresponding manifest (`manifest.json` vs `manifest.firefox.json`) and output dir (`dist/` vs `dist-firefox/`). The bundled `content.js` is identical for both targets — Firefox MV3 aliases the `chrome.*` namespace, so no source-level branching is needed. The target-specific manifest is always written as `manifest.json` in the output dir.

No test runner. The two pure-function modules that would most benefit from unit tests (if added) are `src/shared/transpose.ts` and `src/shared/chord-detect.ts`; the rest is DOM-coupled.

To load the built extension:
- Chrome/Edge: `chrome://extensions/` → Developer mode → Load unpacked → select `dist/`
- Firefox Desktop: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `dist-firefox/manifest.json`
- Firefox Android (Nightly): enable custom add-on collection in Settings, or use `web-ext run -t firefox-android` for ADB-assisted install from `dist-firefox/`

## Architecture

### Runtime layout: content script into Shadow DOM

This is a single-content-script MV3 extension. There is no background service worker, no popup, no options page. Everything that happens, happens inside one IIFE bundle injected into matching host pages (`dist/content.js`).

The reader UI (FAB + overlay) lives inside a **Shadow DOM** attached to a host `<div>` on the page — not the host page's DOM. This is critical:

- Host-page CSS cannot reach into our UI, and our CSS cannot leak out.
- `src/content/content.css` is imported as text by esbuild (`loader: { '.css': 'text' }` in `build.mjs`) and injected as a `<style>` tag inside the shadow root by `src/reader/shadow.ts`. There is no standalone CSS file shipped in `dist/` — the manifest does not reference one.
- All DOM lookups inside the reader go through `getEl(id)` in `src/reader/dom.ts`, which queries whichever root is currently set. `src/reader/shadow.ts::getShadowRoot()` calls `setRoot(shadowRoot)` on first invocation, so `getEl` works transparently.
- The shadow host is `position: fixed; inset: 0; pointer-events: none` so it doesn't perturb host-page layout. The overlay and FAB inside re-enable pointer events via CSS.
- Event handlers that listen on `document` (the overflow-menu outside-click closer) must use `event.composedPath()` to see into the shadow root — `Node.contains()` does not cross shadow boundaries.

### Parser registry

Each chord site has a `SiteParser` object implementing the interface in `src/content/parsers/types.ts`. The registry is `src/content/parsers/index.ts`. `src/content/main.ts` is site-agnostic — it resolves the active parser once via `getParserForCurrentSite()` and delegates URL matching, chord-content detection, and parsing to it.

**To add a new site:**
1. Write a parser file exporting a `SiteParser` (`id`, `label`, `hostnames`, `matchesUrl`, `hasChordContent`, `parse`)
2. Register it in `src/content/parsers/index.ts`
3. Add the URL pattern to `manifest.json → content_scripts.matches`

Parsers return `ParsedSong { title, artist, source, sourceUrl, key?, capo?, tuning?, lines: SongLine[] }`. Both existing parsers funnel their result through `enrichFromLines()` (`parsers/enrich.ts`) which scans the preamble for plain-text `Capo:` / `Key:` / `Tuning:` lines and lifts them into the header fields.

### SPA navigation

Ultimate Guitar is a React SPA — the content script only runs on initial page load, not on client-side navigation. `src/content/main.ts::watchUrlChanges()` wraps `history.pushState` / `replaceState` and listens for `popstate`, dispatching a `leadsheet:urlchange` event. The handler closes the open reader (`forceCloseReader`), clears `lastProcessedUrl`, and restarts the `MutationObserver`. The history wrapping is guarded via a `window.__leadsheet_urlWatch` flag so re-injecting the content script doesn't double-wrap.

### State lifecycle and the async-prefs race

The reader state is a module singleton in `src/reader/state.ts`. Consumers call `getState()`; it throws if the reader isn't open. `clearState()` is called on close.

Preferences live in `chrome.storage.local` (extension-scoped, not per-origin). `src/shared/storage.ts` exposes a synchronous `getCachedPrefs()` backed by a lazy `preloadPrefs()` promise. `main.ts` fires `preloadPrefs()` at content-script init so the cache is warm by the time the reader usually opens.

**The race:** after a fresh extension reload on an already-open chord page, `preloadPrefs()` may still be pending when `createReaderView` runs. `initState` would then apply defaults, the DOM renders with defaults, and the real prefs arrive async — mutating state but not re-rendering. The fix: `initState` accepts an `onAsyncPrefsApplied` callback that `createReaderView` wires to `applyState()`. Keep this wiring intact if you modify the state lifecycle.

### Rendering model

`applyState()` in `reader.ts` is the one function that writes state → DOM. It runs on open, after every state mutation, and on async pref arrival. Inside, it mutates DOM directly — no framework, no diffing. The song body is rebuilt via `renderSong()` (`src/reader/song-view.ts`); the toolbar is synced via `syncToolbarToState()` (`src/reader/toolbar.ts`).

Known perf consideration: `applyState` re-renders the entire song on every state change (font-size tick, transpose step, etc.). For long songs this has visible cost. Splitting content from presentation is noted as future work.

### html tagged template

`src/shared/html.ts` — a ~50-line tagged template helper. Interpolated values auto-escape; nested `html\`…\`` results (`HtmlString`) compose without re-escaping; arrays are joined (so `items.map(i => html\`<li>${i}</li>\`)` works directly in a template). There is no runtime DOM diffing — `render(container, tmpl)` sets `innerHTML`.

Only this helper should be used to build HTML strings from dynamic values. Raw `innerHTML` assignment with template literals bypasses escaping and should not appear in new code.

### Chord line rendering

`renderChordLine` in `src/reader/song-view.ts` has three distinct output shapes. Which one fires is determined by the line's structure:

- **Chord-only line** (UG's typical chord row above a lyric row): plain text consists entirely of chord tokens + whitespace. Render the transposed chord names alone.
- **Inline prose with embedded chord** (e.g. UG's tutorial text: "...the E7 chord..."): chord span sits inside non-chord text. Render the whole line with the chord span colored in place; the chord text is replaced with the transposed name, reading naturally.
- **Chord over lyric** (the common case): build a chord line with chord names at their character positions, then a lyric line below. Critical: chord position calculations use the *original* chord's character offsets; transposed chord names may be longer than originals (`F` → `Gb`), so the builder enforces one-space separation between adjacent chords to avoid collisions.

Also critical: `parseContent` in `ug.ts` preserves leading whitespace on every line. UG positions chord names above specific lyric characters using raw spaces; trimming would misalign the whole song.

### Shared constants

Speed limits (`SCROLL_MIN`, `SCROLL_MAX`, `SCROLL_STEP`) live in `src/reader/scroll.ts` and are imported by `toolbar.ts` for disabled-state comparisons. If you change them, both the step functions and the button-disable logic stay in sync automatically.

## Conventions

- All TypeScript, strict mode. esbuild doesn't type-check — `tsc --noEmit` does, and it runs before the bundle.
- Keep CSS class names prefixed with `ls-` (pre-Shadow DOM convention; still good practice for clarity).
- All chord / chord-name strings pass through `transposeChord()` even at transpose 0 so accidental flips (♯ ↔ ♭) apply consistently.
- The reader DOM is entirely inside the shadow root — do not use `document.getElementById` for reader elements; use `getEl`.
- Dedicated agent definition lives in `.claude/agents/code-reviewer.md` — invokable for full-project reviews.
