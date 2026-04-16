import { getEl } from './dom';
import { getState, savePreferences } from './state';
import {
  startAutoScroll,
  stopAutoScroll,
  nextSpeedUp,
  nextSpeedDown,
  transposeStep,
} from './scroll';

/**
 * Toolbar: HTML template, event bindings, and responsive overflow menu.
 */

export function buildToolbarHTML(): string {
  return `
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
  `;
}

/**
 * Bind all toolbar button events. The `onChange` callback is invoked after
 * each state change so the caller can re-run applyState.
 */
export function bindToolbarEvents(onChange: () => void, onClose: () => void): void {
  const state = getState();

  // Close
  getEl('ls-close')!.addEventListener('click', onClose);

  // Transpose
  getEl('ls-transpose-down')!.addEventListener('click', () => {
    state.transposeSemitones = transposeStep(state.transposeSemitones, -1);
    onChange();
    savePreferences();
  });
  getEl('ls-transpose-up')!.addEventListener('click', () => {
    state.transposeSemitones = transposeStep(state.transposeSemitones, 1);
    onChange();
    savePreferences();
  });

  // Accidentals — either half toggles
  const toggleAccidentals = () => {
    state.useFlats = !state.useFlats;
    onChange();
    savePreferences();
  };
  getEl('ls-accidental-sharp')!.addEventListener('click', toggleAccidentals);
  getEl('ls-accidental-flat')!.addEventListener('click', toggleAccidentals);

  // Font size
  getEl('ls-font-down')!.addEventListener('click', () => {
    state.fontSize = Math.max(10, state.fontSize - 1);
    onChange();
    savePreferences();
  });
  getEl('ls-font-up')!.addEventListener('click', () => {
    state.fontSize = Math.min(28, state.fontSize + 1);
    onChange();
    savePreferences();
  });

  // Layout — either half toggles
  const toggleLayout = () => {
    state.layout = state.layout === 'vertical' ? 'horizontal' : 'vertical';
    onChange();
    savePreferences();
  };
  getEl('ls-layout-vertical')!.addEventListener('click', toggleLayout);
  getEl('ls-layout-horizontal')!.addEventListener('click', toggleLayout);

  // Auto-scroll
  getEl('ls-scroll-toggle')!.addEventListener('click', () => {
    state.autoScrollActive = !state.autoScrollActive;
    if (state.autoScrollActive) startAutoScroll();
    else stopAutoScroll();
    onChange();
  });
  getEl('ls-scroll-slower')!.addEventListener('click', () => {
    state.autoScrollSpeed = nextSpeedDown(state.autoScrollSpeed);
    onChange();
    savePreferences();
  });
  getEl('ls-scroll-faster')!.addEventListener('click', () => {
    state.autoScrollSpeed = nextSpeedUp(state.autoScrollSpeed);
    onChange();
    savePreferences();
  });

  // Dark mode
  getEl('ls-dark-toggle')!.addEventListener('click', () => {
    state.darkMode = !state.darkMode;
    onChange();
    savePreferences();
  });

  // Overflow menu (hamburger dropdown)
  const overflowToggle = getEl('ls-overflow-toggle')!;
  const overflowPanel = getEl('ls-overflow-panel')!;
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
}

/**
 * Update toolbar button active states and derived display values from the
 * current state. Called from the reader's applyState.
 */
export function syncToolbarToState(): void {
  const state = getState();

  // Metadata column (title/artist is set elsewhere; this is the key/capo/tuning stack)
  const metaEl = getEl('ls-meta');
  if (metaEl) {
    const metaLines: string[] = [];
    if (state.song.key) metaLines.push(`Key: ${escapeHtml(state.song.key)}`);
    if (state.song.capo && state.song.capo > 0) metaLines.push(`Capo: ${state.song.capo}`);
    if (state.song.tuning && !isStandardTuning(state.song.tuning)) {
      metaLines.push(`Tuning: ${escapeHtml(state.song.tuning)}`);
    }
    metaEl.innerHTML = metaLines.map((l) => `<div>${l}</div>`).join('');
  }

  // Scroll speed + disabled state at range limits
  const speedEl = getEl('ls-scroll-speed');
  if (speedEl) speedEl.textContent = state.autoScrollSpeed.toFixed(1);
  const slower = getEl<HTMLButtonElement>('ls-scroll-slower');
  if (slower) slower.disabled = state.autoScrollSpeed <= 0.2;
  const faster = getEl<HTMLButtonElement>('ls-scroll-faster');
  if (faster) faster.disabled = state.autoScrollSpeed >= 3.0;

  // Layout active state
  getEl('ls-layout-vertical')?.classList.toggle('ls-active', state.layout === 'vertical');
  getEl('ls-layout-horizontal')?.classList.toggle('ls-active', state.layout === 'horizontal');

  // Accidental active state
  getEl('ls-accidental-sharp')?.classList.toggle('ls-active', !state.useFlats);
  getEl('ls-accidental-flat')?.classList.toggle('ls-active', state.useFlats);

  // Auto-scroll play/pause glyph
  const scrollToggle = getEl('ls-scroll-toggle');
  if (scrollToggle) {
    scrollToggle.classList.toggle('ls-active', state.autoScrollActive);
    scrollToggle.textContent = state.autoScrollActive ? '⏸' : '▶';
  }

  // Dark mode toggle active state
  getEl('ls-dark-toggle')?.classList.toggle('ls-active', state.darkMode);
}

/**
 * Keep the toolbar on one line. When controls don't fit, move the rightmost
 * control-group into the overflow panel (hamburger dropdown). When there's
 * room again, pull groups back in priority order. data-priority on each
 * group sets the display order (left to right, ascending).
 */
export function updateToolbarOverflow(): void {
  const controls = getEl('ls-toolbar-controls');
  const panel = getEl('ls-overflow-panel');
  const toggle = getEl('ls-overflow-toggle');
  if (!controls || !panel || !toggle) return;

  const allGroups = [
    ...Array.from(controls.querySelectorAll<HTMLElement>('.ls-control-group')),
    ...Array.from(panel.querySelectorAll<HTMLElement>('.ls-control-group')),
  ];
  allGroups.sort((a, b) => getPriority(a) - getPriority(b));
  for (const g of allGroups) controls.appendChild(g);

  while (controls.scrollWidth > controls.clientWidth + 1) {
    const inToolbar = Array.from(
      controls.querySelectorAll<HTMLElement>('.ls-control-group')
    );
    if (inToolbar.length === 0) break;
    const victim = inToolbar[inToolbar.length - 1];
    panel.prepend(victim);
  }

  toggle.style.display = panel.children.length > 0 ? '' : 'none';

  if (panel.children.length === 0) {
    panel.classList.remove('ls-open');
    toggle.classList.remove('ls-active');
  }
}

let toolbarRaf: number | null = null;
export function scheduleToolbarUpdate(): void {
  if (toolbarRaf !== null) return;
  toolbarRaf = requestAnimationFrame(() => {
    toolbarRaf = null;
    updateToolbarOverflow();
  });
}

function getPriority(el: HTMLElement): number {
  return parseInt(el.dataset.priority || '0', 10);
}

function isStandardTuning(tuning: string): boolean {
  return tuning.replace(/\s+/g, '').toUpperCase() === 'EADGBE';
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
