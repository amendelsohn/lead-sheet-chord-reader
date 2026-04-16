import { ParsedSong, SongLine } from '../content/parsers/types';
import { transposeChord } from '../shared/transpose';

interface ReaderState {
  song: ParsedSong;
  transposeSemitones: number;
  useFlats: boolean;
  columns: number;
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
    useFlats: false,
    columns: 2,
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
        </div>
        <div class="ls-toolbar-center">
          <div class="ls-control-group">
            <span class="ls-label">Transpose</span>
            <button class="ls-btn" id="ls-transpose-down" title="Transpose down">−</button>
            <span class="ls-value" id="ls-transpose-value">0</span>
            <button class="ls-btn" id="ls-transpose-up" title="Transpose up">+</button>
            <button class="ls-btn ls-toggle" id="ls-flats-toggle" title="Toggle sharps/flats">♭</button>
          </div>
          <div class="ls-control-group">
            <span class="ls-label">Font</span>
            <button class="ls-btn" id="ls-font-down" title="Decrease font size">A−</button>
            <button class="ls-btn" id="ls-font-up" title="Increase font size">A+</button>
          </div>
          <div class="ls-control-group">
            <span class="ls-label">Columns</span>
            <button class="ls-btn" id="ls-col-1" title="1 column">1</button>
            <button class="ls-btn" id="ls-col-2" title="2 columns">2</button>
            <button class="ls-btn" id="ls-col-3" title="3 columns">3</button>
          </div>
          <div class="ls-control-group">
            <span class="ls-label">Scroll</span>
            <button class="ls-btn ls-toggle" id="ls-scroll-toggle" title="Auto-scroll">▶</button>
            <button class="ls-btn" id="ls-scroll-slower" title="Slower">−</button>
            <span class="ls-value" id="ls-scroll-speed">0.5</span>
            <button class="ls-btn" id="ls-scroll-faster" title="Faster">+</button>
          </div>
        </div>
        <div class="ls-toolbar-right">
          <div class="ls-meta" id="ls-meta"></div>
          <button class="ls-btn ls-toggle" id="ls-dark-toggle" title="Toggle dark mode">◐</button>
        </div>
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

  // Metadata
  const metaParts: string[] = [];
  if (state.song.key) metaParts.push(`Key: ${state.song.key}`);
  if (state.song.capo) metaParts.push(`Capo: ${state.song.capo}`);
  if (state.song.tuning) metaParts.push(`Tuning: ${state.song.tuning}`);
  metaEl.textContent = metaParts.join(' · ');

  // Transpose value
  const sign = state.transposeSemitones > 0 ? '+' : '';
  transposeVal.textContent = sign + state.transposeSemitones;

  // Scroll speed
  scrollSpeed.textContent = state.autoScrollSpeed.toFixed(1);

  // Dark mode
  reader.classList.toggle('ls-dark', state.darkMode);

  // Font size
  columnsEl.style.fontSize = state.fontSize + 'px';

  // Columns
  columnsEl.style.columnCount = String(state.columns);

  // Active button states
  document.querySelectorAll('#ls-col-1, #ls-col-2, #ls-col-3').forEach(btn => {
    btn.classList.remove('ls-active');
  });
  document.getElementById(`ls-col-${state.columns}`)?.classList.add('ls-active');

  const flatsToggle = document.getElementById('ls-flats-toggle')!;
  flatsToggle.classList.toggle('ls-active', state.useFlats);

  const scrollToggle = document.getElementById('ls-scroll-toggle')!;
  scrollToggle.classList.toggle('ls-active', state.autoScrollActive);
  scrollToggle.textContent = state.autoScrollActive ? '⏸' : '▶';

  const darkToggle = document.getElementById('ls-dark-toggle')!;
  darkToggle.classList.toggle('ls-active', state.darkMode);

  // Render song content
  renderSong(columnsEl);
}

function renderSong(container: HTMLElement) {
  const html: string[] = [];

  for (const line of state.song.lines) {
    switch (line.type) {
      case 'section-header':
        html.push(`<div class="ls-section-header">${escapeHtml(line.label)}</div>`);
        break;
      case 'empty':
        html.push('<div class="ls-empty-line">&nbsp;</div>');
        break;
      case 'chord-line':
        html.push(renderChordLine(line));
        break;
    }
  }

  container.innerHTML = html.join('\n');
}

function renderChordLine(line: { chords: { chord: string; position: number }[]; lyrics: string }): string {
  if (line.chords.length === 0) {
    // Pure lyrics line
    if (line.lyrics.trim() === '') {
      return '<div class="ls-empty-line">&nbsp;</div>';
    }
    return `<div class="ls-lyric-line">${escapeHtml(line.lyrics)}</div>`;
  }

  // Build chord line and lyric line
  // Chords are positioned above lyrics using their character offset
  const chordChars: string[] = new Array(Math.max(line.lyrics.length, getMaxChordEnd(line.chords))).fill(' ');

  for (const cp of line.chords) {
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
  const lyricsStr = line.lyrics;

  if (lyricsStr.trim() === '' || lyricsStr.trim() === chordStr.trim()) {
    // Chord-only line (no distinct lyrics underneath)
    return `<div class="ls-line"><span class="ls-chords">${escapeHtml(chordStr)}</span></div>`;
  }

  return `<div class="ls-line"><span class="ls-chords">${escapeHtml(chordStr)}</span><span class="ls-lyrics">${escapeHtml(lyricsStr)}</span></div>`;
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

  // Transpose
  document.getElementById('ls-transpose-down')!.addEventListener('click', () => {
    state.transposeSemitones = ((state.transposeSemitones - 1) % 12 + 12) % 12;
    if (state.transposeSemitones > 6) state.transposeSemitones -= 12;
    applyState();
    savePreferences();
  });
  document.getElementById('ls-transpose-up')!.addEventListener('click', () => {
    state.transposeSemitones = ((state.transposeSemitones + 1) % 12 + 12) % 12;
    if (state.transposeSemitones > 6) state.transposeSemitones -= 12;
    applyState();
    savePreferences();
  });

  // Flats toggle
  document.getElementById('ls-flats-toggle')!.addEventListener('click', () => {
    state.useFlats = !state.useFlats;
    applyState();
    savePreferences();
  });

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

  // Columns
  document.getElementById('ls-col-1')!.addEventListener('click', () => {
    state.columns = 1;
    applyState();
    savePreferences();
  });
  document.getElementById('ls-col-2')!.addEventListener('click', () => {
    state.columns = 2;
    applyState();
    savePreferences();
  });
  document.getElementById('ls-col-3')!.addEventListener('click', () => {
    state.columns = 3;
    applyState();
    savePreferences();
  });

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
    state.autoScrollSpeed = Math.max(0.1, +(state.autoScrollSpeed - 0.1).toFixed(1));
    applyState();
    savePreferences();
  });
  document.getElementById('ls-scroll-faster')!.addEventListener('click', () => {
    state.autoScrollSpeed = Math.min(3.0, +(state.autoScrollSpeed + 0.1).toFixed(1));
    applyState();
    savePreferences();
  });

  // Dark mode
  document.getElementById('ls-dark-toggle')!.addEventListener('click', () => {
    state.darkMode = !state.darkMode;
    applyState();
    savePreferences();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const overlay = document.getElementById('leadsheet-overlay');
    if (!overlay) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        state.transposeSemitones = ((state.transposeSemitones + 1) % 12 + 12) % 12;
        if (state.transposeSemitones > 6) state.transposeSemitones -= 12;
        applyState();
        break;
      case 'ArrowDown':
        e.preventDefault();
        state.transposeSemitones = ((state.transposeSemitones - 1) % 12 + 12) % 12;
        if (state.transposeSemitones > 6) state.transposeSemitones -= 12;
        applyState();
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
      case '1':
        state.columns = 1;
        applyState();
        break;
      case '2':
        state.columns = 2;
        applyState();
        break;
      case '3':
        state.columns = 3;
        applyState();
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
    }
  });
}

function startAutoScroll() {
  const content = document.getElementById('ls-content')!;

  function scroll() {
    content.scrollTop += state.autoScrollSpeed;
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
  const prefs = {
    fontSize: state.fontSize,
    columns: state.columns,
    darkMode: state.darkMode,
    useFlats: state.useFlats,
    autoScrollSpeed: state.autoScrollSpeed,
  };
  try {
    localStorage.setItem('leadsheet-prefs', JSON.stringify(prefs));
  } catch {
    // localStorage might not be available
  }
}

function loadPreferences() {
  try {
    const saved = localStorage.getItem('leadsheet-prefs');
    if (saved) {
      const prefs = JSON.parse(saved);
      if (prefs.fontSize) state.fontSize = prefs.fontSize;
      if (prefs.columns) state.columns = prefs.columns;
      if (prefs.darkMode !== undefined) state.darkMode = prefs.darkMode;
      if (prefs.useFlats !== undefined) state.useFlats = prefs.useFlats;
      if (prefs.autoScrollSpeed) state.autoScrollSpeed = prefs.autoScrollSpeed;
    }
  } catch {
    // Ignore
  }
}
