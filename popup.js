/**
 * FeedHole Popup Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  const enabledToggle = document.getElementById('enabled-toggle');
  const settingsLink = document.getElementById('settings-link');
  const filteredCount = document.getElementById('filtered-count');
  const processedCount = document.getElementById('processed-count');

  // Load current state
  try {
    const { feedholeEnabled = true } = await chrome.storage.sync.get('feedholeEnabled');
    enabledToggle.checked = feedholeEnabled;
  } catch (e) {
    console.log('Error loading state:', e);
  }

  // Toggle handler
  enabledToggle.addEventListener('change', async () => {
    await chrome.storage.sync.set({ feedholeEnabled: enabledToggle.checked });

    // Reload LinkedIn tab if open
    const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });
    for (const tab of tabs) {
      chrome.tabs.reload(tab.id);
    }
  });

  // Settings link
  settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  // Get stats from active LinkedIn tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url?.includes('linkedin.com')) {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'getStats' });
      if (response?.stats) {
        filteredCount.textContent = response.stats.filtered || 0;
        processedCount.textContent = response.stats.processed || 0;
      }
    }
  } catch (e) {
    // Content script may not be loaded yet
    console.log('Could not get stats:', e);
  }
});
