import { ParsedSong } from '../content/parsers/types';
import { getCachedPrefs, preloadPrefs, savePrefs, Prefs } from '../shared/storage';

export type LayoutMode = 'vertical' | 'horizontal';

export interface ReaderState {
  song: ParsedSong;
  transposeSemitones: number;
  useFlats: boolean;
  layout: LayoutMode;
  fontSize: number;
  darkMode: boolean;
  autoScrollSpeed: number;
  autoScrollActive: boolean;
  scrollAnimationId: number | null;
  onClose?: () => void;
}

export interface ReaderOptions {
  onClose?: () => void;
}

let current: ReaderState | null = null;

export function initState(song: ParsedSong, options: ReaderOptions = {}): ReaderState {
  current = {
    song,
    transposeSemitones: 0,
    useFlats: true,
    layout: 'vertical',
    fontSize: 14,
    darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
    autoScrollSpeed: 0.5,
    autoScrollActive: false,
    scrollAnimationId: null,
    onClose: options.onClose,
  };
  loadPreferences(current);
  return current;
}

export function getState(): ReaderState {
  if (!current) throw new Error('Reader state not initialized');
  return current;
}

export function clearState(): void {
  current = null;
}

export function savePreferences(): void {
  if (!current) return;
  savePrefs({
    fontSize: current.fontSize,
    layout: current.layout,
    darkMode: current.darkMode,
    useFlats: current.useFlats,
    autoScrollSpeed: current.autoScrollSpeed,
  });
}

function applyPrefs(state: ReaderState, prefs: Prefs): void {
  if (prefs.fontSize) state.fontSize = prefs.fontSize;
  if (prefs.layout === 'vertical' || prefs.layout === 'horizontal') state.layout = prefs.layout;
  if (prefs.darkMode !== undefined) state.darkMode = prefs.darkMode;
  if (prefs.useFlats !== undefined) state.useFlats = prefs.useFlats;
  if (prefs.autoScrollSpeed) state.autoScrollSpeed = prefs.autoScrollSpeed;
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
