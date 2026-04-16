import { ParsedSong, SongLine, ChordPosition, SiteParser } from './types';
import { enrichFromLines } from './enrich';

/**
 * Chordie parser.
 *
 * Chordie hosts chord sheets that were originally scraped from other sites
 * (AZChords, GuitarTabs.cc, etc.) and re-wrapped in its own markup. Each
 * lyric line is its own <div class="chordline"> (or <div class="textline">
 * for non-chord lines). Chords are inline with decorative brackets:
 *
 *   <div class="chordline">
 *     <span class="bracket">[</span>
 *     <span class="relc"><span class="absc G">G</span></span>
 *     <span class="bracket">]</span>
 *     i grew this heart into a drifter
 *     …
 *   </div>
 *
 * Position within the lyric is recoverable by walking the DOM and counting
 * text-node characters (bracket/chord spans contribute zero to the lyric).
 * The site itself uses a proportional font, but our reader re-renders in
 * its own monospace Shadow DOM, so alignment works off the extracted offsets.
 */
export const chordieParser: SiteParser = {
  id: 'chordie',
  label: 'Chordie',
  hostnames: ['chordie.com'],
  matchesUrl(url) {
    // Chord pages are served under /chord.pere/<source-url…>
    return url.pathname.startsWith('/chord.pere/');
  },
  hasChordContent() {
    return (
      document.querySelector('#song .chordline .absc') !== null ||
      document.querySelector('#song .chordline') !== null
    );
  },
  parse: parseChordie,
};

/** Labels we treat as section headers when they appear alone on a textline. */
const SECTION_LABEL_RE =
  /^(intro|verse(?:\s*\d+)?|chorus|pre-?chorus|bridge|outro|solo|interlude|refrain|tag|coda|ending|hook)$/i;

function parseChordie(): ParsedSong | null {
  const container = document.querySelector('#song');
  if (!container) return null;

  const lineEls = container.querySelectorAll('.chordline, .textline');
  if (lineEls.length === 0) return null;

  const title = extractTitle();
  const artist = extractArtist();

  const lines: SongLine[] = [];
  for (const el of lineEls) {
    lines.push(...parseLineElement(el));
  }

  // Drop the Chordie attribution banner that gets injected mid-song on every
  // page, e.g., "( Tab from: http://... )". It's not part of the song.
  const filtered = stripAttribution(lines);

  return enrichFromLines({
    title,
    artist,
    source: chordieParser.id,
    sourceUrl: window.location.href,
    lines: filtered,
  });
}

function extractTitle(): string {
  // <h1 class="titleLeft">Amazing Grace  <a><span>Jars of Clay</span></a></h1>
  const h1 = document.querySelector('h1.titleLeft');
  if (h1) {
    // Title is the leading text before the artist anchor.
    const firstNode = h1.firstChild;
    if (firstNode && firstNode.nodeType === Node.TEXT_NODE) {
      const txt = (firstNode.textContent || '').trim();
      if (txt) return txt;
    }
    // Fallback: strip the artist link's text from the h1 text content.
    const full = (h1.textContent || '').trim();
    const artistText = h1.querySelector('a')?.textContent?.trim() || '';
    if (artistText && full.endsWith(artistText)) {
      return full.slice(0, full.length - artistText.length).trim();
    }
    return full || 'Unknown';
  }
  return document.title.split(/\s+Chords/i)[0].trim() || 'Unknown';
}

function extractArtist(): string {
  const link = document.querySelector('h1.titleLeft a span, h1.titleLeft a');
  const txt = link?.textContent?.trim();
  if (txt) return txt;
  return 'Unknown';
}

function parseLineElement(el: Element): SongLine[] {
  const hasChords = el.querySelector('.absc') !== null;

  if (!hasChords) {
    const text = (el.textContent || '').replace(/\u00A0/g, ' ');
    if (text.trim() === '') return [{ type: 'empty' }];

    // Treat short standalone labels as section headers.
    const trimmed = text.trim();
    if (SECTION_LABEL_RE.test(trimmed)) {
      return [{ type: 'section-header', label: trimmed }];
    }

    return [{ type: 'chord-line', chords: [], lyrics: text }];
  }

  // Walk the DOM to extract chords + lyric, treating .bracket and .absc
  // nodes as zero-width in the lyric.
  const { lyric, chords } = walkChordLine(el);

  // Chordie embeds chords as insert-points inside the lyric — the chord
  // doesn't "occupy" any lyric character. Emit as two separate lines (chord-
  // only, then lyric-only) so the reader's chord-over-lyric path lays the
  // chord names *above* the lyric instead of routing to inline-replace mode,
  // which would otherwise clobber the letter at each chord position.
  const out: SongLine[] = [];
  if (chords.length > 0) {
    out.push({ type: 'chord-line', chords, lyrics: '' });
  }
  if (lyric.trim() !== '') {
    out.push({ type: 'chord-line', chords: [], lyrics: lyric });
  } else if (chords.length === 0) {
    out.push({ type: 'empty' });
  }
  return out;
}

function walkChordLine(root: Element): {
  lyric: string;
  chords: ChordPosition[];
} {
  const chords: ChordPosition[] = [];
  let lyric = '';

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      lyric += (node.textContent || '').replace(/\u00A0/g, ' ');
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;

    // Decorative brackets: skip entirely.
    if (el.classList.contains('bracket')) return;

    // Chord marker: record at current lyric position, don't contribute text.
    if (el.classList.contains('absc')) {
      const name = (el.textContent || '').trim();
      if (name) chords.push({ chord: name, position: lyric.length });
      return;
    }

    // Non-chord wrapper (.relc, .inlc, etc.) — recurse into children.
    for (const child of Array.from(el.childNodes)) {
      walk(child);
    }
  }

  for (const child of Array.from(root.childNodes)) {
    walk(child);
  }

  return { lyric, chords };
}

/**
 * Chordie injects a "( Tab from: <URL> )" attribution line into the middle
 * of every song. It's not part of the song content — drop it so the reader
 * doesn't show it as a lyric.
 */
function stripAttribution(lines: SongLine[]): SongLine[] {
  return lines.filter((line) => {
    if (line.type !== 'chord-line') return true;
    if (line.chords.length > 0) return true;
    return !/^\s*\(\s*Tab from:/i.test(line.lyrics);
  });
}
