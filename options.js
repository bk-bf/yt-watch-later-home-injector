/**
 * Options Page Script
 * Handles settings UI and persistence
 */

const DEFAULT_SETTINGS = {
    enabled: true,
    itemCount: 5,
    cacheTTL: 20,
    thumbnailSize: 'compact',
    showEmptyState: true,
    autoRefresh: true
};

/**
 * Load settings from storage and populate form
 */
async function loadSettings() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });

        if (response.success) {
            const settings = response.settings;

            document.getElementById('enabled').checked = settings.enabled;
            document.getElementById('itemCount').value = settings.itemCount;
            document.getElementById('cacheTTL').value = settings.cacheTTL;
            document.getElementById('thumbnailSize').value = settings.thumbnailSize || 'compact';
            document.getElementById('showEmptyState').checked = settings.showEmptyState;
            document.getElementById('autoRefresh').checked = settings.autoRefresh;

            console.log('[Options] Settings loaded:', settings);
        } else {
            console.error('[Options] Failed to load settings');
            showStatus('Failed to load settings', 'error');
        }
    } catch (error) {
        console.error('[Options] Error loading settings:', error);
        showStatus('Error loading settings', 'error');
    }
}

/**
 * Save settings to storage
 */
async function saveSettings() {
    try {
        const settings = {
            enabled: document.getElementById('enabled').checked,
            itemCount: parseInt(document.getElementById('itemCount').value, 10),
            cacheTTL: parseInt(document.getElementById('cacheTTL').value, 10),
            thumbnailSize: document.getElementById('thumbnailSize').value,
            showEmptyState: document.getElementById('showEmptyState').checked,
            autoRefresh: document.getElementById('autoRefresh').checked
        };

        // Validate
        if (settings.itemCount < 3 || settings.itemCount > 10) {
            showStatus('Number of videos must be between 3 and 10', 'error');
            return;
        }

        if (settings.cacheTTL < 1 || settings.cacheTTL > 1440) {
            showStatus('Cache duration must be between 1 and 1440 minutes', 'error');
            return;
        }

        const response = await chrome.runtime.sendMessage({
            type: 'SAVE_SETTINGS',
            settings: settings
        });

        if (response.success) {
            console.log('[Options] Settings saved:', settings);
            showStatus('Settings saved successfully!', 'success');
        } else {
            showStatus('Failed to save settings', 'error');
        }
    } catch (error) {
        console.error('[Options] Error saving settings:', error);
        showStatus('Error saving settings', 'error');
    }
}

/**
 * Reset settings to defaults
 */
async function resetSettings() {
    if (!confirm('Reset all settings to defaults?')) {
        return;
    }

    try {
        const response = await chrome.runtime.sendMessage({ type: 'RESET_SETTINGS' });

        if (response.success) {
            console.log('[Options] Settings reset to defaults');
            await loadSettings(); // Reload form
            showStatus('Settings reset to defaults', 'success');
        } else {
            showStatus('Failed to reset settings', 'error');
        }
    } catch (error) {
        console.error('[Options] Error resetting settings:', error);
        showStatus('Error resetting settings', 'error');
    }
}

/**
 * Show status message
 */
function showStatus(message, type) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;

    // Auto-hide after 3 seconds
    setTimeout(() => {
        statusEl.className = 'status';
    }, 3000);
}

/**
 * Initialize options page
 */
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();

    // Event listeners
    document.getElementById('save').addEventListener('click', saveSettings);
    document.getElementById('reset').addEventListener('click', resetSettings);

    // Real-time validation
    document.getElementById('itemCount').addEventListener('input', (e) => {
        const value = parseInt(e.target.value, 10);
        if (value < 3 || value > 10) {
            e.target.style.borderColor = '#c62828';
        } else {
            e.target.style.borderColor = '#ddd';
        }
    });

    document.getElementById('cacheTTL').addEventListener('input', (e) => {
        const value = parseInt(e.target.value, 10);
        if (value < 1 || value > 1440) {
            e.target.style.borderColor = '#c62828';
        } else {
            e.target.style.borderColor = '#ddd';
        }
    });
});
