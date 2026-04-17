# Privacy Policy

**LeadSheet Chord Reader**

Last updated: 2026-04-16

This browser extension is designed to be private by default. It reads chord sheet pages you visit on a short list of supported sites and gives you a cleaner way to read them. It does not send any of your data anywhere.

## What we collect

The extension stores a small set of user preferences locally on your device via `chrome.storage.local`:

- Font size
- Color theme
- Default transpose behavior
- Auto-scroll speed

That's it. These preferences are saved so the reader remembers your settings between sessions. They live in your browser profile and never leave your device.

## What we don't collect

- No personally identifiable information (PII)
- No telemetry or usage analytics
- No cookies
- No network requests to our servers (we don't run any)
- No third-party services, SDKs, or trackers
- No tracking across sites or sessions
- No collection or transmission of chord sheet content you view

The extension has no background service worker, no account system, and no remote endpoint. It has nothing to phone home to.

## Permissions, and why

The extension requests the minimum permissions needed to function:

- **`storage`** — to persist your reader preferences (font size, theme, etc.) in `chrome.storage.local` so they survive across pages and browser restarts.
- **`content_scripts` on listed hosts** — the extension injects a content script only on the specific chord sheet sites declared in its manifest (e.g. Ultimate Guitar, E-Chords, CifraClub, AZChords, UkuTabs, Chordie). On those pages it reads the DOM to locate the chord sheet and render it in the reader overlay. It does not run on any other sites.

The extension does not request `tabs`, `webRequest`, `history`, `<all_urls>`, or any other broad permission.

## Data retention

Your preferences remain on your device until you:

- Uninstall the extension, or
- Clear extension storage via your browser's extension settings.

There is no cloud sync, no server-side copy, and nothing to request deletion of — because nothing leaves your machine.

## Children's privacy

The extension does not collect data from anyone, including children.

## Changes to this policy

If the policy changes, the "Last updated" date above will change and the revised version will replace this page at the same URL.

## Contact

Andrew Mendelsohn
Mendelsohn Labs LLC
andrew@mendelsohnlabs.com
