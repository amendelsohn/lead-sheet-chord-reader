/**
 * chrome.storage.local wrapper.
 *
 * Unlike localStorage, chrome.storage.local is:
 *   - Async (Promise-based in MV3)
 *   - Scoped to the extension (shared across all sites the extension runs on)
 *   - Quota ~5 MB
 *
 * We preload preferences at content-script init so the reader can read them
 * synchronously from the in-memory cache when the user opens it. If the
 * reader happens to open before prefs finish loading (rare — auto-open runs
 * many ms after MutationObserver catches content), the caller can await the
 * preload promise and re-apply.
 */

export interface Prefs {
  fontSize?: number;
  layout?: 'vertical' | 'horizontal';
  /** Theme ID (see src/reader/themes.ts). Superseded the earlier darkMode. */
  theme?: string;
  /**
   * Legacy dark-mode flag from pre-theme versions (≤ 1.0.0). Read-only
   * during migration, then stripped on first save. Kept in the interface
   * so the migration step type-checks.
   */
  darkMode?: boolean;
  useFlats?: boolean;
  autoScrollSpeed?: number;
  chordDisplay?: 'letter' | 'roman' | 'nashville';
}

const STORAGE_KEY = 'prefs';

let cache: Prefs | null = null;
let loadPromise: Promise<Prefs> | null = null;

/**
 * Migrate legacy fields to their current shape. Runs on every load before
 * the cache is populated, so callers always see the current shape.
 *
 * Current migrations:
 *  - darkMode: boolean → theme: 'dark' | 'light' (and drop darkMode)
 *    Performed only if no theme is already set, so a user who upgraded,
 *    picked a new theme, then somehow ended up with darkMode resurfacing
 *    wouldn't have their picked theme clobbered.
 */
function migrate(raw: Prefs): Prefs {
  const out: Prefs = { ...raw };
  if (out.theme === undefined && out.darkMode !== undefined) {
    out.theme = out.darkMode ? 'dark' : 'light';
  }
  // Drop the legacy field once we've consumed it. The next savePrefs() will
  // persist the migrated shape.
  delete out.darkMode;
  return out;
}

export function preloadPrefs(): Promise<Prefs> {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve) => {
    try {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        const raw = (result?.[STORAGE_KEY] as Prefs) || {};
        cache = migrate(raw);
        resolve(cache);
      });
    } catch {
      cache = {};
      resolve(cache);
    }
  });
  return loadPromise;
}

export function getCachedPrefs(): Prefs | null {
  return cache;
}

export function savePrefs(prefs: Prefs): void {
  cache = prefs;
  try {
    chrome.storage.local.set({ [STORAGE_KEY]: prefs });
  } catch {
    // chrome.storage not available (e.g., in test) — cache is still updated
  }
}
