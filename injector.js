/**
 * Watch Later Feed Injector - Content Script
 * Detects YouTube homepage feed and injects Watch Later shelf
 */

// State management
let shelfInjected = false;
let currentSettings = null;
let observer = null;
let isYouTubeHomepage = false;
let injectionTimeout = null; // For debouncing injection requests

// Constants
const WATCH_LATER_SHELF_ID = 'wli-watch-later-shelf';
const FEED_CONTAINER_SELECTOR = '#contents';
const FEED_CHECK_INTERVAL = 100; // ms
const FEED_CHECK_MAX_ATTEMPTS = 50; // 5 seconds total
const WATCH_LATER_PLAYLIST_URL = 'https://www.youtube.com/playlist?list=WL';

/**
 * Initialize the extension
 */
async function init() {
    console.log('[WLI] Content script loaded');

    // Load settings first
    await loadSettings();

    // Check if we're on YouTube homepage
    if (!isHomepage()) {
        console.log('[WLI] Not on homepage, skipping injection');
        return;
    }

    isYouTubeHomepage = true;
    console.log('[WLI] On YouTube homepage, initializing...');

    // Check if shelf is enabled
    if (!currentSettings?.enabled) {
        console.log('[WLI] Shelf is disabled in settings');
        setupNavigationObserver(); // Still need observer
        return;
    }

    // Wait for feed container to be ready (non-blocking)
    waitForFeedContainer()
        .then(() => {
            console.log('[WLI] Feed container ready');
            injectShelf();
            setupNavigationObserver();
        })
        .catch(error => {
            console.error('[WLI] Error waiting for feed container:', error);
        });
}

/**
 * Check if current page is YouTube homepage
 * @returns {boolean}
 */
function isHomepage() {
    const url = window.location.href;
    const pathname = window.location.pathname;

    // Check if we're in mock testing environment
    if (url.includes('mock-youtube.html') || document.title.includes('Mock YouTube')) {
        console.log('[WLI] Mock page detected, treating as homepage');
        return true;
    }

    // Match homepage patterns
    return pathname === '/' ||
        pathname === '/feed/explore' ||
        (pathname === '' && url.includes('youtube.com'));
}


/**
 * Load settings from background
 * @returns {Promise<void>}
 */
async function loadSettings() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
        if (response.success) {
            currentSettings = response.settings;
            console.log('[WLI] Settings loaded:', currentSettings);
        } else {
            console.warn('[WLI] Failed to load settings, using defaults');
            currentSettings = {
                enabled: true,
                itemCount: 5,
                cacheTTL: 20,
                sortOrder: 'descending',
                showEmptyState: true
            };
        }
    } catch (error) {
        console.error('[WLI] Error loading settings:', error);
        currentSettings = { enabled: true, itemCount: 5, cacheTTL: 20, sortOrder: 'descending', showEmptyState: true };
    }
}

/**
 * Wait for feed container to exist in DOM
 * Uses polling with timeout to avoid blocking
 * @returns {Promise<Element>}
 */
function waitForFeedContainer() {
    return new Promise((resolve, reject) => {
        let attempts = 0;

        const checkFeed = () => {
            const feedContainer = document.querySelector(FEED_CONTAINER_SELECTOR);

            if (feedContainer) {
                console.log('[WLI] Feed container found');
                resolve(feedContainer);
                return;
            }

            attempts++;
            if (attempts >= FEED_CHECK_MAX_ATTEMPTS) {
                reject(new Error('Feed container not found after timeout'));
                return;
            }

            setTimeout(checkFeed, FEED_CHECK_INTERVAL);
        };

        checkFeed();
    });
}

/**
 * Debounced injection - prevents multiple rapid injection attempts
 * @param {number} delay - Delay in milliseconds
 */
function scheduleInjection(delay = 300) {
    // Clear any existing timeout
    if (injectionTimeout) {
        clearTimeout(injectionTimeout);
    }

    // Schedule new injection
    injectionTimeout = setTimeout(() => {
        injectionTimeout = null;
        injectShelf();
    }, delay);
}

/**
 * Setup MutationObserver to detect SPA navigation and feed re-renders
 */
function setupNavigationObserver() {
    // Disconnect existing observer if any
    if (observer) {
        observer.disconnect();
    }

    // Watch for URL changes (YouTube SPA navigation)
    let lastUrl = window.location.href;

    observer = new MutationObserver(() => {
        const currentUrl = window.location.href;

        // URL changed - check if we're still on homepage
        if (currentUrl !== lastUrl) {
            const previousUrl = lastUrl;
            lastUrl = currentUrl;
            console.log('[WLI] Navigation detected:', previousUrl, '→', currentUrl);

            const wasHomepage = isYouTubeHomepage;
            const wasWatchLater = previousUrl.includes('list=WL');
            isYouTubeHomepage = isHomepage();

            if (isYouTubeHomepage && !wasHomepage) {
                // Navigated to homepage
                if (wasWatchLater) {
                    console.log('[WLI] 🔄 Navigated from Watch Later to homepage - forcing refresh');
                    // Coming from Watch Later, wait a bit longer for scraper to finish
                    shelfInjected = false;
                    removeShelf();
                    scheduleInjection(400);
                } else {
                    console.log('[WLI] Navigated to homepage, scheduling re-injection');
                    shelfInjected = false;
                    removeShelf();
                    scheduleInjection(500);
                }
            } else if (!isYouTubeHomepage && wasHomepage) {
                // Navigated away from homepage
                console.log('[WLI] Navigated away from homepage');
                removeShelf();
                
                // If navigating to Watch Later, remind user to refresh if they made changes
                if (currentUrl.includes('list=WL')) {
                    console.log('[WLI] 📋 On Watch Later page - refresh page (Cmd+Shift+R) if you add/remove videos to update the homepage shelf');
                }
            }
        }

        // Check if shelf was removed (feed re-render)
        if (isYouTubeHomepage && shelfInjected) {
            const existingShelf = document.getElementById(WATCH_LATER_SHELF_ID);
            if (!existingShelf) {
                console.log('[WLI] Shelf removed by feed re-render, scheduling re-injection');
                shelfInjected = false;
                scheduleInjection(100);
            }
        }
    });

    // Observe the entire document for changes
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('[WLI] Navigation observer setup complete');
}

/**
 * Main injection function - fetches data and creates shelf
 * Debounced to prevent multiple rapid injection attempts
 */
async function injectShelf() {
    // Clear any pending injection
    if (injectionTimeout) {
        clearTimeout(injectionTimeout);
        injectionTimeout = null;
    }

    // Prevent duplicate injection
    if (shelfInjected) {
        console.log('[WLI] Shelf already injected, forcing re-injection');
        shelfInjected = false;
        removeShelf();
    }

    // Check if settings allow injection
    if (!currentSettings?.enabled) {
        console.log('[WLI] Shelf disabled in settings');
        return;
    }

    // Find feed container
    const feedContainer = document.querySelector(FEED_CONTAINER_SELECTOR);
    if (!feedContainer) {
        console.warn('[WLI] Feed container not found, cannot inject');
        return;
    }

    console.log('[WLI] Starting shelf injection...');

    try {
        // Fetch Watch Later items from scraped data
        const response = await chrome.runtime.sendMessage({
            type: 'GET_WATCH_LATER',
            settings: currentSettings
        });

        if (!response.success) {
            if (response.needsRefresh) {
                console.log('[WLI] No data available yet, showing prompt to visit Watch Later');
                injectFirstTimePrompt(feedContainer, response.message);
            } else {
                console.error('[WLI] Error fetching playlist:', response.error);
                injectErrorState(feedContainer, response.error);
            }
            return;
        }

        let videos = response.videos || [];
        console.log(`[WLI] Got ${videos.length} videos (from cache: ${response.fromCache}, timestamp: ${response.timestamp})`);
        if (videos.length > 0) {
            console.log(`[WLI] First video: "${videos[0].title}" (${videos[0].videoId})`);
            console.log(`[WLI] Last video: "${videos[videos.length - 1].title}" (${videos[videos.length - 1].videoId})`);
        }

        // Handle empty playlist
        if (videos.length === 0) {
            if (currentSettings.showEmptyState) {
                console.log('[WLI] Playlist is empty, showing empty state');
                injectEmptyState(feedContainer);
            } else {
                console.log('[WLI] Playlist is empty, empty state disabled');
            }
            return;
        }

        // Apply sort order (newest first by default)
        const sortOrder = currentSettings?.sortOrder || 'descending';
        if (sortOrder === 'descending') {
            // Reverse to show newest videos first (YouTube adds newest at the end)
            videos = videos.slice().reverse();
            console.log('[WLI] Sorted videos: newest first (descending)');
        } else {
            console.log('[WLI] Sorted videos: oldest first (ascending)');
        }

        // Limit to configured item count
        const itemCount = currentSettings?.itemCount || 5;
        videos = videos.slice(0, itemCount);
        console.log(`[WLI] Displaying ${videos.length} videos (limit: ${itemCount})`);

        const shelf = createShelf(videos);
        insertShelfSafely(feedContainer, shelf);

        shelfInjected = true;
        console.log('[WLI] Shelf injected successfully');

    } catch (error) {
        console.error('[WLI] Error during injection:', error);
        injectErrorState(feedContainer, error.message);
    }
}

/**
 * Safely insert shelf as first child of feed container
 * Creates nodes off-DOM first to avoid reflows
 * @param {Element} feedContainer - Parent container
 * @param {Element} shelf - Shelf element to insert
 */
function insertShelfSafely(feedContainer, shelf) {
    // Check if shelf already exists and remove it
    const existingShelf = document.getElementById(WATCH_LATER_SHELF_ID);
    if (existingShelf) {
        existingShelf.remove();
    }

    // Insert as first child (before any feed content)
    if (feedContainer.firstChild) {
        feedContainer.insertBefore(shelf, feedContainer.firstChild);
    } else {
        feedContainer.appendChild(shelf);
    }
}

/**
 * Create the Watch Later shelf DOM structure
 * Built off-DOM for performance
 * @param {Array} items - Playlist items
 * @returns {Element} Shelf element
 */
function createShelf(items) {
    // Main shelf container
    const shelf = document.createElement('div');
    shelf.id = WATCH_LATER_SHELF_ID;

    // Apply size class based on settings
    const sizeClass = currentSettings?.thumbnailSize === 'large' ? 'wli-size-large' : 'wli-size-compact';
    shelf.className = `wli-shelf ${sizeClass}`;

    shelf.setAttribute('role', 'region');
    shelf.setAttribute('aria-label', 'Watch Later Playlist');

    // Shelf header
    const header = createShelfHeader();
    shelf.appendChild(header);

    // Carousel container
    const carousel = createCarousel(items);
    shelf.appendChild(carousel);

    return shelf;
}

/**
 * Create shelf header with title and icon
 * @returns {Element}
 */
function createShelfHeader() {
    const header = document.createElement('div');
    header.className = 'wli-shelf-header';

    const title = document.createElement('h2');
    title.className = 'wli-shelf-title';

    // Create Watch Later icon (clock icon) using SVG with proper namespace
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('width', '24');
    icon.setAttribute('height', '24');
    icon.setAttribute('fill', 'currentColor');
    icon.className = 'wli-shelf-icon';

    // Create SVG paths
    const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path1.setAttribute('d', 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zM12 20c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z');

    const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path2.setAttribute('d', 'M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z');

    icon.appendChild(path1);
    icon.appendChild(path2);

    // Create title text
    const titleText = document.createElement('span');
    titleText.textContent = 'Watch Later';

    title.appendChild(icon);
    title.appendChild(titleText);
    header.appendChild(title);

    return header;
}

/**
 * Create horizontal scrolling carousel with video cards
 * @param {Array} items - Playlist items
 * @returns {Element}
 */
function createCarousel(items) {
    const carousel = document.createElement('div');
    carousel.className = 'wli-carousel';
    carousel.setAttribute('role', 'list');
    carousel.setAttribute('tabindex', '0');
    carousel.setAttribute('aria-label', 'Watch Later videos carousel');

    items.forEach((item, index) => {
        const card = createVideoCard(item, index);
        carousel.appendChild(card);
    });

    // Add keyboard navigation
    setupKeyboardNavigation(carousel);

    return carousel;
}

/**
 * Create a video card element
 * @param {Object} item - Playlist item data
 * @param {number} index - Card index for accessibility
 * @returns {Element}
 */
function createVideoCard(item, index) {
    // Card wrapper (anchor for native link behavior)
    const card = document.createElement('a');
    card.href = `https://www.youtube.com/watch?v=${item.videoId}`;
    card.className = 'wli-video-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-label', `${item.title} by ${item.channelTitle}`);
    card.setAttribute('data-video-id', item.videoId);
    card.setAttribute('data-card-index', index);
    card.tabIndex = 0; // Make cards keyboard focusable

    // Thumbnail container with placeholder
    const thumbnailContainer = document.createElement('div');
    thumbnailContainer.className = 'wli-thumbnail-container';

    // Low-res placeholder background (blurred default thumbnail)
    if (item.thumbnails.default) {
        thumbnailContainer.style.backgroundImage = `url(${item.thumbnails.default})`;
        thumbnailContainer.classList.add('wli-thumbnail-loading');
    }

    // Main thumbnail image
    const thumbnail = document.createElement('img');
    thumbnail.src = item.thumbnails.medium || item.thumbnails.default;
    thumbnail.alt = item.title;
    thumbnail.className = 'wli-thumbnail';
    thumbnail.loading = 'lazy'; // Lazy load for performance
    thumbnail.decoding = 'async'; // Async decode to avoid blocking

    // Use high-res thumbnail as srcset if available
    if (item.thumbnails.high) {
        thumbnail.srcset = `${item.thumbnails.medium} 320w, ${item.thumbnails.high} 480w`;
        thumbnail.sizes = '210px';
    }

    // Remove placeholder blur once image loads
    thumbnail.addEventListener('load', () => {
        thumbnailContainer.classList.remove('wli-thumbnail-loading');
        thumbnailContainer.classList.add('wli-thumbnail-loaded');
    }, { once: true });

    // Handle load errors gracefully
    thumbnail.addEventListener('error', () => {
        thumbnailContainer.classList.remove('wli-thumbnail-loading');
        thumbnailContainer.classList.add('wli-thumbnail-error');
        console.warn('[WLI] Failed to load thumbnail for:', item.videoId);
    }, { once: true });

    thumbnailContainer.appendChild(thumbnail);

    // Video info
    const info = document.createElement('div');
    info.className = 'wli-video-info';

    const title = document.createElement('div');
    title.className = 'wli-video-title';
    title.textContent = item.title;
    title.title = item.title; // Tooltip for truncated text

    const channel = document.createElement('div');
    channel.className = 'wli-video-channel';
    channel.textContent = item.channelTitle;

    info.appendChild(title);
    info.appendChild(channel);

    // Assemble card
    card.appendChild(thumbnailContainer);
    card.appendChild(info);

    return card;
}

/**
 * Setup keyboard navigation for carousel
 * Arrow keys navigate between cards, Enter/Space activate link
 * @param {Element} carousel - Carousel container
 */
function setupKeyboardNavigation(carousel) {
    let currentFocusIndex = -1;
    const cards = Array.from(carousel.querySelectorAll('.wli-video-card'));

    if (cards.length === 0) return;

    carousel.addEventListener('keydown', (e) => {
        // Arrow Left - navigate to previous card
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            navigateCards(cards, 'prev');
        }

        // Arrow Right - navigate to next card
        else if (e.key === 'ArrowRight') {
            e.preventDefault();
            navigateCards(cards, 'next');
        }

        // Home - jump to first card
        else if (e.key === 'Home') {
            e.preventDefault();
            focusCard(cards, 0);
        }

        // End - jump to last card
        else if (e.key === 'End') {
            e.preventDefault();
            focusCard(cards, cards.length - 1);
        }
    });

    // Track focus on cards
    cards.forEach((card, index) => {
        card.addEventListener('focus', () => {
            currentFocusIndex = index;
            scrollCardIntoView(carousel, card);
        });

        // Handle click - native link behavior preserved
        // Middle-click, right-click, Ctrl+click all work naturally with <a> tags
    });

    /**
     * Navigate to next or previous card
     * @param {Array} cards - Array of card elements
     * @param {string} direction - 'next' or 'prev'
     */
    function navigateCards(cards, direction) {
        if (currentFocusIndex === -1) {
            // No card focused, focus first card
            focusCard(cards, 0);
            return;
        }

        let newIndex;
        if (direction === 'next') {
            newIndex = (currentFocusIndex + 1) % cards.length; // Wrap to start
        } else {
            newIndex = currentFocusIndex - 1;
            if (newIndex < 0) newIndex = cards.length - 1; // Wrap to end
        }

        focusCard(cards, newIndex);
    }

    /**
     * Focus a specific card
     * @param {Array} cards - Array of card elements
     * @param {number} index - Index of card to focus
     */
    function focusCard(cards, index) {
        if (index >= 0 && index < cards.length) {
            cards[index].focus();
            currentFocusIndex = index;
        }
    }

    /**
     * Scroll card into view smoothly
     * @param {Element} carousel - Carousel container
     * @param {Element} card - Card element to scroll to
     */
    function scrollCardIntoView(carousel, card) {
        const carouselRect = carousel.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();

        // Calculate if card is out of view
        const isLeftOutOfView = cardRect.left < carouselRect.left;
        const isRightOutOfView = cardRect.right > carouselRect.right;

        if (isLeftOutOfView || isRightOutOfView) {
            // Scroll card into view smoothly
            card.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        }
    }
}

/**
 * Inject authentication prompt
 * @param {Element} feedContainer
 */
function injectAuthPrompt(feedContainer) {
    const shelf = document.createElement('div');
    shelf.id = WATCH_LATER_SHELF_ID;
    shelf.className = 'wli-shelf wli-auth-prompt';

    const message = document.createElement('div');
    message.className = 'wli-message';
    message.innerHTML = `
        <h3>Sign in to see your Watch Later videos</h3>
        <button class="wli-sign-in-button" id="wli-sign-in-btn">Sign In</button>
    `;

    shelf.appendChild(message);
    insertShelfSafely(feedContainer, shelf);

    // Add click handler for sign-in button
    document.getElementById('wli-sign-in-btn')?.addEventListener('click', async () => {
        console.log('[WLI] Sign-in button clicked');
        try {
            const result = await chrome.runtime.sendMessage({ type: 'SIGN_IN' });
            if (result.success) {
                console.log('[WLI] Sign-in successful, re-injecting shelf');
                shelfInjected = false;
                removeShelf();
                injectShelf();
            } else {
                console.error('[WLI] Sign-in failed:', result.error);
            }
        } catch (error) {
            console.error('[WLI] Error during sign-in:', error);
        }
    });

    shelfInjected = true;
}

/**
 * Inject first-time prompt (no data scraped yet)
 * @param {Element} feedContainer
 * @param {string} customMessage - Optional custom message
 */
function injectFirstTimePrompt(feedContainer, customMessage) {
    const shelf = document.createElement('div');
    shelf.id = WATCH_LATER_SHELF_ID;
    shelf.className = 'wli-shelf wli-first-time-prompt';

    const message = document.createElement('div');
    message.className = 'wli-message';
    message.innerHTML = `
        <h3>Welcome to Watch Later in Home Feed!</h3>
        <p>${customMessage || 'Visit your Watch Later page once to load your videos'}</p>
        <a href="https://www.youtube.com/playlist?list=WL" class="wli-sign-in-button" style="display: inline-block; text-decoration: none;">
            Go to Watch Later
        </a>
    `;

    shelf.appendChild(message);
    insertShelfSafely(feedContainer, shelf);
    shelfInjected = true;
}

/**
 * Inject empty state message
 * @param {Element} feedContainer
 */
function injectEmptyState(feedContainer) {
    const shelf = document.createElement('div');
    shelf.id = WATCH_LATER_SHELF_ID;
    shelf.className = 'wli-shelf wli-empty-state';

    const message = document.createElement('div');
    message.className = 'wli-message';
    message.innerHTML = `
        <h3>Your Watch Later playlist is empty</h3>
        <p>Save videos to watch them later</p>
    `;

    shelf.appendChild(message);
    insertShelfSafely(feedContainer, shelf);
    shelfInjected = true;
}

/**
 * Inject error state
 * @param {Element} feedContainer
 * @param {string} errorMessage
 */
function injectErrorState(feedContainer, errorMessage) {
    const shelf = document.createElement('div');
    shelf.id = WATCH_LATER_SHELF_ID;
    shelf.className = 'wli-shelf wli-error-state';

    const message = document.createElement('div');
    message.className = 'wli-message';
    message.innerHTML = `
        <h3>Couldn't load Watch Later videos</h3>
        <p>${errorMessage}</p>
        <button class="wli-retry-button" id="wli-retry-btn">Retry</button>
    `;

    shelf.appendChild(message);
    insertShelfSafely(feedContainer, shelf);

    // Add click handler for retry button
    document.getElementById('wli-retry-btn')?.addEventListener('click', () => {
        console.log('[WLI] Retry button clicked');
        shelfInjected = false;
        removeShelf();
        injectShelf();
    });

    shelfInjected = true;
}

/**
 * Remove shelf from DOM
 */
function removeShelf() {
    const shelf = document.getElementById(WATCH_LATER_SHELF_ID);
    if (shelf) {
        shelf.remove();
        shelfInjected = false;
        console.log('[WLI] Shelf removed');
    }
}

/**
 * Handle messages from background
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SETTINGS_UPDATED') {
        console.log('[WLI] Settings updated:', message.settings);
        currentSettings = message.settings;

        // Re-inject shelf with new settings
        if (isYouTubeHomepage) {
            shelfInjected = false;
            removeShelf();
            if (currentSettings.enabled) {
                scheduleInjection(200);
            }
        }
    } else if (message.type === 'DATA_REFRESHED') {
        console.log('[WLI] 🔄 DATA_REFRESHED received:', message.count, 'videos');
        console.log('[WLI] Current state: isYouTubeHomepage =', isYouTubeHomepage, ', enabled =', currentSettings?.enabled);
        
        // ALWAYS re-inject when data refreshes, even if not currently on homepage
        // (it might be a navigation in progress)
        if (currentSettings?.enabled) {
            console.log('[WLI] Force re-injection with fresh Watch Later data');
            shelfInjected = false;
            removeShelf();
            
            // Check if we're on homepage NOW (URL might have just changed)
            if (isHomepage()) {
                isYouTubeHomepage = true;
                console.log('[WLI] Confirmed on homepage, injecting immediately');
                scheduleInjection(100); // Very short delay
            } else {
                console.log('[WLI] Not on homepage yet, will inject when navigation completes');
            }
        }
    }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

console.log('[WLI] Content script initialized');
