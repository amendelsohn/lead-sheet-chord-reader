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
  darkMode?: boolean;
  useFlats?: boolean;
  autoScrollSpeed?: number;
  chordDisplay?: 'letter' | 'roman' | 'nashville';
}

const STORAGE_KEY = 'prefs';

let cache: Prefs | null = null;
let loadPromise: Promise<Prefs> | null = null;

export function preloadPrefs(): Promise<Prefs> {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve) => {
    try {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        cache = (result?.[STORAGE_KEY] as Prefs) || {};
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
