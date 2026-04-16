import { ChordPosition } from '../content/parsers/types';

/**
 * Regex matching a valid chord token, e.g.:
 *   C, Am, F#m7, Bb, C/G, D/F#, Am7, Cmaj7, Dsus4, E7b9, C#m7/G#
 *
 * Structure: root (A-G, optional # or b) + optional quality/extensions + optional /bass
 */
const CHORD_TOKEN_RE = /^[A-G][#b]?(?:maj|min|m|M|sus|dim|aug|add|°|ø|Δ|[\d#b+\-()])*(?:\/[A-G][#b]?)?\*?$/;

/**
 * A line is considered "chord-only" if every whitespace-separated token
 * looks like a chord (and the line has at least one token).
 *
 * This is used to detect chord lines that weren't marked up with `[ch]` tags
 * in the source.
 */
export function isChordOnlyLine(text: string): boolean {
  const tokens = text.trim().split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return false;
  // Filter out bar separators and other musical notation
  const chordTokens = tokens.filter(t => t !== '|' && t !== ':' && t !== '||' && t !== '|:' && t !== ':|');
  if (chordTokens.length === 0) return false;
  return chordTokens.every(t => CHORD_TOKEN_RE.test(t));
}

/**
 * Extract chord positions from a plain-text chord line.
 * Walks the string, capturing tokens and their character offsets.
 */
export function detectChordsInText(text: string): ChordPosition[] {
  const chords: ChordPosition[] = [];
  const re = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const token = match[0];
    if (CHORD_TOKEN_RE.test(token)) {
      chords.push({ chord: token, position: match.index });
    }
  }
  return chords;
}
