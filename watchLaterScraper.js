/**
 * Watch Later Page Scraper
 * Extracts playlist data from the Watch Later page's ytInitialData
 * Runs on *://www.youtube.com/playlist?list=WL
 */

(function () {
    'use strict';

    console.log('[WL Scraper] Content script loaded on Watch Later page');

    /**
     * Extract playlist data from YouTube's embedded data
     * YouTube embeds playlist info in window.ytInitialData
     */
    function extractWatchLaterData() {
        try {
            // YouTube stores page data in ytInitialData
            if (!window.ytInitialData) {
                console.error('[WL Scraper] ytInitialData not found');
                return null;
            }

            const data = window.ytInitialData;

            // Navigate to playlist contents
            const contents = data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]
                ?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]
                ?.itemSectionRenderer?.contents?.[0]
                ?.playlistVideoListRenderer?.contents;

            if (!contents || !Array.isArray(contents)) {
                console.error('[WL Scraper] Playlist contents not found in ytInitialData');
                return null;
            }

            const videos = [];

            // Parse each video item
            for (const item of contents) {
                const videoRenderer = item.playlistVideoRenderer;

                // Skip continuation items or ads
                if (!videoRenderer || !videoRenderer.videoId) {
                    continue;
                }

                // Extract video metadata
                const video = {
                    videoId: videoRenderer.videoId,
                    title: videoRenderer.title?.runs?.[0]?.text || 'Unknown Title',
                    channelTitle: videoRenderer.shortBylineText?.runs?.[0]?.text || 'Unknown Channel',
                    channelId: videoRenderer.shortBylineText?.runs?.[0]?.navigationEndpoint
                        ?.browseEndpoint?.browseId || '',
                    thumbnails: videoRenderer.thumbnail?.thumbnails || [],
                    lengthText: videoRenderer.lengthText?.simpleText || '',
                    // Get best quality thumbnail
                    thumbnail: videoRenderer.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
                        videoRenderer.thumbnail?.thumbnails?.[0]?.url || ''
                };

                // Ensure we have at least videoId and title
                if (video.videoId && video.title) {
                    videos.push(video);
                }
            }

            console.log(`[WL Scraper] Extracted ${videos.length} videos from Watch Later`);
            return videos;

        } catch (error) {
            console.error('[WL Scraper] Error extracting data:', error);
            return null;
        }
    }

    /**
     * Wait for ytInitialData to be available
     * YouTube may load this asynchronously
     */
    function waitForYtData(callback, maxAttempts = 10) {
        let attempts = 0;

        const checkData = () => {
            if (window.ytInitialData) {
                callback();
                return;
            }

            attempts++;
            if (attempts >= maxAttempts) {
                console.error('[WL Scraper] Timeout waiting for ytInitialData');
                return;
            }

            setTimeout(checkData, 300);
        };

        checkData();
    }

    /**
     * Save scraped data to storage
     */
    async function saveToStorage(videos) {
        try {
            const data = {
                videos: videos,
                timestamp: Date.now(),
                source: 'scraper'
            };

            await chrome.storage.local.set({ watchLaterData: data });
            console.log(`[WL Scraper] Saved ${videos.length} videos to storage`);

            // Notify other parts of extension that data is updated
            chrome.runtime.sendMessage({
                type: 'WATCH_LATER_UPDATED',
                count: videos.length
            }).catch(() => {
                // Ignore errors if no listeners
            });

        } catch (error) {
            console.error('[WL Scraper] Error saving to storage:', error);
        }
    }

    /**
     * Main scraping logic
     */
    function scrapeWatchLater() {
        console.log('[WL Scraper] Starting scrape...');

        const videos = extractWatchLaterData();

        if (videos && videos.length > 0) {
            saveToStorage(videos);
        } else if (videos && videos.length === 0) {
            // Empty playlist is valid
            saveToStorage([]);
        } else {
            console.error('[WL Scraper] Failed to extract data');
        }
    }

    /**
     * Listen for navigation events (YouTube is an SPA)
     */
    function setupNavigationListener() {
        // Watch for YouTube's navigation events
        let lastUrl = location.href;

        const observer = new MutationObserver(() => {
            const currentUrl = location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;

                // Check if we're still on Watch Later page
                if (currentUrl.includes('list=WL')) {
                    console.log('[WL Scraper] Navigation detected, re-scraping...');
                    waitForYtData(scrapeWatchLater);
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Initialize scraper
     */
    function init() {
        // Check if we're on the Watch Later page
        if (!location.href.includes('list=WL')) {
            console.log('[WL Scraper] Not on Watch Later page, exiting');
            return;
        }

        console.log('[WL Scraper] Initializing...');

        // Wait for YouTube data to load, then scrape
        waitForYtData(scrapeWatchLater);

        // Setup listener for SPA navigation
        setupNavigationListener();

        // Listen for manual refresh requests
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'REFRESH_WATCH_LATER') {
                console.log('[WL Scraper] Manual refresh requested');
                waitForYtData(scrapeWatchLater);
                sendResponse({ success: true });
            }
        });
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
