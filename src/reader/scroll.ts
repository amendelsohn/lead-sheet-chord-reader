import { getEl } from './dom';
import { getState } from './state';

/**
 * Auto-scroll, page scroll, and horizontal-mode column separator measurement.
 */

// ---- Auto-scroll ----

export function startAutoScroll(): void {
  const state = getState();

  // Browsers round scrollTop/scrollLeft to integer pixels, so sub-1 speeds
  // would truncate to 0 and never advance. Accumulate the fractional delta
  // across frames and apply whole-pixel steps when it crosses 1.
  let accumulator = 0;

  function scroll() {
    // Re-resolve the content element each frame — the reader may have been
    // closed between frames, in which case getEl returns null.
    const content = getEl('ls-content');
    if (!content) return;
    const s = getState();
    accumulator += s.autoScrollSpeed;
    const whole = Math.floor(accumulator);
    if (whole > 0) {
      if (s.layout === 'horizontal') {
        content.scrollLeft += whole;
      } else {
        content.scrollTop += whole;
      }
      accumulator -= whole;
    }
    if (s.autoScrollActive) {
      s.scrollAnimationId = requestAnimationFrame(scroll);
    }
  }

  state.scrollAnimationId = requestAnimationFrame(scroll);
}

export function stopAutoScroll(): void {
  const state = getState();
  if (state.scrollAnimationId !== null) {
    cancelAnimationFrame(state.scrollAnimationId);
    state.scrollAnimationId = null;
  }
}

// ---- Page scroll (keyboard shortcuts) ----

/**
 * Scroll by one "page" in the direction indicated.
 * Vertical mode: viewport height minus an overlap so the reader sees some
 * context from the previous page.
 * Horizontal mode: exactly one column width + gap.
 */
export function pageScroll(direction: 1 | -1): void {
  const content = getEl('ls-content');
  if (!content) return;

  if (getState().layout === 'horizontal') {
    const columnsEl = getEl('ls-columns');
    const firstChild = columnsEl?.firstElementChild as HTMLElement | null;
    const colWidth = firstChild?.offsetWidth || 420;
    const colGap = 48; // Matches the CSS `gap: 0 48px`
    const step = colWidth + colGap;
    content.scrollBy({ left: direction * step, behavior: 'smooth' });
  } else {
    const overlap = Math.min(80, content.clientHeight * 0.15);
    const step = content.clientHeight - overlap;
    content.scrollBy({ top: direction * step, behavior: 'smooth' });
  }
}

// ---- Column separators (horizontal mode) ----

/**
 * Flexbox has no native column-rule, so we place absolutely-positioned
 * separator divs at x-positions measured from the laid-out flex items.
 */
export function updateColumnSeparators(): void {
  const columnsEl = getEl('ls-columns');
  if (!columnsEl) return;

  columnsEl.querySelectorAll('.ls-col-separator').forEach((el) => el.remove());

  if (getState().layout !== 'horizontal') return;

  const items = Array.from(columnsEl.children).filter(
    (el) => !el.classList.contains('ls-col-separator')
  ) as HTMLElement[];
  if (items.length === 0) return;

  const columnLefts = new Set<number>();
  for (const item of items) columnLefts.add(item.offsetLeft);

  const sortedLefts = [...columnLefts].sort((a, b) => a - b);
  const GAP_HALF = 24; // half of `gap: 0 48px`
  for (let i = 1; i < sortedLefts.length; i++) {
    const sep = document.createElement('div');
    sep.className = 'ls-col-separator';
    sep.style.left = sortedLefts[i] - GAP_HALF + 'px';
    columnsEl.appendChild(sep);
  }
}

// ---- rAF-debounced schedulers ----

let separatorRaf: number | null = null;
export function scheduleSeparatorUpdate(): void {
  if (separatorRaf !== null) return;
  separatorRaf = requestAnimationFrame(() => {
    separatorRaf = null;
    updateColumnSeparators();
  });
}

// ---- Speed / transpose step helpers ----

export const SCROLL_STEP = 0.2;
export const SCROLL_MIN = 0.2;
export const SCROLL_MAX = 3.0;

export function nextSpeedUp(current: number): number {
  return Math.min(SCROLL_MAX, +(current + SCROLL_STEP).toFixed(1));
}

export function nextSpeedDown(current: number): number {
  return Math.max(SCROLL_MIN, +(current - SCROLL_STEP).toFixed(1));
}

/**
 * Step transpose semitones by delta, range -11..+11, wrapping to 0 past
 * the extremes (not to the opposite end).
 */
export function transposeStep(current: number, delta: 1 | -1): number {
  const next = current + delta;
  if (next > 11) return 0;
  if (next < -11) return 0;
  return next;
}
