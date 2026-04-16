import { ParsedSong, SongLine, ChordPosition, SiteParser } from './types';
import { enrichFromLines } from './enrich';

/**
 * E-Chords parser.
 *
 * Chords are <span data-chord="F">F</span> inside a <pre>. Some songs wrap
 * them in <pre class="pre-columns-N">; others use a plain <pre>.
 * Section headers live in <strong> tags.
 */
export const eChordsParser: SiteParser = {
  id: 'e-chords',
  label: 'E-Chords',
  hostnames: ['e-chords.com'],
  matchesUrl(url) {
    // Chord pages look like /chords/artist/song
    return /^\/chords\/.+\/.+/i.test(url.pathname);
  },
  hasChordContent() {
    return document.querySelector('span[data-chord]') !== null;
  },
  parse: parseEChords,
};

function parseEChords(): ParsedSong | null {
  // Some songs use <pre class="pre-columns-N">, others use a bare <pre>.
  // Select any <pre> that actually contains chord spans — that's the
  // reliable signal regardless of class name.
  const chordPres = Array.from(document.querySelectorAll('pre')).filter((p) =>
    p.querySelector('span[data-chord]')
  );
  if (chordPres.length === 0) return null;

  const title = extractTitle();
  const artist = extractArtist();

  const lines: SongLine[] = [];

  for (const preEl of chordPres) {
    const parsed = parsePreElement(preEl);
    lines.push(...parsed);
  }

  return enrichFromLines({
    title,
    artist,
    source: eChordsParser.id,
    sourceUrl: window.location.href,
    key: extractKey(),
    lines,
  });
}

function extractKey(): string | undefined {
  // E-Chords renders the key inside a "key-changer" button:
  //   <button class="btn btn-icon key-changer">Key: <span class="key">G</span>...</button>
  const keyEl = document.querySelector('.key-changer .key');
  const key = keyEl?.textContent?.trim();
  return key || undefined;
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
