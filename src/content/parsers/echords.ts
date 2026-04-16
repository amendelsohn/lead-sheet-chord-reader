import { ParsedSong, SongLine, ChordPosition } from './types';

/**
 * Parse E-Chords chord page from the rendered DOM.
 *
 * E-Chords renders chords as:
 *   <span data-chord="F">F</span>
 * inside <pre class="pre-columns"> elements.
 *
 * Section headers use <strong> tags: <strong>[Intro]</strong>
 */
export function parseEChords(): ParsedSong | null {
  // Find chord content containers
  const preEls = document.querySelectorAll('pre.pre-columns');
  if (preEls.length === 0) return null;

  // Check for chord spans
  const chordSpans = document.querySelectorAll('pre.pre-columns span[data-chord]');
  if (chordSpans.length === 0) return null;

  const title = extractTitle();
  const artist = extractArtist();

  const lines: SongLine[] = [];

  for (const preEl of preEls) {
    const parsed = parsePreElement(preEl);
    lines.push(...parsed);
  }

  return {
    title,
    artist,
    source: 'e-chords',
    sourceUrl: window.location.href,
    lines,
  };
}

function extractTitle(): string {
  // E-Chords title format: "Yesterday Chords - The Beatles | E-CHORDS"
  const titleEl = document.querySelector('h1');
  if (titleEl) {
    return titleEl.textContent?.replace(/\s*Chords?\s*$/i, '').trim() || 'Unknown';
  }
  const pageTitle = document.title;
  const match = pageTitle.match(/^(.+?)\s+Chords?\s*-/i);
  return match ? match[1].trim() : 'Unknown';
}

function extractArtist(): string {
  // Try h1 sibling or page title
  const pageTitle = document.title;
  const match = pageTitle.match(/Chords?\s*-\s*(.+?)(?:\s*\|\s*E-CHORDS)?$/i);
  if (match) return match[1].trim();

  // Try meta tags
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) {
    const content = ogTitle.getAttribute('content') || '';
    const artistMatch = content.match(/Chords?\s*-\s*(.+)/i);
    if (artistMatch) return artistMatch[1].trim();
  }

  return 'Unknown';
}

function parsePreElement(preEl: Element): SongLine[] {
  const lines: SongLine[] = [];
  const htmlLines = preEl.innerHTML.split('\n');

  for (const htmlLine of htmlLines) {
    // Preserve leading whitespace — chord/lyric alignment depends on it.
    const plainText = stripHtml(htmlLine);

    if (plainText.trim() === '') {
      lines.push({ type: 'empty' });
      continue;
    }

    // Check for section header in <strong> tags
    const strongMatch = htmlLine.match(/<strong>\s*\[(.+?)\]\s*<\/strong>/i);
    const sectionMatch = plainText.trim().match(/^\[(.+)\]$/);

    if (strongMatch) {
      lines.push({ type: 'section-header', label: strongMatch[1] });
      // If there are also chords on this line after the header, parse those too
      const afterHeader = htmlLine.replace(/<strong>.*?<\/strong>/i, '');
      if (afterHeader.includes('data-chord')) {
        const chords = extractChordPositions(afterHeader);
        const lyrics = stripHtml(afterHeader);
        if (chords.length > 0 || lyrics.trim()) {
          lines.push({ type: 'chord-line', chords, lyrics });
        }
      }
      continue;
    }
    if (sectionMatch && !htmlLine.includes('data-chord')) {
      lines.push({ type: 'section-header', label: sectionMatch[1] });
      continue;
    }

    // Chord or lyric line — preserve exact whitespace
    if (htmlLine.includes('data-chord')) {
      const chords = extractChordPositions(htmlLine);
      lines.push({ type: 'chord-line', chords, lyrics: plainText });
    } else {
      lines.push({ type: 'chord-line', chords: [], lyrics: plainText });
    }
  }

  return lines;
}

function extractChordPositions(htmlLine: string): ChordPosition[] {
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
        let fullChord = chordName;
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
