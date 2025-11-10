# YT Watch Later in Home Feed

A Chrome/Opera extension that surfaces your YouTube Watch Later playlist as a native-looking horizontal shelf at the top of the YouTube homepage.

## Features

- 🎯 Watch Later videos appear prominently on YouTube homepage
- ⌨️ Keyboard accessible carousel with arrow navigation
- 🎨 Native YouTube styling for seamless integration
- 🔒 Privacy-focused: minimal permissions, no external data transmission
- ⚡ Smart caching to reduce API calls (20-min default TTL)
- 📱 Responsive design adapts to different screen sizes
- 🚀 GPU-accelerated scrolling with progressive image loading

## Quick Start

### For Production Use (Real YouTube)

**See [SETUP.md](./SETUP.md)** for complete instructions on:
1. Creating Google Cloud OAuth credentials
2. Configuring the extension
3. Loading it in Chrome/Opera
4. Testing on actual YouTube

### For Development (Mock Page)

**Prerequisites:**
- Chrome or Opera browser
- No API credentials needed for mock testing

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
- [x] `background.js` - Service worker (auth & API)
- [x] `injector.js` - Content script (injection logic)
- [x] `injector.css` - Scoped styles with CSS variables
- [x] `youtubeApi.js` - API wrapper with retry logic
- [x] `mockChromeApi.js` - Mock Chrome API for local testing
- [x] `mockData.js` - Sample playlist data
- [x] `SETUP.md` - Production setup guide
- [ ] `options.html` - Settings UI
- [ ] `options.js` - Settings logic

## Permissions

- `identity` - OAuth authentication via Chrome Identity API
- `storage` - Cache playlist data and user settings locally
- `https://www.googleapis.com/*` - YouTube Data API v3 access

## Privacy

- Only requests `youtube.readonly` scope (view-only access)
- No data transmitted to external servers
- Cache stored locally in browser only (`chrome.storage.local`)
- No tracking or analytics
- Open source - all code is auditable

## Loading on Chrome/Opera

1. Open `chrome://extensions/` (or `opera://extensions/`)
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select this project folder
5. Copy the **Extension ID** (needed for OAuth setup)

For complete OAuth setup, see **[SETUP.md](./SETUP.md)**

## Implementation Status

### Completed (Tasks 1-5)
- [x] 1.1 - Manifest V3 with service worker
- [x] 1.2 - Dev harness (mock-youtube.html)
- [x] 2.1 - chrome.identity OAuth integration
- [x] 2.2 - YouTube Data API wrapper
- [x] 3.1 - Cache layer with TTL (20 min default)
- [x] 3.2 - Runtime messaging (10 message types)
- [x] 4.1 - Feed detection & robust injection
- [x] 4.2 - Keyboard navigation (Arrow keys, Home/End)
- [x] 4.3 - Progressive image loading with lazy loading
- [x] 5.1 - Scoped CSS with variables
- [x] 5.2 - Hover states & interactions

### In Progress
- [ ] 6.1 - Options page UI
- [ ] 6.2 - Settings runtime behavior (partially complete)
- [ ] 7.1 - Empty playlist state (partially complete)
- [ ] 7.2 - Auth prompts (partially complete)

### Pending
- [ ] 8.1-8.3 - Testing & QA
- [ ] 9.1-9.2 - Store submission prep
- [ ] Tests & QA
- [ ] Chrome Web Store submission

## License

MIT (or your preferred license)

## Contributing

This is a personal project, but feel free to fork and adapt for your own use!
