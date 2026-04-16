import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isChordToken, isChordOnlyLine, detectChordsInText } from './chord-detect.ts';

describe('isChordToken — accepts typical chord spellings', () => {
  const truePositives = [
    'C', 'D', 'E', 'F', 'G', 'A', 'B',
    'C#', 'Db', 'F#', 'Bb', 'G#', 'Ab',
    'Am', 'Dm', 'Em', 'F#m', 'Bbm',
    'C7', 'G7', 'D7',
    'Cmaj7', 'Dmaj7', 'Fmaj7',
    'Am7', 'Dm7', 'F#m7',
    'Dsus4', 'Dsus2', 'Asus',
    'Cdim', 'Cdim7', 'C°', 'Cø',
    'Caug', 'C+',
    'Gadd9', 'Cadd11',
    'E7b9', 'G7#5',
    'F#m7b5',
    'C/G', 'D/F#', 'G/B', 'C#m7/G#',
    'CΔ', 'CM7',
    'F*', 'C/G*',
  ];

  for (const chord of truePositives) {
    test(`accepts "${chord}"`, () => {
      assert.equal(isChordToken(chord), true, `expected "${chord}" to be recognized`);
    });
  }
});

describe('isChordToken — rejects non-chord tokens', () => {
  const falsePositives = [
    '',           // empty
    ' ',          // whitespace only
    'a',          // lowercase single letter
    'b',          // lowercase
    'g',          // lowercase
    'h',          // out-of-range letter
    'Cat',        // chord-looking prefix + non-chord suffix
    'Go',         // ditto
    'Dog',        // 'o' not in suffix alphabet
    'Hello',      // starts with non-chord letter
    'world',      // lowercase, irrelevant letters
    '1',          // number
    '123',        // digits
    '---',        // punctuation
    '|',          // bar separator (caller filters these)
    '(F)',        // parens-wrapped (caller strips before calling)
    '#C',         // accidental-first
    'C/g',        // lowercase bass
    'c',          // lowercase root
  ];

  for (const token of falsePositives) {
    test(`rejects "${token}"`, () => {
      assert.equal(isChordToken(token), false, `expected "${token}" to be rejected`);
    });
  }
});

describe('isChordOnlyLine — true for chord-only rows', () => {
  const lines = [
    'C',
    'C Am F G',
    '  C   Am   F   G  ',
    'C Am F G ',
    'F#m7 B7 Emaj7',
    'D/F# G A',
    'C | Am | F | G',
    'C : Am',
    'C || Am',
    'C |: Am :|',
    '|: C G :|',
  ];
  for (const line of lines) {
    test(`true for "${line}"`, () => {
      assert.equal(isChordOnlyLine(line), true);
    });
  }
});

describe('isChordOnlyLine — false for non-chord lines', () => {
  const lines = [
    '',                          // empty
    '   ',                       // whitespace only
    'Hello world',               // plain prose
    'This is a lyric line',      // prose
    'C is a chord',              // 'is', 'a', 'chord' are not chord tokens
    'C Am Cat G',                // one bogus token contaminates the line
    'I love you',                // all lowercase prose
    '| | |',                     // only bar separators -> nothing to judge
    '|',                         // single bar
    ':',                         // single colon
  ];
  for (const line of lines) {
    test(`false for "${line}"`, () => {
      assert.equal(isChordOnlyLine(line), false);
    });
  }
});

describe('detectChordsInText — extracts tokens with character offsets', () => {
  test('empty string yields no chords', () => {
    assert.deepEqual(detectChordsInText(''), []);
  });

  test('whitespace-only string yields no chords', () => {
    assert.deepEqual(detectChordsInText('    '), []);
  });

  test('single chord at position 0', () => {
    assert.deepEqual(detectChordsInText('C'), [{ chord: 'C', position: 0 }]);
  });

  test('leading whitespace shifts position', () => {
    assert.deepEqual(detectChordsInText('   C'), [{ chord: 'C', position: 3 }]);
  });

  test('multiple chords track their offsets', () => {
    assert.deepEqual(detectChordsInText('C Am F G'), [
      { chord: 'C', position: 0 },
      { chord: 'Am', position: 2 },
      { chord: 'F', position: 5 },
      { chord: 'G', position: 7 },
    ]);
  });

  test('non-chord tokens are skipped, positions of real chords preserved', () => {
    // "C Hello Am" -> chords at 0 and 8.
    assert.deepEqual(detectChordsInText('C Hello Am'), [
      { chord: 'C', position: 0 },
      { chord: 'Am', position: 8 },
    ]);
  });

  test('slash chords and extensions detected', () => {
    assert.deepEqual(detectChordsInText('D/F#  Cmaj7'), [
      { chord: 'D/F#', position: 0 },
      { chord: 'Cmaj7', position: 6 },
    ]);
  });

  test('bar separators are not returned (they do not match the chord regex)', () => {
    // The vertical bar fails CHORD_TOKEN_RE, so it's simply omitted from output.
    assert.deepEqual(detectChordsInText('C | Am | G'), [
      { chord: 'C', position: 0 },
      { chord: 'Am', position: 4 },
      { chord: 'G', position: 9 },
    ]);
  });

  test('all-prose lines yield no chords', () => {
    assert.deepEqual(detectChordsInText('Hello world this is lyrics'), []);
  });
});
