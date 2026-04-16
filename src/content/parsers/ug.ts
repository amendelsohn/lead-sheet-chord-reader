import { ParsedSong, SongLine, ChordPosition, SiteParser } from './types';
import { enrichFromLines } from './enrich';

/**
 * Ultimate Guitar parser.
 *
 * UG renders chords as chord spans inside a <pre>. Section headers like [Intro]
 * are plain-text lines. Two DOM variants exist in the wild:
 *   - Desktop: <span data-name="Am7" class="eSJpP ...">Am7</span>
 *   - Mobile:  <span class="tabContent-chord js-chord-chord" data-original-chord="Am7">Am7</span>
 * Both are handled via the combined selector below.
 */
const CHORD_SELECTOR = 'span[data-name], span[data-original-chord]';

export const ultimateGuitarParser: SiteParser = {
  id: 'ultimate-guitar',
  label: 'Ultimate Guitar',
  hostnames: ['ultimate-guitar.com'],
  matchesUrl(url) {
    // Chord pages look like /tab/artist/song-chords-12345
    return /\/tab\/.+chords/i.test(url.pathname);
  },
  hasChordContent() {
    return document.querySelector(CHORD_SELECTOR) !== null;
  },
  parse: parseUltimateGuitar,
};

function getChordName(el: Element): string | null {
  return el.getAttribute('data-name') || el.getAttribute('data-original-chord');
}

function parseUltimateGuitar(): ParsedSong | null {
  // Find the chord content container — look for a pre that contains chord spans
  const preEls = document.querySelectorAll('pre');
  let preEl: Element | null = null;
  for (const candidate of preEls) {
    if (candidate.querySelector(CHORD_SELECTOR)) {
      preEl = candidate;
      break;
    }
  }
  if (!preEl) return null;

  // Check for chord spans to confirm this is a chord page
  const chordSpans = preEl.querySelectorAll(CHORD_SELECTOR);
  if (chordSpans.length === 0) return null;

  // Extract title and artist
  const title = extractTitle();
  const artist = extractArtist();
  const { key, capo, tuning } = extractMetadata();

  // Parse the content line by line
  const lines = parseContent(preEl);

  return enrichFromLines({
    title,
    artist,
    source: ultimateGuitarParser.id,
    sourceUrl: window.location.href,
    key,
    capo,
    tuning,
    lines,
  });
}

function extractTitle(): string {
  const h1 = document.querySelector('h1');
  if (h1) {
    // UG titles end with " Chords" — strip it
    return h1.textContent?.replace(/\s*Chords\s*$/i, '').trim() || 'Unknown';
  }
  return document.title.replace(/\s*CHORDS.*$/i, '').trim() || 'Unknown';
}

function extractArtist(): string {
  // Artist link is near the h1
  const h1 = document.querySelector('h1');
  if (h1) {
    const container = h1.closest('span');
    if (container) {
      const artistLink = container.querySelector('a[href*="/artist/"]');
      if (artistLink) return artistLink.textContent?.trim() || 'Unknown';
    }
  }
  // Fallback: look for any artist link on the page
  const artistLink = document.querySelector('a[href*="/artist/"]');
  return artistLink?.textContent?.trim() || 'Unknown';
}

function extractMetadata(): { key?: string; capo?: number; tuning?: string } {
  const result: { key?: string; capo?: number; tuning?: string } = {};

  // UG labels key/capo/tuning with plain "<span>Key:</span><span>…</span>"
  // pairs. We don't have a reliable container selector, but we can short-
  // circuit once all three fields are populated so we stop early on long pages.
  const allSpans = document.querySelectorAll('span');
  for (const span of allSpans) {
    if (result.key && result.capo !== undefined && result.tuning) break;
    const text = span.textContent?.trim() || '';
    if (!result.key && text === 'Key:') {
      result.key = span.nextElementSibling?.textContent?.trim() || undefined;
    } else if (result.capo === undefined && text === 'Capo:') {
      const capoText = span.nextElementSibling?.textContent?.trim() || '';
      const match = capoText.match(/(\d+)/);
      if (match) result.capo = parseInt(match[1], 10);
    } else if (!result.tuning && text === 'Tuning:') {
      result.tuning = span.nextElementSibling?.textContent?.trim() || undefined;
    }
  }

  return result;
}

function parseContent(preEl: Element): SongLine[] {
  const lines: SongLine[] = [];

  // UG occasionally injects UI noise inside the <pre> (tracking pixels,
  // widget buttons, etc.) — e.g. <div class="d8c-l">X</div> at the end.
  // Strip any non-<span> descendants before parsing so their text doesn't
  // show up as phantom lyric lines. Chord content is only <span>s + text.
  const clone = preEl.cloneNode(true) as Element;
  for (const el of Array.from(clone.querySelectorAll('*'))) {
    if (el.tagName !== 'SPAN') el.remove();
  }

  const rawText = clone.innerHTML;
  const htmlLines = rawText.split('\n');

  for (const htmlLine of htmlLines) {
    // IMPORTANT: do NOT trim the HTML line — leading whitespace positions
    // chord letters above the correct lyric chars on the next line. UG's
    // chord sheet format relies on monospace alignment within a <pre>, so
    // every space character matters.
    const plainText = stripHtml(htmlLine);

    if (plainText.trim() === '') {
      lines.push({ type: 'empty' });
      continue;
    }

    // Check for section header: [Intro], [Verse 1], etc.
    const sectionMatch = plainText.trim().match(/^\[(.+)\]$/);
    if (sectionMatch) {
      lines.push({ type: 'section-header', label: sectionMatch[1] });
      continue;
    }

    if (/data-(name|original-chord)="[^"]+"/.test(htmlLine)) {
      lines.push({
        type: 'chord-line',
        chords: extractChordPositions(htmlLine),
        lyrics: plainText,
      });
    } else {
      // Pure text line — preserve exact whitespace
      lines.push({
        type: 'chord-line',
        chords: [],
        lyrics: plainText,
      });
    }
  }

  return lines;
}

/**
 * Extract chord positions from an HTML line containing <span data-name="..."> elements.
 * Position is calculated based on where the chord appears in the stripped text.
 */
function extractChordPositions(htmlLine: string): ChordPosition[] {
  const chords: ChordPosition[] = [];

  // Replace chord spans with a marker, tracking positions
  let position = 0;
  let remaining = htmlLine;

  // Process character by character in the stripped version
  // Strategy: walk through HTML, track text position, capture chord positions
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlLine;

  let textPos = 0;
  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      textPos += (node.textContent || '').length;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const chordName = getChordName(el);
      if (chordName) {
        let fullChord = chordName;
        // If the next sibling text starts with '*', treat it as an alt-fingering marker
        // that belongs to this chord (common convention, e.g., "F*" for alternate F voicing)
        const nextSib = el.nextSibling;
        if (nextSib && nextSib.nodeType === Node.TEXT_NODE && (nextSib.textContent || '').startsWith('*')) {
          fullChord += '*';
        }
        chords.push({ chord: fullChord, position: textPos });
        textPos += (el.textContent || '').length;
      } else {
        for (const child of el.childNodes) {
          walk(child);
        }
      }
    }
  }

  for (const child of tempDiv.childNodes) {
    walk(child);
  }

  return chords;
}

function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || '';
}
