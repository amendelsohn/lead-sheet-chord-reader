/**
 * DOM access helpers.
 *
 * All element lookups inside the reader flow through `getEl` rather than
 * `document.getElementById` directly. That way, when we move the reader
 * into a Shadow DOM root, only this file has to change.
 */

let root: Document | ShadowRoot = document;

export function setRoot(newRoot: Document | ShadowRoot): void {
  root = newRoot;
}

export function getRoot(): Document | ShadowRoot {
  return root;
}

export function getEl<T extends HTMLElement = HTMLElement>(id: string): T | null {
  // ShadowRoot and Document both have getElementById
  return (root as Document).getElementById(id) as T | null;
}
