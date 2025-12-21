/**
 * FeedHole Content Script
 * Watches LinkedIn feed and applies user-configured filters
 * 
 * Design principles:
 * - Fail safe: if anything breaks, do nothing
 * - Never block scrolling
 * - Never interact with posts (no clicks, no automation)
 * - Neutral messaging: "filtered per your preferences"
 */

(function() {
  'use strict';
  
  // State
  let userRules = { ...DEFAULT_RULES };
  let processedPosts = new Set();
  let stats = { filtered: 0, processed: 0 };
  let observer = null;
  let isEnabled = true;
  
  // LinkedIn selectors (will need maintenance as LinkedIn updates)
  const SELECTORS = {
    feedContainer: '.scaffold-finite-scroll__content',
    feedPost: '[data-urn^="urn:li:activity"]',
    postText: '.feed-shared-update-v2__description',
    postTextAlt: '.update-components-text',
    authorName: '.update-components-actor__name',
    promotedLabel: '.update-components-actor__description',
    repostIndicator: '.update-components-header__text-view',
    seeMore: '.feed-shared-inline-show-more-text__see-more-less-toggle'
  };
  
  /**
   * Initialize extension
   */
  async function init() {
    console.log('[FeedHole] Initializing...');

    // Load user rules and enabled state from storage
    try {
      const stored = await chrome.storage.sync.get(['feedholeRules', 'feedholeEnabled']);
      if (stored.feedholeRules) {
        userRules = { ...DEFAULT_RULES, ...stored.feedholeRules };
      }
      // Default to enabled if not set
      isEnabled = stored.feedholeEnabled !== false;
    } catch (e) {
      console.log('[FeedHole] Using default rules');
    }

    // Only start if enabled
    if (isEnabled) {
      waitForFeed();
    } else {
      console.log('[FeedHole] Disabled by user');
    }
  }
  
  /**
   * Wait for LinkedIn feed container to appear
   */
  function waitForFeed() {
    const feed = document.querySelector(SELECTORS.feedContainer);
    
    if (feed) {
      console.log('[FeedHole] Feed found, attaching observer');
      attachObserver(feed);
      // Process existing posts
      processExistingPosts();
    } else {
      // Retry - LinkedIn loads dynamically
      setTimeout(waitForFeed, 500);
    }
  }
  
  /**
   * Attach MutationObserver to feed
   */
  function attachObserver(feed) {
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if it's a post or contains posts
            const posts = node.matches?.(SELECTORS.feedPost) 
              ? [node] 
              : node.querySelectorAll?.(SELECTORS.feedPost) || [];
            
            for (const post of posts) {
              processPost(post);
            }
          }
        }
      }
    });
    
    observer.observe(feed, {
      childList: true,
      subtree: true
    });
  }
  
  /**
   * Process existing posts on page load
   */
  function processExistingPosts() {
    const posts = document.querySelectorAll(SELECTORS.feedPost);
    posts.forEach(post => processPost(post));
  }
  
  /**
   * Extract data from a LinkedIn post element
   */
  function extractPostData(postElement) {
    try {
      // Get post URN for deduplication
      const urn = postElement.getAttribute('data-urn') || '';
      
      // Get post text
      let textElement = postElement.querySelector(SELECTORS.postText) 
                     || postElement.querySelector(SELECTORS.postTextAlt);
      let text = textElement?.innerText || '';
      
      // Get author
      const authorElement = postElement.querySelector(SELECTORS.authorName);
      const author = authorElement?.innerText || '';
      
      // Check if promoted
      const promotedElement = postElement.querySelector(SELECTORS.promotedLabel);
      const isPromoted = promotedElement?.innerText?.toLowerCase().includes('promoted') || false;
      
      // Check if repost
      const repostElement = postElement.querySelector(SELECTORS.repostIndicator);
      const isRepost = repostElement?.innerText?.toLowerCase().includes('reposted') || false;
      
      // Count emojis and hashtags
      const emojiCount = countEmojis(text);
      const hashtagCount = countHashtags(text);
      
      return {
        urn,
        text,
        author,
        isPromoted,
        isRepost,
        emojiCount,
        hashtagCount
      };
    } catch (e) {
      console.log('[FeedHole] Error extracting post data:', e);
      return null;
    }
  }
  
  /**
   * Process a single post
   */
  function processPost(postElement) {
    try {
      // Get URN for deduplication
      const urn = postElement.getAttribute('data-urn');
      if (!urn || processedPosts.has(urn)) return;
      
      processedPosts.add(urn);
      stats.processed++;
      
      // Extract post data
      const postData = extractPostData(postElement);
      if (!postData) return;
      
      // Analyze with rules
      const result = analyzePost(postData, userRules);
      
      if (result.shouldHide) {
        collapsePost(postElement, result.reasons);
        stats.filtered++;
      }
      
    } catch (e) {
      // Fail safe: do nothing on error
      console.log('[FeedHole] Error processing post:', e);
    }
  }
  
  /**
   * Collapse a post with FeedHole overlay
   */
  function collapsePost(postElement, reasons) {
    // Don't double-process
    if (postElement.classList.contains('feedhole-processed')) return;
    postElement.classList.add('feedhole-processed');
    
    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'feedhole-collapsed';
    
    // Create collapsed placeholder
    const placeholder = document.createElement('div');
    placeholder.className = 'feedhole-placeholder';
    
    // Neutral, clinical messaging
    const reasonText = reasons.length > 0 
      ? reasons.join(', ') 
      : 'Matched configured filters';
    
    placeholder.innerHTML = `
      <div class="feedhole-info">
        <span class="feedhole-icon">◯</span>
        <span class="feedhole-text">Filtered: ${escapeHtml(reasonText)}</span>
        <button class="feedhole-reveal">Show</button>
      </div>
    `;
    
    // Store original display
    const originalDisplay = postElement.style.display;
    
    // Hide original, show placeholder
    postElement.style.display = 'none';
    postElement.insertAdjacentElement('beforebegin', placeholder);
    
    // Reveal button handler
    const revealBtn = placeholder.querySelector('.feedhole-reveal');
    revealBtn.addEventListener('click', () => {
      placeholder.remove();
      postElement.style.display = originalDisplay || '';
      postElement.classList.add('feedhole-revealed');
    });
  }
  
  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Listen for rule updates from options page
   */
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
      if (changes.feedholeRules) {
        userRules = { ...DEFAULT_RULES, ...changes.feedholeRules.newValue };
        console.log('[FeedHole] Rules updated');
      }
      if (changes.feedholeEnabled !== undefined) {
        isEnabled = changes.feedholeEnabled.newValue !== false;
        console.log('[FeedHole] Enabled:', isEnabled);
      }
    }
  });

  /**
   * Listen for messages from popup (stats request)
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'getStats') {
      sendResponse({ stats, isEnabled });
    }
    return true;
  });
  
  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})();
