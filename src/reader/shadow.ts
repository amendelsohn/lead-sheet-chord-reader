import readerCss from '../content/content.css';
import { setRoot } from './dom';

/**
 * Shadow DOM isolation for the reader UI.
 *
 * The reader (and the floating action button) live inside a closed-style
 * layout container so the host page's CSS can't clobber our styles and our
 * styles can't leak out.
 *
 * Shadow root is created lazily on first access and reused across open/close
 * cycles. A single `<style>` tag holds our CSS, imported as text at build
 * time (esbuild's .css text loader — see build.mjs).
 */

let shadowHost: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;

export function getShadowRoot(): ShadowRoot {
  if (shadowRoot) return shadowRoot;

  shadowHost = document.createElement('div');
  shadowHost.id = 'leadsheet-shadow-host';
  // The host element is the only part of our UI that exists in the host
  // page's layout. Pin it to the viewport so it never perturbs page reflow,
  // and make it pointer-transparent by default — the overlay and FAB inside
  // the shadow root re-enable pointer events as needed.
  Object.assign(shadowHost.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '2147483647',
  });

  shadowRoot = shadowHost.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = readerCss;
  shadowRoot.appendChild(style);

  document.body.appendChild(shadowHost);

  // All reader DOM lookups flow through dom.ts's getEl, which queries
  // whichever root is set here.
  setRoot(shadowRoot);

  return shadowRoot;
}

export function shadowHostElement(): HTMLElement | null {
  return shadowHost;
}
