/**
 * Simple test/demo script for YouTube API wrapper
 * Can be run in Node.js with mock data to test the logic
 */

// Mock data for testing without real API calls
const MOCK_WATCH_LATER_RESPONSE = {
    items: [
        {
            id: 'item1',
            snippet: {
                resourceId: { videoId: 'dQw4w9WgXcQ' },
                title: 'Sample Video Title 1',
                channelTitle: 'Sample Channel',
                publishedAt: '2024-01-15T10:30:00Z',
                thumbnails: {
                    default: { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg' },
                    medium: { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg' },
                    high: { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' }
                }
            }
        },
        {
            id: 'item2',
            snippet: {
                resourceId: { videoId: 'jNQXAC9IVRw' },
                title: 'Another Interesting Video',
                channelTitle: 'Cool Creator',
                publishedAt: '2024-01-10T14:20:00Z',
                thumbnails: {
                    default: { url: 'https://i.ytimg.com/vi/jNQXAC9IVRw/default.jpg' },
                    medium: { url: 'https://i.ytimg.com/vi/jNQXAC9IVRw/mqdefault.jpg' },
                    high: { url: 'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg' }
                }
            }
        }
    ],
    pageInfo: {
        totalResults: 2,
        resultsPerPage: 10
    }
};

/**
 * Get mock Watch Later items for testing
 * Use this in content script during development
 */
function getMockWatchLaterItems() {
    // Simulate API processing delay
    return new Promise((resolve) => {
        setTimeout(() => {
            const items = MOCK_WATCH_LATER_RESPONSE.items.map(item => ({
                id: item.id,
                videoId: item.snippet?.resourceId?.videoId,
                title: item.snippet?.title,
                channelTitle: item.snippet?.channelTitle,
                publishedAt: item.snippet?.publishedAt,
                thumbnails: {
                    default: item.snippet?.thumbnails?.default?.url,
                    medium: item.snippet?.thumbnails?.medium?.url,
                    high: item.snippet?.thumbnails?.high?.url,
                    maxres: item.snippet?.thumbnails?.maxres?.url
                }
            }));
            resolve(items);
        }, 100);
    });
}

// Log example for debugging
if (typeof console !== 'undefined') {
    console.log('[Mock] Sample Watch Later items structure:');
    console.log(JSON.stringify(MOCK_WATCH_LATER_RESPONSE.items[0], null, 2));
}

// Export for use in tests or development
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MOCK_WATCH_LATER_RESPONSE,
        getMockWatchLaterItems
    };
}
