/**
 * Background Service Worker
 * Handles data management, caching, and messaging with content scripts
 * Note: No longer uses OAuth or YouTube API - data is scraped from Watch Later page
 */

// Cache configuration
const CACHE_KEY = 'watchLaterData';
const DEFAULT_CACHE_TTL = 20 * 60 * 1000; // 20 minutes in milliseconds

// Settings keys and defaults
const SETTINGS_KEY = 'settings';
const DEFAULT_SETTINGS = {
    enabled: true,
    itemCount: 5,
    cacheTTL: 20, // minutes
    showEmptyState: true,
    autoRefresh: true // Auto-refresh when visiting Watch Later page
};

/**
 * Get Watch Later data from storage
 * @returns {Promise<Object|null>} Scraped Watch Later data or null
 */
async function getWatchLaterData() {
    try {
        const result = await chrome.storage.local.get(CACHE_KEY);
        const data = result[CACHE_KEY];

        if (!data) {
            console.log('[Data] No Watch Later data in storage');
            return null;
        }

        // Check if data is still valid (within TTL)
        const settings = await getSettings();
        const ttl = (settings.cacheTTL || 20) * 60 * 1000;
        const age = Date.now() - data.timestamp;

        if (age > ttl) {
            console.log(`[Data] Cached data expired (age: ${Math.round(age / 1000)}s, TTL: ${Math.round(ttl / 1000)}s)`);
            return null;
        }

        console.log(`[Data] Returning cached data: ${data.videos?.length || 0} videos`);
        return data;

    } catch (error) {
        console.error('[Data] Error getting Watch Later data:', error);
        return null;
    }
}

/**
 * Check if Watch Later data exists and is valid
 * @returns {Promise<boolean>}
 */
async function hasValidData() {
    const data = await getWatchLaterData();
    return data !== null;
}

/**
 * Clear cached Watch Later data
 */
async function clearData() {
    try {
        await chrome.storage.local.remove(CACHE_KEY);
        console.log('[Data] Cleared Watch Later data');
        return true;
    } catch (error) {
        console.error('[Data] Error clearing data:', error);
        return false;
    }
}

/**
 * Request scraper to refresh Watch Later data
 * Opens Watch Later page in background tab to trigger scraper
 */
async function refreshWatchLaterData() {
    try {
        console.log('[Refresh] Opening Watch Later page to scrape data...');
        
        // Open Watch Later page in a new tab (will trigger scraper)
        const tab = await chrome.tabs.create({
            url: 'https://www.youtube.com/playlist?list=WL',
            active: false // Don't switch to tab
        });

        // Close the tab after a few seconds (give scraper time to run)
        setTimeout(async () => {
            try {
                await chrome.tabs.remove(tab.id);
                console.log('[Refresh] Background tab closed');
            } catch (error) {
                // Tab may already be closed
            }
        }, 3000);

        return { success: true };

    } catch (error) {
        console.error('[Refresh] Error refreshing data:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get settings from storage or return defaults
 * @returns {Promise<Object>} Settings object
 */
async function getSettings() {
    try {
        const result = await chrome.storage.local.get(SETTINGS_KEY);
        const settings = result[SETTINGS_KEY];

        if (settings && typeof settings === 'object') {
            // Merge with defaults to handle any missing keys
            return { ...DEFAULT_SETTINGS, ...settings };
        }

        console.log('[Settings] Using default settings');
        return { ...DEFAULT_SETTINGS };

    } catch (error) {
        console.error('[Settings] Error reading settings:', error);
        return { ...DEFAULT_SETTINGS };
    }
}

/**
 * Save settings to storage
 * @param {Object} settings - Settings to save
 * @returns {Promise<boolean>} Success status
 */
async function saveSettings(settings) {
    try {
        // Validate settings
        if (!settings || typeof settings !== 'object') {
            throw new Error('Invalid settings object');
        }

        // Merge with current settings to preserve any unmodified values
        const currentSettings = await getSettings();
        const newSettings = { ...currentSettings, ...settings };

        // Validate specific fields
        if (typeof newSettings.itemCount === 'number') {
            newSettings.itemCount = Math.max(3, Math.min(10, newSettings.itemCount));
        }

        if (typeof newSettings.cacheTTL === 'number') {
            newSettings.cacheTTL = Math.max(1, Math.min(1440, newSettings.cacheTTL)); // 1 min to 24 hours
        }

        await chrome.storage.local.set({ [SETTINGS_KEY]: newSettings });
        console.log('[Settings] Settings saved:', newSettings);

        // Notify all tabs about settings change
        const tabs = await chrome.tabs.query({ url: '*://www.youtube.com/*' });
        for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, {
                type: 'SETTINGS_UPDATED',
                settings: newSettings
            }).catch(() => {
                // Ignore errors for tabs without content script
            });
        }

        return true;

    } catch (error) {
        console.error('[Settings] Error saving settings:', error);
        return false;
    }
}

/**
 * Reset settings to defaults
 * @returns {Promise<boolean>} Success status
 */
async function resetSettings() {
    try {
        await chrome.storage.local.set({ [SETTINGS_KEY]: { ...DEFAULT_SETTINGS } });
        console.log('[Settings] Settings reset to defaults');

        // Notify all tabs
        const tabs = await chrome.tabs.query({ url: '*://www.youtube.com/*' });
        for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, {
                type: 'SETTINGS_UPDATED',
                settings: DEFAULT_SETTINGS
            }).catch(() => {});
        }

        return true;
    } catch (error) {
        console.error('[Settings] Error resetting settings:', error);
        return false;
    }
}

/**
 * Message handler for content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Background] Received message:', message.type);

    // Handle different message types
    switch (message.type) {
        case 'GET_WATCH_LATER':
            // Get Watch Later data from storage
            getWatchLaterData().then(data => {
                if (data && data.videos) {
                    const settings = message.settings || { itemCount: 5 };
                    const videos = data.videos.slice(0, settings.itemCount || 5);
                    
                    sendResponse({
                        success: true,
                        videos: videos,
                        timestamp: data.timestamp,
                        fromCache: true
                    });
                } else {
                    sendResponse({
                        success: false,
                        error: 'No data available',
                        needsRefresh: true,
                        message: 'Visit your Watch Later page to load videos'
                    });
                }
            }).catch(error => {
                sendResponse({
                    success: false,
                    error: error.message
                });
            });
            return true; // Keep channel open for async response

        case 'REFRESH_WATCH_LATER':
            // Trigger refresh by opening Watch Later page
            refreshWatchLaterData().then(result => {
                sendResponse(result);
            }).catch(error => {
                sendResponse({
                    success: false,
                    error: error.message
                });
            });
            return true;

        case 'CLEAR_CACHE':
            // Clear cached data
            clearData().then(success => {
                sendResponse({ success });
            }).catch(error => {
                sendResponse({
                    success: false,
                    error: error.message
                });
            });
            return true;

        case 'GET_SETTINGS':
            // Get current settings
            getSettings().then(settings => {
                sendResponse({
                    success: true,
                    settings: settings
                });
            }).catch(error => {
                sendResponse({
                    success: false,
                    error: error.message,
                    settings: DEFAULT_SETTINGS
                });
            });
            return true;

        case 'SAVE_SETTINGS':
            // Save settings
            saveSettings(message.settings).then(success => {
                sendResponse({ success });
            }).catch(error => {
                sendResponse({
                    success: false,
                    error: error.message
                });
            });
            return true;

        case 'RESET_SETTINGS':
            // Reset to defaults
            resetSettings().then(success => {
                sendResponse({ success });
            }).catch(error => {
                sendResponse({
                    success: false,
                    error: error.message
                });
            });
            return true;

        case 'HAS_DATA':
            // Check if data exists
            hasValidData().then(hasData => {
                sendResponse({
                    success: true,
                    hasData: hasData
                });
            }).catch(error => {
                sendResponse({
                    success: false,
                    error: error.message
                });
            });
            return true;

        case 'WATCH_LATER_UPDATED':
            // Notify from scraper that data was updated
            console.log(`[Background] Watch Later data updated: ${message.count} videos`);
            
            // Notify all YouTube tabs to refresh
            chrome.tabs.query({ url: '*://www.youtube.com/*' }).then(tabs => {
                for (const tab of tabs) {
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'DATA_REFRESHED',
                        count: message.count
                    }).catch(() => {});
                }
            });
            
            sendResponse({ success: true });
            return false;

        default:
            console.warn('[Background] Unknown message type:', message.type);
            sendResponse({
                success: false,
                error: 'Unknown message type'
            });
            return false;
    }
});

// Log when service worker starts
console.log('[Background] Service worker initialized (DOM scraping mode)');
