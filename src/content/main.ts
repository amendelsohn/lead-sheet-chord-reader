import { parseUltimateGuitar } from './parsers/ug';
import { parseEChords } from './parsers/echords';
import { ParsedSong } from './parsers/types';
import { createReaderView } from '../reader/reader';

/**
 * LeadSheet content script entry point.
 * Detects which site we're on, extracts chord data, and injects the reader.
 */
function main() {
  const hostname = window.location.hostname;
  let song: ParsedSong | null = null;

  if (hostname.includes('ultimate-guitar.com')) {
    song = parseUltimateGuitar();
  } else if (hostname.includes('e-chords.com')) {
    song = parseEChords();
  }

  if (!song || song.lines.length === 0) {
    console.log('[LeadSheet] No chord data found on this page.');
    return;
  }

  console.log(`[LeadSheet] Parsed "${song.title}" by ${song.artist} (${song.lines.length} lines)`);

  // Inject the floating action button
  injectFAB(song);
}

function injectFAB(song: ParsedSong) {
  const fab = document.createElement('button');
  fab.id = 'leadsheet-fab';
  fab.innerHTML = '♪';
  fab.title = 'Open LeadSheet Reader';
  fab.addEventListener('click', () => {
    openReader(song);
  });
  document.body.appendChild(fab);
}

function openReader(song: ParsedSong) {
  // Remove FAB
  const fab = document.getElementById('leadsheet-fab');
  if (fab) fab.remove();

  // Create and inject reader overlay
  createReaderView(song);
}

// Wait for page to be fully loaded, then run
if (document.readyState === 'complete') {
  main();
} else {
  window.addEventListener('load', main);
}
