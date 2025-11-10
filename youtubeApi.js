/**
 * YouTube Data API v3 Wrapper
 * Handles fetching Watch Later playlist items with minimal data requests
 */

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const WATCH_LATER_PLAYLIST_ID = 'WL';

/**
 * Fetch Watch Later playlist items
 * @param {string} accessToken - OAuth access token
 * @param {number} maxResults - Maximum number of items to fetch (default 10)
 * @returns {Promise<Array>} Array of playlist items with minimal metadata
 */
async function fetchWatchLaterItems(accessToken, maxResults = 10) {
    if (!accessToken) {
        throw new Error('Access token is required');
    }

    // Request only the minimal fields needed for display
    // This reduces payload size and API quota usage
    const fields = [
        'items(id',
        'snippet(resourceId/videoId',
        'title',
        'thumbnails',
        'channelTitle',
        'publishedAt))',
        'nextPageToken',
        'pageInfo'
    ].join(',');

    const url = new URL(`${YOUTUBE_API_BASE}/playlistItems`);
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('playlistId', WATCH_LATER_PLAYLIST_ID);
    url.searchParams.set('maxResults', maxResults.toString());
    url.searchParams.set('fields', fields);

    console.log('[YouTubeAPI] Fetching Watch Later items:', {
        maxResults,
        playlistId: WATCH_LATER_PLAYLIST_ID
    });

    const response = await fetchWithRetry(url.toString(), {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        await handleApiError(response);
    }

    const data = await response.json();

    // Transform API response to simpler format
    const items = (data.items || []).map(item => ({
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

    console.log(`[YouTubeAPI] Successfully fetched ${items.length} items`);

    return items;
}

/**
 * Fetch with automatic retry logic for transient errors
 * @param {string} url - API endpoint URL
 * @param {object} options - Fetch options
 * @param {number} maxRetries - Maximum number of retry attempts (default 3)
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options, maxRetries = 3) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);

            // Don't retry on 4xx client errors (except 429 rate limit)
            if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                return response;
            }

            // Retry on 5xx server errors and 429 rate limit
            if (response.status >= 500 || response.status === 429) {
                if (attempt < maxRetries) {
                    const delay = calculateBackoffDelay(attempt, response.status);
                    console.warn(
                        `[YouTubeAPI] HTTP ${response.status} - Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`
                    );
                    await sleep(delay);
                    continue;
                }
            }

            return response;

        } catch (error) {
            lastError = error;

            if (attempt < maxRetries) {
                const delay = calculateBackoffDelay(attempt);
                console.warn(
                    `[YouTubeAPI] Network error - Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
                    error.message
                );
                await sleep(delay);
                continue;
            }
        }
    }

    // All retries exhausted
    throw lastError || new Error('Max retries exceeded');
}

/**
 * Calculate exponential backoff delay
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {number} statusCode - HTTP status code (optional)
 * @returns {number} Delay in milliseconds
 */
function calculateBackoffDelay(attempt, statusCode) {
    // Base delay: 1 second
    const baseDelay = 1000;

    // Exponential backoff: 1s, 2s, 4s, 8s...
    let delay = baseDelay * Math.pow(2, attempt);

    // Add jitter to prevent thundering herd (±25%)
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
    delay += jitter;

    // For rate limiting (429), use longer delays
    if (statusCode === 429) {
        delay *= 2;
    }

    // Cap at 30 seconds
    return Math.min(delay, 30000);
}

/**
 * Sleep utility for delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Handle API error responses
 * @param {Response} response - Fetch response object
 * @throws {Error} Descriptive error based on status code
 */
async function handleApiError(response) {
    let errorMessage = `YouTube API error: ${response.status} ${response.statusText}`;

    try {
        const errorData = await response.json();
        if (errorData.error) {
            errorMessage = errorData.error.message || errorMessage;

            // Log detailed error info for debugging
            console.error('[YouTubeAPI] API Error Details:', {
                status: response.status,
                message: errorData.error.message,
                errors: errorData.error.errors,
                code: errorData.error.code
            });
        }
    } catch (e) {
        // Couldn't parse error JSON, use generic message
    }

    // Provide user-friendly error messages
    switch (response.status) {
        case 401:
            throw new Error('Authentication failed. Please sign in again.');
        case 403:
            throw new Error('Access denied. Check API quotas and permissions.');
        case 404:
            throw new Error('Watch Later playlist not found.');
        case 429:
            throw new Error('Rate limit exceeded. Please try again later.');
        case 500:
        case 502:
        case 503:
        case 504:
            throw new Error('YouTube service temporarily unavailable. Please try again.');
        default:
            throw new Error(errorMessage);
    }
}

/**
 * Get video URL from video ID
 * @param {string} videoId - YouTube video ID
 * @returns {string} Full YouTube video URL
 */
function getVideoUrl(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Get Watch Later playlist URL
 * @returns {string} Full Watch Later playlist URL
 */
function getWatchLaterUrl() {
    return 'https://www.youtube.com/playlist?list=WL';
}

// Export functions for use in background.js
if (typeof module !== 'undefined' && module.exports) {
    // Node.js / Jest environment
    module.exports = {
        fetchWatchLaterItems,
        fetchWithRetry,
        calculateBackoffDelay,
        getVideoUrl,
        getWatchLaterUrl
    };
}
