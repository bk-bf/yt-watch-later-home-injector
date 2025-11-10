# Watch Later Feed Injector - Implementation Tasks

## Overview

Implement the Watch Later Feed Injector Chrome/Opera extension which surfaces a user's YouTube Watch Later playlist as a native-looking horizontal shelf at the top of the YouTube homepage.

**Philosophy:** Surface saved content with minimum friction and privacy impact; design decisions should prioritize native-feel, performance, and privacy.

**Dependencies:** Manifest V3 skeleton, YouTube Data API access via Chrome Identity, content script injection plumbing, world (YouTube) DOM understanding
**Estimated Time:** 4-5 days (MVP prototype through basic polish)
**Goal:** A working MV3 extension that authenticates via chrome.identity, fetches Watch Later items, caches them, and injects a keyboard-accessible carousel on the YouTube homepage.

---

## Implementation Tasks

### 1. MV3 skeleton & build
Create minimal extension scaffolding and dev-run harness.

- [x] 1.1 Create `manifest.json` (MV3)
  - Set `background.service_worker`, `content_scripts` for `*://www.youtube.com/*`, and permissions for `https://www.googleapis.com/*`.
  - Add `oauth2` client info placeholder if needed in manifest for review.
  - _Reqs: NFR-3, Implementation constraints_

- [x] 1.2 Dev harness / local mock
  - Add a simple local `mock-youtube.html` page to test injection without full YouTube (loads content_script for layout testing).
  - Add minimal npm scripts (optional) or README dev steps.
  - _Reqs: Testing strategy_

### 2. Authentication & API wrapper
Implement chrome.identity flow and a small API wrapper to call YouTube Data API v3.

- [x] 2.1 chrome.identity integration
  - Implement `background.js` service worker method to obtain an access token using `chrome.identity.getAuthToken`.
  - Handle common auth errors and present an unobtrusive CTA to sign in when required.
  - _Reqs: FR-1, Privacy & security_

- [x] 2.2 YouTube API wrapper
  - Create `youtubeApi.js` that requests `playlistItems.list` for playlist ID `WL` (Watch Later). Request minimal fields: `snippet(resourceId/videoId,title,thumbnails,channelTitle,publishedAt)`.
  - Implement simple retries/backoff for transient 5xx responses.
  - _Reqs: FR-2, YouTube Data API usage_

### 3. Background caching & messaging
Caching and message-routing between background and content script.

- [x] 3.1 Cache layer in service worker
  - Use `chrome.storage.local` to store fetched playlist metadata and a timestamp.
  - Default TTL: 20 minutes (configurable). Return cached data when still valid; otherwise fetch and update cache.
  - _Reqs: FR-7, Caching strategy_

- [x] 3.2 Runtime messaging
  - Implement `chrome.runtime.onMessage` handlers to serve content-script requests for playlist items and settings.
  - Support a "refresh" message that forces API fetch and cache update.
  - _Reqs: Components and responsibilities_

### 4. Content script: detection & injection
Detect homepage feed and inject a shelf using MutationObserver without blocking initial render.

- [x] 4.1 Feed detection & robust injection
  - Use a non-blocking startup: wait for the feed container sentinel (or a short safe delay), then attach a MutationObserver to detect SPA navigations and feed re-rendering.
  - Implement a safe insertion strategy: create nodes off-DOM and insert before first feed card.
  - _Reqs: Components and responsibilities, UI/DOM injection details, Edge cases_

- [x] 4.2 Shelf DOM structure & focus behavior
  - Build a shelf with header: `In Your Watch Later`
  - Carousel container: horizontally scrollable region showing 3–5 visible cards depending on viewport.
  - Cards must be focusable and support keyboard left/right traversal inside the carousel.
  - Preserve native link behavior (anchors) so right-click and middle-click work as normal.
  - _Reqs: FR-3, FR-5, Accessibility_

- [x] 4.3 Thumbnails & lazy-loading
  - Use `loading="lazy"` for img and low-res placeholder if available.
  - Avoid heavy DOM paints; use CSS transform for horizontal scrolling where possible.
  - _Reqs: Performance, UI/DOM injection details_

### 5. Styling & visual parity
Make the shelf visually match YouTube patterns while avoiding CSS collisions.

- [x] 5.1 Scoped CSS
  - Create `injector.css` with scoped classes prefixed `wli-`.
  - Use CSS variables for spacing and breakpoints to maintain responsive behavior.
  - _Reqs: Styling, Privacy & security (no external CSS leakage)_

- [ ] 5.2 Hover states & micro-interactions
  - Implement thumbnail hover overlays (play affordance) if non-invasive; otherwise keep native thumbnail look and title hover.
  - Ensure contrast and accessibility for hover/focus states.
  - _Reqs: Behavior, Accessibility_

### 6. Options page & persisted settings
Allow users to configure number of items, TTL, and enable/disable.

- [ ] 6.1 Options UI
  - Create `options.html` and `options.js` to set: number of visible items (3–10), cache TTL (minutes), enable/disable shelf.
  - Persist options in `chrome.storage.sync` (or local) with sensible defaults.
  - _Reqs: FR-6, Privacy considerations_

- [ ] 6.2 Respect settings at runtime
  - Background and content script must read settings before fetching and rendering.
  - Allow immediate "apply" of settings via message bus.
  - _Reqs: Components and responsibilities_

### 7. Error handling, empty & auth states
Graceful UX when API/auth/network problems occur.

- [ ] 7.1 Empty playlist state
  - Render a small empty state card with a `View All` link to Watch Later.
  - _Reqs: FR-8, Acceptance AC-4_

- [ ] 7.2 Auth prompts and error CTA
  - If token missing/invalid, show a small unobtrusive CTA to sign in that triggers `chrome.identity.getAuthToken`.
  - If API rate-limited, fall back to cached data and log a console warning.
  - _Reqs: FR-1, Error handling & fallbacks_

### 8. Tests & QA
Automated and manual tests to validate behavior and accessibility.

- [ ] 8.1 Unit tests (API and cache)
  - Write Jest tests for `youtubeApi.js` mock responses and for cache TTL logic.
  - _Reqs: Testing strategy_

- [ ] 8.2 Integration tests (mock page)
  - Create a test harness `mock-youtube.html` that loads the content script and verifies insertion, keyboard navigation, and ARIA attributes.
  - _Reqs: Testing strategy, Accessibility_

- [ ] 8.3 Manual cross-browser checks
  - Validate flows on latest Chrome and Opera, check client-side navigation persistence, and store-review checklist.
  - _Reqs: NFR-3, Appendix checklist_

### 9. Packaging & store submission
Prepare materials for Chrome Web Store and final polish.

- [ ] 9.1 Prepare store assets
  - Create privacy description, short and long descriptions, screenshots showing the shelf on homepage, and a minimal changelog.
  - _Reqs: Privacy considerations, Appendix checklist_

- [ ] 9.2 Final linting & bundle size
  - Verify bundle size and remove large unused dependencies; run linting and fix warnings.
  - _Reqs: Implementation constraints_

---

## Suggested order & timeboxing (MVP-focused)

Day 1: Tasks 1 + 2 (MV3 skeleton, identity + simple API wrapper)
Day 2: Tasks 3 + 4 (caching, messaging, feed detection, basic injection)
Day 3: Tasks 5 + 7 (styling, empty/auth/error states, accessibility)
Day 4: Tasks 6 + 8 (options UI, unit/integration tests) and polish
Day 5 (optional): Task 9 and store submission prep

## Acceptance checklist (quick)

- [ ] Shelf appears for authenticated users with Watch Later items (AC-1)
- [ ] Cards show thumbnail/title/channel and open native video links (AC-2, AC-3)
- [ ] Configurable count and TTL work and persist (AC-6)
- [ ] Keyboard accessibility and ARIA labels present (AC-5, Accessibility)

---
End of tasks.md
