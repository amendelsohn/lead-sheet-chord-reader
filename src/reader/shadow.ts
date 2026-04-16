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
  // Reset any inherited styling so the host div doesn't itself influence
  // layout of the page. Children inside the shadow root are fully isolated
  // anyway, but the host div still participates in the host page's layout.
  shadowHost.style.all = 'initial';

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
