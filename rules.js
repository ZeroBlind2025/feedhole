/**
 * FeedHole Rule Engine
 * Stage A: Local, deterministic rules (0 cost, instant)
 * 
 * Philosophy: Neutral, clinical, never moralistic.
 * We don't judge content. We apply user-configured pattern matching.
 */

const DEFAULT_RULES = {
  // Thresholds
  maxHashtags: 5,
  maxEmojis: 8,
  minPostLength: 50,
  
  // Toggle rules
  hidePromoted: true,
  hideReposts: true,
  hideNewsletterPitches: true,
  hideEngagementBait: true,
  hideHumbleBrags: true,
  hideRageHooks: true,
  
  // Custom blocked phrases (user-configurable)
  blockedPhrases: [],
  
  // Muted authors (user-configurable)
  mutedAuthors: []
};

// Engagement bait patterns - ends with calls for interaction
const ENGAGEMENT_BAIT_PATTERNS = [
  /agree\s*\??\s*$/i,
  /thoughts\s*\??\s*$/i,
  /what do you think\s*\??\s*$/i,
  /am i wrong\s*\??\s*$/i,
  /change my mind\s*\.?\s*$/i,
  /repost if you\s/i,
  /share if you\s/i,
  /comment\s+["']?\w+["']?\s+(if|below)/i,
  /tag someone who/i,
  /who else\s*\??\s*$/i,
  /right\s*\?\s*$/i
];

// Humble brag / origin story hooks
const HUMBLE_BRAG_PATTERNS = [
  /^i was (fired|rejected|broke|homeless|struggling)/i,
  /^i dropped out/i,
  /^i failed/i,
  /^everyone told me (i couldn'?t|no|to quit)/i,
  /^i went from .+ to .+ in/i,
  /^nobody believed/i,
  /^they laughed when/i,
  /^i never thought i'?d/i,
  /^\d+ years ago,? i (had nothing|was broke|couldn'?t)/i,
  /^i used to (make|earn) \$[\d,]+/i
];

// Rage hook patterns
const RAGE_HOOK_PATTERNS = [
  /^(unpopular opinion|hot take|controversial)/i,
  /^stop (doing|saying|believing)/i,
  /^i'?m (sick|tired) of/i,
  /^nobody talks about/i,
  /^the (truth|problem) (about|with|is)/i,
  /will hate (this|me)/i,
  /^most people (don'?t|won'?t|can'?t)/i,
  /^here'?s what .+ won'?t tell you/i,
  /doesn'?t want you to know/i,
  /^i'?m going to get (hate|attacked|cancelled)/i
];

// Newsletter / lead magnet patterns
const NEWSLETTER_PATTERNS = [
  /subscribe to my/i,
  /join my newsletter/i,
  /link in (bio|comments|first comment)/i,
  /download my free/i,
  /get my free/i,
  /i wrote about this in my/i,
  /full (article|post|thread) in/i,
  /comment ["']?\w+["']? (and i'?ll|to get)/i,
  /dm me ["']?\w+["']?\s*(for|and)/i
];

/**
 * Analyze a post and return filter results
 * @param {Object} postData - Extracted post data
 * @param {Object} rules - User's configured rules
 * @returns {Object} - { shouldHide: boolean, reasons: string[], score: number }
 */
function analyzePost(postData, rules = DEFAULT_RULES) {
  const reasons = [];
  let score = 0;
  
  const { 
    text = '', 
    author = '', 
    isPromoted = false, 
    isRepost = false,
    emojiCount = 0,
    hashtagCount = 0
  } = postData;
  
  // Check: Promoted content
  if (rules.hidePromoted && isPromoted) {
    reasons.push('Promoted content');
    score += 100; // Auto-hide
  }
  
  // Check: Repost without commentary
  if (rules.hideReposts && isRepost) {
    reasons.push('Repost');
    score += 50;
  }
  
  // Check: Muted author
  if (rules.mutedAuthors.some(a => author.toLowerCase().includes(a.toLowerCase()))) {
    reasons.push(`Author matches muted pattern`);
    score += 100;
  }
  
  // Check: Hashtag threshold
  if (hashtagCount > rules.maxHashtags) {
    reasons.push(`Hashtag count (${hashtagCount} > ${rules.maxHashtags})`);
    score += 20;
  }
  
  // Check: Emoji density
  if (emojiCount > rules.maxEmojis) {
    reasons.push(`Emoji density (${emojiCount} > ${rules.maxEmojis})`);
    score += 15;
  }
  
  // Check: Engagement bait
  if (rules.hideEngagementBait) {
    for (const pattern of ENGAGEMENT_BAIT_PATTERNS) {
      if (pattern.test(text)) {
        reasons.push('Matched engagement pattern');
        score += 30;
        break;
      }
    }
  }
  
  // Check: Humble brag / origin story hooks
  if (rules.hideHumbleBrags) {
    for (const pattern of HUMBLE_BRAG_PATTERNS) {
      if (pattern.test(text)) {
        reasons.push('Matched origin story hook');
        score += 25;
        break;
      }
    }
  }
  
  // Check: Rage hooks
  if (rules.hideRageHooks) {
    for (const pattern of RAGE_HOOK_PATTERNS) {
      if (pattern.test(text)) {
        reasons.push('Matched hook pattern');
        score += 25;
        break;
      }
    }
  }
  
  // Check: Newsletter pitches
  if (rules.hideNewsletterPitches) {
    for (const pattern of NEWSLETTER_PATTERNS) {
      if (pattern.test(text)) {
        reasons.push('Matched newsletter pattern');
        score += 35;
        break;
      }
    }
  }
  
  // Check: Blocked phrases
  for (const phrase of rules.blockedPhrases) {
    if (text.toLowerCase().includes(phrase.toLowerCase())) {
      reasons.push(`Contains blocked phrase`);
      score += 40;
      break;
    }
  }
  
  // Threshold: 50+ = hide
  const shouldHide = score >= 50;
  
  return {
    shouldHide,
    reasons,
    score
  };
}

/**
 * Count emojis in text
 */
function countEmojis(text) {
  const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
  const matches = text.match(emojiRegex);
  return matches ? matches.length : 0;
}

/**
 * Count hashtags in text
 */
function countHashtags(text) {
  const hashtagRegex = /#\w+/g;
  const matches = text.match(hashtagRegex);
  return matches ? matches.length : 0;
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { analyzePost, countEmojis, countHashtags, DEFAULT_RULES };
}
