import { SiteParser } from './types';
import { ultimateGuitarParser } from './ug';
import { eChordsParser } from './echords';
import { cifraClubParser } from './cifraclub';
import { azChordsParser } from './azchords';
import { ukuTabsParser } from './ukutabs';

/**
 * Registry of all supported chord sites. To add a new site:
 *   1. Create a parser file that exports a `SiteParser` object
 *   2. Add it to this list
 *   3. Add the site's URL pattern to manifest.json → content_scripts.matches
 */
export const PARSERS: readonly SiteParser[] = [
  ultimateGuitarParser,
  eChordsParser,
  cifraClubParser,
  azChordsParser,
  ukuTabsParser,
];

/**
 * Find the parser whose hostname matches the current page. Matching is
 * substring-based to handle subdomains (e.g. tabs.ultimate-guitar.com).
 */
export function getParserForCurrentSite(): SiteParser | null {
  const hostname = window.location.hostname;
  return (
    PARSERS.find((p) => p.hostnames.some((h) => hostname.includes(h))) ?? null
  );
}

export { SiteParser } from './types';
