import { ParsedSong, SongLine, ChordPosition } from './types';

/**
 * Parse Ultimate Guitar chord page from the rendered DOM.
 *
 * UG renders chords as:
 *   <span data-name="Am7" class="eSJpP ...">Am7</span>
 * inside a <pre> within a <section> or <code> element.
 *
 * Lines alternate between chord lines (containing spans) and lyric lines (plain text).
 * Section headers like [Intro], [Verse 1] are plain text lines wrapped in brackets.
 */
export function parseUltimateGuitar(): ParsedSong | null {
  // Find the chord content container
  const preEl = document.querySelector('pre[class]');
  if (!preEl) return null;

  // Check for chord spans to confirm this is a chord page
  const chordSpans = preEl.querySelectorAll('span[data-name]');
  if (chordSpans.length === 0) return null;

  // Extract title and artist
  const title = extractTitle();
  const artist = extractArtist();
  const { key, capo, tuning } = extractMetadata();

  // Parse the content line by line
  const lines = parseContent(preEl);

  return {
    title,
    artist,
    source: 'ultimate-guitar',
    sourceUrl: window.location.href,
    key,
    capo,
    tuning,
    lines,
  };
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

  // Look for metadata spans near the chord content
  const allSpans = document.querySelectorAll('span');
  for (const span of allSpans) {
    const text = span.textContent?.trim() || '';
    if (text === 'Key:') {
      const next = span.nextElementSibling;
      if (next) result.key = next.textContent?.trim();
    }
    if (text === 'Capo:') {
      const next = span.nextElementSibling;
      if (next) {
        const capoText = next.textContent?.trim() || '';
        const match = capoText.match(/(\d+)/);
        if (match) result.capo = parseInt(match[1], 10);
      }
    }
    if (text === 'Tuning:') {
      const next = span.nextElementSibling;
      if (next) result.tuning = next.textContent?.trim();
    }
  }

  return result;
}

function parseContent(preEl: Element): SongLine[] {
  const lines: SongLine[] = [];

  // Walk through the pre element's content
  // UG structures content as text nodes and span elements within the pre
  // We need to process it line by line based on newlines

  const rawText = preEl.innerHTML;
  const htmlLines = rawText.split('\n');

  for (const htmlLine of htmlLines) {
    const trimmed = htmlLine.trim();

    if (trimmed === '') {
      lines.push({ type: 'empty' });
      continue;
    }

    // Check for section header: [Intro], [Verse 1], etc.
    const plainText = stripHtml(trimmed);
    const sectionMatch = plainText.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      lines.push({ type: 'section-header', label: sectionMatch[1] });
      continue;
    }

    // Check if line contains chord spans
    const chordMatches = [...trimmed.matchAll(/data-name="([^"]+)"/g)];
    if (chordMatches.length > 0) {
      // This is a chord line — extract chord positions
      // We need to figure out where each chord sits relative to the text
      const chords = extractChordPositions(trimmed);
      const lyrics = stripHtml(trimmed);

      lines.push({
        type: 'chord-line',
        chords,
        lyrics,
      });
    } else {
      // Check for e-chords style data-chord spans
      const eChordMatches = [...trimmed.matchAll(/data-chord="([^"]+)"/g)];
      if (eChordMatches.length > 0) {
        const chords = extractChordPositionsEChords(trimmed);
        const lyrics = stripHtml(trimmed);
        lines.push({ type: 'chord-line', chords, lyrics });
      } else {
        // Pure lyric line or other text — treat as lyrics with no chords
        lines.push({
          type: 'chord-line',
          chords: [],
          lyrics: plainText,
        });
      }
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
      const chordName = el.getAttribute('data-name');
      if (chordName) {
        chords.push({ chord: chordName, position: textPos });
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

function extractChordPositionsEChords(htmlLine: string): ChordPosition[] {
  const chords: ChordPosition[] = [];
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlLine;

  let textPos = 0;
  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      textPos += (node.textContent || '').length;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const chordName = el.getAttribute('data-chord');
      if (chordName) {
        chords.push({ chord: chordName, position: textPos });
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
