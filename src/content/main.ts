import { getParserForCurrentSite, SiteParser } from './parsers';
import { ParsedSong } from './parsers/types';
import { createReaderView, forceCloseReader, isReaderOpen } from '../reader/reader';
import { getShadowRoot } from '../reader/shadow';
import { preloadPrefs } from '../shared/storage';

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
let activeParser: SiteParser | null = null;

function isChordPageUrl(): boolean {
  if (!activeParser) return false;
  return activeParser.matchesUrl(new URL(window.location.href));
}

function tryParse(): ParsedSong | null {
  return activeParser ? activeParser.parse() : null;
}

function hasChordContent(): boolean {
  return activeParser ? activeParser.hasChordContent() : false;
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
  const fab = getShadowRoot().getElementById('leadsheet-fab');
  if (fab) fab.remove();
  createReaderView(song, { onClose: handleReaderClose });
}

function handleReaderClose() {
  // Remember the user closed it for this URL this session and clear the
  // dedupe key so a later re-open (via FAB or nav back) can re-process.
  sessionStorage.setItem('leadsheet-dismissed', window.location.href);
  lastProcessedUrl = null;
  injectFAB();
}

// Inline SVG so we don't need web_accessible_resources for an icon asset.
// Matches the extension's action icon (pick + LS) without the outer background
// rect, since the FAB already provides its own background.
const FAB_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" aria-hidden="true" focusable="false">
  <path d="M 64 16 Q 108 16 108 54 Q 108 86 64 114 Q 20 86 20 54 Q 20 16 64 16 Z" fill="#a8a5ff"/>
  <text x="64" y="72" text-anchor="middle" font-family="URW Gothic, Inter, -apple-system, sans-serif" font-weight="700" font-size="52" fill="#1a1838">LS</text>
</svg>`;

function injectFAB() {
  const root = getShadowRoot();
  if (root.getElementById('leadsheet-fab')) return;
  const fab = document.createElement('button');
  fab.id = 'leadsheet-fab';
  fab.innerHTML = FAB_ICON_SVG;
  fab.title = 'Open LeadSheet Reader';
  fab.addEventListener('click', () => {
    // Clear dismissal and open
    sessionStorage.removeItem('leadsheet-dismissed');
    const song = tryParse();
    if (song) openReader(song);
  });
  root.appendChild(fab);
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

let urlChangeTimer: number | null = null;
function handleUrlChange() {
  // A new page almost certainly means a different song. Close any existing
  // reader so the user doesn't see the previous song while the new one loads.
  forceCloseReader();

  lastProcessedUrl = null;

  // Give the SPA time to render, then process. Debounce rapid nav so we
  // don't stack timers on every history push.
  if (urlChangeTimer !== null) clearTimeout(urlChangeTimer);
  urlChangeTimer = window.setTimeout(() => {
    urlChangeTimer = null;
    startObserver();
  }, 100);
}

/**
 * SPA navigation detection — patches history API and listens for popstate.
 * Necessary because UG uses client-side routing; the content script only
 * loads on initial page load, not on subsequent navigations.
 *
 * Guarded against double-invocation — if the content script is re-injected
 * (e.g. BFCache restore) we'd otherwise wrap the history APIs repeatedly
 * and dispatch N events per navigation.
 */
interface LeadSheetWindow extends Window {
  __leadsheet_urlWatch?: boolean;
}
function watchUrlChanges() {
  const w = window as LeadSheetWindow;
  if (w.__leadsheet_urlWatch) {
    // Still bind the handler — a freshly injected script still needs to hear
    // the events, which are dispatched off the already-wrapped history API.
    window.addEventListener('leadsheet:urlchange', handleUrlChange);
    return;
  }
  w.__leadsheet_urlWatch = true;

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
  activeParser = getParserForCurrentSite();
  if (!activeParser) return;

  console.log(`[LeadSheet] Content script loaded on ${activeParser.label}`);

  // Start fetching saved prefs from chrome.storage immediately. By the time
  // the user actually opens the reader, the cache is almost always populated.
  preloadPrefs().catch(() => {});

  watchUrlChanges();
  startObserver();
}

// Run immediately — content script is injected at document_idle
init();
