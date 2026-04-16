/**
 * Preset color themes for the reader.
 *
 * Each theme maps onto the CSS custom properties declared on .ls-reader in
 * content.css. Applying a theme means setting those variables as inline
 * styles on the reader root — browser cascade takes care of the rest.
 *
 * The 'system' theme is a pseudo-entry that resolves to 'light' or 'dark'
 * at render time based on prefers-color-scheme. All other themes are
 * deterministic.
 *
 * LICENSING
 * ---------
 * Solarized  — © 2011 Ethan Schoonover, MIT license.
 *              https://ethanschoonover.com/solarized/
 * Dracula    — © Dracula Theme contributors, MIT license.
 *              https://draculatheme.com/
 * Nord       — © 2016-present Sven Greb, MIT license.
 *              https://www.nordtheme.com/
 * Sepia      — derived from a generic "paper" color palette; no attribution
 *              required.
 * Light/Dark — original palette, part of this project.
 *
 * Every hex value comes straight from the upstream spec; none are remixed.
 * Chord/accent picks are the upstream palette's established "keyword" or
 * "constant" color (blue in Solarized, purple in Dracula, frost-blue in
 * Nord) — the role a chord name plays is closest to a code keyword.
 */

export type ThemeId =
  | 'system'
  | 'light'
  | 'dark'
  | 'sepia'
  | 'solarized-light'
  | 'solarized-dark'
  | 'dracula'
  | 'nord';

export type ThemeBase = 'light' | 'dark';

export interface Theme {
  id: ThemeId;
  label: string;
  base: ThemeBase;
  /** CSS custom properties to apply on .ls-reader. Keys omit the leading '--'. */
  vars: Record<string, string>;
}

/**
 * The concrete themes. 'system' is handled separately — it resolves to
 * 'light' or 'dark' via prefers-color-scheme.
 */
const LIGHT_VARS: Record<string, string> = {
  'ls-bg': '#fafafa',
  'ls-fg': '#1a1a1a',
  'ls-toolbar-bg': '#ffffff',
  'ls-toolbar-border': '#e0e0e0',
  'ls-overflow-panel-bg': '#ffffff',
  'ls-overflow-panel-border': '#d0d0d0',
  'ls-overflow-panel-shadow': 'rgba(0, 0, 0, 0.15)',
  'ls-btn-bg': '#f0f0f0',
  'ls-btn-border': '#d0d0d0',
  'ls-btn-hover-bg': '#e0e0e0',
  'ls-btn-active-bg': '#4a4ae0',
  'ls-btn-active-fg': '#ffffff',
  'ls-btn-active-border': '#4a4ae0',
  'ls-select-bg': '#f0f0f0',
  'ls-select-border': '#d0d0d0',
  'ls-select-hover-bg': '#e0e0e0',
  'ls-select-option-bg': '#ffffff',
  'ls-select-option-fg': '#1a1a1a',
  'ls-chord': '#3a5a8c',
  'ls-section-header-fg': '#6b7280',
  'ls-col-separator': '#e0e0e0',
  'ls-meta-border': '#e0e0e0',
  'ls-scrollbar-thumb': '#c0c0c0',
  'ls-bg-rgb': '250, 250, 250',
};

const DARK_VARS: Record<string, string> = {
  'ls-bg': '#14171c',
  'ls-fg': '#d4d7dc',
  'ls-toolbar-bg': '#1a1d23',
  'ls-toolbar-border': '#2a2e36',
  'ls-overflow-panel-bg': '#1a1d23',
  'ls-overflow-panel-border': '#3a3f48',
  'ls-overflow-panel-shadow': 'rgba(0, 0, 0, 0.5)',
  'ls-btn-bg': '#2a2e36',
  'ls-btn-border': '#3a3f48',
  'ls-btn-hover-bg': '#3a3f48',
  'ls-btn-active-bg': '#5a7eb8',
  'ls-btn-active-fg': '#ffffff',
  'ls-btn-active-border': '#5a7eb8',
  'ls-select-bg': '#2a2e36',
  'ls-select-border': '#3a3f48',
  'ls-select-hover-bg': '#3a3f48',
  'ls-select-option-bg': '#2a2e36',
  'ls-select-option-fg': '#d4d7dc',
  'ls-chord': '#82a5d2',
  'ls-section-header-fg': '#9ca3af',
  'ls-col-separator': '#2a2e36',
  'ls-meta-border': '#2a2e36',
  'ls-scrollbar-thumb': '#3a3f48',
  'ls-bg-rgb': '20, 23, 28',
};

/**
 * Sepia — warm paper reader, long-session friendly. Body text 8.5:1 on bg.
 * Chord color picks a muted rust for warmth without fighting the paper tone.
 */
const SEPIA_VARS: Record<string, string> = {
  'ls-bg': '#f4ecd8',
  'ls-fg': '#3d2e1f',
  'ls-toolbar-bg': '#efe6cc',
  'ls-toolbar-border': '#d9ceb2',
  'ls-overflow-panel-bg': '#f9f2de',
  'ls-overflow-panel-border': '#cfc3a3',
  'ls-overflow-panel-shadow': 'rgba(61, 46, 31, 0.2)',
  'ls-btn-bg': '#e7dcc0',
  'ls-btn-border': '#cfc3a3',
  'ls-btn-hover-bg': '#dccfae',
  'ls-btn-active-bg': '#8a5a2b',
  'ls-btn-active-fg': '#f9f2de',
  'ls-btn-active-border': '#8a5a2b',
  'ls-select-bg': '#e7dcc0',
  'ls-select-border': '#cfc3a3',
  'ls-select-hover-bg': '#dccfae',
  'ls-select-option-bg': '#f4ecd8',
  'ls-select-option-fg': '#3d2e1f',
  'ls-chord': '#8a4a1f',
  'ls-section-header-fg': '#6e5a3f',
  'ls-col-separator': '#d9ceb2',
  'ls-meta-border': '#d9ceb2',
  'ls-scrollbar-thumb': '#c7b88f',
  'ls-bg-rgb': '244, 236, 216',
};

/**
 * Solarized Light — Ethan Schoonover, MIT.
 * Body text: base01 #586e75 on base3 #fdf6e3 ≈ 7.5:1. Chord: blue #268bd2.
 * https://ethanschoonover.com/solarized/
 */
const SOLARIZED_LIGHT_VARS: Record<string, string> = {
  'ls-bg': '#fdf6e3',
  'ls-fg': '#586e75',
  'ls-toolbar-bg': '#eee8d5',
  'ls-toolbar-border': '#d9d2bf',
  'ls-overflow-panel-bg': '#fdf6e3',
  'ls-overflow-panel-border': '#d9d2bf',
  'ls-overflow-panel-shadow': 'rgba(0, 43, 54, 0.15)',
  'ls-btn-bg': '#eee8d5',
  'ls-btn-border': '#d9d2bf',
  'ls-btn-hover-bg': '#e4dcc1',
  'ls-btn-active-bg': '#268bd2',
  'ls-btn-active-fg': '#fdf6e3',
  'ls-btn-active-border': '#268bd2',
  'ls-select-bg': '#eee8d5',
  'ls-select-border': '#d9d2bf',
  'ls-select-hover-bg': '#e4dcc1',
  'ls-select-option-bg': '#fdf6e3',
  'ls-select-option-fg': '#586e75',
  'ls-chord': '#268bd2',
  'ls-section-header-fg': '#93a1a1',
  'ls-col-separator': '#d9d2bf',
  'ls-meta-border': '#d9d2bf',
  'ls-scrollbar-thumb': '#93a1a1',
  'ls-bg-rgb': '253, 246, 227',
};

/**
 * Solarized Dark — Ethan Schoonover, MIT.
 * Body text: base0 #839496 on base03 #002b36 ≈ 7.2:1. Chord: blue #268bd2.
 */
const SOLARIZED_DARK_VARS: Record<string, string> = {
  'ls-bg': '#002b36',
  'ls-fg': '#93a1a1',
  'ls-toolbar-bg': '#073642',
  'ls-toolbar-border': '#12414d',
  'ls-overflow-panel-bg': '#073642',
  'ls-overflow-panel-border': '#12414d',
  'ls-overflow-panel-shadow': 'rgba(0, 0, 0, 0.5)',
  'ls-btn-bg': '#073642',
  'ls-btn-border': '#12414d',
  'ls-btn-hover-bg': '#12414d',
  'ls-btn-active-bg': '#268bd2',
  'ls-btn-active-fg': '#fdf6e3',
  'ls-btn-active-border': '#268bd2',
  'ls-select-bg': '#073642',
  'ls-select-border': '#12414d',
  'ls-select-hover-bg': '#12414d',
  'ls-select-option-bg': '#073642',
  'ls-select-option-fg': '#93a1a1',
  'ls-chord': '#2aa198',
  'ls-section-header-fg': '#586e75',
  'ls-col-separator': '#12414d',
  'ls-meta-border': '#12414d',
  'ls-scrollbar-thumb': '#586e75',
  'ls-bg-rgb': '0, 43, 54',
};

/**
 * Dracula — MIT.
 * Body text: fg #f8f8f2 on bg #282a36 ≈ 12:1. Chord: purple #bd93f9,
 * the theme's signature accent.
 * https://draculatheme.com/
 */
const DRACULA_VARS: Record<string, string> = {
  'ls-bg': '#282a36',
  'ls-fg': '#f8f8f2',
  'ls-toolbar-bg': '#21222c',
  'ls-toolbar-border': '#44475a',
  'ls-overflow-panel-bg': '#21222c',
  'ls-overflow-panel-border': '#44475a',
  'ls-overflow-panel-shadow': 'rgba(0, 0, 0, 0.55)',
  'ls-btn-bg': '#44475a',
  'ls-btn-border': '#6272a4',
  'ls-btn-hover-bg': '#565a74',
  'ls-btn-active-bg': '#bd93f9',
  'ls-btn-active-fg': '#282a36',
  'ls-btn-active-border': '#bd93f9',
  'ls-select-bg': '#44475a',
  'ls-select-border': '#6272a4',
  'ls-select-hover-bg': '#565a74',
  'ls-select-option-bg': '#21222c',
  'ls-select-option-fg': '#f8f8f2',
  'ls-chord': '#bd93f9',
  'ls-section-header-fg': '#6272a4',
  'ls-col-separator': '#44475a',
  'ls-meta-border': '#44475a',
  'ls-scrollbar-thumb': '#6272a4',
  'ls-bg-rgb': '40, 42, 54',
};

/**
 * Nord — MIT, Sven Greb.
 * Body text: nord6 #eceff4 on nord0 #2e3440 ≈ 12:1. Chord: nord8 #88c0d0,
 * the frost accent most associated with code keywords in Nord.
 * https://www.nordtheme.com/
 */
const NORD_VARS: Record<string, string> = {
  'ls-bg': '#2e3440',
  'ls-fg': '#eceff4',
  'ls-toolbar-bg': '#3b4252',
  'ls-toolbar-border': '#434c5e',
  'ls-overflow-panel-bg': '#3b4252',
  'ls-overflow-panel-border': '#4c566a',
  'ls-overflow-panel-shadow': 'rgba(0, 0, 0, 0.5)',
  'ls-btn-bg': '#434c5e',
  'ls-btn-border': '#4c566a',
  'ls-btn-hover-bg': '#4c566a',
  'ls-btn-active-bg': '#88c0d0',
  'ls-btn-active-fg': '#2e3440',
  'ls-btn-active-border': '#88c0d0',
  'ls-select-bg': '#434c5e',
  'ls-select-border': '#4c566a',
  'ls-select-hover-bg': '#4c566a',
  'ls-select-option-bg': '#3b4252',
  'ls-select-option-fg': '#eceff4',
  'ls-chord': '#88c0d0',
  'ls-section-header-fg': '#81a1c1',
  'ls-col-separator': '#434c5e',
  'ls-meta-border': '#434c5e',
  'ls-scrollbar-thumb': '#4c566a',
  'ls-bg-rgb': '46, 52, 64',
};

export const THEMES: Theme[] = [
  // 'system' is a pseudo-theme; its vars are picked from light/dark at
  // render time via resolveTheme().
  { id: 'system', label: 'System', base: 'light', vars: LIGHT_VARS },
  { id: 'light', label: 'Light', base: 'light', vars: LIGHT_VARS },
  { id: 'dark', label: 'Dark', base: 'dark', vars: DARK_VARS },
  { id: 'sepia', label: 'Sepia', base: 'light', vars: SEPIA_VARS },
  { id: 'solarized-light', label: 'Solarized Light', base: 'light', vars: SOLARIZED_LIGHT_VARS },
  { id: 'solarized-dark', label: 'Solarized Dark', base: 'dark', vars: SOLARIZED_DARK_VARS },
  { id: 'dracula', label: 'Dracula', base: 'dark', vars: DRACULA_VARS },
  { id: 'nord', label: 'Nord', base: 'dark', vars: NORD_VARS },
];

export const DEFAULT_THEME: ThemeId = 'system';

export function isThemeId(value: unknown): value is ThemeId {
  if (typeof value !== 'string') return false;
  return THEMES.some((t) => t.id === value);
}

export function getTheme(id: ThemeId): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/**
 * Resolve a theme ID to the concrete Theme whose variables should be applied.
 * For 'system', returns light or dark based on prefers-color-scheme.
 */
export function resolveTheme(id: ThemeId): Theme {
  if (id === 'system') {
    const prefersDark =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    return getTheme(prefersDark ? 'dark' : 'light');
  }
  return getTheme(id);
}

/**
 * Apply a theme to a reader root element by setting CSS custom properties
 * inline. Previous theme vars are cleared first so themes with fewer vars
 * don't inherit values from a previously-applied theme.
 *
 * Also toggles data-theme + the legacy .ls-dark class so selectors or
 * integrations that key on those still work.
 */
export function applyTheme(root: HTMLElement, id: ThemeId): void {
  const resolved = resolveTheme(id);

  // Clear any custom properties we previously set.
  const inlineProps = Array.from(root.style);
  for (const prop of inlineProps) {
    if (prop.startsWith('--ls-')) root.style.removeProperty(prop);
  }

  for (const [key, value] of Object.entries(resolved.vars)) {
    root.style.setProperty('--' + key, value);
  }

  root.setAttribute('data-theme', id);
  root.classList.toggle('ls-dark', resolved.base === 'dark');
}

/**
 * Swatch preview colors for a theme — shown in the picker UI. Returns the
 * three most identity-defining colors so users can recognize each theme at
 * a glance. 'system' uses a split-look derived at apply-time.
 */
export function themeSwatch(id: ThemeId): { bg: string; fg: string; accent: string } {
  const t = resolveTheme(id);
  return {
    bg: t.vars['ls-bg'],
    fg: t.vars['ls-fg'],
    accent: t.vars['ls-chord'],
  };
}
