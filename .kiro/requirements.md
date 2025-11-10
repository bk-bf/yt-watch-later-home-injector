# Watch Later Feed Injector — Requirements

## Purpose

This document lists functional and non-functional requirements, user stories, acceptance criteria, permissions, and test cases for the Watch Later Feed Injector extension.

## Scope

Surface the user's YouTube Watch Later playlist as a horizontal carousel at the top of the YouTube homepage feed using a Chrome/Opera Manifest V3 extension.

## Stakeholders

- End users with a Watch Later playlist
- Extension developer(s)
- Reviewers for Chrome Web Store

## Functional requirements

FR-1: Authenticate user via Chrome Identity
- The extension must use chrome.identity to obtain an OAuth token with the `youtube.readonly` scope.

FR-2: Fetch Watch Later items
- The service worker must query the YouTube Data API v3 for Watch Later items and return structured metadata to the content script.

FR-3: Inject shelf on homepage
- The content script must insert an "In Your Watch Later" shelf at the top of the homepage feed with a `View All` link to the playlist.

FR-4: Render cards
- Each card in the shelf must display thumbnail, title, channel name, and short metadata (views/published time if available).

FR-5: Native click behavior
- Clicking a card must navigate to the YouTube video page with the same behavior as native YouTube links (open in same tab, preserve context menu).

FR-6: Configurable options
- Provide optional settings: number of items to display (3–10), cache TTL (minutes), enable/disable shelf.

FR-7: Caching
- Cache playlist metadata in chrome.storage.local with configurable TTL. Use cache to reduce API calls.

FR-8: Error & empty states
- Show unobtrusive UI states for authentication errors, API errors, and empty playlists.

## Non-functional requirements

NFR-1: Performance
- Initial injection should not delay YouTube's primary content. Defer injection until the feed is visible. Use lazy-loading for images.

NFR-2: Security & Privacy
- Request minimal required scopes. Do not transmit or persist sensitive user data outside the extension.

NFR-3: Compatibility
- Support latest stable Chrome and Opera browsers where Manifest V3 is available. Content script should handle YouTube client-side navigation.

NFR-4: Accessibility
- All interactive elements must be keyboard accessible and provide ARIA attributes and readable labels.

## Permissions and API scopes

- Host permissions: `https://www.googleapis.com/*` (for Data API). Optionally `https://www.youtube.com/*` for advanced interactions.
- Identity/OAuth: `https://www.googleapis.com/auth/youtube.readonly`

## User stories

- As a user, I want to see my Watch Later videos at the top of the homepage so I remember to watch them.
- As a user, I want clicking a video to behave like native YouTube links so navigation feels natural.
- As a privacy-conscious user, I want the extension to use the minimum permissions and not store my credentials.

## Acceptance criteria

AC-1: When an authenticated user with items in Watch Later visits youtube.com, a shelf labeled "In Your Watch Later" appears as the first feed element.

AC-2: The shelf shows up to the configured number of items (default 5) and is horizontally scrollable. 3–5 cards are visible depending on window width.

AC-3: Clicking an item opens the corresponding YouTube video with no change to the context menu or middle-click behavior.

AC-4: If the playlist is empty, the shelf displays an empty state message and a link to the Watch Later playlist.

AC-5: If the user is not authenticated or token is invalid, the shelf does not display and a small unobtrusive CTA is available to sign in.

AC-6: The extension respects cache TTL and does not make unnecessary API calls within the TTL window.

## Edge cases

- YouTube client-side navigation (SPA-style route changes): content script must re-insert or maintain shelf across navigation events.
- Playlist items with missing thumbnails: use fallback placeholder image.
- Rate limit responses: back off and use cached data or hide the shelf with logged message.

## Test cases (high level)

TC-1: Authenticated user with items
- Setup: Authenticate and ensure Watch Later has >5 items.
- Expectation: Shelf appears, shows up to configured count, links navigate correctly.

TC-2: Unauthenticated user
- Setup: Revoke extension permissions or user not signed in.
- Expectation: Shelf hidden; CTA appears to sign in.

TC-3: Empty playlist
- Setup: Clear test Watch Later playlist.
- Expectation: Empty state displayed and `View All` links to playlist.

TC-4: Cache behavior
- Setup: Fetch data, then offline the network within TTL.
- Expectation: Cached data displays; background refresh fails gracefully.

TC-5: Accessibility
- Setup: Keyboard-only navigation and screen reader checks.
- Expectation: Items reachable by tab, ARIA labels present, no traps.

## Implementation constraints

- Must use Manifest V3.
- No external servers to store user data.
- Keep asset size small to pass store review and reduce bundle size.

## Milestones

- M1 — Core fetch + injection (no settings): authenticate, fetch Watch Later, inject shelf with basic styling.
- M2 — Caching, error states, and keyboard accessibility.
- M3 — Options page: configurable count, TTL, enable/disable.
- M4 — Polish: matching YouTube styles, tests, and prepare Chrome Web Store submission.

## Privacy considerations

- Explain in README and store listing that only playlist metadata is accessed and that auth is done via Chrome identity; explicitly state no external transmission of user data.

## Metrics & logging

- Local logging: console logs for development. No telemetry by default. If added, must be opt-in and documented.

## Appendix: minimal acceptance checklist for reviewers

- Uses `youtube.readonly` scope only.
- Shelf does not persist or send personal data to external servers.
- Injection is visually and functionally consistent with normal YouTube navigation.

---
End of requirements.md
