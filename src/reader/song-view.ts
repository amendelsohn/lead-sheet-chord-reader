import { SongLine } from '../content/parsers/types';
import { transposeChord } from '../shared/transpose';
import { isChordOnlyLine, detectChordsInText } from '../shared/chord-detect';
import { getState } from './state';

/**
 * Render the full song into the given container.
 *
 * Groups chord lines with their immediate lyric lines in a wrapper div so
 * that flex column-wrap layout can't split a chord from its lyrics across
 * a page boundary in horizontal mode.
 */
export function renderSong(container: HTMLElement): void {
  const lines = getState().song.lines;
  const out: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.type === 'section-header') {
      out.push(`<div class="ls-section-header">${escapeHtml(line.label)}</div>`);
      i++;
      continue;
    }

    if (line.type === 'empty') {
      out.push('<div class="ls-empty-line">&nbsp;</div>');
      i++;
      continue;
    }

    // chord-line with chords: start a group that absorbs immediately-
    // following lyric-only lines so they render as one atomic unit
    const hasChords = line.chords.length > 0 || isChordOnlyLine(line.lyrics);
    if (hasChords) {
      const group: string[] = [renderChordLine(line)];
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j];
        if (next.type !== 'chord-line') break;
        if (next.chords.length > 0 || isChordOnlyLine(next.lyrics)) break;
        group.push(renderChordLine(next));
        j++;
      }
      if (group.length > 1) {
        out.push(`<div class="ls-group">${group.join('')}</div>`);
      } else {
        out.push(group[0]);
      }
      i = j;
    } else {
      out.push(renderChordLine(line));
      i++;
    }
  }

  container.innerHTML = out.join('\n');
}

function renderChordLine(line: {
  chords: { chord: string; position: number }[];
  lyrics: string;
}): string {
  const state = getState();

  // Fallback: if the line has no tagged chord spans but the plain text looks
  // like a chord-only line (e.g. "F    Am    Bb    C"), regex-detect chords
  // in the text. Handles tabs where the author didn't wrap with [ch] markup.
  let effectiveChords = line.chords;
  let effectiveLyrics = line.lyrics;
  if (line.chords.length === 0 && isChordOnlyLine(line.lyrics)) {
    effectiveChords = detectChordsInText(line.lyrics);
    effectiveLyrics = '';
  }

  if (effectiveChords.length === 0) {
    if (line.lyrics.trim() === '') {
      return '<div class="ls-empty-line">&nbsp;</div>';
    }
    return `<div class="ls-lyric-line">${escapeHtml(line.lyrics)}</div>`;
  }

  // Build the chord line by placing each transposed chord at its character
  // offset. Lyrics are preserved with exact whitespace so alignment holds.
  const chordChars: string[] = new Array(
    Math.max(effectiveLyrics.length, maxChordEnd(effectiveChords))
  ).fill(' ');

  for (const cp of effectiveChords) {
    const transposed = transposeChord(cp.chord, state.transposeSemitones, state.useFlats);
    for (let i = 0; i < transposed.length; i++) {
      if (cp.position + i < chordChars.length) {
        chordChars[cp.position + i] = transposed[i];
      } else {
        chordChars.push(transposed[i]);
      }
    }
  }

  const chordStr = chordChars.join('').trimEnd();

  // Chord-only line: don't also render the original text — it'd show the
  // untransposed chord names below the transposed chord line. The check
  // looks at the original chord positions (not the transposed chord line)
  // so it's stable under transpose and accidental flips.
  if (
    effectiveLyrics.trim() === '' ||
    isEntirelyCoveredByChords(effectiveLyrics, effectiveChords)
  ) {
    return `<div class="ls-line"><span class="ls-chords">${escapeHtml(chordStr)}</span></div>`;
  }

  return `<div class="ls-line"><span class="ls-chords">${escapeHtml(chordStr)}</span><span class="ls-lyrics">${escapeHtml(effectiveLyrics)}</span></div>`;
}

/**
 * True if every non-whitespace character in `text` falls inside the bounds
 * of one of the original chord tokens. Indicates a chord-only line where
 * the plain text is just chord names separated by spaces.
 */
function isEntirelyCoveredByChords(
  text: string,
  chords: { chord: string; position: number }[]
): boolean {
  if (chords.length === 0) return false;
  const covered = new Array(text.length).fill(false);
  for (const cp of chords) {
    for (let i = 0; i < cp.chord.length; i++) {
      const idx = cp.position + i;
      if (idx >= 0 && idx < text.length) covered[idx] = true;
    }
  }
  for (let i = 0; i < text.length; i++) {
    if (!/\s/.test(text[i]) && !covered[i]) return false;
  }
  return true;
}

function maxChordEnd(chords: { chord: string; position: number }[]): number {
  let max = 0;
  for (const c of chords) {
    max = Math.max(max, c.position + c.chord.length);
  }
  return max;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
