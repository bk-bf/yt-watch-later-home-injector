# YT Watch Later in Home Feed

A Chrome/Opera extension that surfaces your YouTube Watch Later playlist as a native-looking horizontal shelf at the top of the YouTube homepage.

## Features

- 🎯 Watch Later videos appear prominently on YouTube homepage
- ⌨️ Keyboard accessible carousel with arrow navigation
- 🎨 Native YouTube styling for seamless integration
- 🔒 Privacy-focused: minimal permissions, no external data transmission
- ⚡ Smart caching to reduce API calls

## Development Setup

### Prerequisites

- Chrome or Opera browser
- (Optional) Google Cloud project with YouTube Data API v3 enabled for real API testing

### Quick Start

1. **Clone/download this repository**

2. **Load the extension in Chrome:**
   - Open `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select this project folder

3. **Test locally with mock page:**
   ```bash
   # Open mock-youtube.html in your browser
   open mock-youtube.html
   ```
   
   The mock page simulates YouTube's homepage structure for testing injection logic without hitting the real site.

### Development Workflow

#### Testing on Mock Page
- Open `mock-youtube.html` in your browser
- The content script (`injector.js`) loads automatically
- Check browser console for logs and errors
- Modify `injector.js` or `injector.css` and reload the page

#### Testing on Real YouTube
- Load the extension in Chrome (see Quick Start)
- Navigate to `https://www.youtube.com/`
- Check if the shelf appears (requires authentication setup)
- Use Chrome DevTools to inspect injected elements

#### Debugging
- **Content script logs:** Open DevTools on YouTube or mock page
- **Background script logs:** Go to `chrome://extensions/`, find this extension, click "service worker"
- **Inspect injected DOM:** Right-click on the shelf → Inspect

### Project Structure

```
.
├── manifest.json          # Extension configuration (MV3)
├── background.js          # Service worker (auth, API, caching)
├── injector.js            # Content script (DOM injection)
├── injector.css           # Scoped styles for injected shelf
├── youtubeApi.js          # YouTube Data API wrapper
├── options.html           # Settings page UI
├── options.js             # Settings page logic
├── mock-youtube.html      # Local dev harness
├── placeholder.png        # Extension icon
└── README.md              # This file
```

### OAuth Setup (Optional for Development)

The extension works without real OAuth credentials during initial development. To test with real YouTube data:

1. Create a [Google Cloud Project](https://console.cloud.google.com/)
2. Enable the YouTube Data API v3
3. Create OAuth 2.0 credentials (Chrome App)
4. Copy the Client ID and update `manifest.json`:
   ```json
   "oauth2": {
     "client_id": "YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com",
     "scopes": ["https://www.googleapis.com/auth/youtube.readonly"]
   }
   ```

### File Creation Checklist

- [x] `manifest.json` - Extension manifest (MV3)
- [x] `mock-youtube.html` - Dev harness for local testing
- [x] `README.md` - Development documentation
- [ ] `background.js` - Service worker (auth & API)
- [ ] `injector.js` - Content script (injection logic)
- [ ] `injector.css` - Styles for shelf
- [ ] `youtubeApi.js` - API wrapper
- [ ] `options.html` - Settings UI
- [ ] `options.js` - Settings logic

## Permissions

- `identity` - OAuth authentication via Chrome Identity API
- `storage` - Cache playlist data locally
- `https://www.googleapis.com/*` - YouTube Data API access

## Privacy

- Only requests `youtube.readonly` scope (view-only access)
- No data transmitted to external servers
- Cache stored locally in browser only
- No tracking or analytics

## Testing Strategy

1. **Unit tests** - API wrapper and cache logic (Jest)
2. **Integration tests** - Mock page harness for DOM injection
3. **Manual testing** - Real YouTube with different states (auth, empty, errors)
4. **Accessibility** - Keyboard navigation and screen reader checks

## Roadmap

- [x] Manifest V3 skeleton
- [ ] Authentication & API wrapper
- [ ] Background caching & messaging
- [ ] Content script injection
- [ ] Styling & visual parity
- [ ] Options page
- [ ] Error handling
- [ ] Tests & QA
- [ ] Chrome Web Store submission

## License

MIT (or your preferred license)

## Contributing

This is a personal project, but feel free to fork and adapt for your own use!
