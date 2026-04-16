# LeadSheet Chord Reader — Product Spec

> Status: v0.1 (April 2026)
>
> **Note:** This is the original product spec written before implementation.
> Some details (column layout, data model, file structure) have evolved. For
> the current shape of the code, see `README.md` and the inline docs in
> `src/content/parsers/types.ts`. Kept here for historical intent.

## One-Liner

A Chrome extension that auto-activates on chord sites (Ultimate Guitar, E-Chords) and renders a clean, distraction-free chord sheet with transpose, multi-column layout, auto-scroll, and chord diagrams.

## The Problem

Chord sites are cluttered with ads, paywalls, popups, and poor reading UX. When you're playing guitar with both hands occupied, you need:

- No scrolling (multi-column layout that fits the screen)
- No distractions (just chords and lyrics)
- Quick transpose (capo changes, vocal range)
- Auto-scroll (hands-free while playing)

Extensions like "Chords View" exist but require manual activation, lack guitar chord diagrams, and don't parse structured chord data from the page.

## Supported Sites

### Ultimate Guitar (`tabs.ultimate-guitar.com`)

**DOM structure:** Chords are rendered as `<span data-name="Am" class="eSJpP ...">Am</span>` inside a `<pre>` element within a `<section>` tag. Section headers like `[Intro]`, `[Verse 1]`, `[Chorus]` are plain text. Metadata (key, capo, tuning) is in the surrounding UI elements.

**URL pattern:** `*://tabs.ultimate-guitar.com/tab/*/chords-*`

### E-Chords (`www.e-chords.com`)

**DOM structure:** Chords are rendered as `<span data-chord="F">F</span>` inside `<pre class="pre-columns">` elements. Section headers use `<strong>` tags.

**URL pattern:** `*://www.e-chords.com/chords/*/*`

## Features (v0.1 — MVP)

### Auto-Activate
- Content script matches chord page URLs
- Automatically extracts chord data from DOM
- Shows floating action button to open reader view
- One click opens full-screen clean reader

### Clean Reader View
- Full-screen overlay (or new tab) with just chords + lyrics
- Song title and artist at top
- Monospace font, clear chord/lyric alignment
- Section headers styled distinctly (`[Verse]`, `[Chorus]`, etc.)

### Multi-Column Layout
- 1, 2, or 3 column options
- Content flows across columns (CSS `column-count`)
- Fits more of the song on screen without scrolling

### Transpose
- +1 / -1 semitone buttons
- Displays current transposition offset
- Sharps/flats toggle (C# vs Db)
- All chord names update instantly

### Font Size
- Increase / decrease buttons
- Persisted in localStorage

### Dark Mode
- Light / dark toggle
- Respects system preference by default
- Persisted in localStorage

### Auto-Scroll
- Play/pause button
- Adjustable speed
- Smooth CSS animation scroll

### Chord Diagrams (Stretch for v0.1)
- Guitar chord diagram SVGs for each unique chord
- Shown in a collapsible header bar or on hover

## Architecture

```
lead-sheet-chord-reader/
├── manifest.json          # Manifest V3
├── src/
│   ├── content/
│   │   ├── main.ts        # Content script entry — detects site, extracts, injects FAB
│   │   ├── parsers/
│   │   │   ├── types.ts   # Shared ParsedSong type
│   │   │   ├── ug.ts      # Ultimate Guitar parser
│   │   │   └── echords.ts # E-Chords parser
│   │   └── inject.ts      # Injects the reader overlay into page
│   ├── reader/
│   │   ├── reader.html    # Reader view page
│   │   ├── reader.ts      # Reader logic (transpose, columns, scroll, etc.)
│   │   └── reader.css     # Reader styles
│   └── shared/
│       └── transpose.ts   # Chord transposition logic
├── icons/                 # Extension icons
├── build/                 # Build output (gitignored)
├── package.json
├── tsconfig.json
└── vite.config.ts         # Build config (Vite + CRXJS or manual)
```

## Data Model

```typescript
interface ParsedSong {
  title: string;
  artist: string;
  source: 'ultimate-guitar' | 'e-chords';
  sourceUrl: string;
  key?: string;
  capo?: number;
  tuning?: string;
  sections: Section[];
}

interface Section {
  label?: string;           // "Intro", "Verse 1", "Chorus", etc.
  lines: ChordLine[];
}

interface ChordLine {
  chords: ChordPosition[];  // Chords with their character positions
  lyrics: string;           // The lyric text for this line
}

interface ChordPosition {
  chord: string;            // "Am7", "D/F#", "C"
  position: number;         // Character offset in the lyrics line
}
```

## Tech Stack

- **Language:** TypeScript
- **Build:** Vite (fast, good Chrome extension support)
- **Styling:** Plain CSS (no framework needed for extension)
- **Chrome APIs:** Manifest V3, content_scripts, storage

## Non-Goals (for now)

- Scraping / fetching chord data from servers (extension only reads pages you visit)
- Audio analysis / chord detection (that's ChordKit)
- Mobile support (Chrome extensions are desktop-only)
- Firefox / Safari ports (later)
- Offline chord database
- User accounts / cloud sync
