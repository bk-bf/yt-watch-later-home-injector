/**
 * Mock Chrome Runtime API for local testing
 * This allows testing the content script in mock-youtube.html without loading as an extension
 */

// Only create mock if chrome.runtime doesn't exist (i.e., we're in mock-youtube.html)
if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.log('[Mock] Creating mock Chrome API');
    
    window.chrome = {
        runtime: {
            sendMessage: async function(message) {
                console.log('[Mock] Message sent:', message.type, message);
                
                // Simulate different responses based on message type
                switch (message.type) {
                    case 'GET_SETTINGS':
                        return {
                            success: true,
                            settings: {
                                enabled: true,
                                itemCount: 5,
                                cacheTTL: 20,
                                showEmptyState: true
                            }
                        };
                    
                    case 'CHECK_AUTH':
                        return {
                            success: true,
                            data: {
                                authenticated: true,  // Set to false to test auth prompt
                                needsAuth: false
                            }
                        };
                    
                    case 'GET_WATCH_LATER':
                        // Return mock playlist items
                        return {
                            success: true,
                            items: [
                                {
                                    id: 'item1',
                                    videoId: 'dQw4w9WgXcQ',
                                    title: 'Amazing Tutorial: Building Chrome Extensions',
                                    channelTitle: 'Tech Channel',
                                    publishedAt: '2024-01-15T10:30:00Z',
                                    thumbnails: {
                                        default: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg',
                                        medium: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
                                        high: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
                                    }
                                },
                                {
                                    id: 'item2',
                                    videoId: 'jNQXAC9IVRw',
                                    title: 'Complete JavaScript Course - 10 Hours',
                                    channelTitle: 'Code Academy',
                                    publishedAt: '2024-01-10T14:20:00Z',
                                    thumbnails: {
                                        default: 'https://i.ytimg.com/vi/jNQXAC9IVRw/default.jpg',
                                        medium: 'https://i.ytimg.com/vi/jNQXAC9IVRw/mqdefault.jpg',
                                        high: 'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg'
                                    }
                                },
                                {
                                    id: 'item3',
                                    videoId: 'M7lc1UVf-VE',
                                    title: 'Understanding Async/Await in 15 Minutes',
                                    channelTitle: 'Dev Tips',
                                    publishedAt: '2024-01-08T09:15:00Z',
                                    thumbnails: {
                                        default: 'https://i.ytimg.com/vi/M7lc1UVf-VE/default.jpg',
                                        medium: 'https://i.ytimg.com/vi/M7lc1UVf-VE/mqdefault.jpg',
                                        high: 'https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg'
                                    }
                                },
                                {
                                    id: 'item4',
                                    videoId: 'TlB_eWDSMt4',
                                    title: 'Advanced CSS Grid Techniques',
                                    channelTitle: 'Design Master',
                                    publishedAt: '2024-01-05T16:45:00Z',
                                    thumbnails: {
                                        default: 'https://i.ytimg.com/vi/TlB_eWDSMt4/default.jpg',
                                        medium: 'https://i.ytimg.com/vi/TlB_eWDSMt4/mqdefault.jpg',
                                        high: 'https://i.ytimg.com/vi/TlB_eWDSMt4/hqdefault.jpg'
                                    }
                                },
                                {
                                    id: 'item5',
                                    videoId: 'v8sB_r8KqBU',
                                    title: 'Node.js Best Practices 2024',
                                    channelTitle: 'Backend Pro',
                                    publishedAt: '2024-01-03T11:30:00Z',
                                    thumbnails: {
                                        default: 'https://i.ytimg.com/vi/v8sB_r8KqBU/default.jpg',
                                        medium: 'https://i.ytimg.com/vi/v8sB_r8KqBU/mqdefault.jpg',
                                        high: 'https://i.ytimg.com/vi/v8sB_r8KqBU/hqdefault.jpg'
                                    }
                                }
                            ],
                            count: 5,
                            fromCache: false,
                            timestamp: Date.now()
                        };
                    
                    case 'SIGN_IN':
                        // Simulate successful sign-in
                        await new Promise(resolve => setTimeout(resolve, 500));
                        return {
                            success: true,
                            token: 'mock_token_12345',
                            error: null
                        };
                    
                    case 'REFRESH_CACHE':
                        // Same as GET_WATCH_LATER but with refreshed: true
                        const watchLaterResponse = await this.sendMessage({ type: 'GET_WATCH_LATER' });
                        return {
                            ...watchLaterResponse,
                            refreshed: true
                        };
                    
                    default:
                        console.warn('[Mock] Unknown message type:', message.type);
                        return {
                            success: false,
                            error: 'Mock: Unknown message type'
                        };
                }
            },
            
            onMessage: {
                addListener: function(callback) {
                    console.log('[Mock] Message listener added');
                    // Store callback for potential future use
                    window._mockMessageListeners = window._mockMessageListeners || [];
                    window._mockMessageListeners.push(callback);
                }
            }
        }
    };
    
    console.log('[Mock] Mock Chrome API ready');
    console.log('[Mock] To test different states, modify the mock responses in mockChromeApi.js');
}

// Helper function to simulate settings update message
function simulateSettingsUpdate(newSettings) {
    if (window._mockMessageListeners) {
        window._mockMessageListeners.forEach(listener => {
            listener({
                type: 'SETTINGS_UPDATED',
                settings: newSettings
            }, {}, () => {});
        });
    }
}

// Expose helper functions for testing in console
window._wliMock = {
    // Test auth prompt
    testAuthPrompt: function() {
        const originalCheck = chrome.runtime.sendMessage;
        chrome.runtime.sendMessage = async function(msg) {
            if (msg.type === 'CHECK_AUTH') {
                return { success: true, data: { authenticated: false, needsAuth: true } };
            }
            return originalCheck.call(this, msg);
        };
        console.log('[Mock] Auth state set to: needs auth');
        console.log('[Mock] Reload page to see auth prompt');
    },
    
    // Test empty playlist
    testEmptyPlaylist: function() {
        const originalGet = chrome.runtime.sendMessage;
        chrome.runtime.sendMessage = async function(msg) {
            if (msg.type === 'GET_WATCH_LATER') {
                return { success: true, items: [], count: 0, fromCache: false, timestamp: Date.now() };
            }
            return originalGet.call(this, msg);
        };
        console.log('[Mock] Playlist set to: empty');
        console.log('[Mock] Reload page to see empty state');
    },
    
    // Test error state
    testError: function() {
        const originalGet = chrome.runtime.sendMessage;
        chrome.runtime.sendMessage = async function(msg) {
            if (msg.type === 'GET_WATCH_LATER') {
                return { success: false, error: 'Network error: Could not connect to API' };
            }
            return originalGet.call(this, msg);
        };
        console.log('[Mock] API set to: error state');
        console.log('[Mock] Reload page to see error state');
    },
    
    // Reset to normal state
    reset: function() {
        location.reload();
    }
};

console.log('[Mock] Test helpers available: window._wliMock');
console.log('[Mock] Try: _wliMock.testAuthPrompt(), _wliMock.testEmptyPlaylist(), _wliMock.testError()');
