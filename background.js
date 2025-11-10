/**
 * Background Service Worker
 * Handles authentication, API calls, caching, and messaging with content scripts
 */

// Import YouTube API wrapper
importScripts('youtubeApi.js');

// Authentication state
let cachedToken = null;
let tokenExpiryTime = null;

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
                    // Fetch Watch Later playlist
                    try {
                        const token = await getAuthToken(false);
                        if (!token) {
                            sendResponse({
                                success: false,
                                needsAuth: true,
                                error: 'Not authenticated'
                            });
                            break;
                        }

                        const maxResults = message.maxResults || 10;
                        const items = await fetchWatchLaterItems(token, maxResults);
                        
                        sendResponse({
                            success: true,
                            items: items,
                            count: items.length
                        });
                    } catch (error) {
                        console.error('[Background] Error fetching Watch Later:', error);
                        
                        // Check if it's an auth error
                        if (error.message?.includes('Authentication failed')) {
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
chrome.runtime.onInstalled.addListener((details) => {
    console.log('[Background] Extension installed/updated:', details.reason);

    if (details.reason === 'install') {
        console.log('[Background] First install - welcome!');
        // Could open options page or show welcome message
    } else if (details.reason === 'update') {
        console.log('[Background] Updated from version:', details.previousVersion);
    }
});

/**
 * Service worker startup
 */
console.log('[Background] Service worker started');
console.log('[Background] Ready to handle authentication requests');
