import { ParsedSong, SongLine, ChordPosition, SiteParser } from './types';
import { enrichFromLines } from './enrich';

/**
 * Cifra Club parser (cifraclub.com and cifraclub.com.br).
 *
 * Cifra Club renders chords as <b>G</b> inside a <pre> within
 * <div id="cifra">. Section headers like [Intro] are plain-text lines.
 * Tablature blocks are wrapped in <span class="tablatura"> / <span class="cnt">
 * but their content is inline monospace text — we keep it as-is.
 *
 * Metadata is carried by stable-ID spans (#cifra_tom, #cifra_afi, #cifra_capo)
 * so extraction is language-independent (the site ships PT / ES / EN labels).
 */
export const cifraClubParser: SiteParser = {
  id: 'cifraclub',
  label: 'Cifra Club',
  hostnames: ['cifraclub.com'],
  matchesUrl(url) {
    // Chord pages sit at /artist/song/ — two path segments, nothing else.
    // (Landing pages, /videos/, /blog/, etc. differ in shape or in content.)
    return /^\/[^/]+\/[^/]+\/?$/.test(url.pathname);
  },
  hasChordContent() {
    return document.querySelector('#cifra pre b') !== null;
  },
  parse: parseCifraClub,
};

function parseCifraClub(): ParsedSong | null {
  const preEl = document.querySelector('#cifra pre');
  if (!preEl) return null;
  if (!preEl.querySelector('b')) return null;

  const title = extractTitle();
  const artist = extractArtist();
  const { key, capo, tuning } = extractMetadata();

  const lines = parseContent(preEl);

  return enrichFromLines({
    title,
    artist,
    source: cifraClubParser.id,
    sourceUrl: window.location.href,
    key,
    capo,
    tuning,
    lines,
  });
}

function extractTitle(): string {
  // Prefer the song-title h1 (`.t1`); the page also has a site-logo h1, so
  // querying bare `h1` would pick the wrong one.
  const h1 = document.querySelector('h1.t1');
  if (h1) return h1.textContent?.trim() || 'Unknown';
  const pageTitle = document.title;
  const match = pageTitle.match(/^(.+?)\s*-\s*Cifra/i);
  return match ? match[1].trim() : 'Unknown';
}

function extractArtist(): string {
  const h2 = document.querySelector('h2.t3');
  if (h2) {
    const link = h2.querySelector('a');
    return (link || h2).textContent?.trim() || 'Unknown';
  }
  return 'Unknown';
}

function extractMetadata(): { key?: string; capo?: number; tuning?: string } {
  const result: { key?: string; capo?: number; tuning?: string } = {};

  // Key: <span id="cifra_tom">…<a>F</a>…</span>
  const tomEl = document.querySelector('#cifra_tom a');
  const key = tomEl?.textContent?.trim();
  if (key) result.key = key;

  // Tuning: <span id="cifra_afi">…<a>D G C F A D</a></span>
  const afiEl = document.querySelector('#cifra_afi a');
  const tuning = afiEl?.textContent?.trim();
  if (tuning) result.tuning = tuning;

  // Capo: <span id="cifra_capo">Capo: 3ª casa</span> (text varies by locale)
  const capoEl = document.querySelector('#cifra_capo');
  if (capoEl) {
    const text = capoEl.textContent?.trim() || '';
    const match = text.match(/(\d+)/);
    if (match) result.capo = parseInt(match[1], 10);
  }

  return result;
}

function parseContent(preEl: Element): SongLine[] {
  // Strip non-chord auxiliary elements. Cifra Club injects ads/widgets and
  // wraps tablature in <span class="tablatura">/<span class="cnt"> — the
  // latter carry useful inline text, so we *keep* spans (stripHtml flattens
  // them) and only remove non-chord block elements that would add phantom
  // lines. <b> is the chord marker; <span> is preserved for its text.
  const clone = preEl.cloneNode(true) as Element;
  for (const el of Array.from(clone.querySelectorAll('*'))) {
    const tag = el.tagName;
    if (tag !== 'B' && tag !== 'SPAN' && tag !== 'I' && tag !== 'EM') {
      // Unwrap: replace element with its children so we don't lose
      // content inside wrapper <div>s that Cifra Club now injects.
      el.replaceWith(...el.childNodes);
    }
  }

  const rawText = clone.innerHTML;
  const htmlLines = rawText.split('\n');

  const lines: SongLine[] = [];
  for (const htmlLine of htmlLines) {
    // Leading whitespace positions chord letters above lyric chars in a
    // monospace <pre>, so every space matters — never trim the HTML line.
    const plainText = stripHtml(htmlLine);

    if (plainText.trim() === '') {
      lines.push({ type: 'empty' });
      continue;
    }

    // Section header: bare [Intro], [Verse 1], [Tab - Intro] with no chord on the line.
    const sectionMatch = plainText.trim().match(/^\[(.+)\]$/);
    if (sectionMatch && !/<b>/i.test(htmlLine)) {
      lines.push({ type: 'section-header', label: sectionMatch[1] });
      continue;
    }

    if (/<b>/i.test(htmlLine)) {
      lines.push({
        type: 'chord-line',
        chords: extractChordPositions(htmlLine),
        lyrics: plainText,
      });
    } else {
      lines.push({ type: 'chord-line', chords: [], lyrics: plainText });
    }
  }

  return lines;
}

/**
 * Extract chord positions from an HTML line containing <b>…</b> chord markers.
 * Position is the chord's character offset in the line's plain text.
 */
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
      if (el.tagName === 'B') {
        const chordName = (el.textContent || '').trim();
        if (chordName) {
          chords.push({ chord: chordName, position: textPos });
        }
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
