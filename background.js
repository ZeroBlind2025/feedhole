/**
 * FeedHole Background Script
 * Handles messages from content scripts
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openOptions') {
    chrome.runtime.openOptionsPage();
  }
  return true;
});
