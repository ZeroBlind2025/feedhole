/**
 * FeedHole Background Script
 * Handles messages from content scripts
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openOptions') {
    chrome.runtime.openOptionsPage();
  }
  if (message.action === 'openOptionsTab') {
    // Open options in a new tab (less likely to be blocked by ad blockers)
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
  }
  return true;
});
