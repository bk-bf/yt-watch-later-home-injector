#!/bin/bash

# Quick Start Script for YT Watch Later Extension
# This script helps you load the extension in Chrome for testing

echo "=================================================="
echo "YT Watch Later Extension - Quick Start"
echo "=================================================="
echo ""

# Check if Chrome is installed
if [[ "$OSTYPE" == "darwin"* ]]; then
    CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    if [ ! -f "$CHROME_PATH" ]; then
        echo "❌ Google Chrome not found at: $CHROME_PATH"
        exit 1
    fi
else
    echo "⚠️  This script is optimized for macOS"
    echo "    For other OS, manually open chrome://extensions/"
fi

echo "📋 Steps to load the extension:"
echo ""
echo "1. Open Chrome extensions page:"
echo "   → chrome://extensions/"
echo ""
echo "2. Enable Developer Mode (toggle in top-right)"
echo ""
echo "3. Click 'Load unpacked'"
echo ""
echo "4. Select this folder:"
echo "   → $(pwd)"
echo ""
echo "5. Copy the Extension ID"
echo ""
echo "=================================================="
echo ""
echo "🔑 OAuth Setup Required:"
echo "   Follow instructions in SETUP.md to:"
echo "   - Create Google Cloud project"
echo "   - Enable YouTube Data API v3"
echo "   - Create OAuth 2.0 credentials"
echo "   - Update manifest.json with Client ID"
echo ""
echo "=================================================="
echo ""
echo "🧪 For local testing (no OAuth needed):"
echo "   → open mock-youtube.html"
echo ""
echo "🚀 For production testing:"
echo "   1. Setup OAuth (see SETUP.md)"
echo "   2. Load extension in Chrome"
echo "   3. Visit youtube.com"
echo ""
echo "=================================================="

# Offer to open mock page
read -p "Open mock-youtube.html for local testing? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    open mock-youtube.html
    echo "✅ Mock page opened in browser"
fi

# Offer to open extensions page
read -p "Open chrome://extensions/ to load extension? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        "$CHROME_PATH" "chrome://extensions/"
        echo "✅ Chrome extensions page opened"
    else
        echo "⚠️  Please manually open chrome://extensions/"
    fi
fi

echo ""
echo "📚 Documentation:"
echo "   - SETUP.md - Complete OAuth setup guide"
echo "   - README.md - Development documentation"
echo "   - PRODUCTION_READY.md - Testing checklist"
echo ""
echo "Happy coding! 🎉"
