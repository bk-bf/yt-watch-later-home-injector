/**
 * Background Service Worker
 * Handles authentication, API calls, caching, and messaging with content scripts
 */

// Import YouTube API wrapper
importScripts('youtubeApi.js');

// Authentication state
let cachedToken = null;
let tokenExpiryTime = null;

// Cache configuration
const CACHE_KEY = 'watchLaterCache';
const CACHE_TTL_KEY = 'cacheTTL';
const DEFAULT_CACHE_TTL = 20 * 60 * 1000; // 20 minutes in milliseconds

// Settings keys and defaults
const SETTINGS_KEY = 'settings';
const DEFAULT_SETTINGS = {
    enabled: true,
    itemCount: 5,
    cacheTTL: 20, // minutes
    showEmptyState: true
};

/**
 * Get OAuth access token using Chrome Identity API
 * @param {boolean} interactive - Whether to show auth UI if needed
 * @returns {Promise<string|null>} Access token or null on error
 */
async function getAuthToken(interactive = false) {
    try {
        // Check if we have a valid cached token
        if (cachedToken && tokenExpiryTime && Date.now() < tokenExpiryTime) {
            console.log('[Auth] Using cached token');
            return cachedToken;
        }

        console.log(`[Auth] Requesting new token (interactive: ${interactive})`);

        // Request token from Chrome Identity API
        const token = await chrome.identity.getAuthToken({
            interactive: interactive
        });

        if (token) {
            cachedToken = token;
            // Tokens typically expire in 1 hour, cache for 50 minutes to be safe
            tokenExpiryTime = Date.now() + (50 * 60 * 1000);
            console.log('[Auth] Token obtained successfully');
            return token;
        }

        console.warn('[Auth] No token returned');
        return null;

    } catch (error) {
        console.error('[Auth] Error getting token:', error);

        // Handle specific error cases
        if (error.message?.includes('OAuth2 not granted or revoked')) {
            console.warn('[Auth] User needs to grant permissions');
            return null;
        }

        if (error.message?.includes('OAuth2 client ID')) {
            console.error('[Auth] Invalid OAuth2 client ID in manifest.json');
            console.error('[Auth] Replace YOUR_CLIENT_ID_HERE with actual client ID');
            return null;
        }

        // Clear cached token on error
        cachedToken = null;
        tokenExpiryTime = null;

        return null;
    }
}

/**
 * Revoke the current auth token and clear cache
 * Useful for forcing re-authentication
 */
async function revokeAuthToken() {
    if (cachedToken) {
        try {
            await chrome.identity.removeCachedAuthToken({ token: cachedToken });
            console.log('[Auth] Token revoked successfully');
        } catch (error) {
            console.error('[Auth] Error revoking token:', error);
        }
    }

    cachedToken = null;
    tokenExpiryTime = null;
}

/**
 * Check authentication status without triggering interactive flow
 * @returns {Promise<{authenticated: boolean, needsAuth: boolean}>}
 */
async function checkAuthStatus() {
    const token = await getAuthToken(false);

    return {
        authenticated: !!token,
        needsAuth: !token
    };
}

/**
 * Trigger interactive authentication flow
 * Called when user explicitly wants to sign in
 * @returns {Promise<{success: boolean, token: string|null, error: string|null}>}
 */
async function triggerInteractiveAuth() {
    console.log('[Auth] Starting interactive authentication flow');

    try {
        const token = await getAuthToken(true);

        if (token) {
            return {
                success: true,
                token: token,
                error: null
            };
        }

        return {
            success: false,
            token: null,
            error: 'No token returned - user may have cancelled'
        };

    } catch (error) {
        return {
            success: false,
            token: null,
            error: error.message || 'Authentication failed'
        };
    }
}

/**
 * Get cache TTL from settings or use default
 * @returns {Promise<number>} Cache TTL in milliseconds
 */
async function getCacheTTL() {
    try {
        const result = await chrome.storage.local.get(CACHE_TTL_KEY);
        const ttlMinutes = result[CACHE_TTL_KEY];

        if (ttlMinutes && typeof ttlMinutes === 'number' && ttlMinutes > 0) {
            return ttlMinutes * 60 * 1000; // Convert minutes to milliseconds
        }
    } catch (error) {
        console.warn('[Cache] Error reading TTL from storage:', error);
    }

    return DEFAULT_CACHE_TTL;
}

/**
 * Get cached playlist items if still valid
 * @returns {Promise<{items: Array, timestamp: number}|null>} Cached data or null if expired/missing
 */
async function getCachedPlaylist() {
    try {
        const result = await chrome.storage.local.get(CACHE_KEY);
        const cached = result[CACHE_KEY];

        if (!cached || !cached.items || !cached.timestamp) {
            console.log('[Cache] No cached data found');
            return null;
        }

        const ttl = await getCacheTTL();
        const age = Date.now() - cached.timestamp;

        if (age > ttl) {
            console.log(`[Cache] Cache expired (age: ${Math.round(age / 1000)}s, TTL: ${Math.round(ttl / 1000)}s)`);
            return null;
        }

        console.log(`[Cache] Using cached data (age: ${Math.round(age / 1000)}s, ${cached.items.length} items)`);
        return cached;

    } catch (error) {
        console.error('[Cache] Error reading from storage:', error);
        return null;
    }
}

/**
 * Save playlist items to cache
 * @param {Array} items - Playlist items to cache
 * @returns {Promise<boolean>} Success status
 */
async function setCachedPlaylist(items) {
    try {
        const cacheData = {
            items: items,
            timestamp: Date.now()
        };

        await chrome.storage.local.set({ [CACHE_KEY]: cacheData });
        console.log(`[Cache] Cached ${items.length} items`);
        return true;

    } catch (error) {
        console.error('[Cache] Error writing to storage:', error);
        return false;
    }
}

/**
 * Clear cached playlist data
 * @returns {Promise<boolean>} Success status
 */
async function clearCache() {
    try {
        await chrome.storage.local.remove(CACHE_KEY);
        console.log('[Cache] Cache cleared');
        return true;
    } catch (error) {
        console.error('[Cache] Error clearing cache:', error);
        return false;
    }
}

/**
 * Fetch Watch Later items with caching
 * @param {boolean} forceRefresh - Force API fetch even if cache is valid
 * @param {number} maxResults - Maximum items to fetch
 * @returns {Promise<{items: Array, fromCache: boolean}>}
 */
async function getWatchLaterWithCache(forceRefresh = false, maxResults = 10) {
    // Check cache first unless force refresh
    if (!forceRefresh) {
        const cached = await getCachedPlaylist();
        if (cached) {
            return {
                items: cached.items,
                fromCache: true,
                timestamp: cached.timestamp
            };
        }
    }

    // Fetch fresh data from API
    console.log('[Cache] Fetching fresh data from API');
    const token = await getAuthToken(false);

    if (!token) {
        throw new Error('Not authenticated');
    }

    const items = await fetchWatchLaterItems(token, maxResults);

    // Cache the fresh data
    await setCachedPlaylist(items);

    return {
        items: items,
        fromCache: false,
        timestamp: Date.now()
    };
}

/**
 * Get user settings with defaults
 * @returns {Promise<Object>} Settings object
 */
async function getSettings() {
    try {
        const result = await chrome.storage.sync.get(SETTINGS_KEY);
        const settings = result[SETTINGS_KEY] || {};

        // Merge with defaults
        const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };

        console.log('[Settings] Loaded settings:', mergedSettings);
        return mergedSettings;

    } catch (error) {
        console.error('[Settings] Error reading settings:', error);
        return DEFAULT_SETTINGS;
    }
}

/**
 * Save user settings
 * @param {Object} settings - Settings object to save
 * @returns {Promise<boolean>} Success status
 */
async function saveSettings(settings) {
    try {
        // Validate settings
        const validatedSettings = {
            enabled: typeof settings.enabled === 'boolean' ? settings.enabled : DEFAULT_SETTINGS.enabled,
            itemCount: (settings.itemCount >= 3 && settings.itemCount <= 10) ? settings.itemCount : DEFAULT_SETTINGS.itemCount,
            cacheTTL: (settings.cacheTTL >= 5 && settings.cacheTTL <= 60) ? settings.cacheTTL : DEFAULT_SETTINGS.cacheTTL,
            showEmptyState: typeof settings.showEmptyState === 'boolean' ? settings.showEmptyState : DEFAULT_SETTINGS.showEmptyState
        };

        await chrome.storage.sync.set({ [SETTINGS_KEY]: validatedSettings });

        // Also update cache TTL in local storage for cache functions
        await chrome.storage.local.set({ [CACHE_TTL_KEY]: validatedSettings.cacheTTL });

        console.log('[Settings] Settings saved:', validatedSettings);
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
        await chrome.storage.sync.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
        await chrome.storage.local.set({ [CACHE_TTL_KEY]: DEFAULT_SETTINGS.cacheTTL });
        console.log('[Settings] Settings reset to defaults');
        return true;
    } catch (error) {
        console.error('[Settings] Error resetting settings:', error);
        return false;
    }
}

/**
 * Message handler for content script requests
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Background] Received message:', message.type);

    // Handle async operations
    (async () => {
        try {
            switch (message.type) {
                case 'CHECK_AUTH':
                    // Check if user is authenticated (non-interactive)
                    const status = await checkAuthStatus();
                    sendResponse({ success: true, data: status });
                    break;

                case 'GET_AUTH_TOKEN':
                    // Get token (non-interactive by default)
                    const interactive = message.interactive || false;
                    const token = await getAuthToken(interactive);
                    sendResponse({
                        success: !!token,
                        token: token,
                        needsAuth: !token
                    });
                    break;

                case 'SIGN_IN':
                    // Trigger interactive sign-in flow
                    const authResult = await triggerInteractiveAuth();
                    sendResponse(authResult);
                    break;

                case 'SIGN_OUT':
                    // Revoke token and clear cache
                    await revokeAuthToken();
                    sendResponse({ success: true });
                    break;

                case 'GET_WATCH_LATER':
                    // Fetch Watch Later playlist with caching
                    try {
                        const forceRefresh = message.forceRefresh || false;
                        const maxResults = message.maxResults || 10;

                        const result = await getWatchLaterWithCache(forceRefresh, maxResults);

                        sendResponse({
                            success: true,
                            items: result.items,
                            count: result.items.length,
                            fromCache: result.fromCache,
                            timestamp: result.timestamp
                        });
                    } catch (error) {
                        console.error('[Background] Error fetching Watch Later:', error);

                        // Check if it's an auth error
                        if (error.message?.includes('Authentication failed') ||
                            error.message?.includes('Not authenticated')) {
                            // Clear cached token and request re-auth
                            cachedToken = null;
                            tokenExpiryTime = null;
                            sendResponse({
                                success: false,
                                needsAuth: true,
                                error: error.message
                            });
                        } else {
                            sendResponse({
                                success: false,
                                error: error.message
                            });
                        }
                    }
                    break;

                case 'REFRESH_CACHE':
                    // Force refresh cache
                    try {
                        const maxResults = message.maxResults || 10;
                        const result = await getWatchLaterWithCache(true, maxResults);

                        sendResponse({
                            success: true,
                            items: result.items,
                            count: result.items.length,
                            refreshed: true
                        });
                    } catch (error) {
                        console.error('[Background] Error refreshing cache:', error);
                        sendResponse({
                            success: false,
                            error: error.message
                        });
                    }
                    break;

                case 'CLEAR_CACHE':
                    // Clear cached data
                    const cleared = await clearCache();
                    sendResponse({ success: cleared });
                    break;

                case 'GET_SETTINGS':
                    // Get user settings
                    const settings = await getSettings();
                    sendResponse({
                        success: true,
                        settings: settings
                    });
                    break;

                case 'SAVE_SETTINGS':
                    // Save user settings
                    if (!message.settings) {
                        sendResponse({
                            success: false,
                            error: 'Settings object required'
                        });
                        break;
                    }

                    const saved = await saveSettings(message.settings);
                    if (saved) {
                        // Notify all tabs about settings change
                        const tabs = await chrome.tabs.query({ url: '*://www.youtube.com/*' });
                        tabs.forEach(tab => {
                            chrome.tabs.sendMessage(tab.id, {
                                type: 'SETTINGS_UPDATED',
                                settings: message.settings
                            }).catch(() => {
                                // Tab might not have content script loaded, ignore error
                            });
                        });
                    }

                    sendResponse({
                        success: saved,
                        settings: saved ? message.settings : null
                    });
                    break;

                case 'RESET_SETTINGS':
                    // Reset settings to defaults
                    const reset = await resetSettings();
                    if (reset) {
                        // Notify all tabs about settings reset
                        const tabs = await chrome.tabs.query({ url: '*://www.youtube.com/*' });
                        tabs.forEach(tab => {
                            chrome.tabs.sendMessage(tab.id, {
                                type: 'SETTINGS_UPDATED',
                                settings: DEFAULT_SETTINGS
                            }).catch(() => {
                                // Tab might not have content script loaded, ignore error
                            });
                        });
                    }

                    sendResponse({
                        success: reset,
                        settings: reset ? DEFAULT_SETTINGS : null
                    });
                    break;

                default:
                    console.warn('[Background] Unknown message type:', message.type);
                    sendResponse({ success: false, error: 'Unknown message type' });
            }
        } catch (error) {
            console.error('[Background] Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();

    // Return true to indicate async response
    return true;
});

/**
 * Extension installation/update handler
 */
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('[Background] Extension installed/updated:', details.reason);

    if (details.reason === 'install') {
        console.log('[Background] First install - initializing defaults');
        // Initialize default settings on first install
        await saveSettings(DEFAULT_SETTINGS);
    } else if (details.reason === 'update') {
        console.log('[Background] Updated from version:', details.previousVersion);
        // Ensure new settings fields are present
        const currentSettings = await getSettings();
        await saveSettings(currentSettings);
    }
});

/**
 * Service worker startup
 */
console.log('[Background] Service worker started');
console.log('[Background] Ready to handle authentication requests');
