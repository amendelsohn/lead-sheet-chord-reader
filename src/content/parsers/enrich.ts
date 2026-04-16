import { ParsedSong, SongLine } from './types';

/**
 * Some tabs include metadata like "Capo: 3" or "Key: G" as plain-text lines
 * inside the chord content rather than as proper site metadata. This
 * post-processor scans the parsed lines for those patterns, lifts the values
 * into the ParsedSong header fields (when not already set), and removes the
 * source lines so they don't appear as stray text in the reader.
 *
 * Only scans the top preamble — the part before the first section header —
 * to avoid lifting something that's legitimately part of the song body.
 */
export function enrichFromLines(song: ParsedSong): ParsedSong {
  const lines = [...song.lines];
  const updated = { ...song };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Stop at the first real content — section header or a chord line.
    if (line.type === 'section-header') break;
    if (line.type === 'chord-line' && line.chords.length > 0) break;
    if (line.type === 'empty') continue;

    const text = line.lyrics.trim();

    // Capo: 3  |  Capo: 3rd fret  |  Capo 3
    const capoMatch = text.match(/^capo[:\s]+\s*(\d+)/i);
    if (capoMatch && (updated.capo === undefined || updated.capo === 0)) {
      updated.capo = parseInt(capoMatch[1], 10);
      lines[i] = { type: 'empty' };
      continue;
    }

    // Key: G  |  Key of G  |  Key - G
    const keyMatch = text.match(/^key[:\s-]+\s*([A-G][#b]?m?)\s*$/i);
    if (keyMatch && !updated.key) {
      updated.key = keyMatch[1];
      lines[i] = { type: 'empty' };
      continue;
    }

    // Tuning: E A D G B E
    const tuningMatch = text.match(/^tuning[:\s]+\s*(.+)$/i);
    if (tuningMatch && !updated.tuning) {
      updated.tuning = tuningMatch[1].trim();
      lines[i] = { type: 'empty' };
      continue;
    }
  }

  updated.lines = lines;
  return updated;
}
