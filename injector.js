/**
 * Watch Later Feed Injector - Content Script
 * Detects YouTube homepage feed and injects Watch Later shelf
 */

// State management
let shelfInjected = false;
let currentSettings = null;
let observer = null;
let isYouTubeHomepage = false;

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
    
    // Check if we're on YouTube homepage
    if (!isHomepage()) {
        console.log('[WLI] Not on homepage, skipping injection');
        return;
    }
    
    isYouTubeHomepage = true;
    console.log('[WLI] On YouTube homepage, initializing...');
    
    // Load settings
    await loadSettings();
    
    // Check if shelf is enabled
    if (!currentSettings?.enabled) {
        console.log('[WLI] Shelf is disabled in settings');
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
                showEmptyState: true
            };
        }
    } catch (error) {
        console.error('[WLI] Error loading settings:', error);
        currentSettings = { enabled: true, itemCount: 5, cacheTTL: 20, showEmptyState: true };
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
            lastUrl = currentUrl;
            console.log('[WLI] Navigation detected:', currentUrl);
            
            const wasHomepage = isYouTubeHomepage;
            isYouTubeHomepage = isHomepage();
            
            if (isYouTubeHomepage && !wasHomepage) {
                // Navigated to homepage
                console.log('[WLI] Navigated to homepage, re-injecting shelf');
                shelfInjected = false;
                setTimeout(() => injectShelf(), 500); // Small delay for feed to load
            } else if (!isYouTubeHomepage && wasHomepage) {
                // Navigated away from homepage
                console.log('[WLI] Navigated away from homepage');
                removeShelf();
            }
        }
        
        // Check if shelf was removed (feed re-render)
        if (isYouTubeHomepage && shelfInjected) {
            const existingShelf = document.getElementById(WATCH_LATER_SHELF_ID);
            if (!existingShelf) {
                console.log('[WLI] Shelf removed by feed re-render, re-injecting');
                shelfInjected = false;
                injectShelf();
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
 */
async function injectShelf() {
    // Prevent duplicate injection
    if (shelfInjected) {
        console.log('[WLI] Shelf already injected');
        return;
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
        // Check authentication first
        const authStatus = await chrome.runtime.sendMessage({ type: 'CHECK_AUTH' });
        
        if (!authStatus.success || authStatus.data.needsAuth) {
            console.log('[WLI] Not authenticated, showing sign-in prompt');
            injectAuthPrompt(feedContainer);
            return;
        }
        
        // Fetch Watch Later items
        const response = await chrome.runtime.sendMessage({
            type: 'GET_WATCH_LATER',
            maxResults: currentSettings.itemCount || 5
        });
        
        if (!response.success) {
            if (response.needsAuth) {
                console.log('[WLI] Auth required, showing sign-in prompt');
                injectAuthPrompt(feedContainer);
            } else {
                console.error('[WLI] Error fetching playlist:', response.error);
                injectErrorState(feedContainer, response.error);
            }
            return;
        }
        
        console.log(`[WLI] Got ${response.count} items (from cache: ${response.fromCache})`);
        
        // Handle empty playlist
        if (response.count === 0) {
            if (currentSettings.showEmptyState) {
                console.log('[WLI] Playlist is empty, showing empty state');
                injectEmptyState(feedContainer);
            } else {
                console.log('[WLI] Playlist is empty, empty state disabled');
            }
            return;
        }
        
        // Create and inject shelf
        const shelf = createShelf(response.items);
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
    shelf.className = 'wli-shelf';
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
 * Create shelf header with title
 * @returns {Element}
 */
function createShelfHeader() {
    const header = document.createElement('div');
    header.className = 'wli-shelf-header';
    
    const title = document.createElement('h2');
    title.className = 'wli-shelf-title';
    title.textContent = 'In Your Watch Later';
    
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
    
    // Thumbnail container
    const thumbnailContainer = document.createElement('div');
    thumbnailContainer.className = 'wli-thumbnail-container';
    
    const thumbnail = document.createElement('img');
    thumbnail.src = item.thumbnails.medium || item.thumbnails.default;
    thumbnail.alt = item.title;
    thumbnail.className = 'wli-thumbnail';
    thumbnail.loading = 'lazy'; // Lazy load for performance
    
    // Use high-res thumbnail as srcset if available
    if (item.thumbnails.high) {
        thumbnail.srcset = `${item.thumbnails.medium} 320w, ${item.thumbnails.high} 480w`;
    }
    
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
 * Handle settings updates from background
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
                injectShelf();
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
