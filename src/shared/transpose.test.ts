import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChord, transposeChord } from './transpose.ts';

describe('parseChord', () => {
  const cases: Array<{
    input: string;
    expected: { root: string; suffix: string; bass?: string; alt: boolean } | null;
  }> = [
    { input: 'C', expected: { root: 'C', suffix: '', bass: undefined, alt: false } },
    { input: 'Am', expected: { root: 'A', suffix: 'm', bass: undefined, alt: false } },
    { input: 'Am7', expected: { root: 'A', suffix: 'm7', bass: undefined, alt: false } },
    { input: 'F#', expected: { root: 'F#', suffix: '', bass: undefined, alt: false } },
    { input: 'Bb', expected: { root: 'Bb', suffix: '', bass: undefined, alt: false } },
    { input: 'D/F#', expected: { root: 'D', suffix: '', bass: 'F#', alt: false } },
    { input: 'C#m7/G#', expected: { root: 'C#', suffix: 'm7', bass: 'G#', alt: false } },
    { input: 'F*', expected: { root: 'F', suffix: '', bass: undefined, alt: true } },
    { input: 'FM7/E*', expected: { root: 'F', suffix: 'M7', bass: 'E', alt: true } },
    { input: 'Cmaj7', expected: { root: 'C', suffix: 'maj7', bass: undefined, alt: false } },
    { input: 'Dsus4', expected: { root: 'D', suffix: 'sus4', bass: undefined, alt: false } },
    { input: 'E7b9', expected: { root: 'E', suffix: '7b9', bass: undefined, alt: false } },
    { input: 'Gadd9', expected: { root: 'G', suffix: 'add9', bass: undefined, alt: false } },
  ];

  for (const { input, expected } of cases) {
    test(`parses "${input}"`, () => {
      assert.deepEqual(parseChord(input), expected);
    });
  }

  test('returns null for non-chord strings', () => {
    // Regex anchors require starting with [A-G][#b]?; strings starting elsewhere fail.
    assert.equal(parseChord(''), null);
    assert.equal(parseChord('hello'), null);
    assert.equal(parseChord('1'), null);
    assert.equal(parseChord('#C'), null);
  });

  test('"Cat" parses as chord with suffix "at" (regex is permissive on suffix)', () => {
    // Locks in current behavior: the regex's `.*?` suffix is unconstrained.
    // Chord-validity filtering is the caller's job (see chord-detect.ts).
    assert.deepEqual(parseChord('Cat'), { root: 'C', suffix: 'at', bass: undefined, alt: false });
  });
});

describe('transposeChord — every semitone step for C major (sharps)', () => {
  const expectedSharp = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  for (let s = 0; s < 12; s++) {
    test(`C + ${s} semitones (sharps) -> ${expectedSharp[s]}`, () => {
      assert.equal(transposeChord('C', s, false), expectedSharp[s]);
    });
  }
});

describe('transposeChord — every semitone step for C major (flats)', () => {
  const expectedFlat = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  for (let s = 0; s < 12; s++) {
    test(`C + ${s} semitones (flats) -> ${expectedFlat[s]}`, () => {
      assert.equal(transposeChord('C', s, true), expectedFlat[s]);
    });
  }
});

describe('transposeChord — sharps <-> flats switching at zero semitones', () => {
  test('C# at 0 semitones with flats preference becomes Db', () => {
    assert.equal(transposeChord('C#', 0, true), 'Db');
  });

  test('Db at 0 semitones with sharps preference becomes C#', () => {
    assert.equal(transposeChord('Db', 0, false), 'C#');
  });

  test('Bb at 0 semitones with sharps preference becomes A#', () => {
    assert.equal(transposeChord('Bb', 0, false), 'A#');
  });

  test('A# at 0 semitones with flats preference becomes Bb', () => {
    assert.equal(transposeChord('A#', 0, true), 'Bb');
  });

  test('natural notes are unchanged at 0 semitones regardless of preference', () => {
    for (const n of ['C', 'D', 'E', 'F', 'G', 'A', 'B']) {
      assert.equal(transposeChord(n, 0, true), n);
      assert.equal(transposeChord(n, 0, false), n);
    }
  });
});

describe('transposeChord — edge-case accidentals', () => {
  // NOTE_TO_INDEX has explicit entries for E#, Fb, B#, Cb.
  test('E# transposed up 0 (sharps) -> F (enharmonic normalization)', () => {
    assert.equal(transposeChord('E#', 0, false), 'F');
  });
  test('Fb transposed up 0 (sharps) -> E', () => {
    assert.equal(transposeChord('Fb', 0, false), 'E');
  });
  test('B# transposed up 0 (sharps) -> C', () => {
    assert.equal(transposeChord('B#', 0, false), 'C');
  });
  test('Cb transposed up 0 (flats) -> B', () => {
    assert.equal(transposeChord('Cb', 0, true), 'B');
  });
});

describe('transposeChord — negative semitones wrap correctly', () => {
  test('C - 1 (sharps) -> B', () => {
    assert.equal(transposeChord('C', -1, false), 'B');
  });
  test('C - 2 (flats) -> Bb', () => {
    assert.equal(transposeChord('C', -2, true), 'Bb');
  });
  test('C - 12 (sharps) -> C', () => {
    assert.equal(transposeChord('C', -12, false), 'C');
  });
  test('C - 13 (sharps) -> B', () => {
    assert.equal(transposeChord('C', -13, false), 'B');
  });
});

describe('transposeChord — semitones beyond one octave wrap', () => {
  test('C + 12 -> C', () => {
    assert.equal(transposeChord('C', 12, false), 'C');
  });
  test('C + 14 (sharps) -> D', () => {
    assert.equal(transposeChord('C', 14, false), 'D');
  });
  test('G + 25 (sharps) -> G# (25 mod 12 = 1)', () => {
    assert.equal(transposeChord('G', 25, false), 'G#');
  });
});

describe('transposeChord — extended chord qualities preserved', () => {
  const cases: Array<{ chord: string; semi: number; flats: boolean; expected: string }> = [
    { chord: 'Am7', semi: 2, flats: false, expected: 'Bm7' },
    { chord: 'Cmaj7', semi: 2, flats: false, expected: 'Dmaj7' },
    { chord: 'Dsus4', semi: 2, flats: false, expected: 'Esus4' },
    { chord: 'E7b9', semi: 1, flats: false, expected: 'F7b9' },
    { chord: 'Gadd9', semi: -2, flats: false, expected: 'Fadd9' },
    { chord: 'F#m7b5', semi: 1, flats: false, expected: 'Gm7b5' },
    { chord: 'Cdim7', semi: 3, flats: false, expected: 'D#dim7' },
    { chord: 'Aaug', semi: 2, flats: false, expected: 'Baug' },
    { chord: 'Bbmaj7', semi: 1, flats: true, expected: 'Bmaj7' },
  ];

  for (const { chord, semi, flats, expected } of cases) {
    test(`${chord} + ${semi} (flats=${flats}) -> ${expected}`, () => {
      assert.equal(transposeChord(chord, semi, flats), expected);
    });
  }
});

describe('transposeChord — slash chords transpose both root and bass', () => {
  const cases: Array<{ chord: string; semi: number; flats: boolean; expected: string }> = [
    { chord: 'G/B', semi: 2, flats: false, expected: 'A/C#' },
    { chord: 'D/F#', semi: 1, flats: false, expected: 'D#/G' },
    { chord: 'D/F#', semi: 1, flats: true, expected: 'Eb/G' },
    { chord: 'C#m7/G#', semi: 1, flats: false, expected: 'Dm7/A' },
    { chord: 'F/C', semi: -5, flats: false, expected: 'C/G' },
  ];
  for (const { chord, semi, flats, expected } of cases) {
    test(`${chord} + ${semi} (flats=${flats}) -> ${expected}`, () => {
      assert.equal(transposeChord(chord, semi, flats), expected);
    });
  }
});

describe('transposeChord — alternate-fingering marker preserved', () => {
  test('F* + 2 (sharps) -> G*', () => {
    assert.equal(transposeChord('F*', 2, false), 'G*');
  });
  test('FM7/E* + 0 (sharps) preserves everything', () => {
    assert.equal(transposeChord('FM7/E*', 0, false), 'FM7/E*');
  });
  test('FM7/E* + 2 (sharps) -> GM7/F#*', () => {
    assert.equal(transposeChord('FM7/E*', 2, false), 'GM7/F#*');
  });
});

describe('transposeChord — non-chord input passes through unchanged', () => {
  // parseChord returns null for inputs not starting with [A-G][#b]?, so
  // transposeChord returns the input verbatim.
  test('empty string', () => {
    assert.equal(transposeChord('', 3, false), '');
  });
  test('lowercase word starting with non-chord letter', () => {
    assert.equal(transposeChord('hello', 3, false), 'hello');
  });
  test('punctuation', () => {
    assert.equal(transposeChord('---', 3, false), '---');
  });
});

describe('transposeChord — current behavior on ambiguous input (lock-in)', () => {
  // parseChord's suffix is unconstrained, so words starting with [A-G] parse
  // as chords. Callers are expected to gate with chord-detect first. These
  // tests lock in current behavior so regressions get noticed.
  test('"Cat" + 2 (sharps) -> "Dat"', () => {
    assert.equal(transposeChord('Cat', 2, false), 'Dat');
  });
  test('"Go" + 2 (sharps) -> "Ao"', () => {
    assert.equal(transposeChord('Go', 2, false), 'Ao');
  });
});
