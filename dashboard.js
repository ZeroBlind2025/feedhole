/**
 * FeedHole Dashboard Script
 */

const FILTER_LABELS = {
  promoted: 'Promoted',
  repost: 'Reposts',
  mutedAuthor: 'Muted Authors',
  hashtags: 'Hashtags',
  emojis: 'Emojis',
  engagementBait: 'Engagement Bait',
  originStory: 'Origin Stories',
  rageHook: 'Rage Hooks',
  newsletter: 'Newsletters',
  blockedPhrase: 'Blocked Phrases'
};

const FILTER_ICONS = {
  promoted: '💰',
  repost: '🔄',
  mutedAuthor: '🔇',
  hashtags: '#️⃣',
  emojis: '😀',
  engagementBait: '🎣',
  originStory: '📖',
  rageHook: '😤',
  newsletter: '📧',
  blockedPhrase: '🚫'
};

let currentStats = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadStats();
  attachListeners();

  // Auto-refresh every 5 seconds
  setInterval(loadStats, 5000);
});

/**
 * Load stats from storage
 */
async function loadStats() {
  try {
    const { feedholeStats } = await chrome.storage.local.get('feedholeStats');
    currentStats = feedholeStats || {
      filtered: 0,
      processed: 0,
      byType: {},
      recentFiltered: []
    };
    renderStats();
  } catch (e) {
    console.error('Error loading stats:', e);
  }
}

/**
 * Render all stats to the dashboard
 */
function renderStats() {
  const { filtered = 0, processed = 0, byType = {}, recentFiltered = [] } = currentStats;

  // Update summary cards
  document.getElementById('total-filtered').textContent = formatNumber(filtered);
  document.getElementById('total-processed').textContent = formatNumber(processed);

  // Filter rate
  const rate = processed > 0 ? Math.round((filtered / processed) * 100) : 0;
  document.getElementById('filter-rate').textContent = rate + '%';

  // Top filter
  const topFilter = getTopFilter(byType);
  document.getElementById('top-filter').textContent = topFilter || '-';

  // Render bar chart
  renderBarChart(byType);

  // Render activity feed
  renderActivityFeed(recentFiltered);
}

/**
 * Render bar chart
 */
function renderBarChart(byType) {
  const container = document.getElementById('bar-chart');
  const maxValue = Math.max(...Object.values(byType), 1);

  container.innerHTML = Object.entries(FILTER_LABELS).map(([key, label]) => {
    const value = byType[key] || 0;
    const height = Math.max((value / maxValue) * 200, 4);

    return `
      <div class="bar-item">
        <div class="bar" style="height: ${height}px;">
          <span class="bar-value">${value}</span>
        </div>
        <span class="bar-label">${label}</span>
      </div>
    `;
  }).join('');
}

/**
 * Render activity feed
 */
function renderActivityFeed(recentFiltered) {
  const container = document.getElementById('activity-list');

  if (!recentFiltered || recentFiltered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">◯</div>
        <div class="empty-state-text">No filtered posts yet.<br>Browse LinkedIn to see activity.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = recentFiltered.map(item => {
    const timeAgo = formatTimeAgo(item.timestamp);
    const icon = getIconForReasons(item.reasons);

    return `
      <div class="activity-item">
        <div class="activity-icon">${icon}</div>
        <div class="activity-content">
          <div class="activity-author">${escapeHtml(item.author || 'Unknown author')}</div>
          <div class="activity-preview">${escapeHtml(item.preview || '')}</div>
          <div class="activity-tags">
            ${item.reasons.map(r => `<span class="tag">${escapeHtml(r)}</span>`).join('')}
          </div>
        </div>
        <div class="activity-time">${timeAgo}</div>
      </div>
    `;
  }).join('');
}

/**
 * Get icon for filter reasons
 */
function getIconForReasons(reasons) {
  if (!reasons || reasons.length === 0) return '◯';

  const reason = reasons[0].toLowerCase();
  if (reason.includes('promoted')) return FILTER_ICONS.promoted;
  if (reason.includes('repost')) return FILTER_ICONS.repost;
  if (reason.includes('author')) return FILTER_ICONS.mutedAuthor;
  if (reason.includes('hashtag')) return FILTER_ICONS.hashtags;
  if (reason.includes('emoji')) return FILTER_ICONS.emojis;
  if (reason.includes('engagement')) return FILTER_ICONS.engagementBait;
  if (reason.includes('origin')) return FILTER_ICONS.originStory;
  if (reason.includes('hook')) return FILTER_ICONS.rageHook;
  if (reason.includes('newsletter')) return FILTER_ICONS.newsletter;
  if (reason.includes('blocked')) return FILTER_ICONS.blockedPhrase;

  return '◯';
}

/**
 * Get top filter type
 */
function getTopFilter(byType) {
  const entries = Object.entries(byType).filter(([, v]) => v > 0);
  if (entries.length === 0) return null;

  const [topKey] = entries.sort((a, b) => b[1] - a[1])[0];
  return FILTER_LABELS[topKey] || topKey;
}

/**
 * Format number with commas
 */
function formatNumber(n) {
  return n.toLocaleString();
}

/**
 * Format timestamp to relative time
 */
function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  return Math.floor(seconds / 86400) + 'd ago';
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Attach event listeners
 */
function attachListeners() {
  document.getElementById('refresh-btn').addEventListener('click', loadStats);

  document.getElementById('reset-btn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all stats? This cannot be undone.')) {
      await chrome.storage.local.remove('feedholeStats');
      await loadStats();
    }
  });
}
