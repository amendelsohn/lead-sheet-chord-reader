import { ParsedSong, SongLine } from '../content/parsers/types';
import { transposeChord } from '../shared/transpose';
import { isChordOnlyLine, detectChordsInText } from '../shared/chord-detect';
import { getCachedPrefs, preloadPrefs, savePrefs, Prefs } from '../shared/storage';

type LayoutMode = 'vertical' | 'horizontal';

interface ReaderState {
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

let state: ReaderState;

export interface ReaderOptions {
  onClose?: () => void;
}

export function isReaderOpen(): boolean {
  return document.getElementById('leadsheet-overlay') !== null;
}

export function createReaderView(song: ParsedSong, options: ReaderOptions = {}) {
  // Don't create duplicate reader if one is already open
  if (isReaderOpen()) return;

  state = {
    song,
    transposeSemitones: 0,
    useFlats: true,
    layout: 'vertical' as LayoutMode,
    fontSize: 14,
    darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
    autoScrollSpeed: 0.5,
    autoScrollActive: false,
    scrollAnimationId: null,
    onClose: options.onClose,
  };

  // Load saved preferences
  loadPreferences();

  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'leadsheet-overlay';
  overlay.innerHTML = buildReaderHTML();
  document.body.appendChild(overlay);

  // Apply initial state
  applyState();

  // Bind events
  bindEvents();

  // Prevent body scroll
  document.body.style.overflow = 'hidden';

  // Recompute column separators and toolbar overflow on viewport resize
  window.addEventListener('resize', scheduleSeparatorUpdate);
  window.addEventListener('resize', scheduleToolbarUpdate);

  // Initial toolbar layout measurement happens after first paint
  requestAnimationFrame(() => updateToolbarOverflow());
}

let separatorRaf: number | null = null;
function scheduleSeparatorUpdate() {
  if (separatorRaf !== null) return;
  separatorRaf = requestAnimationFrame(() => {
    separatorRaf = null;
    updateColumnSeparators();
  });
}

let toolbarRaf: number | null = null;
function scheduleToolbarUpdate() {
  if (toolbarRaf !== null) return;
  toolbarRaf = requestAnimationFrame(() => {
    toolbarRaf = null;
    updateToolbarOverflow();
  });
}

/**
 * Keep the toolbar on one line. When controls don't fit, move the lowest-
 * priority control-group into the overflow panel (hamburger dropdown).
 * When there's room again, pull groups back in priority order.
 *
 * data-priority on each group: higher = keep longer. Lowest is first to go.
 */
function updateToolbarOverflow() {
  const controls = document.getElementById('ls-toolbar-controls');
  const panel = document.getElementById('ls-overflow-panel');
  const toggle = document.getElementById('ls-overflow-toggle');
  if (!controls || !panel || !toggle) return;

  // Return all groups to the toolbar in their display order (priority
  // ascending — lowest on the left). When overflow occurs we drop the
  // RIGHTMOST group into the panel first — this matches reading flow
  // (text wraps from the right, not the left).
  const allGroups = [
    ...Array.from(controls.querySelectorAll<HTMLElement>('.ls-control-group')),
    ...Array.from(panel.querySelectorAll<HTMLElement>('.ls-control-group')),
  ];
  allGroups.sort((a, b) => getPriority(a) - getPriority(b));
  for (const g of allGroups) controls.appendChild(g);

  // Demote the rightmost group until the toolbar fits. Prepending to the
  // panel keeps panel order consistent with toolbar display order.
  while (controls.scrollWidth > controls.clientWidth + 1) {
    const inToolbar = Array.from(
      controls.querySelectorAll<HTMLElement>('.ls-control-group')
    );
    if (inToolbar.length === 0) break;
    const victim = inToolbar[inToolbar.length - 1];
    panel.prepend(victim);
  }

  toggle.style.display = panel.children.length > 0 ? '' : 'none';

  // If the panel is empty, also close it (tidy up state)
  if (panel.children.length === 0) {
    panel.classList.remove('ls-open');
    toggle.classList.remove('ls-active');
  }
}

function getPriority(el: HTMLElement): number {
  return parseInt(el.dataset.priority || '0', 10);
}

function isStandardTuning(tuning: string): boolean {
  // Normalize — UG writes "E A D G B E", others may omit spaces
  return tuning.replace(/\s+/g, '').toUpperCase() === 'EADGBE';
}

function buildReaderHTML(): string {
  return `
    <div class="ls-reader" id="ls-reader">
      <header class="ls-toolbar">
        <div class="ls-toolbar-left">
          <button class="ls-btn ls-close" id="ls-close" title="Close reader (Esc)">✕</button>
          <div class="ls-song-info">
            <span class="ls-title" id="ls-title"></span>
            <span class="ls-artist" id="ls-artist"></span>
          </div>
          <div class="ls-meta" id="ls-meta"></div>
        </div>
        <div class="ls-toolbar-center" id="ls-toolbar-controls">
          <div class="ls-control-group" data-priority="1">
            <span class="ls-label">Layout</span>
            <div class="ls-control-row ls-btn-group">
              <button class="ls-btn" id="ls-layout-vertical" title="Vertical — one column, scroll down (v)">↕ Vertical</button>
              <button class="ls-btn" id="ls-layout-horizontal" title="Horizontal — page view, scroll across (h)">↔ Pages</button>
            </div>
          </div>
          <div class="ls-control-group" data-priority="2">
            <span class="ls-label">Font</span>
            <div class="ls-control-row">
              <button class="ls-btn" id="ls-font-down" title="Decrease font size">A−</button>
              <button class="ls-btn" id="ls-font-up" title="Increase font size">A+</button>
            </div>
          </div>
          <div class="ls-control-group" data-priority="3">
            <span class="ls-label">Scroll</span>
            <div class="ls-control-row">
              <button class="ls-btn ls-toggle" id="ls-scroll-toggle" title="Auto-scroll">▶</button>
              <button class="ls-btn" id="ls-scroll-slower" title="Slower">−</button>
              <span class="ls-value" id="ls-scroll-speed">0.5</span>
              <button class="ls-btn" id="ls-scroll-faster" title="Faster">+</button>
            </div>
          </div>
          <div class="ls-control-group" data-priority="4">
            <span class="ls-label">Transpose</span>
            <div class="ls-control-row">
              <button class="ls-btn" id="ls-transpose-down" title="Transpose down">−</button>
              <span class="ls-value" id="ls-transpose-value">0</span>
              <button class="ls-btn" id="ls-transpose-up" title="Transpose up">+</button>
            </div>
          </div>
          <div class="ls-control-group" data-priority="5">
            <span class="ls-label">Accidentals</span>
            <div class="ls-control-row ls-btn-group">
              <button class="ls-btn" id="ls-accidental-sharp" title="Use sharps (C#, F#, ...)">♯</button>
              <button class="ls-btn" id="ls-accidental-flat" title="Use flats (Db, Gb, ...)">♭</button>
            </div>
          </div>
        </div>
        <div class="ls-toolbar-right">
          <button class="ls-btn ls-toggle" id="ls-dark-toggle" title="Toggle dark mode">◐</button>
          <button class="ls-btn" id="ls-overflow-toggle" title="More controls" aria-label="More controls" style="display: none;">☰</button>
        </div>
        <div class="ls-overflow-panel" id="ls-overflow-panel"></div>
      </header>
      <main class="ls-content" id="ls-content">
        <div class="ls-columns" id="ls-columns"></div>
      </main>
    </div>
  `;
}

function applyState() {
  const reader = document.getElementById('ls-reader')!;
  const titleEl = document.getElementById('ls-title')!;
  const artistEl = document.getElementById('ls-artist')!;
  const metaEl = document.getElementById('ls-meta')!;
  const transposeVal = document.getElementById('ls-transpose-value')!;
  const scrollSpeed = document.getElementById('ls-scroll-speed')!;
  const columnsEl = document.getElementById('ls-columns')!;

  // Song info
  titleEl.textContent = state.song.title;
  artistEl.textContent = state.song.artist;

  // Metadata — stacked vertically, one line per field.
  // Hide defaults: capo 0 = no capo, standard EADGBE tuning is implicit.
  const metaLines: string[] = [];
  if (state.song.key) metaLines.push(`Key: ${escapeHtml(state.song.key)}`);
  if (state.song.capo && state.song.capo > 0) {
    metaLines.push(`Capo: ${state.song.capo}`);
  }
  if (state.song.tuning && !isStandardTuning(state.song.tuning)) {
    metaLines.push(`Tuning: ${escapeHtml(state.song.tuning)}`);
  }
  metaEl.innerHTML = metaLines.map(l => `<div>${l}</div>`).join('');

  // Transpose value — number, plus transposed key in parens when we have one
  const sign = state.transposeSemitones > 0 ? '+' : '';
  let transposeText = sign + state.transposeSemitones;
  if (state.song.key) {
    const newKey = transposeChord(state.song.key, state.transposeSemitones, state.useFlats);
    transposeText += ` (${newKey})`;
  }
  transposeVal.textContent = transposeText;

  // Scroll speed
  scrollSpeed.textContent = state.autoScrollSpeed.toFixed(1);
  const slowerBtn = document.getElementById('ls-scroll-slower') as HTMLButtonElement | null;
  if (slowerBtn) slowerBtn.disabled = state.autoScrollSpeed <= 0.2;
  const fasterBtn = document.getElementById('ls-scroll-faster') as HTMLButtonElement | null;
  if (fasterBtn) fasterBtn.disabled = state.autoScrollSpeed >= 3.0;

  // Dark mode
  reader.classList.toggle('ls-dark', state.darkMode);

  // Font size
  columnsEl.style.fontSize = state.fontSize + 'px';

  // Layout mode — clear inline column-count left over from old behavior
  columnsEl.style.columnCount = '';
  reader.classList.toggle('ls-layout-vertical', state.layout === 'vertical');
  reader.classList.toggle('ls-layout-horizontal', state.layout === 'horizontal');

  document.getElementById('ls-layout-vertical')?.classList.toggle('ls-active', state.layout === 'vertical');
  document.getElementById('ls-layout-horizontal')?.classList.toggle('ls-active', state.layout === 'horizontal');

  // Accidental buttons: highlight whichever matches the current mode
  document.getElementById('ls-accidental-sharp')?.classList.toggle('ls-active', !state.useFlats);
  document.getElementById('ls-accidental-flat')?.classList.toggle('ls-active', state.useFlats);

  const scrollToggle = document.getElementById('ls-scroll-toggle')!;
  scrollToggle.classList.toggle('ls-active', state.autoScrollActive);
  scrollToggle.textContent = state.autoScrollActive ? '⏸' : '▶';

  const darkToggle = document.getElementById('ls-dark-toggle')!;
  darkToggle.classList.toggle('ls-active', state.darkMode);

  // Render song content
  renderSong(columnsEl);

  // After content renders, draw column separators (horizontal mode only).
  // rAF so measurement sees the post-layout positions.
  requestAnimationFrame(() => updateColumnSeparators());
}

/**
 * Flexbox has no native column-rule equivalent. We render separators as
 * absolutely-positioned elements at x-positions measured from the DOM after
 * layout. Each distinct left offset among flex items marks a column start;
 * we draw a separator just before each column except the first.
 */
function updateColumnSeparators() {
  const columnsEl = document.getElementById('ls-columns');
  if (!columnsEl) return;

  // Clear any previous separators
  columnsEl.querySelectorAll('.ls-col-separator').forEach(el => el.remove());

  if (state.layout !== 'horizontal') return;

  const items = Array.from(columnsEl.children).filter(
    el => !el.classList.contains('ls-col-separator')
  ) as HTMLElement[];
  if (items.length === 0) return;

  // Collect each unique column's left offset (start of the track)
  const columnLefts = new Set<number>();
  for (const item of items) {
    columnLefts.add(item.offsetLeft);
  }

  const sortedLefts = [...columnLefts].sort((a, b) => a - b);
  // gap: 0 48px — separator sits 24px to the left of each column start
  // (i.e., centered in the gap between this column and the previous one)
  const GAP_HALF = 24;
  for (let i = 1; i < sortedLefts.length; i++) {
    const sep = document.createElement('div');
    sep.className = 'ls-col-separator';
    sep.style.left = (sortedLefts[i] - GAP_HALF) + 'px';
    columnsEl.appendChild(sep);
  }
}

function renderSong(container: HTMLElement) {
  const html: string[] = [];
  const lines = state.song.lines;

  /**
   * In horizontal (page) mode, the flex column-wrap layout treats each direct
   * child as an atomic unit — it can't split a child across columns. So we
   * group each chord line with its following lyric line(s) into one wrapper
   * div. That keeps chords visually attached to the words they belong to.
   * (In vertical mode this grouping has no visible effect.)
   */
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.type === 'section-header') {
      html.push(`<div class="ls-section-header">${escapeHtml(line.label)}</div>`);
      i++;
      continue;
    }

    if (line.type === 'empty') {
      html.push('<div class="ls-empty-line">&nbsp;</div>');
      i++;
      continue;
    }

    // chord-line: if it carries chords (explicit or detectable), start a group
    // that also absorbs the immediately-following lyric-only chord-lines
    const hasChords = line.chords.length > 0 || isChordOnlyLine(line.lyrics);
    if (hasChords) {
      const group: string[] = [renderChordLine(line)];
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j];
        if (next.type !== 'chord-line') break;
        if (next.chords.length > 0 || isChordOnlyLine(next.lyrics)) break;
        group.push(renderChordLine(next));
        j++;
      }
      if (group.length > 1) {
        html.push(`<div class="ls-group">${group.join('')}</div>`);
      } else {
        html.push(group[0]);
      }
      i = j;
    } else {
      html.push(renderChordLine(line));
      i++;
    }
  }

  container.innerHTML = html.join('\n');
}

function renderChordLine(line: { chords: { chord: string; position: number }[]; lyrics: string }): string {
  // Heuristic: if the line has no detected chord spans but the plain text looks
  // like a chord-only line (e.g., "F    Am    Bb    C"), treat it as chords.
  // This handles tabs where the author didn't wrap chord names in [ch] tags.
  let effectiveChords = line.chords;
  let effectiveLyrics = line.lyrics;
  if (line.chords.length === 0 && isChordOnlyLine(line.lyrics)) {
    effectiveChords = detectChordsInText(line.lyrics);
    effectiveLyrics = ''; // No separate lyrics underneath — it's a chord-only line
  }

  if (effectiveChords.length === 0) {
    // Pure lyrics line
    if (line.lyrics.trim() === '') {
      return '<div class="ls-empty-line">&nbsp;</div>';
    }
    return `<div class="ls-lyric-line">${escapeHtml(line.lyrics)}</div>`;
  }

  // Build chord line and lyric line
  // Chords are positioned above lyrics using their character offset
  const chordChars: string[] = new Array(Math.max(effectiveLyrics.length, getMaxChordEnd(effectiveChords))).fill(' ');

  for (const cp of effectiveChords) {
    const transposed = transposeChord(cp.chord, state.transposeSemitones, state.useFlats);
    for (let i = 0; i < transposed.length; i++) {
      if (cp.position + i < chordChars.length) {
        chordChars[cp.position + i] = transposed[i];
      } else {
        chordChars.push(transposed[i]);
      }
    }
  }

  const chordStr = chordChars.join('').trimEnd();
  const lyricsStr = effectiveLyrics;

  // Chord-only line: the raw lyrics consist entirely of chord tokens and
  // whitespace. Render just the transposed chord line. (Can't compare
  // chordStr to lyricsStr directly — when we transpose or flip accidentals,
  // the transposed names will legitimately differ from the raw text.)
  if (lyricsStr.trim() === '' || isEntirelyCoveredByChords(lyricsStr, effectiveChords)) {
    return `<div class="ls-line"><span class="ls-chords">${escapeHtml(chordStr)}</span></div>`;
  }

  return `<div class="ls-line"><span class="ls-chords">${escapeHtml(chordStr)}</span><span class="ls-lyrics">${escapeHtml(lyricsStr)}</span></div>`;
}

/**
 * Returns true if every non-whitespace character in `text` falls within the
 * bounds of one of the given chord tokens (using each chord's ORIGINAL name
 * at its recorded position). Used to detect chord-only lines — where the
 * plain text is just chord names separated by spaces — so we don't render a
 * stale "lyrics" line below the transposed chord line.
 */
function isEntirelyCoveredByChords(
  text: string,
  chords: { chord: string; position: number }[]
): boolean {
  if (chords.length === 0) return false;
  const covered = new Array(text.length).fill(false);
  for (const cp of chords) {
    for (let i = 0; i < cp.chord.length; i++) {
      const idx = cp.position + i;
      if (idx >= 0 && idx < text.length) covered[idx] = true;
    }
  }
  for (let i = 0; i < text.length; i++) {
    if (!/\s/.test(text[i]) && !covered[i]) return false;
  }
  return true;
}

function getMaxChordEnd(chords: { chord: string; position: number }[]): number {
  let max = 0;
  for (const c of chords) {
    max = Math.max(max, c.position + c.chord.length);
  }
  return max;
}

function bindEvents() {
  // Close
  document.getElementById('ls-close')!.addEventListener('click', closeReader);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeReader();
  });

  // Transpose — range -11..+11, wrap to 0 past the extremes
  document.getElementById('ls-transpose-down')!.addEventListener('click', () => {
    state.transposeSemitones = transposeStep(state.transposeSemitones, -1);
    applyState();
    savePreferences();
  });
  document.getElementById('ls-transpose-up')!.addEventListener('click', () => {
    state.transposeSemitones = transposeStep(state.transposeSemitones, 1);
    applyState();
    savePreferences();
  });

  // Accidentals (sharps / flats) — either half toggles the state
  const toggleAccidentals = () => {
    state.useFlats = !state.useFlats;
    applyState();
    savePreferences();
  };
  document.getElementById('ls-accidental-sharp')!.addEventListener('click', toggleAccidentals);
  document.getElementById('ls-accidental-flat')!.addEventListener('click', toggleAccidentals);

  // Font size
  document.getElementById('ls-font-down')!.addEventListener('click', () => {
    state.fontSize = Math.max(10, state.fontSize - 1);
    applyState();
    savePreferences();
  });
  document.getElementById('ls-font-up')!.addEventListener('click', () => {
    state.fontSize = Math.min(28, state.fontSize + 1);
    applyState();
    savePreferences();
  });

  // Layout — either half toggles the state
  const toggleLayout = () => {
    state.layout = state.layout === 'vertical' ? 'horizontal' : 'vertical';
    applyState();
    savePreferences();
  };
  document.getElementById('ls-layout-vertical')!.addEventListener('click', toggleLayout);
  document.getElementById('ls-layout-horizontal')!.addEventListener('click', toggleLayout);

  // Auto-scroll
  document.getElementById('ls-scroll-toggle')!.addEventListener('click', () => {
    state.autoScrollActive = !state.autoScrollActive;
    if (state.autoScrollActive) {
      startAutoScroll();
    } else {
      stopAutoScroll();
    }
    applyState();
  });
  document.getElementById('ls-scroll-slower')!.addEventListener('click', () => {
    state.autoScrollSpeed = nextSpeedDown(state.autoScrollSpeed);
    applyState();
    savePreferences();
  });
  document.getElementById('ls-scroll-faster')!.addEventListener('click', () => {
    state.autoScrollSpeed = nextSpeedUp(state.autoScrollSpeed);
    applyState();
    savePreferences();
  });

  // Dark mode
  document.getElementById('ls-dark-toggle')!.addEventListener('click', () => {
    state.darkMode = !state.darkMode;
    applyState();
    savePreferences();
  });

  // Overflow menu (hamburger)
  const overflowToggle = document.getElementById('ls-overflow-toggle')!;
  const overflowPanel = document.getElementById('ls-overflow-panel')!;
  overflowToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = overflowPanel.classList.toggle('ls-open');
    overflowToggle.classList.toggle('ls-active', open);
  });
  document.addEventListener('click', (e) => {
    if (!overflowPanel.classList.contains('ls-open')) return;
    if (overflowPanel.contains(e.target as Node)) return;
    if (overflowToggle.contains(e.target as Node)) return;
    overflowPanel.classList.remove('ls-open');
    overflowToggle.classList.remove('ls-active');
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const overlay = document.getElementById('leadsheet-overlay');
    if (!overlay) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        state.transposeSemitones = transposeStep(state.transposeSemitones, 1);
        applyState();
        savePreferences();
        break;
      case 'ArrowDown':
        e.preventDefault();
        state.transposeSemitones = transposeStep(state.transposeSemitones, -1);
        applyState();
        savePreferences();
        break;
      case '+':
      case '=':
        state.fontSize = Math.min(28, state.fontSize + 1);
        applyState();
        break;
      case '-':
        state.fontSize = Math.max(10, state.fontSize - 1);
        applyState();
        break;
      case 'v':
        state.layout = 'vertical';
        applyState();
        savePreferences();
        break;
      case 'h':
        state.layout = 'horizontal';
        applyState();
        savePreferences();
        break;
      case ' ':
        e.preventDefault();
        state.autoScrollActive = !state.autoScrollActive;
        if (state.autoScrollActive) startAutoScroll();
        else stopAutoScroll();
        applyState();
        break;
      case 'd':
        state.darkMode = !state.darkMode;
        applyState();
        break;
      case 'b':
        state.useFlats = !state.useFlats;
        applyState();
        break;
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault();
        pageScroll(-1);
        break;
      case 'ArrowRight':
      case 'PageDown':
        e.preventDefault();
        pageScroll(1);
        break;
    }
  });
}

/**
 * Scroll by one "page" in the direction indicated (+1 forward, -1 back).
 * Vertical mode: by viewport height minus overlap, so the reader sees a few
 * lines of context from the previous page.
 * Horizontal mode: by exactly one column width + gap (jump between pages).
 */
const SCROLL_STEP = 0.2;
const SCROLL_MIN = 0.2;
const SCROLL_MAX = 3.0;

function nextSpeedUp(current: number): number {
  return Math.min(SCROLL_MAX, +(current + SCROLL_STEP).toFixed(1));
}

function nextSpeedDown(current: number): number {
  return Math.max(SCROLL_MIN, +(current - SCROLL_STEP).toFixed(1));
}

/**
 * Step transpose semitones by delta, with the range -11..+11.
 * Past the extremes, wrap to 0 (not to the opposite end) — so the user sees
 * "no transpose" between each 11-step lap through the keys.
 */
function transposeStep(current: number, delta: 1 | -1): number {
  const next = current + delta;
  if (next > 11) return 0;
  if (next < -11) return 0;
  return next;
}

function pageScroll(direction: 1 | -1) {
  const content = document.getElementById('ls-content');
  if (!content) return;

  if (state.layout === 'horizontal') {
    // Measure actual column width from the first child of the flex container
    const columnsEl = document.getElementById('ls-columns');
    const firstChild = columnsEl?.firstElementChild as HTMLElement | null;
    const colWidth = firstChild?.offsetWidth || 420;
    const colGap = 48; // Matches the CSS `gap: 0 48px`
    const step = colWidth + colGap;
    content.scrollBy({ left: direction * step, behavior: 'smooth' });
  } else {
    // Vertical: one viewport height minus an overlap so the user keeps
    // some context from the previous page
    const overlap = Math.min(80, content.clientHeight * 0.15);
    const step = content.clientHeight - overlap;
    content.scrollBy({ top: direction * step, behavior: 'smooth' });
  }
}

function startAutoScroll() {
  const content = document.getElementById('ls-content')!;
  // Browsers round scrollTop/scrollLeft to integer pixels, so sub-1 speeds
  // get truncated to 0 and never advance. Accumulate fractional delta between
  // frames and apply whole-pixel steps when the accumulator crosses 1.
  let accumulator = 0;

  function scroll() {
    accumulator += state.autoScrollSpeed;
    const whole = Math.floor(accumulator);
    if (whole > 0) {
      if (state.layout === 'horizontal') {
        content.scrollLeft += whole;
      } else {
        content.scrollTop += whole;
      }
      accumulator -= whole;
    }
    if (state.autoScrollActive) {
      state.scrollAnimationId = requestAnimationFrame(scroll);
    }
  }

  state.scrollAnimationId = requestAnimationFrame(scroll);
}

function stopAutoScroll() {
  if (state.scrollAnimationId !== null) {
    cancelAnimationFrame(state.scrollAnimationId);
    state.scrollAnimationId = null;
  }
}

function closeReader() {
  stopAutoScroll();
  window.removeEventListener('resize', scheduleSeparatorUpdate);
  const overlay = document.getElementById('leadsheet-overlay');
  if (overlay) overlay.remove();
  document.body.style.overflow = '';

  // Let the caller (main.ts) handle what happens after close
  if (state.onClose) {
    state.onClose();
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function savePreferences() {
  savePrefs({
    fontSize: state.fontSize,
    layout: state.layout,
    darkMode: state.darkMode,
    useFlats: state.useFlats,
    autoScrollSpeed: state.autoScrollSpeed,
  });
}

function applyPrefs(prefs: Prefs) {
  if (prefs.fontSize) state.fontSize = prefs.fontSize;
  if (prefs.layout === 'vertical' || prefs.layout === 'horizontal') state.layout = prefs.layout;
  if (prefs.darkMode !== undefined) state.darkMode = prefs.darkMode;
  if (prefs.useFlats !== undefined) state.useFlats = prefs.useFlats;
  if (prefs.autoScrollSpeed) state.autoScrollSpeed = prefs.autoScrollSpeed;
}

function loadPreferences() {
  // Preferred path: prefs are already cached from the content-script preload.
  const cached = getCachedPrefs();
  if (cached) {
    applyPrefs(cached);
    return;
  }
  // Fallback: preload didn't finish yet (rare). Start defaults now, then
  // re-apply + re-render once prefs arrive.
  preloadPrefs().then((prefs) => {
    applyPrefs(prefs);
    applyState();
  });
}
