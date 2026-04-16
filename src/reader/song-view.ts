import { transposeChord } from '../shared/transpose';
import { isChordOnlyLine, detectChordsInText } from '../shared/chord-detect';
import { getState } from './state';
import { html, HtmlString, render } from '../shared/html';

/**
 * Render the full song into the given container.
 *
 * Groups chord lines with their immediate lyric lines in a wrapper div so
 * that flex column-wrap layout can't split a chord from its lyrics across
 * a page boundary in horizontal mode.
 */
export function renderSong(container: HTMLElement): void {
  const lines = getState().song.lines;
  const out: HtmlString[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.type === 'section-header') {
      out.push(html`<div class="ls-section-header">${line.label}</div>`);
      i++;
      continue;
    }

    if (line.type === 'empty') {
      out.push(html`<div class="ls-empty-line">&nbsp;</div>`);
      i++;
      continue;
    }

    // chord-line with chords: start a group that absorbs immediately-
    // following lyric-only lines so they render as one atomic unit
    const hasChords = line.chords.length > 0 || isChordOnlyLine(line.lyrics);
    if (hasChords) {
      const group: HtmlString[] = [renderChordLine(line)];
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j];
        if (next.type !== 'chord-line') break;
        if (next.chords.length > 0 || isChordOnlyLine(next.lyrics)) break;
        group.push(renderChordLine(next));
        j++;
      }
      if (group.length > 1) {
        out.push(html`<div class="ls-group">${group}</div>`);
      } else {
        out.push(group[0]);
      }
      i = j;
    } else {
      out.push(renderChordLine(line));
      i++;
    }
  }

  render(container, html`${out}`);
}

function renderChordLine(line: {
  chords: { chord: string; position: number }[];
  lyrics: string;
}): HtmlString {
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
      return html`<div class="ls-empty-line">&nbsp;</div>`;
    }
    return html`<div class="ls-lyric-line">${line.lyrics}</div>`;
  }

  // If the chord spans sit inside a prose sentence (text around them is not
  // just whitespace), render them inline rather than as a chord-line-over-
  // lyric-line stack. This is the "the E7 chord" case: UG wraps the chord
  // name in a span, but it's really just a reference inside a sentence.
  if (hasInlineChordText(effectiveLyrics, effectiveChords)) {
    return renderInlineChordLine(effectiveLyrics, effectiveChords);
  }

  // Traditional chord-over-lyric rendering. Build the chord line by placing
  // each transposed chord at its character offset. Lyrics below preserve
  // exact whitespace so alignment holds.
  // Transposed chord names can be longer than the original (e.g. F → Gb),
  // so we sort by position and enforce at least one space between adjacent
  // chords. Without this, "F    Am" transposed down a semitone would render
  // as "EAbm" — the Gb-ified chord eats the whitespace separator.
  const sortedChords = [...effectiveChords]
    .map((cp) => ({
      text: transposeChord(cp.chord, state.transposeSemitones, state.useFlats),
      position: cp.position,
    }))
    .sort((a, b) => a.position - b.position);

  let cursor = 0;
  const chordChars: string[] = new Array(
    Math.max(effectiveLyrics.length, maxChordEnd(effectiveChords))
  ).fill(' ');

  for (const cp of sortedChords) {
    // Never place a chord before where the previous chord ended (+1 space).
    const start = Math.max(cp.position, cursor);
    for (let i = 0; i < cp.text.length; i++) {
      const idx = start + i;
      if (idx < chordChars.length) chordChars[idx] = cp.text[i];
      else chordChars.push(cp.text[i]);
    }
    cursor = start + cp.text.length + 1;
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
    return html`<div class="ls-line"><span class="ls-chords">${chordStr}</span></div>`;
  }

  return html`<div class="ls-line"><span class="ls-chords">${chordStr}</span><span class="ls-lyrics">${effectiveLyrics}</span></div>`;
}

/**
 * Render a prose line with chord spans embedded in it. Walks the text in
 * order, emitting plain-text runs and styled chord spans. The chord text
 * itself is replaced by the transposed/accidental-flipped name.
 */
function renderInlineChordLine(
  text: string,
  chords: { chord: string; position: number }[]
): HtmlString {
  const state = getState();
  const sorted = [...chords].sort((a, b) => a.position - b.position);
  const parts: HtmlString[] = [];
  let cursor = 0;

  for (const cp of sorted) {
    if (cp.position > cursor) {
      parts.push(html`${text.substring(cursor, cp.position)}`);
    }
    const transposed = transposeChord(
      cp.chord,
      state.transposeSemitones,
      state.useFlats
    );
    parts.push(html`<span class="ls-chords">${transposed}</span>`);
    cursor = cp.position + cp.chord.length;
  }
  if (cursor < text.length) {
    parts.push(html`${text.substring(cursor)}`);
  }

  return html`<div class="ls-lyric-line">${parts}</div>`;
}

/**
 * True if the text has substantive (non-whitespace) content *outside* the
 * chord span ranges. Indicates prose with inline chord references like
 * "switches between the E chord and the E7 chord".
 */
function hasInlineChordText(
  text: string,
  chords: { chord: string; position: number }[]
): boolean {
  const covered = new Array(text.length).fill(false);
  for (const cp of chords) {
    for (let i = 0; i < cp.chord.length; i++) {
      const idx = cp.position + i;
      if (idx >= 0 && idx < text.length) covered[idx] = true;
    }
  }
  for (let i = 0; i < text.length; i++) {
    if (!covered[i] && !/\s/.test(text[i])) return true;
  }
  return false;
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
