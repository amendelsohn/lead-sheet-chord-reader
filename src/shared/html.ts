/**
 * Minimal tagged-template HTML builder.
 *
 * Interpolated values are auto-escaped unless they're themselves HtmlString
 * results from a nested `html` call — that lets you compose fragments
 * without double-escaping.
 *
 * Arrays are joined (so you can map over items and drop the array into a
 * template). `null`, `undefined`, and `false` render as empty strings, which
 * makes conditionals like `${condition && html`<div/>`}` clean.
 *
 *   html`<div class="box">${text}</div>`           // text auto-escaped
 *   html`<ul>${items.map(i => html`<li>${i}</li>`)}</ul>`
 *   html`${showHeader && html`<h1>Title</h1>`}`
 */

const HTML_MARKER = Symbol('html');

export interface HtmlString {
  readonly [HTML_MARKER]: true;
  readonly value: string;
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): HtmlString {
  let result = strings[0];
  for (let i = 0; i < values.length; i++) {
    result += stringify(values[i]);
    result += strings[i + 1];
  }
  return { [HTML_MARKER]: true, value: result };
}

function stringify(val: unknown): string {
  if (val === null || val === undefined || val === false) return '';
  if (Array.isArray(val)) return val.map(stringify).join('');
  if (typeof val === 'object' && (val as HtmlString)[HTML_MARKER] === true) {
    return (val as HtmlString).value;
  }
  return escape(String(val));
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render an HtmlString into a container element, replacing its contents.
 */
export function render(container: Element, tmpl: HtmlString): void {
  container.innerHTML = tmpl.value;
}
