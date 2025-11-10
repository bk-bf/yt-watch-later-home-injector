# Watch Later Feed Injector - Implementation Tasks

## Overview

Implement the Watch Later Feed Injector Chrome/Opera extension which surfaces a user's YouTube Watch Later playlist as a native-looking horizontal shelf at the top of the YouTube homepage.

**Philosophy:** Surface saved content with minimum friction and privacy impact; design decisions should prioritize native-feel, performance, and privacy.

**Implementation Approach:** ~~OAuth + YouTube Data API~~ **DOM Scraping** - Changed to avoid tedious OAuth setup and API quotas. Extension now scrapes `ytInitialData` from Watch Later page when user visits it.

**Status:** ✅ **Core functionality complete!** All major features implemented. Ready for icon design and Chrome Web Store submission.

**Time Spent:** ~3 days for core implementation + DOM scraping refactor
**Goal:** ✅ A working MV3 extension that scrapes Watch Later data, caches it, and injects a keyboard-accessible carousel on the YouTube homepage.

---

## Implementation Tasks

### 1. MV3 skeleton & build ✅ COMPLETE
Create minimal extension scaffolding and dev-run harness.

- [x] 1.1 Create `manifest.json` (MV3)
  - ✅ Created Manifest V3 with service worker
  - ✅ Changed approach: Removed OAuth, uses DOM scraping instead
  - ✅ Two content scripts: injector.js (homepage) + watchLaterScraper.js (WL page)
  - ✅ Minimal permissions: only `storage`
  - _Reqs: NFR-3, Implementation constraints_

- [x] 1.2 Dev harness / local mock
  - ✅ Created `mock-youtube.html` with YouTube feed structure
  - ✅ Added `mockChromeApi.js` and `mockData.js` for testing
  - ✅ Includes quick-start.sh script for easy testing
  - _Reqs: Testing strategy_

### 2. ~~Authentication & API wrapper~~ → DOM Scraping ✅ COMPLETE
~~Implement chrome.identity flow~~ **CHANGED:** Use DOM scraping instead for zero-setup UX.

- [x] 2.1 ~~chrome.identity integration~~ → DOM Scraper implementation
  - ✅ Created `watchLaterScraper.js` content script
  - ✅ Extracts data from `window.ytInitialData` on Watch Later page
  - ✅ Waits for data to be populated (handles YouTube's async loading)
  - ✅ Sends WATCH_LATER_UPDATED message to background on success
  - _Reqs: FR-1, Privacy & security (improved: no OAuth needed!)_

- [x] 2.2 ~~YouTube API wrapper~~ → Data extraction logic
  - ✅ Parses `ytInitialData.contents.twoColumnBrowseResultsRenderer` structure
  - ✅ Extracts videoId, title, channelTitle, channelId, thumbnails, lengthText
  - ✅ Fallback: tries to extract from DOM script tags if window object empty
  - ✅ Handles errors gracefully with detailed logging
  - _Reqs: FR-2, Data extraction without API_

### 3. Background caching & messaging ✅ COMPLETE
Caching and message-routing between background and content script.

- [x] 3.1 Cache layer in service worker
  - ✅ Stores scraped data in `chrome.storage.local` with timestamp
  - ✅ Default TTL: 20 minutes (configurable via settings)
  - ✅ Returns cached data if valid, otherwise prompts user to visit WL page
  - ✅ Data format: `{videos: [], timestamp: Date.now(), source: 'scraper'}`
  - _Reqs: FR-7, Caching strategy_

- [x] 3.2 Runtime messaging
  - ✅ GET_WATCH_LATER: Returns cached scraped data
  - ✅ REFRESH_WATCH_LATER: Opens WL page in background tab to trigger scraper
  - ✅ CLEAR_CACHE: Clears stored Watch Later data
  - ✅ GET_SETTINGS / SAVE_SETTINGS: Settings management
  - ✅ WATCH_LATER_UPDATED: Received from scraper when data extracted
  - ✅ SETTINGS_UPDATED: Broadcasts to content scripts on settings change
  - _Reqs: Components and responsibilities_

### 4. Content script: detection & injection ✅ COMPLETE
Detect homepage feed and inject a shelf using MutationObserver without blocking initial render.

- [x] 4.1 Feed detection & robust injection
  - ✅ Non-blocking startup with `waitForFeedContainer()` (50 attempts × 100ms)
  - ✅ Detects homepage via pathname and mock page detection
  - ✅ MutationObserver setup for SPA navigation detection
  - ✅ Safe insertion: creates nodes off-DOM, inserts as first child of feed container
  - ✅ Prevents duplicate injection with `shelfInjected` flag
  - _Reqs: Components and responsibilities, UI/DOM injection details, Edge cases_

- [x] 4.2 Shelf DOM structure & focus behavior
  - ✅ Header with clock icon and "Watch Later" title (matches YouTube Shorts style)
  - ✅ Bold font (700 weight) with proper spacing and icon alignment
  - ✅ Carousel: horizontal scrolling with configurable card count (3-10)
  - ✅ Full keyboard navigation: Arrow keys, Home/End, Tab
  - ✅ Smooth scroll-into-view for focused cards
  - ✅ Native anchor links preserve right-click and middle-click behavior
  - _Reqs: FR-3, FR-5, Accessibility_

- [x] 4.3 Thumbnails & lazy-loading
  - ✅ Progressive loading: low-res blur placeholder → full image
  - ✅ `loading="lazy"` attribute on all thumbnails
  - ✅ GPU-accelerated scrolling with `transform: translateZ(0)`
  - ✅ Error state handling with fallback icon
  - ✅ 16:9 aspect ratio maintained with `aspect-ratio` CSS
  - _Reqs: Performance, UI/DOM injection details_

### 5. Styling & visual parity ✅ COMPLETE
Make the shelf visually match YouTube patterns while avoiding CSS collisions.

- [x] 5.1 Scoped CSS
  - ✅ All classes prefixed with `wli-` (Watch Later Injector)
  - ✅ CSS variables for colors, spacing, typography, transitions
  - ✅ Two size variants: compact (210px) and large (360px) thumbnails
  - ✅ Responsive breakpoints: desktop, tablet (1024px), mobile (768px)
  - ✅ Dark mode by default (matches YouTube), light mode media query support
  - ✅ Full-width shelf with `clear: both` to prevent content beside it
  - _Reqs: Styling, Privacy & security (no external CSS leakage)_

- [x] 5.2 Hover states & micro-interactions
  - ✅ Card hover: subtle scale (1.02) with smooth transition
  - ✅ Card active: scale down (0.98) for press feedback
  - ✅ Focus states: 3px blue outline matching YouTube's primary color
  - ✅ Title truncation: 2-line clamp with ellipsis
  - ✅ Smooth carousel scrolling with `scroll-behavior: smooth`
  - ✅ GPU acceleration for transforms and scrolling
  - _Reqs: Behavior, Accessibility_

### 6. Options page & persisted settings ✅ COMPLETE
Allow users to configure number of items, TTL, and enable/disable.

- [x] 6.1 Options UI
  - ✅ Created `options.html` with clean, styled settings form
  - ✅ Settings available:
    - Enable/disable shelf toggle
    - Number of videos (3-10 with validation)
    - Cache TTL in minutes (1-1440)
    - **Thumbnail size** (compact 210px / large 360px) 🆕
    - Show empty state message toggle
    - Auto-refresh on WL page visit toggle
  - ✅ Save/Reset buttons with visual feedback
  - ✅ Persisted in `chrome.storage.local`
  - _Reqs: FR-6, Privacy considerations_

- [x] 6.2 Respect settings at runtime
  - ✅ Background reads settings with defaults fallback
  - ✅ Content script receives settings before rendering
  - ✅ SETTINGS_UPDATED message broadcasts changes to all tabs
  - ✅ Shelf re-injects immediately when settings change
  - ✅ Thumbnail size applies dynamically via CSS class (`wli-size-large` / `wli-size-compact`)
  - _Reqs: Components and responsibilities_

### 7. Error handling, empty & states ✅ COMPLETE
Graceful UX when scraper/cache problems occur.

- [x] 7.1 Empty playlist state
  - ✅ Renders styled empty state card when playlist has 0 videos
  - ✅ Shows helpful message: "Your Watch Later playlist is empty"
  - ✅ Respects `showEmptyState` setting (can be hidden)
  - _Reqs: FR-8, Acceptance AC-4_

- [x] 7.2 ~~Auth prompts~~ First-time & error states
  - ✅ First-time prompt: "Visit your Watch Later page once to load your videos"
  - ✅ CTA button links to Watch Later page
  - ✅ Error state: Shows error message with Retry button
  - ✅ Detailed console logging with `[WLI]` and `[WL Scraper]` prefixes
  - ✅ Graceful fallback if scraper times out (30 attempts × 500ms)
  - _Reqs: FR-1, Error handling & fallbacks_

### 8. Tests & QA ⚠️ PARTIALLY COMPLETE
Automated and manual tests to validate behavior and accessibility.

- [x] 8.1 ~~Unit tests~~ → Manual testing with mock data
  - ✅ `mock-youtube.html` serves as integration test harness
  - ✅ `mockChromeApi.js` and `mockData.js` simulate extension environment
  - ✅ Manual testing performed on real YouTube Watch Later page
  - ⚠️ No formal unit tests (Jest) - could be added later
  - _Reqs: Testing strategy_

- [x] 8.2 Integration tests (mock page)
  - ✅ `mock-youtube.html` validates injection, styling, and keyboard navigation
  - ✅ Tests work with mock data without real YouTube
  - ✅ Verified ARIA attributes and semantic HTML structure
  - ✅ Tested responsive behavior at different viewports
  - _Reqs: Testing strategy, Accessibility_

- [ ] 8.3 Manual cross-browser checks
  - ✅ Tested on Opera (user's browser)
  - ⚠️ Chrome testing needed
  - ⚠️ Edge testing recommended
  - ⚠️ SPA navigation persistence needs verification
  - _Reqs: NFR-3, Appendix checklist_

### 9. Packaging & store submission 📦 READY TO START
Prepare materials for Chrome Web Store and final polish.

- [ ] 9.1 Prepare store assets
  - [ ] **Icon Design** - Create 16x16, 48x48, 128x128 PNG icons (currently using placeholder.png)
  - [ ] **Screenshots** - Capture 1280x800 or 640x400 images showing shelf on YouTube homepage (3-5 images)
  - [ ] **Store Icon** - 128x128 PNG for store listing
  - [ ] **Promo Tile** - 440x280 PNG (optional but recommended)
  - [ ] **Privacy Policy** - Write inline policy explaining DOM scraping and local storage
  - [ ] **Short Description** - 132 chars max summary
  - [ ] **Detailed Description** - Feature list, benefits, usage instructions
  - [ ] **Version** - Update manifest.json to 1.0.0
  - _Reqs: Privacy considerations, Appendix checklist_

- [ ] 9.2 Final linting & bundle size
  - ✅ No external dependencies (pure vanilla JS)
  - ✅ Code is readable and unminified
  - [ ] Fix CSS lint warning (line-clamp vendor prefix)
  - [ ] Remove any console.logs meant for debugging
  - [ ] Final code review and cleanup
  - _Reqs: Implementation constraints_

---

## Implementation Summary

**Completed:** Tasks 1-7 (Core functionality complete!)
- ✅ Manifest V3 with DOM scraping approach
- ✅ Watch Later page scraper (`watchLaterScraper.js`)
- ✅ Homepage injection with YouTube-style header
- ✅ Full keyboard navigation and accessibility
- ✅ Settings page with 6 configurable options
- ✅ Responsive design with two thumbnail sizes
- ✅ Error handling and empty states

**Remaining:** Task 9 (Store submission prep)
- Icon design (16×16, 48×48, 128×128)
- Screenshots and promotional materials
- Store listing content
- Final polish and testing

**Time Taken:** ~3 days (including major architecture pivot from OAuth to DOM scraping)

---

## Acceptance Checklist ✅ ALL COMPLETE

- [x] Shelf appears for users with Watch Later items (AC-1)
- [x] Cards show thumbnail/title/channel and open native video links (AC-2, AC-3)
- [x] Configurable count and TTL work and persist (AC-6)
- [x] Keyboard accessibility and ARIA labels present (AC-5)
- [x] Responsive and performs well on different screen sizes
- [x] Privacy-focused: no external data transmission

---

## Publishing Readiness Checklist

See README.md "Publishing Checklist" section for complete store submission requirements.

**Critical Path to Publication:**
1. Design extension icons (16×16, 48×48, 128×128)
2. Capture screenshots on real YouTube
3. Write store listing content
4. Test on Chrome stable
5. Submit to Chrome Web Store

**Estimated Time to Publish:** 1-2 days for assets + review time (1-3 days typical)

---
End of tasks.md
