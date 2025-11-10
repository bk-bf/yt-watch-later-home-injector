# Setup Guide: Running on YouTube

This guide walks you through setting up the extension to work on the actual YouTube website.

## Prerequisites

- Google Chrome or Opera browser
- A Google account with access to Google Cloud Console

---

## Step 1: Create OAuth 2.0 Credentials

The extension needs OAuth credentials to access your YouTube Watch Later playlist.

### 1.1 Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Name it: `YT Watch Later Extension` (or your choice)
4. Click **Create**

### 1.2 Enable YouTube Data API v3

1. In your project, go to **APIs & Services** → **Library**
2. Search for **YouTube Data API v3**
3. Click on it and press **Enable**

### 1.3 Create OAuth 2.0 Client ID

1. Go to **APIs & Services** → **Credentials**
2. Click **Configure Consent Screen**:
   - Choose **External** (unless you have a Google Workspace)
   - Fill in required fields:
     - App name: `YT Watch Later Extension`
     - User support email: Your email
     - Developer contact: Your email
   - Click **Save and Continue**
   - On **Scopes** page, click **Add or Remove Scopes**:
     - Search for `youtube.readonly`
     - Select: `https://www.googleapis.com/auth/youtube.readonly`
     - Click **Update** → **Save and Continue**
   - On **Test users**, add your Google account email
   - Click **Save and Continue**

3. Go back to **Credentials** tab
4. Click **Create Credentials** → **OAuth client ID**
5. Select **Application type**: `Chrome Extension`
6. Name: `YT Watch Later Extension Client`
7. For **Item ID**: Use a temporary placeholder like `abcdefghijklmnopqrstuvwxyzabcdef` (we'll update this after loading the extension)
8. Click **Create**
9. **Copy the Client ID** (format: `xxx.apps.googleusercontent.com`)

---

## Step 2: Configure the Extension

### 2.1 Update manifest.json

1. Open `manifest.json` in your editor
2. Find the `oauth2` section
3. Replace `YOUR_CLIENT_ID_HERE` with your actual Client ID:

```json
"oauth2": {
    "client_id": "123456789.apps.googleusercontent.com",
    "scopes": [
        "https://www.googleapis.com/auth/youtube.readonly"
    ]
}
```

### 2.2 Get Extension ID

1. Open Chrome/Opera
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select the extension folder
6. **Copy the Extension ID** (long string like `abcdefghijklmnopqrstuvwxyzabcdef`)

### 2.3 Update OAuth Client with Extension ID

1. Go back to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Replace the temporary Item ID with your real **Extension ID**
5. Click **Save**

---

## Step 3: Load & Test the Extension

### 3.1 Load Extension

If not already loaded:
1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the extension folder

### 3.2 Test on YouTube

1. Navigate to [youtube.com](https://www.youtube.com)
2. The extension should:
   - Prompt you to sign in (if not already authenticated)
   - Fetch your Watch Later playlist
   - Inject a shelf at the top of the homepage feed

### 3.3 Grant Permissions

On first run:
1. Click the **Sign in** button in the shelf
2. You'll see Google's OAuth consent screen
3. Review permissions (read-only access to YouTube)
4. Click **Allow**
5. The shelf should populate with your Watch Later videos

---

## Step 4: Verify Everything Works

### Test Checklist

- [ ] Shelf appears on YouTube homepage
- [ ] Videos load with thumbnails, titles, and channel names
- [ ] Clicking a video opens it in the same/new tab
- [ ] Keyboard navigation works (Arrow keys, Home/End)
- [ ] Cache works (reload page within 20 minutes - should be instant)
- [ ] Empty state shows if Watch Later is empty
- [ ] Auth prompt appears if signed out

---

## Troubleshooting

### "Error fetching Watch Later" message

**Cause**: API quota exceeded or network issue

**Solution**:
- Wait a few minutes and refresh
- Check [API quotas](https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas)
- Default quota: 10,000 units/day (this extension uses ~3-5 per fetch)

### "Sign in to view your Watch Later playlist"

**Cause**: OAuth token invalid or expired

**Solution**:
- Click **Sign in** button
- Revoke and re-grant permissions if needed
- Check OAuth client ID in manifest.json is correct

### Shelf doesn't appear

**Cause**: YouTube DOM structure changed or navigation issue

**Solution**:
- Check browser console (`F12`) for errors
- Look for `[WLI]` prefixed logs
- Ensure you're on the homepage (not search, video page, etc.)

### Extension ID mismatch error

**Cause**: OAuth client configured with wrong extension ID

**Solution**:
1. Go to `chrome://extensions/`
2. Copy your extension's ID
3. Update it in Google Cloud Console OAuth client
4. Reload the extension

---

## Development vs Production

### Development Mode (Current)
- Uses `mockChromeApi.js` for local testing
- No real API calls
- Mock data with 5 sample videos

### Production Mode (YouTube)
- Real OAuth authentication
- Live YouTube Data API calls
- Your actual Watch Later playlist
- API quota limits apply

---

## Optional: Add Custom Icons

Replace `placeholder.png` with actual icons:

- `icon16.png` (16x16px)
- `icon48.png` (48x48px)
- `icon128.png` (128x128px)

Update `manifest.json`:

```json
"icons": {
    "16": "icon16.png",
    "48": "icon48.png",
    "128": "icon128.png"
},
"action": {
    "default_icon": {
        "16": "icon16.png",
        "48": "icon48.png"
    }
}
```

---

## Privacy & Security Notes

- **Read-only access**: Extension only reads your Watch Later playlist
- **No external servers**: All data stays between your browser and YouTube
- **Local caching**: Cache stored in browser using `chrome.storage.local`
- **No tracking**: No analytics, no user data collection
- **Open source**: All code is visible and auditable

---

## Support

If you encounter issues:

1. Check browser console for `[WLI]` logs
2. Verify OAuth credentials are correct
3. Ensure YouTube Data API v3 is enabled
4. Check API quotas aren't exceeded

For bugs or feature requests, please file an issue on the project repository.
