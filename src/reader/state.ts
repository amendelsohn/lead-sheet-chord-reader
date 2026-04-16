import { ParsedSong } from '../content/parsers/types';
import { getCachedPrefs, preloadPrefs, savePrefs, Prefs } from '../shared/storage';
import { Key, inferKey, collectChords } from '../shared/key-infer';
import { ThemeId, DEFAULT_THEME, isThemeId } from './themes';

export type LayoutMode = 'vertical' | 'horizontal';
export type ChordDisplay = 'letter' | 'roman' | 'nashville';

export interface ReaderState {
  song: ParsedSong;
  transposeSemitones: number;
  useFlats: boolean;
  layout: LayoutMode;
  fontSize: number;
  theme: ThemeId;
  autoScrollSpeed: number;
  autoScrollActive: boolean;
  scrollAnimationId: number | null;
  chordDisplay: ChordDisplay;
  /** Key inferred from the song's chord sequence, computed once at init. */
  inferredKey: Key | null;
  /** User-selected key; overrides inferredKey when set. Not persisted. */
  manualKey: Key | null;
  onClose?: () => void;
}

export interface ReaderOptions {
  onClose?: () => void;
}

let current: ReaderState | null = null;

export function initState(
  song: ParsedSong,
  options: ReaderOptions = {},
  onAsyncPrefsApplied?: () => void
): ReaderState {
  current = {
    song,
    transposeSemitones: 0,
    useFlats: true,
    layout: 'vertical',
    fontSize: 14,
    theme: DEFAULT_THEME,
    autoScrollSpeed: 0.5,
    autoScrollActive: false,
    scrollAnimationId: null,
    chordDisplay: 'letter',
    inferredKey: inferKey(collectChords(song.lines)) ?? parseKeyString(song.key),
    manualKey: null,
    onClose: options.onClose,
  };
  // Prefs are usually cached by the time a reader opens (preloadPrefs runs
  // from main.ts at content-script init). If not — e.g. right after the
  // extension is freshly (re)loaded on an already-open page — the async
  // path fires the callback so the caller can re-render with the real prefs.
  loadPreferences(current, onAsyncPrefsApplied);
  return current;
}

export function getState(): ReaderState {
  if (!current) throw new Error('Reader state not initialized');
  return current;
}

export function clearState(): void {
  current = null;
}

/**
 * The key used for scale-degree rendering: manual override beats inferred.
 * Returns null when neither is available — caller should fall back to
 * letter display.
 */
export function effectiveKey(state: ReaderState): Key | null {
  return state.manualKey ?? state.inferredKey;
}

export function savePreferences(): void {
  if (!current) return;
  savePrefs({
    fontSize: current.fontSize,
    layout: current.layout,
    theme: current.theme,
    useFlats: current.useFlats,
    autoScrollSpeed: current.autoScrollSpeed,
    chordDisplay: current.chordDisplay,
  });
}

function applyPrefs(state: ReaderState, prefs: Prefs): void {
  if (prefs.fontSize) state.fontSize = prefs.fontSize;
  if (prefs.layout === 'vertical' || prefs.layout === 'horizontal') state.layout = prefs.layout;
  if (prefs.theme !== undefined && isThemeId(prefs.theme)) state.theme = prefs.theme;
  if (prefs.useFlats !== undefined) state.useFlats = prefs.useFlats;
  if (prefs.autoScrollSpeed) state.autoScrollSpeed = prefs.autoScrollSpeed;
  if (prefs.chordDisplay === 'letter' || prefs.chordDisplay === 'roman' || prefs.chordDisplay === 'nashville') {
    state.chordDisplay = prefs.chordDisplay;
  }
}

/**
 * Apply cached prefs synchronously if available; otherwise kick off the
 * async preload and invoke the callback once they arrive so the caller
 * can re-render.
 */
export function loadPreferences(state: ReaderState, onAsyncLoad?: () => void): void {
  const cached = getCachedPrefs();
  if (cached) {
    applyPrefs(state, cached);
    return;
  }
  preloadPrefs()
    .then((prefs) => {
      applyPrefs(state, prefs);
      onAsyncLoad?.();
    })
    .catch(() => {
      // preloadPrefs already resolves with {} on error today, but keep an
      // explicit catch so a future rejection can't hang the caller waiting
      // on a one-time pref-applied callback.
    });
}

/**
 * Parse a key string from a parser's preamble (e.g. "G", "Am", "Bbm") into
 * a structured Key. Returns null for unparseable strings.
 */
function parseKeyString(s: string | undefined): Key | null {
  if (!s) return null;
  const m = s.trim().match(/^([A-G])([#b]?)(m)?$/i);
  if (!m) return null;
  const tonic = m[1].toUpperCase() + (m[2] || '').toLowerCase();
  return { tonic, mode: m[3] ? 'minor' : 'major' };
}
