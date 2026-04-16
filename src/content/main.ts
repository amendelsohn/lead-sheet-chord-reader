import { parseUltimateGuitar } from './parsers/ug';
import { parseEChords } from './parsers/echords';
import { ParsedSong } from './parsers/types';
import { createReaderView, isReaderOpen } from '../reader/reader';

/**
 * LeadSheet content script entry point.
 *
 * Strategy:
 *   1. Watch for chord content to appear in DOM (UG is a React SPA; content renders after load).
 *   2. When found, parse and auto-open the reader.
 *   3. Detect SPA navigation (URL changes) and re-trigger.
 *   4. User can disable auto-open with ?leadsheet=skip in URL, or by closing the reader
 *      (which shows a FAB button to re-open if desired).
 */

let lastProcessedUrl: string | null = null;
let observer: MutationObserver | null = null;

function detectSite(): 'ultimate-guitar' | 'e-chords' | null {
  const hostname = window.location.hostname;
  if (hostname.includes('ultimate-guitar.com')) return 'ultimate-guitar';
  if (hostname.includes('e-chords.com')) return 'e-chords';
  return null;
}

function isChordPageUrl(): boolean {
  const site = detectSite();
  const path = window.location.pathname;

  if (site === 'ultimate-guitar') {
    // Chord pages look like /tab/artist/song-chords-12345
    return /\/tab\/.+chords/i.test(path);
  }
  if (site === 'e-chords') {
    // E-Chords pages look like /chords/artist/song
    return /^\/chords\/.+\/.+/i.test(path);
  }
  return false;
}

function tryParse(): ParsedSong | null {
  const site = detectSite();
  if (site === 'ultimate-guitar') return parseUltimateGuitar();
  if (site === 'e-chords') return parseEChords();
  return null;
}

function hasChordContent(): boolean {
  // Cheap check for chord markers in the DOM
  return (
    document.querySelector('span[data-name]') !== null ||
    document.querySelector('span[data-chord]') !== null
  );
}

function processPage() {
  // Don't re-process the same URL twice
  if (lastProcessedUrl === window.location.href) return;

  // Only process actual chord pages
  if (!isChordPageUrl()) {
    console.log('[LeadSheet] Not a chord page URL, skipping.');
    return;
  }

  // Skip if reader is already open
  if (isReaderOpen()) return;

  // Skip if user added ?leadsheet=skip to URL
  if (window.location.search.includes('leadsheet=skip')) {
    console.log('[LeadSheet] Skipped (query param).');
    return;
  }

  // Skip if user has dismissed auto-open for this session
  if (sessionStorage.getItem('leadsheet-dismissed') === window.location.href) {
    injectFAB();
    return;
  }

  const song = tryParse();
  if (!song || song.lines.length === 0) {
    // Content not ready yet — observer will retry
    return;
  }

  lastProcessedUrl = window.location.href;
  console.log(`[LeadSheet] Parsed "${song.title}" by ${song.artist} (${song.lines.length} lines) — opening reader`);

  // Auto-open the reader
  openReader(song);

  // Stop observing once we've opened the reader
  stopObserver();
}

function openReader(song: ParsedSong) {
  const fab = document.getElementById('leadsheet-fab');
  if (fab) fab.remove();
  createReaderView(song, { onClose: handleReaderClose });
}

function handleReaderClose() {
  // Remember the user closed it for this URL this session
  sessionStorage.setItem('leadsheet-dismissed', window.location.href);
  injectFAB();
}

function injectFAB() {
  if (document.getElementById('leadsheet-fab')) return;
  const fab = document.createElement('button');
  fab.id = 'leadsheet-fab';
  fab.innerHTML = '♪';
  fab.title = 'Open LeadSheet Reader';
  fab.addEventListener('click', () => {
    // Clear dismissal and open
    sessionStorage.removeItem('leadsheet-dismissed');
    const song = tryParse();
    if (song) openReader(song);
  });
  document.body.appendChild(fab);
}

function startObserver() {
  stopObserver();
  observer = new MutationObserver(() => {
    if (hasChordContent()) {
      processPage();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Also try immediately in case content is already there
  if (hasChordContent()) {
    processPage();
  }
}

function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

function handleUrlChange() {
  // Reset state on navigation
  lastProcessedUrl = null;
  // Give the SPA time to render, then process
  setTimeout(() => startObserver(), 100);
}

/**
 * SPA navigation detection — patches history API and listens for popstate.
 * Necessary because UG uses client-side routing; the content script only
 * loads on initial page load, not on subsequent navigations.
 */
function watchUrlChanges() {
  const origPushState = history.pushState;
  const origReplaceState = history.replaceState;

  history.pushState = function (...args) {
    const result = origPushState.apply(this, args);
    window.dispatchEvent(new Event('leadsheet:urlchange'));
    return result;
  };

  history.replaceState = function (...args) {
    const result = origReplaceState.apply(this, args);
    window.dispatchEvent(new Event('leadsheet:urlchange'));
    return result;
  };

  window.addEventListener('popstate', () => {
    window.dispatchEvent(new Event('leadsheet:urlchange'));
  });

  window.addEventListener('leadsheet:urlchange', handleUrlChange);
}

function init() {
  const site = detectSite();
  if (!site) return;

  console.log(`[LeadSheet] Content script loaded on ${site}`);

  watchUrlChanges();
  startObserver();
}

// Run immediately — content script is injected at document_idle
init();
