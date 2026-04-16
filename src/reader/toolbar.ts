import { getEl } from './dom';
import { getState, savePreferences, ChordDisplay } from './state';
import {
  startAutoScroll,
  stopAutoScroll,
  nextSpeedUp,
  nextSpeedDown,
  transposeStep,
  SCROLL_MIN,
  SCROLL_MAX,
} from './scroll';
import { html, HtmlString } from '../shared/html';
import { Key, Mode } from '../shared/key-infer';

/**
 * Toolbar: HTML template, event bindings, and responsive overflow menu.
 */

export function buildToolbarHTML(): HtmlString {
  return html`
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
        <div class="ls-control-group" data-priority="7">
          <span class="ls-label">Display</span>
          <div class="ls-control-row ls-btn-group">
            <button class="ls-btn" id="ls-display-letter" title="Letter names (C, G, Am)">ABC</button>
            <button class="ls-btn" id="ls-display-roman" title="Roman numerals (I, V, vi)">Roman</button>
            <button class="ls-btn" id="ls-display-nashville" title="Nashville numbers (1, 5, 6m)">1-2-3</button>
          </div>
        </div>
        <div class="ls-control-group" data-priority="8" id="ls-key-group">
          <span class="ls-label">Degree key</span>
          <div class="ls-control-row">
            <select class="ls-select" id="ls-key-select" title="Key used for scale-degree display"></select>
          </div>
        </div>
        <div class="ls-control-group" data-priority="9">
          <span class="ls-label">Theme</span>
          <div class="ls-control-row ls-btn-group">
            <button class="ls-btn" id="ls-theme-light" title="Light theme">☀</button>
            <button class="ls-btn" id="ls-theme-dark" title="Dark theme">☾</button>
          </div>
        </div>
      </div>
      <div class="ls-toolbar-right">
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

  // Theme — either half toggles
  const toggleTheme = () => {
    state.darkMode = !state.darkMode;
    onChange();
    savePreferences();
  };
  getEl('ls-theme-light')!.addEventListener('click', toggleTheme);
  getEl('ls-theme-dark')!.addEventListener('click', toggleTheme);

  // Display mode (letter / roman / nashville)
  const setDisplay = (mode: ChordDisplay) => {
    state.chordDisplay = mode;
    onChange();
    savePreferences();
  };
  getEl('ls-display-letter')!.addEventListener('click', () => setDisplay('letter'));
  getEl('ls-display-roman')!.addEventListener('click', () => setDisplay('roman'));
  getEl('ls-display-nashville')!.addEventListener('click', () => setDisplay('nashville'));

  // Key override select
  populateKeySelect();
  const keySelect = getEl<HTMLSelectElement>('ls-key-select')!;
  keySelect.addEventListener('change', () => {
    const value = keySelect.value;
    if (value === 'auto') {
      state.manualKey = null;
    } else {
      state.manualKey = parseSelectValue(value);
    }
    onChange();
  });

  // Overflow menu (hamburger dropdown)
  const overflowToggle = getEl('ls-overflow-toggle')!;
  const overflowPanel = getEl('ls-overflow-panel')!;
  overflowToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = overflowPanel.classList.toggle('ls-open');
    overflowToggle.classList.toggle('ls-active', open);
  });
  // Outside-click close. composedPath() crosses shadow-DOM boundaries so
  // the check works whether the click hit our shadow content (retargeted
  // at the shadow host from document's perspective) or the host page.
  outsideClickHandler = (e: MouseEvent) => {
    if (!overflowPanel.classList.contains('ls-open')) return;
    const path = e.composedPath();
    if (path.includes(overflowPanel)) return;
    if (path.includes(overflowToggle)) return;
    overflowPanel.classList.remove('ls-open');
    overflowToggle.classList.remove('ls-active');
  };
  document.addEventListener('click', outsideClickHandler);
}

let outsideClickHandler: ((e: MouseEvent) => void) | null = null;

/** Remove document-level listeners registered by bindToolbarEvents. */
export function unbindToolbarEvents(): void {
  if (outsideClickHandler) {
    document.removeEventListener('click', outsideClickHandler);
    outsideClickHandler = null;
  }
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
    const lines: HtmlString[] = [];
    if (state.song.key) lines.push(html`<div>Key: ${state.song.key}</div>`);
    if (state.song.capo && state.song.capo > 0) lines.push(html`<div>Capo: ${state.song.capo}</div>`);
    if (state.song.tuning && !isStandardTuning(state.song.tuning)) {
      lines.push(html`<div>Tuning: ${state.song.tuning}</div>`);
    }
    metaEl.innerHTML = html`${lines}`.value;
  }

  // Scroll speed + disabled state at range limits
  const speedEl = getEl('ls-scroll-speed');
  if (speedEl) speedEl.textContent = state.autoScrollSpeed.toFixed(1);
  const slower = getEl<HTMLButtonElement>('ls-scroll-slower');
  if (slower) slower.disabled = state.autoScrollSpeed <= SCROLL_MIN;
  const faster = getEl<HTMLButtonElement>('ls-scroll-faster');
  if (faster) faster.disabled = state.autoScrollSpeed >= SCROLL_MAX;

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

  // Theme toggle active state
  getEl('ls-theme-light')?.classList.toggle('ls-active', !state.darkMode);
  getEl('ls-theme-dark')?.classList.toggle('ls-active', state.darkMode);

  // Display-mode active state
  getEl('ls-display-letter')?.classList.toggle('ls-active', state.chordDisplay === 'letter');
  getEl('ls-display-roman')?.classList.toggle('ls-active', state.chordDisplay === 'roman');
  getEl('ls-display-nashville')?.classList.toggle('ls-active', state.chordDisplay === 'nashville');

  // Key select: shown/hidden based on display mode; reflects effective key
  const keyGroup = getEl('ls-key-group');
  const wasHidden = keyGroup?.style.display === 'none';
  const shouldHide = state.chordDisplay === 'letter';
  if (keyGroup) keyGroup.style.display = shouldHide ? 'none' : '';
  const keySelect = getEl<HTMLSelectElement>('ls-key-select');
  if (keySelect) {
    keySelect.value = state.manualKey ? keyToSelectValue(state.manualKey) : 'auto';
    // Refresh 'auto' label so it reflects the current inferred key.
    const autoOption = keySelect.querySelector<HTMLOptionElement>('option[value="auto"]');
    if (autoOption) {
      autoOption.textContent = state.inferredKey
        ? `Auto (${formatKey(state.inferredKey)})`
        : 'Auto (unknown)';
    }
  }

  // Visibility of the key group changed — re-run overflow so we don't leave
  // the toolbar silently overflowing its container.
  if (wasHidden !== shouldHide) scheduleToolbarUpdate();
}

const TONICS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

function formatKey(k: Key): string {
  return k.mode === 'minor' ? `${k.tonic} minor` : `${k.tonic} major`;
}

function keyToSelectValue(k: Key): string {
  return `${k.tonic}-${k.mode}`;
}

function parseSelectValue(v: string): Key | null {
  const m = v.match(/^([A-G][#b]?)-(major|minor)$/);
  if (!m) return null;
  return { tonic: m[1], mode: m[2] as Mode };
}

function populateKeySelect(): void {
  const sel = getEl<HTMLSelectElement>('ls-key-select');
  if (!sel) return;
  const makeOpt = (value: string, label: string) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    return opt;
  };
  sel.replaceChildren();
  sel.appendChild(makeOpt('auto', 'Auto'));
  for (const tonic of TONICS) sel.appendChild(makeOpt(`${tonic}-major`, `${tonic} major`));
  for (const tonic of TONICS) sel.appendChild(makeOpt(`${tonic}-minor`, `${tonic} minor`));
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
