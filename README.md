# YT Watch Later in Home Feed

A Chrome/Opera extension that surfaces your YouTube Watch Later playlist as a native-looking horizontal shelf at the top of the YouTube homepage—no OAuth required!

## Features

- 🎯 **Watch Later videos on homepage** - Your saved videos appear in a dedicated shelf, just like YouTube Shorts
- 🔄 **DOM Scraping (No OAuth)** - Automatically extracts data when you visit your Watch Later page—no tedious authentication setup
- 🎨 **Native YouTube styling** - Seamless integration with bold header and clock icon matching YouTube's design language
- ⚙️ **Customizable display** - Choose between compact (210px) or large (360px) thumbnails
- ⌨️ **Keyboard accessible** - Full arrow key navigation with Home/End support
- 🔒 **Privacy-focused** - Zero external data transmission, everything stays in your browser
- ⚡ **Smart caching** - 20-minute default TTL reduces page loads (configurable)
- 📱 **Responsive design** - Adapts seamlessly to different screen sizes
- 🚀 **GPU-accelerated** - Smooth scrolling with progressive image loading

## How It Works

The extension uses **DOM scraping** instead of OAuth, making setup effortless:

1. **Install the extension** - Load it into Chrome/Opera (no credentials needed!)
2. **Visit your Watch Later page** once - The extension automatically extracts your video data
3. **Go to YouTube homepage** - Your Watch Later shelf appears at the top of the feed
4. **Automatic updates** - Visiting Watch Later again refreshes the data (or enable auto-refresh in settings)

No API keys, no OAuth flow, no quotas—just instant access to your saved videos!

## Installation

### Option 1: Load Unpacked (Development)

1. **Download/Clone this repository**
   ```bash
   git clone https://github.com/bk-bf/yt-watch-later-home-injector.git
   cd yt-watch-later-home-injector
   ```

2. **Load in Chrome/Opera:**
   - Open `chrome://extensions/` (or `opera://extensions/`)
   - Enable **Developer mode** (toggle in top-right)
   - Click **Load unpacked**
   - Select the project folder

3. **First-time setup:**
   - Visit [youtube.com/playlist?list=WL](https://www.youtube.com/playlist?list=WL)
   - Go to [youtube.com](https://www.youtube.com) - Your shelf appears!

### Option 2: Chrome Web Store (Coming Soon)

Once published, install directly from the Chrome Web Store with one click.

## Settings

Access settings by right-clicking the extension icon or via `chrome://extensions/`:

- **Enable/Disable** - Toggle the shelf on/off
- **Number of videos** - Show 3-10 videos (default: 5)
- **Cache duration** - How long to cache data in minutes (default: 20)
- **Thumbnail size** - Compact (210px) or Large (360px) 
- **Show empty state** - Display message when Watch Later is empty
- **Auto-refresh** - Automatically update when visiting Watch Later page

## Usage Tips

- **First run:** Visit your Watch Later page once to initialize data
- **Refresh data:** Visit Watch Later again or enable auto-refresh in settings
- **Keyboard navigation:** Use arrow keys to browse, Enter to open, Home/End to jump
- **Cache control:** Adjust TTL if you add/remove videos frequently
- **Privacy:** All data stays local—nothing leaves your browser

## Architecture

The extension uses DOM scraping for zero-setup convenience:

1. **Content Script (injector.js)** - Detects YouTube homepage and injects the shelf
2. **Content Script (watchLaterScraper.js)** - Extracts data from Watch Later page's `ytInitialData`
3. **Service Worker (background.js)** - Manages cached data and settings
4. **Options Page** - User-configurable settings (items, TTL, thumbnail size, etc.)

### Key Files

```
.
├── manifest.json            # Extension configuration (MV3)
├── background.js            # Service worker (caching, messaging)
├── injector.js              # Homepage injection & carousel
├── injector.css             # Scoped styles (wli- prefix)
├── watchLaterScraper.js     # DOM scraper for Watch Later page
├── options.html/js          # Settings page
└── mock-youtube.html        # Development test harness
```

## Permissions

- `storage` - Cache scraped playlist data and user settings locally

That's it! No identity permissions, no API access needed.

## Privacy & Security

- ✅ **No OAuth** - No identity permissions required
- ✅ **No external servers** - All data stays in your browser
- ✅ **No tracking** - Zero analytics or telemetry
- ✅ **Read-only scraping** - Only reads public data from pages you visit
- ✅ **Open source** - All code is auditable
- ✅ **Minimal permissions** - Only requests `storage` permission

Your Watch Later data never leaves your device.


## Development

For developers who want to contribute or modify:

**Testing:** Open `mock-youtube.html` for local testing without YouTube
**Debugging:** Check console logs prefixed with `[WLI]` (injector) or `[WL Scraper]`
**Structure:** See `.kiro/` for complete implementation details

## License

MIT License - See LICENSE file

## Contributing

Issues and pull requests welcome! This project prioritizes:
- Privacy and security
- Native YouTube look and feel  
- Performance and accessibility
- Zero-setup user experience
