import { parseChord } from './transpose';

/**
 * Key inference from a chord list.
 *
 * Scores all 24 candidate keys (12 major + 12 minor) against the chord
 * sequence using a diatonic-fit heuristic, biased toward the first and last
 * chord (songs tend to start and end on the tonic). Returns the best match,
 * or null if confidence is below threshold — callers should hide the degree
 * toggle rather than show a bad guess.
 */

export type Mode = 'major' | 'minor';
export interface Key { tonic: string; mode: Mode; }

type Quality = 'major' | 'minor' | 'dim' | 'aug';

interface ChordFeature {
  rootIdx: number;
  quality: Quality;
}

const NOTE_INDEX: Record<string, number> = {
  'C': 0, 'B#': 0,
  'C#': 1, 'Db': 1,
  'D': 2,
  'D#': 3, 'Eb': 3,
  'E': 4, 'Fb': 4,
  'F': 5, 'E#': 5,
  'F#': 6, 'Gb': 6,
  'G': 7,
  'G#': 8, 'Ab': 8,
  'A': 9,
  'A#': 10, 'Bb': 10,
  'B': 11, 'Cb': 11,
};

// Display names per tonic index. Must align with the tonic list in the
// toolbar's key-override select so that an inferred key round-trips through
// the UI cleanly. Convention: flats for Db/Eb/Ab/Bb, sharp for F#; a manual
// override covers the cases where the user prefers the other spelling
// (e.g. C# minor vs Db minor).
const TONIC_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// Diatonic triads per mode: [semitone offset from tonic, expected quality].
const MAJOR_DIATONIC: [number, Quality][] = [
  [0, 'major'],
  [2, 'minor'],
  [4, 'minor'],
  [5, 'major'],
  [7, 'major'],
  [9, 'minor'],
  [11, 'dim'],
];

// Minor covers natural minor plus the harmonic-minor dominant (major V),
// since charts in minor keys routinely use V or V7.
const MINOR_DIATONIC: [number, Quality][] = [
  [0, 'minor'],
  [2, 'dim'],
  [3, 'major'],
  [5, 'minor'],
  [7, 'minor'],
  [7, 'major'],
  [8, 'major'],
  [10, 'major'],
];

function splitQuality(suffix: string): Quality {
  if (/^(dim|°)/.test(suffix)) return 'dim';
  if (/^(aug|\+)(?!\d)/.test(suffix)) return 'aug';
  if (/^(m(?!aj)|min|-)/.test(suffix)) return 'minor';
  return 'major';
}

function parseChordForInference(chord: string): ChordFeature | null {
  const p = parseChord(chord);
  if (!p) return null;
  const rootIdx = NOTE_INDEX[p.root];
  if (rootIdx === undefined) return null;
  return { rootIdx, quality: splitQuality(p.suffix) };
}

function scoreKey(chords: ChordFeature[], tonicIdx: number, mode: Mode): number {
  const table = mode === 'major' ? MAJOR_DIATONIC : MINOR_DIATONIC;
  let score = 0;

  for (let i = 0; i < chords.length; i++) {
    const c = chords[i];
    const offset = ((c.rootIdx - tonicIdx) % 12 + 12) % 12;

    // Best diatonic match for this offset: exact-quality +2, root-only +0.5.
    let chordScore = -1;
    for (const [off, q] of table) {
      if (off !== offset) continue;
      if (c.quality === q) { chordScore = 2; break; }
      if (chordScore < 0.5) chordScore = 0.5;
    }

    // Tonic & dominant bonuses reinforce the most key-defining chords.
    if (offset === 0 && c.quality === (mode === 'major' ? 'major' : 'minor')) {
      chordScore += 3;
    }
    if (offset === 7 && c.quality === 'major') chordScore += 1;

    // Endpoint chords weigh more — songs usually start and end on tonic.
    if (i === 0 || i === chords.length - 1) chordScore *= 2;

    score += chordScore;
  }
  return score;
}

/**
 * Return the best-guess key for a chord sequence, or null if confidence is
 * too low. Chord order matters (first/last are weighted).
 */
export function inferKey(chordStrs: string[]): Key | null {
  const chords = chordStrs
    .map(parseChordForInference)
    .filter((c): c is ChordFeature => c !== null);
  if (chords.length < 2) return null;

  let best: { tonicIdx: number; mode: Mode; score: number } | null = null;
  for (let tonicIdx = 0; tonicIdx < 12; tonicIdx++) {
    for (const mode of ['major', 'minor'] as const) {
      const s = scoreKey(chords, tonicIdx, mode);
      if (!best || s > best.score) {
        best = { tonicIdx, mode, score: s };
      }
    }
  }
  if (!best) return null;

  // Confidence gate: roughly, if half the chords fit diatonically with
  // endpoint weighting, we've cleared this. Below it, suppress inference.
  const minConfidence = chords.length * 1.0;
  if (best.score < minConfidence) return null;

  return { tonic: TONIC_NAMES[best.tonicIdx], mode: best.mode };
}

/**
 * Collect all chord tokens from a song's lines in document order.
 * Exported so the caller (reader.ts) can feed inferKey without reaching into
 * the line structure itself.
 */
export function collectChords(
  lines: { type: string; chords?: { chord: string }[] }[]
): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (line.type === 'chord-line' && line.chords) {
      for (const c of line.chords) out.push(c.chord);
    }
  }
  return out;
}
