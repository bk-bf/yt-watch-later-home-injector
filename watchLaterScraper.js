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
            console.log('[WL Scraper] Full ytInitialData structure:', JSON.stringify(Object.keys(data)));

            // Navigate to playlist contents - try multiple possible paths
            let contents = data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]
                ?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]
                ?.itemSectionRenderer?.contents?.[0]
                ?.playlistVideoListRenderer?.contents;

            if (!contents || !Array.isArray(contents)) {
                console.warn('[WL Scraper] Primary path failed, trying alternative paths...');

                // Try alternative structure
                contents = data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]
                    ?.tabRenderer?.content?.sectionListRenderer?.contents;

                console.log('[WL Scraper] Alternative path result:', contents ? 'found' : 'not found');
            }

            if (!contents || !Array.isArray(contents)) {
                console.error('[WL Scraper] Playlist contents not found in ytInitialData');
                console.log('[WL Scraper] Trying to log structure for debugging...');

                // Log more detail for debugging
                if (data?.contents) {
                    console.log('[WL Scraper] data.contents keys:', Object.keys(data.contents));
                    if (data.contents.twoColumnBrowseResultsRenderer) {
                        console.log('[WL Scraper] twoColumnBrowseResultsRenderer keys:',
                            Object.keys(data.contents.twoColumnBrowseResultsRenderer));
                    }
                }

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

                // Extract video metadata with more robust thumbnail handling
                const thumbnails = videoRenderer.thumbnail?.thumbnails || [];
                const video = {
                    videoId: videoRenderer.videoId,
                    title: videoRenderer.title?.runs?.[0]?.text || videoRenderer.title?.simpleText || 'Unknown Title',
                    channelTitle: videoRenderer.shortBylineText?.runs?.[0]?.text || 'Unknown Channel',
                    channelId: videoRenderer.shortBylineText?.runs?.[0]?.navigationEndpoint
                        ?.browseEndpoint?.browseId || '',
                    lengthText: videoRenderer.lengthText?.simpleText || '',
                    // Format thumbnails for compatibility with injector
                    thumbnails: {
                        default: thumbnails[0]?.url || '',
                        medium: thumbnails[thumbnails.length > 1 ? 1 : 0]?.url || thumbnails[0]?.url || '',
                        high: thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url || ''
                    }
                };

                // Ensure we have at least videoId and title
                if (video.videoId && video.title) {
                    videos.push(video);
                }
            }

            console.log(`[WL Scraper] Successfully extracted ${videos.length} videos from Watch Later`);
            if (videos.length > 0) {
                console.log('[WL Scraper] Sample video:', videos[0]);
            }
            return videos;

        } catch (error) {
            console.error('[WL Scraper] Error extracting data:', error);
            console.error('[WL Scraper] Stack trace:', error.stack);
            return null;
        }
    }

    /**
     * Try to extract ytInitialData from script tags if not available on window
     */
    function extractYtInitialDataFromDOM() {
        try {
            const scripts = document.querySelectorAll('script');
            for (const script of scripts) {
                const content = script.textContent;
                if (content.includes('var ytInitialData =') || content.includes('window.ytInitialData =')) {
                    // Try to extract the JSON
                    const match = content.match(/ytInitialData\s*=\s*({.+?});/s);
                    if (match && match[1]) {
                        console.log('[WL Scraper] Found ytInitialData in script tag');
                        return JSON.parse(match[1]);
                    }
                }
            }
            console.warn('[WL Scraper] Could not find ytInitialData in script tags');
            return null;
        } catch (error) {
            console.error('[WL Scraper] Error extracting from DOM:', error);
            return null;
        }
    }

    /**
     * Wait for ytInitialData to be available and populated
     * YouTube may load this asynchronously
     */
    function waitForYtData(callback, maxAttempts = 30) {
        let attempts = 0;

        const checkData = () => {
            if (attempts === 0 || attempts % 5 === 0) {
                console.log(`[WL Scraper] Checking for ytInitialData... (attempt ${attempts + 1}/${maxAttempts})`);
            }

            // Check if ytInitialData exists AND has contents property (indicates it's populated)
            if (window.ytInitialData && typeof window.ytInitialData === 'object') {
                const hasContents = window.ytInitialData.contents;

                console.log('[WL Scraper] ytInitialData found on window!');
                console.log('[WL Scraper] Type:', typeof window.ytInitialData);
                console.log('[WL Scraper] Has contents:', !!hasContents);
                console.log('[WL Scraper] Data keys:', Object.keys(window.ytInitialData));

                if (hasContents) {
                    callback();
                    return;
                } else {
                    console.log('[WL Scraper] ytInitialData exists but contents not yet populated, waiting...');
                }
            }

            // After a few attempts, try extracting from DOM
            if (attempts > 5) {
                console.log('[WL Scraper] Attempting to extract from DOM...');
                const dataFromDOM = extractYtInitialDataFromDOM();
                if (dataFromDOM && dataFromDOM.contents) {
                    window.ytInitialData = dataFromDOM;
                    console.log('[WL Scraper] ytInitialData extracted from DOM and set on window');
                    callback();
                    return;
                }
            }

            attempts++;
            if (attempts >= maxAttempts) {
                console.error('[WL Scraper] Timeout waiting for ytInitialData after', maxAttempts, 'attempts');
                console.log('[WL Scraper] window.ytInitialData type:', typeof window.ytInitialData);
                console.log('[WL Scraper] window.ytInitialData keys:', window.ytInitialData ? Object.keys(window.ytInitialData) : 'N/A');
                console.log('[WL Scraper] Available window properties:', Object.keys(window).filter(k => k.toLowerCase().includes('yt')));
                return;
            }

            setTimeout(checkData, 500);
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
