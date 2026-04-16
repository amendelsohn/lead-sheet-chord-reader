# LeadSheet Chord Reader

A Chrome extension that renders chord sheets in a clean, distraction-free reading layout. Parses the existing page content client-side — no scraping, no network calls.

Currently compatible with Ultimate Guitar®, E-Chords, Cifra Club, AZChords, and UkuTabs (trademarks of their respective owners; this project is not affiliated with or endorsed by any of them).

## Features

- **Auto-activates** on supported chord sheet pages
- **Two layouts:** *Vertical* (one column, scroll down) or *Pages* (fills each column top-to-bottom, scroll right to reveal more columns)
- **Transpose** up/down across a -11..+11 range, with the current key shown next to the number
- **Sharps / flats** segmented toggle — flips accidental display even at transpose 0
- **Auto-scroll** with adjustable speed (0.2–3.0) — follows vertical or horizontal axis depending on layout
- **Light / dark theme** — defaults to system preference, togglable
- **Font size** control
- **Keyboard shortcuts** for everything
- **Responsive toolbar** — least-important controls collapse into a hamburger menu on narrow windows
- **Shadow DOM isolation** — reader styles don't leak into the host page and vice versa
- **Print-friendly** — Ctrl+P prints just the chord sheet

## Keyboard Shortcuts (when reader is open)

| Key | Action |
|-----|--------|
| `Esc` | Close reader |
| `↑` / `↓` | Transpose up/down |
| `←` / `→` / `PgUp` / `PgDn` | Page scroll (vertical: scroll by screen height with overlap; horizontal: one column) |
| `+` / `-` | Font size up/down |
| `v` | Vertical layout (single column, scroll down) |
| `h` | Horizontal layout (page view, scroll across) |
| `Space` | Toggle auto-scroll |
| `d` | Toggle dark mode |
| `b` | Toggle flats/sharps |

## Development Setup

### Prerequisites

- Node.js 18+
- Chrome browser

### Build

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Watch mode (rebuilds on file changes)
npm run dev
```

### Load in Chrome

1. Run `npm run build`
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the `dist/` folder inside this project
6. Navigate to any chord page on [Ultimate Guitar](https://tabs.ultimate-guitar.com), [E-Chords](https://www.e-chords.com), [Cifra Club](https://www.cifraclub.com), [AZChords](https://www.azchords.com), or [UkuTabs](https://ukutabs.com)
7. Click the ♪ button in the bottom-right corner to open the reader

### Test URLs

- https://tabs.ultimate-guitar.com/tab/elton-john/can-you-feel-the-love-tonight-chords-519520
- https://www.e-chords.com/chords/the-beatles/yesterday
- https://tabs.ultimate-guitar.com/tab/the-animals/house-of-the-rising-sun-chords-65175
- https://www.cifraclub.com/the-beatles/yesterday/
- https://www.azchords.com/b/beatles-tabs-410/yesterday-tabs-101080.html
- https://ukutabs.com/t/the-beatles/yesterday/

### After making changes

1. Run `npm run build` (or have `npm run dev` running)
2. Go to `chrome://extensions/`
3. Click the refresh icon on the LeadSheet extension card
4. Reload the chord page

## Project Structure

```
src/
├── content/
│   ├── main.ts                 # Content script entry — registry dispatch, observer
│   ├── content.css             # Reader styles (bundled into the Shadow DOM)
│   └── parsers/
│       ├── types.ts            # ParsedSong / SiteParser interfaces
│       ├── index.ts            # Parser registry
│       ├── enrich.ts           # Shared post-processor (Capo/Key/Tuning text scan)
│       ├── ug.ts               # Ultimate Guitar parser
│       ├── echords.ts          # E-Chords parser
│       ├── cifraclub.ts        # Cifra Club parser
│       ├── azchords.ts         # AZChords parser
│       └── ukutabs.ts          # UkuTabs parser
├── reader/
│   ├── reader.ts               # Entry — createReaderView, applyState, close
│   ├── state.ts                # ReaderState + chrome.storage prefs
│   ├── toolbar.ts              # HTML template, events, overflow menu
│   ├── song-view.ts            # Song renderer (chord / lyric / inline / group)
│   ├── scroll.ts               # Auto-scroll, page scroll, column separators
│   ├── keyboard.ts             # Keyboard shortcut dispatch
│   ├── shadow.ts               # Shadow DOM host / root
│   └── dom.ts                  # getEl / setRoot helper
├── shared/
│   ├── transpose.ts            # Chord transposition
│   ├── chord-detect.ts         # Regex chord-token detector
│   ├── storage.ts              # chrome.storage.local wrapper
│   └── html.ts                 # Tagged-template HTML builder
└── types.d.ts                  # Ambient types (CSS-as-text import)
```

## Supported Sites

| Site | How it parses |
|------|---------------|
| Ultimate Guitar | `<span data-name="Am">` in `<pre>` |
| E-Chords | `<span data-chord="Am">` in any `<pre>` |
| Cifra Club | `<b>Am</b>` in `<pre>` inside `<div id="cifra">` |
| AZChords | Plain-text `<pre id="content">` — inline `(Am)` or chord-over-lyric |
| UkuTabs | `<a class="ukutabschord">` in `<pre id="ukutabs-song">` |

### Adding a new site

1. Create a parser file in `src/content/parsers/` exporting a `SiteParser`
2. Register it in `src/content/parsers/index.ts`
3. Add the URL pattern to `manifest.json → content_scripts.matches`

See `src/content/parsers/types.ts` for the `SiteParser` interface.

## License

MIT
