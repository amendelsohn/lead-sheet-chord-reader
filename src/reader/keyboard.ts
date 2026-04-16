import { getEl } from './dom';
import { getState, savePreferences } from './state';
import { startAutoScroll, stopAutoScroll, pageScroll, transposeStep } from './scroll';

/**
 * Keyboard shortcut handler for the reader. Registered once per open;
 * caller is responsible for calling detachKeyboard on close.
 */

let boundHandler: ((e: KeyboardEvent) => void) | null = null;

export function attachKeyboard(onChange: () => void, onClose: () => void): void {
  if (boundHandler) return;

  boundHandler = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (!getEl('ls-reader')) return;

    const state = getState();

    switch (e.key) {
      case 'Escape':
        onClose();
        break;
      case 'ArrowUp':
        e.preventDefault();
        state.transposeSemitones = transposeStep(state.transposeSemitones, 1);
        onChange();
        savePreferences();
        break;
      case 'ArrowDown':
        e.preventDefault();
        state.transposeSemitones = transposeStep(state.transposeSemitones, -1);
        onChange();
        savePreferences();
        break;
      case '+':
      case '=':
        state.fontSize = Math.min(28, state.fontSize + 1);
        onChange();
        break;
      case '-':
        state.fontSize = Math.max(10, state.fontSize - 1);
        onChange();
        break;
      case 'v':
        state.layout = 'vertical';
        onChange();
        savePreferences();
        break;
      case 'h':
        state.layout = 'horizontal';
        onChange();
        savePreferences();
        break;
      case ' ':
        e.preventDefault();
        state.autoScrollActive = !state.autoScrollActive;
        if (state.autoScrollActive) startAutoScroll();
        else stopAutoScroll();
        onChange();
        break;
      case 'd':
        state.darkMode = !state.darkMode;
        onChange();
        break;
      case 'b':
        state.useFlats = !state.useFlats;
        onChange();
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
  };

  document.addEventListener('keydown', boundHandler);
}

export function detachKeyboard(): void {
  if (boundHandler) {
    document.removeEventListener('keydown', boundHandler);
    boundHandler = null;
  }
}
