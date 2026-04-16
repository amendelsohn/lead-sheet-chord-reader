import { ParsedSong, SongLine, ChordPosition, SiteParser } from './types';
import { enrichFromLines } from './enrich';

/**
 * UkuTabs parser.
 *
 * Content lives in <pre id="ukutabs-song">. Chord markers are
 * <a class="ukutabschord" href="...">F</a> at exact character offsets.
 * Section labels are <strong>…</strong>: (no [brackets]), often nested
 * — e.g. <strong><strong>Verse</strong> 1</strong>:
 *
 * Default ukulele tuning is GCEA; we don't surface it as a metadata field
 * because the site doesn't either. Transpose still works on the chord names.
 */
export const ukuTabsParser: SiteParser = {
  id: 'ukutabs',
  label: 'UkuTabs',
  hostnames: ['ukutabs.com'],
  matchesUrl(url) {
    // Song pages have two path segments under a single-letter prefix.
    // Seen in the wild: /t/<artist>/<song>/ (primary) and /b/<artist>/<song>/
    // (alternate versions). hasChordContent() filters non-song pages.
    return /^\/[a-z]\/[^/]+\/[^/]+\/?$/i.test(url.pathname);
  },
  hasChordContent() {
    return document.querySelector('pre#ukutabs-song .ukutabschord') !== null;
  },
  parse: parseUkuTabs,
};

function parseUkuTabs(): ParsedSong | null {
  const preEl = document.querySelector('pre#ukutabs-song');
  if (!preEl) return null;
  if (!preEl.querySelector('.ukutabschord')) return null;

  const title = extractTitle();
  const artist = extractArtist();

  const lines = parseContent(preEl);

  return enrichFromLines({
    title,
    artist,
    source: ukuTabsParser.id,
    sourceUrl: window.location.href,
    lines,
  });
}

function extractTitle(): string {
  const h1 = document.querySelector('h1.liedjestitel, h1.stunning-header-title');
  if (h1) return h1.textContent?.trim() || 'Unknown';
  return document.title.split(/[|–-]/)[0].trim() || 'Unknown';
}

function extractArtist(): string {
  // Artist is the last breadcrumb item before the song title.
  // Structure:
  //   <ul class="breadcrumbs">
  //     <li>…Home…</li> <li>…T…</li> <li>…<span itemprop="name">The Beatles</span>…</li>
  //   </ul>
  const items = document.querySelectorAll('.breadcrumbs .breadcrumbs-item');
  if (items.length >= 2) {
    const artistItem = items[items.length - 1];
    const name = artistItem.querySelector('[itemprop="name"]');
    const txt = (name || artistItem).textContent?.trim();
    if (txt) return txt;
  }
  return 'Unknown';
}

function parseContent(preEl: Element): SongLine[] {
  // Strip non-chord auxiliary elements (ads, diagram popovers, etc.).
  // Keep <a> (chord marker) and <strong> (section label) only — plus
  // <span> as a conservative catch-all for inline wrappers we may not
  // have seen yet. Anything else becomes phantom lines when split on \n.
  const clone = preEl.cloneNode(true) as Element;
  for (const el of Array.from(clone.querySelectorAll('*'))) {
    const tag = el.tagName;
    if (tag !== 'A' && tag !== 'STRONG' && tag !== 'SPAN' && tag !== 'B') {
      el.remove();
    }
  }

  const rawText = clone.innerHTML;
  const htmlLines = rawText.split('\n');

  const lines: SongLine[] = [];
  for (const htmlLine of htmlLines) {
    const plainText = stripHtml(htmlLine);

    if (plainText.trim() === '') {
      lines.push({ type: 'empty' });
      continue;
    }

    // Section header pattern: "<strong>…</strong>:" — possibly with nested
    // <strong> tags (UkuTabs uses <strong><strong>Verse</strong> 1</strong>:).
    // Strip all <strong> tags and look for "LABEL:" at line start, with
    // nothing but the label + optional trailing chord markers on the line.
    const sectionLabel = matchSectionHeader(htmlLine);
    if (sectionLabel) {
      lines.push({ type: 'section-header', label: sectionLabel.label });
      // If the line also has chord markers after the header (e.g.,
      // "<strong>Intro</strong>: <a>F</a>"), emit the trailing chord line too.
      if (sectionLabel.rest.includes('ukutabschord')) {
        const chords = extractChordPositions(sectionLabel.rest);
        const lyrics = stripHtml(sectionLabel.rest);
        if (chords.length > 0 || lyrics.trim()) {
          lines.push({ type: 'chord-line', chords, lyrics });
        }
      }
      continue;
    }

    if (htmlLine.includes('ukutabschord')) {
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
 * If the line is a section header line (a <strong>…</strong>: with only
 * whitespace or trailing chord links after the colon), return the label
 * and the rest of the line. Otherwise return null.
 *
 * Nested <strong> is tolerated: "<strong><strong>Verse</strong> 1</strong>:"
 * becomes "Verse 1".
 */
function matchSectionHeader(htmlLine: string): { label: string; rest: string } | null {
  // Line must start (after leading whitespace) with <strong>.
  const trimmed = htmlLine.trimStart();
  if (!/^<strong\b/i.test(trimmed)) return null;

  // Strip all <strong> open/close tags to get just the text label and
  // whatever follows the colon.
  const withoutStrong = htmlLine.replace(/<\/?strong[^>]*>/gi, '');
  // Expect "LABEL:  <rest>" — label is plain text, followed by a colon.
  const m = withoutStrong.match(/^\s*([^:<]+?)\s*:\s*(.*)$/);
  if (!m) return null;
  const label = m[1].trim();
  if (!label) return null;
  return { label, rest: m[2] };
}

/**
 * Extract chord positions from an HTML line containing
 * <a class="ukutabschord">…</a> markers.
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
      if (el.classList && el.classList.contains('ukutabschord')) {
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
