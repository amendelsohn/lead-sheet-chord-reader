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
  /** Stable identifier of the SiteParser that produced this song. */
  source: string;
  sourceUrl: string;
  key?: string;
  capo?: number;
  tuning?: string;
  lines: SongLine[];
}

/**
 * A SiteParser knows how to recognize a chord page on a specific site and
 * pull a ParsedSong out of its DOM. To add a new site:
 *   1. Write a parser file that exports a SiteParser object
 *   2. Register it in src/content/parsers/index.ts
 *   3. Add the site's URL pattern to manifest.json → content_scripts.matches
 */
export interface SiteParser {
  /** Stable identifier used for ParsedSong.source and logging */
  id: string;
  /** Human-readable label for logs and debugging */
  label: string;
  /** Hostname substrings this parser handles (e.g., 'ultimate-guitar.com') */
  hostnames: string[];
  /** True if the given URL looks like a chord page on this site */
  matchesUrl(url: URL): boolean;
  /**
   * Cheap DOM probe: does the page currently have the markers this parser
   * needs? Called frequently by the MutationObserver, so keep it fast.
   */
  hasChordContent(): boolean;
  /**
   * Parse the current page into a ParsedSong. Returns null if the page
   * isn't ready yet or doesn't actually have chord content.
   */
  parse(): ParsedSong | null;
}
