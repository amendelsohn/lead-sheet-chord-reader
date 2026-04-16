// Chord transposition logic

const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Maps any note name (sharp or flat) to its semitone index (0-11)
const NOTE_TO_INDEX: Record<string, number> = {};
NOTES_SHARP.forEach((n, i) => { NOTE_TO_INDEX[n] = i; });
NOTES_FLAT.forEach((n, i) => { NOTE_TO_INDEX[n] = i; });
// Handle edge cases
NOTE_TO_INDEX['E#'] = 5;  // F
NOTE_TO_INDEX['Fb'] = 4;  // E
NOTE_TO_INDEX['B#'] = 0;  // C
NOTE_TO_INDEX['Cb'] = 11; // B

/**
 * Parse a chord string into root note, optional bass note, and suffix.
 * The trailing `*` marks an alternate fingering and is preserved through transpose.
 * Examples:
 *   "Am7"     -> { root: "A",  suffix: "m7", bass: undefined, alt: false }
 *   "D/F#"    -> { root: "D",  suffix: "",   bass: "F#",      alt: false }
 *   "C#m7/G#" -> { root: "C#", suffix: "m7", bass: "G#",      alt: false }
 *   "F*"      -> { root: "F",  suffix: "",   bass: undefined, alt: true }
 *   "FM7/E*"  -> { root: "F",  suffix: "M7", bass: "E",       alt: true }
 */
export function parseChord(chord: string): { root: string; suffix: string; bass?: string; alt: boolean } | null {
  const match = chord.match(/^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?(\*?)$/);
  if (!match) return null;
  return {
    root: match[1],
    suffix: match[2],
    bass: match[3] || undefined,
    alt: match[4] === '*',
  };
}

/**
 * Transpose a single note by the given number of semitones.
 */
function transposeNote(note: string, semitones: number, useFlats: boolean): string {
  const index = NOTE_TO_INDEX[note];
  if (index === undefined) return note;
  const newIndex = ((index + semitones) % 12 + 12) % 12;
  return useFlats ? NOTES_FLAT[newIndex] : NOTES_SHARP[newIndex];
}

/**
 * Transpose a full chord string by the given number of semitones.
 */
export function transposeChord(chord: string, semitones: number, useFlats: boolean): string {
  // No early return on semitones === 0: we still need to normalize
  // accidentals (# ↔ ♭) to match the current useFlats preference.
  const parsed = parseChord(chord);
  if (!parsed) return chord;

  const newRoot = transposeNote(parsed.root, semitones, useFlats);
  const newBass = parsed.bass ? transposeNote(parsed.bass, semitones, useFlats) : undefined;
  return newRoot + parsed.suffix + (newBass ? '/' + newBass : '') + (parsed.alt ? '*' : '');
}
