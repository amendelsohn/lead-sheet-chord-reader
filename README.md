# LeadSheet Chord Reader

A Chrome extension that auto-activates on chord sites (Ultimate Guitar, E-Chords) and renders a clean, distraction-free chord sheet.

## Features

- **Auto-activates** on Ultimate Guitar and E-Chords chord pages
- **Multi-column layout** (1, 2, or 3 columns) — no scrolling while playing
- **Transpose** up/down with sharps/flats toggle
- **Auto-scroll** with adjustable speed — hands-free while playing
- **Dark mode** — respects system preference, togglable
- **Font size** control
- **Keyboard shortcuts** for everything
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
6. Navigate to any chord page on [Ultimate Guitar](https://tabs.ultimate-guitar.com) or [E-Chords](https://www.e-chords.com)
7. Click the ♪ button in the bottom-right corner to open the reader

### Test URLs

- https://tabs.ultimate-guitar.com/tab/elton-john/can-you-feel-the-love-tonight-chords-519520
- https://www.e-chords.com/chords/the-beatles/yesterday
- https://tabs.ultimate-guitar.com/tab/the-animals/house-of-the-rising-sun-chords-65175

### After making changes

1. Run `npm run build` (or have `npm run dev` running)
2. Go to `chrome://extensions/`
3. Click the refresh icon on the LeadSheet extension card
4. Reload the chord page

## Project Structure

```
src/
├── content/
│   ├── main.ts              # Content script entry point
│   ├── content.css           # FAB + reader styles
│   └── parsers/
│       ├── types.ts          # ParsedSong data model
│       ├── ug.ts             # Ultimate Guitar DOM parser
│       └── echords.ts        # E-Chords DOM parser
├── reader/
│   └── reader.ts             # Reader view UI + controls
└── shared/
    └── transpose.ts          # Chord transposition logic
```

## Supported Sites

| Site | Status | How it parses |
|------|--------|---------------|
| Ultimate Guitar | ✅ | `<span data-name="Am">` in `<pre>` |
| E-Chords | ✅ | `<span data-chord="Am">` in `<pre class="pre-columns">` |

## License

MIT
