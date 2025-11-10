# Watch Later Feed Injector — Design

## Overview

This document describes the high-level design for "Watch Later Feed Injector", a Manifest V3 Chrome/Opera extension that surfaces the user's YouTube Watch Later playlist on the YouTube homepage by injecting a native-looking horizontal carousel (shelf) at the top of the feed.

Goals:
- Surface Watch Later items prominently to encourage watching saved videos.
- Match YouTube's native UI patterns for a seamless experience.
- Respect user privacy and minimize stored data.

## High-level architecture

Components:
- Manifest (MV3) + static assets
- Service Worker (background) — handles auth, token refresh, caching policy, message routing
- Content Script — injects UI, performs DOM observation, handles click/hover behavior
- OAuth / Identity — Chrome Identity API + YouTube Data API v3
- Local Cache — chrome.storage.local for short-term caching (15–30 minutes)

Data flow (textual diagram):

User visits youtube.com homepage
  -> Content script loads and signals background (message)
  -> Background checks cache / token; if needed triggers OAuth via chrome.identity
  -> Background fetches playlist items from YouTube Data API
  -> Background caches items and returns payload to content script
  -> Content script renders carousel and attaches event handlers

## Components and responsibilities

1) manifest.json (MV3)
  - Declare content_scripts for `*://www.youtube.com/*` (match homepage path)
  - Host permissions: `https://www.googleapis.com/*` for Data API, `https://www.youtube.com/*` for injection if required
  - Identity: oauth2 client_id and declared scopes in manifest if using chrome.identity.getAuthToken
  - background.service_worker: runs fetches and caching

2) Service Worker (background.js)
  - Authenticate using chrome.identity.getAuthToken (OAuth2 flow)
  - Refresh tokens and manage token expiry implicitly via identity API
  - Fetch Watch Later playlist via YouTube Data API v3 (playlistItems.list)
  - Implement caching: store fetched playlist items and timestamp in chrome.storage.local
  - Respond to requests from content scripts via chrome.runtime.onMessage
  - Expose settings persistence (display count, refresh interval, enabled/disabled)

3) Content Script (injector.js + injector.css)
  - Wait until YouTube homepage load (non-blocking). Use a short delay or a sentinel DOM element that indicates homepage feed availability.
  - Use MutationObserver to reliably detect when the feed container is present or when feed content re-renders (e.g., client-side navigation)
  - Request playlist items from service worker
  - Build DOM nodes for the shelf that closely follow YouTube's horizontal shelf markup (semantic elements where possible)
  - Apply CSS that reuses YouTube-like values (spacing, fonts, hover states) but lives in extension namespace to avoid collisions. Use scoped classes prefixed with `wli-`.
  - Insert shelf at the top of the feed (before the first feed card) and ensure it is keyboard accessible
  - Implement lazy-loading for thumbnails (loading=lazy and placeholder blurred thumbnail)
  - Ensure clicks navigate to YouTube video pages using native anchors to preserve normal behavior and history

## UI / DOM injection details

Insertion point:
- Identify the primary feed container element used by YouTube (observe DOM to find the first feed card or a consistent container class). Insert the shelf as the first child of the feed container.

Structure:
- Header row: `In Your Watch Later` + `View All` link (to playlist URL)
- Carousel container: horizontal scrolling region with 3–5 cards visible depending on viewport width
- Card content: thumbnail, title (single-line ellipsis), channel name, view/time metadata

Behavior:
- Native hover states: show video overlay play button on hover if feasible; otherwise preserve thumbnail hover and title highlight
- Click behavior: open video in current tab (same as native links). Right-click context menu preserved, middle-click opens new tab.
- Keyboard: allow focusable cards and left/right arrow navigation inside the carousel

Styling:
- Keep CSS minimal and scoped (class prefix `wli-`) to reduce collisions
- Use CSS variables for sizing to adapt to responsive breakpoints
- Use native YouTube fonts and colors where possible to match visual language

## Authentication

- Use chrome.identity API for OAuth authentication flow; request the minimum scope required: `https://www.googleapis.com/auth/youtube.readonly`
- The service worker calls chrome.identity.getAuthToken to get an access token and uses it in requests to YouTube Data API
- Do not store OAuth credentials or refresh tokens in extension storage; rely on chrome.identity for token management

## YouTube Data API usage

- Endpoint: playlistItems.list with playlistId `WL` (Watch Later) or use the user's Watch Later playlist id returned by channels API if necessary
- Requested fields: id, snippet(title, thumbnails, resourceId/videoId, channelTitle, publishedAt), contentDetails (duration if needed via Videos API)
- Rate limiting: cache results for 15–30 minutes by default; allow user to change refresh interval in options

## Caching strategy

- Store fetched playlist items and a timestamp in `chrome.storage.local`
- Default TTL: 20 minutes (configurable to 15–30 mins)
- On page load: if cached and not expired return cached data immediately while optionally refreshing in background

## Error handling & fallbacks

- Network/API errors: gracefully hide the shelf and log a non-intrusive console warning
- Authentication errors: show a small unobtrusive CTA in the content script (or extension icon badge) prompting the user to sign in
- Empty playlist: show empty state with a small message and link to the playlist page

## Performance considerations

- Defer injection until feed is visible to avoid blocking YouTube's first paint
- Minimize DOM reflows: create shelf off-DOM (document.createDocumentFragment) then insert
- Use lazy loading for thumbnails and avoid heavy images
- Batch updates and avoid expensive selectors in MutationObserver

## Privacy & security

- Only request the minimal required OAuth scope (youtube.readonly)
- Do not send user data outside YouTube or the extension's runtime
- Store only the minimal playlist metadata (ids, titles, thumbnails, channel names), no personal metadata

## Accessibility

- Ensure all interactive elements are focusable (tabindex, native anchors)
- Provide meaningful ARIA labels for carousel and items (role="list" and role="listitem" where appropriate)
- Support high-contrast text and prefer system fonts for legibility

## Testing strategy

- Unit tests for helper modules (API wrapper, cache logic) using a JS test runner (Jest)
- Integration tests: simple harness that loads a static HTML mock of YouTube homepage and verifies DOM insertion and accessibility attributes
- Manual testing: authenticated user flows on Chrome/Opera, verify injection across different screen sizes and navigation events

## Future improvements / optional features

- Options UI: allow users to set number of visible items, TTL, enable/disable shelf
- Analytics (opt-in) for feature usage
- Support additional injection locations (mobile web, watch pages, subscriptions)

## Notes and references

- YouTube Data API v3 docs: https://developers.google.com/youtube/v3
- Chrome Identity API docs: https://developer.chrome.com/docs/extensions/reference/identity/
- Manifest V3 guidance: https://developer.chrome.com/docs/extensions/mv3/intro/

---
End of design.md
