import { ParsedSong, SongLine, ChordPosition, SiteParser } from './types';
import { enrichFromLines } from './enrich';
import {
  isChordToken,
  isChordOnlyLine,
  detectChordsInText,
} from '../../shared/chord-detect';

/**
 * AZChords parser.
 *
 * Content lives in <pre id="text-content"> (or legacy <pre id="content">) as
 * plain text. Newer pages may wrap chord names in <span class="ch"> — the
 * parser uses textContent which flattens these to plain text either way.
 * The site hosts submissions in two different formats, often for the same
 * song, so we handle both in a single parser:
 *
 * 1. **Inline paren** (ChordPro-ish):
 *      (F)Yesterday(Em)all my(A7)troubles seemed so(Dm)far away
 *    Each `(ChordName)` becomes a chord marker at the lyric character offset
 *    where it appears. A space is reinserted between word-boundary chord
 *    changes so the stripped lyric still reads as prose (see extractInlineChords).
 *
 * 2. **Chord-over-lyric** (traditional):
 *       G      G/F#            Dm/F          E7
 *      It's a god-awful small affair to the girl
 *    Lines that contain only chord-looking tokens are emitted as chord lines
 *    with positions derived from whitespace offsets (via detectChordsInText).
 *
 * A single song may mix both — we decide per-line.
 */
export const azChordsParser: SiteParser = {
  id: 'azchords',
  label: 'AZChords',
  hostnames: ['azchords.com'],
  matchesUrl(url) {
    // Song pages look like /<letter>/<artist-tabs-N>/<song-tabs-M>.html
    return /^\/[a-z0-9]\/[^/]+\/[^/]+\.html?$/i.test(url.pathname);
  },
  hasChordContent() {
    const pre = document.querySelector('pre#text-content') || document.querySelector('pre#content');
    if (!pre) return false;
    const text = pre.textContent || '';
    // Inline-paren format: "(F)" / "(Am)" / "(C/G)" etc.
    if (/\([A-G][#b]?[^)\s]{0,15}\)/.test(text)) return true;
    // Chord-over-lyric format: at least one line that parses as chord-only.
    // Skip blank and header lines; bail early once we find one.
    for (const line of text.split('\n')) {
      if (isChordOnlyLine(line)) return true;
    }
    return false;
  },
  parse: parseAZChords,
};

function parseAZChords(): ParsedSong | null {
  const preEl = document.querySelector('pre#text-content') || document.querySelector('pre#content');
  if (!preEl) return null;

  const rawText = preEl.textContent || '';
  if (!rawText.trim()) return null;

  const title = extractTitle();
  const artist = extractArtist();

  const lines = parseContent(rawText);

  return enrichFromLines({
    title,
    artist,
    source: azChordsParser.id,
    sourceUrl: window.location.href,
    lines,
  });
}

function extractTitle(): string {
  // og:title is "Yesterday Chords – Beatles | Version #1"
  const og = document
    .querySelector('meta[property="og:title"]')
    ?.getAttribute('content');
  if (og) {
    const m = og.match(/^(.+?)\s+(?:Chords|Tabs|Ukulele|Bass|Drum|Guitar Pro)\s*[–\-]/i);
    if (m) return m[1].trim();
  }
  // Fallback: h2 first text node (layout: "Yesterday <br> Chords<br> ...")
  const h2 = document.querySelector('.h2title h2');
  if (h2) {
    const firstLine = (h2.textContent || '').split('\n')[0]?.trim();
    if (firstLine) return firstLine;
  }
  return 'Unknown';
}

function extractArtist(): string {
  // Artist sits inside the h2 as a link: <a href="/b/beatles-tabs-410.html">Beatles</a>
  const artistLink = document.querySelector('.h2title h2 a[href*="-tabs-"]');
  if (artistLink) return artistLink.textContent?.trim() || 'Unknown';
  // Fallback via og:title: "Song Chords – Artist | Version #N"
  const og = document
    .querySelector('meta[property="og:title"]')
    ?.getAttribute('content');
  if (og) {
    const m = og.match(/[–\-]\s*(.+?)(?:\s*\|.*)?$/);
    if (m) return m[1].trim();
  }
  return 'Unknown';
}

function parseContent(rawText: string): SongLine[] {
  const lines: SongLine[] = [];
  const textLines = rawText.split('\n');

  for (const line of textLines) {
    if (line.trim() === '') {
      lines.push({ type: 'empty' });
      continue;
    }

    // Section header: [Chorus], [Verse 1], etc. Occasionally also bare
    // "CHORUS:" — support both.
    const bracketMatch = line.trim().match(/^\[(.+)\]$/);
    if (bracketMatch) {
      lines.push({ type: 'section-header', label: bracketMatch[1] });
      continue;
    }
    const bareHeader = line.trim().match(/^(CHORUS|VERSE(?:\s*\d+)?|INTRO|OUTRO|BRIDGE|PRE-?CHORUS|SOLO)\s*:?\s*$/i);
    if (bareHeader) {
      lines.push({ type: 'section-header', label: bareHeader[1].toUpperCase() });
      continue;
    }

    // Format #1: inline paren. Cheap check first.
    if (line.includes('(') && /\([A-G][#b]?[^)\s]{0,15}\)/.test(line)) {
      const { lyric, chords } = extractInlineChords(line);
      lines.push({ type: 'chord-line', chords, lyrics: lyric });
      continue;
    }

    // Format #2: chord-over-lyric. A line that parses as chord-only becomes
    // a chord line whose lyric is the raw text (the renderer will align the
    // chord names above the lyric line that follows).
    if (isChordOnlyLine(line)) {
      lines.push({
        type: 'chord-line',
        chords: detectChordsInText(line),
        lyrics: line,
      });
      continue;
    }

    // Plain lyric line — preserve exact whitespace.
    lines.push({ type: 'chord-line', chords: [], lyrics: line });
  }

  return lines;
}

/**
 * Walk the input line, extracting `(Chord)` tokens as chord markers and
 * building the lyric string with those tokens removed. Non-chord parenthesized
 * text (e.g. "(instrumental)", "(Frase final)") is left as literal lyric.
 *
 * AZChords drops the space on either side of an inline chord marker
 * (e.g. "Yesterday(Em)all" instead of "Yesterday (Em) all"). A naïve strip
 * yields unreadable run-together text ("Yesterdayall"). When a chord sits
 * between two letter/digit characters, we re-insert a space so the rendered
 * chord line reads as normal prose. This degrades the less-common mid-word
 * chord change from "yesterday" to "yes terday", which still reads fine and
 * is still a faithful indication of where the chord lands.
 *
 * Position is the character offset of the chord within the lyric text.
 */
function extractInlineChords(line: string): {
  lyric: string;
  chords: ChordPosition[];
} {
  const chords: ChordPosition[] = [];
  let lyric = '';
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '(') {
      // Look for a matching ')' with chord-like content. Chord tokens don't
      // contain spaces or nested parens, so cap the lookahead.
      const close = line.indexOf(')', i + 1);
      if (close > i && close - i <= 15) {
        const inner = line.slice(i + 1, close);
        if (inner && !/\s/.test(inner) && isChordToken(inner)) {
          const prevCh = lyric.length > 0 ? lyric[lyric.length - 1] : '';
          const nextCh = close + 1 < line.length ? line[close + 1] : '';
          if (isWordChar(prevCh) && isWordChar(nextCh)) {
            lyric += ' ';
          }
          chords.push({ chord: inner, position: lyric.length });
          i = close + 1;
          continue;
        }
      }
    }
    lyric += ch;
    i += 1;
  }
  return { lyric, chords };
}

function isWordChar(ch: string): boolean {
  return /[A-Za-z0-9']/.test(ch);
}
