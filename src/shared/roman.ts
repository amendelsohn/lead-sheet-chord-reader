import { parseChord } from './transpose';

/**
 * Scale-degree chord rendering — Roman numerals (IVm7) and Nashville (4m7).
 *
 * Both formats are rendered relative to a tonic. No minor-key-specific table:
 * the convention used here (matching most Nashville charts) is that the
 * degree table is always relative to the major scale starting at the tonic;
 * flatted degrees in a minor-key song appear as bIII / bVI / bVII.
 *
 * Minor/diminished/augmented chord quality is expressed in the formatted
 * output — not in the degree index — so this function doesn't need a `mode`.
 */

export type DegreeFormat = 'roman' | 'nashville';

const ROMAN     = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII'];
const NASHVILLE = ['1', 'b2',  '2',  'b3',   '3',   '4',  '#4',  '5', 'b6',  '6',  'b7',   '7'];

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

type Quality = 'major' | 'minor' | 'dim' | 'aug';

function noteIndex(n: string): number | null {
  const i = NOTE_INDEX[n];
  return i === undefined ? null : i;
}

function intervalFromTonic(root: string, tonic: string): number | null {
  const r = noteIndex(root);
  const t = noteIndex(tonic);
  if (r === null || t === null) return null;
  return ((r - t) % 12 + 12) % 12;
}

/**
 * Split a chord suffix into a triad quality and the remaining extension text.
 * Examples:
 *   ""       → major, ""
 *   "m7"     → minor, "7"
 *   "maj7"   → major, "maj7"
 *   "dim7"   → dim,   "7"
 *   "°7"     → dim,   "7"
 *   "aug"    → aug,   ""
 *   "+"      → aug,   ""
 *   "m7b5"   → minor, "7b5"   (half-dim treated as minor-flavored)
 *   "sus4"   → major, "sus4"
 *   "5"      → major, "5"     (power chord)
 */
function splitQuality(suffix: string): { quality: Quality; rest: string } {
  // diminished
  let m = suffix.match(/^(dim|°)(.*)$/);
  if (m) return { quality: 'dim', rest: m[2] };

  // augmented — 'aug' or '+' not followed by a digit (to avoid eating the '+' in 'add9+')
  m = suffix.match(/^(aug|\+)(?!\d)(.*)$/);
  if (m) return { quality: 'aug', rest: m[2] };

  // minor — 'm' (not 'maj'/'M'), 'min', or '-'
  m = suffix.match(/^(m(?!aj)|min|-)(.*)$/);
  if (m) return { quality: 'minor', rest: m[2] };

  return { quality: 'major', rest: suffix };
}

/**
 * Return just the degree label for a note relative to tonic (no quality),
 * used for slash-bass rendering.
 */
function degreeLabel(note: string, tonic: string, format: DegreeFormat): string | null {
  const iv = intervalFromTonic(note, tonic);
  if (iv === null) return null;
  return (format === 'roman' ? ROMAN : NASHVILLE)[iv];
}

/**
 * Format a chord string as a scale degree relative to the given tonic.
 * Returns the original chord string unchanged if the root can't be parsed.
 */
export function formatChordAsDegree(
  chord: string,
  tonic: string,
  format: DegreeFormat
): string {
  const parsed = parseChord(chord);
  if (!parsed) return chord;

  const iv = intervalFromTonic(parsed.root, tonic);
  if (iv === null) return chord;

  const { quality, rest } = splitQuality(parsed.suffix);
  let base = (format === 'roman' ? ROMAN : NASHVILLE)[iv];

  // Roman: case indicates quality. Nashville: numbers are case-agnostic; the
  // 'm' marker trails the number.
  if (format === 'roman' && (quality === 'minor' || quality === 'dim')) {
    base = base.toLowerCase();
  }

  let tail = rest;
  if (format === 'roman') {
    if (quality === 'dim') tail = '°' + tail;
    else if (quality === 'aug') tail = '+' + tail;
  } else {
    if (quality === 'minor') tail = 'm' + tail;
    else if (quality === 'dim') tail = '°' + tail;
    else if (quality === 'aug') tail = '+' + tail;
  }

  let out = base + tail;

  if (parsed.bass) {
    const bass = degreeLabel(parsed.bass, tonic, format);
    if (bass) out += '/' + bass;
    else out += '/' + parsed.bass;
  }

  if (parsed.alt) out += '*';

  return out;
}
