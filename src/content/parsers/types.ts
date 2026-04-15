export interface ChordPosition {
  chord: string;
  position: number;
}

export interface ChordLine {
  type: 'chord-line';
  chords: ChordPosition[];
  lyrics: string;
}

export interface SectionHeader {
  type: 'section-header';
  label: string;
}

export interface EmptyLine {
  type: 'empty';
}

export type SongLine = ChordLine | SectionHeader | EmptyLine;

export interface ParsedSong {
  title: string;
  artist: string;
  source: 'ultimate-guitar' | 'e-chords';
  sourceUrl: string;
  key?: string;
  capo?: number;
  tuning?: string;
  lines: SongLine[];
}
