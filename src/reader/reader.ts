import { ParsedSong } from '../content/parsers/types';
import { transposeChord } from '../shared/transpose';
import { getEl } from './dom';
import { initState, clearState, getState, ReaderOptions } from './state';
import {
  buildToolbarHTML,
  bindToolbarEvents,
  syncToolbarToState,
  updateToolbarOverflow,
  scheduleToolbarUpdate,
} from './toolbar';
import { renderSong } from './song-view';
import {
  stopAutoScroll,
  scheduleSeparatorUpdate,
  updateColumnSeparators,
} from './scroll';
import { attachKeyboard, detachKeyboard } from './keyboard';

export { ReaderOptions } from './state';

export function isReaderOpen(): boolean {
  return document.getElementById('leadsheet-overlay') !== null;
}

export function createReaderView(song: ParsedSong, options: ReaderOptions = {}): void {
  if (isReaderOpen()) return;

  initState(song, options);

  const overlay = document.createElement('div');
  overlay.id = 'leadsheet-overlay';
  overlay.innerHTML = buildOverlayHTML();
  document.body.appendChild(overlay);

  applyState();
  bindToolbarEvents(applyState, closeReader);
  attachKeyboard(applyState, closeReader);

  document.body.style.overflow = 'hidden';

  window.addEventListener('resize', scheduleSeparatorUpdate);
  window.addEventListener('resize', scheduleToolbarUpdate);

  requestAnimationFrame(() => updateToolbarOverflow());
}

/**
 * Update every DOM node that depends on reader state. Called after any state
 * change (toolbar click, keyboard shortcut, async pref load).
 */
function applyState(): void {
  const state = getState();
  const reader = getEl('ls-reader');
  if (!reader) return;

  // Song title / artist
  const titleEl = getEl('ls-title');
  const artistEl = getEl('ls-artist');
  if (titleEl) titleEl.textContent = state.song.title;
  if (artistEl) artistEl.textContent = state.song.artist;

  // Transposed key display (e.g. "+2 (G)")
  const transposeVal = getEl('ls-transpose-value');
  if (transposeVal) {
    const sign = state.transposeSemitones > 0 ? '+' : '';
    let text = sign + state.transposeSemitones;
    if (state.song.key) {
      const newKey = transposeChord(state.song.key, state.transposeSemitones, state.useFlats);
      text += ` (${newKey})`;
    }
    transposeVal.textContent = text;
  }

  // Dark mode, layout, font size, scroll toggle state, etc.
  reader.classList.toggle('ls-dark', state.darkMode);
  reader.classList.toggle('ls-layout-vertical', state.layout === 'vertical');
  reader.classList.toggle('ls-layout-horizontal', state.layout === 'horizontal');

  const columnsEl = getEl('ls-columns');
  if (columnsEl) {
    columnsEl.style.fontSize = state.fontSize + 'px';
    columnsEl.style.columnCount = ''; // clear any stale inline style
    renderSong(columnsEl);
  }

  syncToolbarToState();

  // Column separators re-measure after layout settles
  requestAnimationFrame(() => updateColumnSeparators());
}

function buildOverlayHTML(): string {
  return `
    <div class="ls-reader" id="ls-reader">
      ${buildToolbarHTML()}
      <main class="ls-content" id="ls-content">
        <div class="ls-columns" id="ls-columns"></div>
      </main>
    </div>
  `;
}

function closeReader(): void {
  stopAutoScroll();
  detachKeyboard();
  window.removeEventListener('resize', scheduleSeparatorUpdate);
  window.removeEventListener('resize', scheduleToolbarUpdate);

  const overlay = document.getElementById('leadsheet-overlay');
  if (overlay) overlay.remove();
  document.body.style.overflow = '';

  const onClose = getState().onClose;
  clearState();
  onClose?.();
}
