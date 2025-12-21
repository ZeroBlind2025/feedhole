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
  let badge = null;

  // LinkedIn selectors (will need maintenance as LinkedIn updates)
  // Multiple selectors per element type to handle different post structures
  const SELECTORS = {
    feedContainer: [
      '.scaffold-finite-scroll__content',
      '.core-rail'
    ],
    feedPost: [
      '[data-urn^="urn:li:activity"]',
      '[data-urn^="urn:li:aggregate"]',
      '.feed-shared-update-v2'
    ],
    postText: [
      '.feed-shared-update-v2__description',
      '.update-components-text',
      '.feed-shared-text',
      '.feed-shared-inline-show-more-text',
      '.break-words'
    ],
    authorName: [
      '.update-components-actor__name span[aria-hidden="true"]',
      '.update-components-actor__name',
      '.feed-shared-actor__name',
      '.feed-shared-post-meta__name',
      '.update-components-actor__title span',
      '.artdeco-entity-lockup__title'
    ],
    promotedLabel: [
      '.update-components-actor__description',
      '.feed-shared-actor__description',
      '.update-components-actor__sub-description',
      '.update-components-actor__supplementary-actor-info',
      '.update-components-actor__meta-link',
      '.update-components-actor__meta',
      '.feed-shared-actor__sub-description',
      '.ad-banner-badge',
      '.feed-shared-actor__supplementary-actor-info',
      '[data-ad-banner]'
    ],
    repostIndicator: [
      '.update-components-header__text-view',
      '.feed-shared-header',
      '.update-components-header'
    ],
    seeMore: [
      '.feed-shared-inline-show-more-text__see-more-less-toggle',
      '.see-more'
    ]
  };

  /**
   * Try multiple selectors and return first match
   */
  function queryFirst(element, selectors) {
    const selectorList = Array.isArray(selectors) ? selectors : [selectors];
    for (const selector of selectorList) {
      const found = element.querySelector(selector);
      if (found) return found;
    }
    return null;
  }

  /**
   * Initialize extension
   */
  async function init() {
    console.log('[FeedHole] Initializing...');

    // Load user rules from storage
    try {
      const stored = await chrome.storage.sync.get('feedholeRules');
      if (stored.feedholeRules) {
        userRules = { ...DEFAULT_RULES, ...stored.feedholeRules };
      }
    } catch (e) {
      console.log('[FeedHole] Using default rules');
    }

    // Initialize floating badge
    if (window.FeedHoleBadge) {
      badge = new window.FeedHoleBadge();
    }

    // Wait for feed to exist
    waitForFeed();
  }

  /**
   * Wait for LinkedIn feed container to appear
   */
  function waitForFeed() {
    const feed = queryFirst(document, SELECTORS.feedContainer);

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

      // Get post text (try multiple selectors)
      const textElement = queryFirst(postElement, SELECTORS.postText);
      const text = textElement?.innerText || '';

      // Get author (try multiple selectors)
      const authorElement = queryFirst(postElement, SELECTORS.authorName);
      let author = authorElement?.innerText?.trim() || '';
      // Clean up author name (remove extra whitespace, newlines)
      author = author.split('\n')[0].trim();

      // Check if promoted (try multiple selectors)
      const promotedElement = queryFirst(postElement, SELECTORS.promotedLabel);
      const promotedText = promotedElement?.innerText?.toLowerCase() || '';

      // Fallback: scan the actor/header area for "Promoted" text
      const actorArea = queryFirst(postElement, [
        '.update-components-actor',
        '.feed-shared-actor',
        '.feed-shared-actor__container'
      ]);
      const actorText = actorArea?.innerText?.toLowerCase() || '';

      const isPromoted = promotedText.includes('promoted') ||
                         promotedText.includes('sponsored') ||
                         actorText.includes('promoted') ||
                         actorText.includes('sponsored');

      // Check if repost (try multiple selectors)
      const repostElement = queryFirst(postElement, SELECTORS.repostIndicator);
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

      // Update badge
      if (badge) {
        badge.updateStats(stats.filtered, stats.processed);
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

    // Store original content
    const originalContent = postElement.innerHTML;
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
   * Listen for rule updates from options page or badge
   */
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.feedholeRules) {
      userRules = { ...DEFAULT_RULES, ...changes.feedholeRules.newValue };
      console.log('[FeedHole] Rules updated, reprocessing feed...');

      // Reset stats and reprocess
      processedPosts.clear();
      stats = { filtered: 0, processed: 0 };

      // Remove existing collapsed placeholders
      document.querySelectorAll('.feedhole-placeholder').forEach(el => el.remove());
      document.querySelectorAll('.feedhole-processed').forEach(el => {
        el.classList.remove('feedhole-processed', 'feedhole-revealed');
        el.style.display = '';
      });

      // Reprocess
      processExistingPosts();
    }
  });

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
