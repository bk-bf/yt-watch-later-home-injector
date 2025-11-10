# Publishing Checklist

Ready to publish to Chrome Web Store? Complete these tasks:

### Required Assets
- [ ] **Extension Icon** - Create 16x16, 48x48, 128x128 PNG icons (current: placeholder.png)
- [ ] **Store Icon** - 128x128 PNG for Web Store listing
- [ ] **Screenshots** - 1280x800 or 640x400 showing the shelf on YouTube homepage (3-5 images)
- [ ] **Promo Tile** - 440x280 PNG (optional but recommended)

### Store Listing Content
- [ ] **Name** - "Watch Later in Home Feed" or similar (max 45 chars)
- [ ] **Short Description** - 132 chars max summary
- [ ] **Detailed Description** - Feature list, benefits, usage instructions
- [ ] **Privacy Policy** - Add inline policy explaining data usage (DOM scraping, local storage)
- [ ] **Category** - Choose appropriate category (Productivity / Social & Communication)

### Technical Requirements  
- [ ] **Version Number** - Update to 1.0.0 in manifest.json
- [ ] **Permissions Justification** - Explain why `storage` permission is needed
- [ ] **Test Accounts** - Not needed (no OAuth)
- [ ] **Deobfuscated Code** - Ensure all code is readable (no minification for review)

### Pre-Submission Testing
- [ ] Test on Chrome stable (latest version)
- [ ] Test on Opera (if targeting Opera store)
- [ ] Verify all settings work correctly
- [ ] Test with empty Watch Later playlist
- [ ] Test with 1, 5, 10+ videos in Watch Later
- [ ] Verify no console errors on normal usage
- [ ] Test responsive behavior at different viewport sizes

### Submission Steps
1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devcenter)
2. Pay one-time $5 developer registration fee (if not registered)
3. Click "New Item" and upload ZIP of extension folder
4. Fill in store listing with prepared content
5. Submit for review (typically 1-3 days)

### Post-Publication
- [ ] Add Chrome Web Store link to README
- [ ] Create GitHub release with version tag
- [ ] Monitor reviews and support requests
- [ ] Plan future updates (if needed)

---
