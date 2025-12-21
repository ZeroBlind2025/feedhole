/**
 * FeedHole Floating Badge
 * Injected into LinkedIn - no popup required
 * 
 * The number going up is the product.
 */

class FeedHoleBadge {
  constructor() {
    this.isExpanded = false;
    this.stats = { filtered: 0, processed: 0 };
    this.recentFiltered = [];
    this.element = null;
    this.modal = null;
    this.init();
  }
  
  init() {
    // Create badge container
    this.element = document.createElement('div');
    this.element.id = 'feedhole-badge';
    this.element.innerHTML = this.renderCollapsed();
    document.body.appendChild(this.element);

    // Attach styles
    this.injectStyles();

    // Event listeners
    this.element.addEventListener('click', (e) => this.handleClick(e));

    // Make draggable
    this.makeDraggable();

    // Load position from storage
    this.loadPosition();

    // Protect badge from LinkedIn's DOM manipulation
    this.protectBadge();
  }

  protectBadge() {
    // Watch for badge removal and re-add it
    const observer = new MutationObserver((mutations) => {
      // Check if badge was removed
      if (!document.getElementById('feedhole-badge')) {
        console.log('[FeedHole] Badge was removed, re-adding...');
        document.body.appendChild(this.element);
      }
      // Check if styles were removed
      if (!document.getElementById('feedhole-badge-styles')) {
        console.log('[FeedHole] Styles were removed, re-injecting...');
        this.injectStyles();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: false
    });
  }
  
  renderCollapsed() {
    return `
      <div class="feedhole-badge-collapsed">
        <span class="feedhole-badge-icon">◯</span>
        <span class="feedhole-badge-count" data-action="show-modal">${this.stats.filtered}</span>
      </div>
    `;
  }
  
  renderExpanded() {
    return `
      <div class="feedhole-badge-expanded">
        <div class="feedhole-badge-header">
          <div class="feedhole-badge-title">
            <span class="feedhole-badge-icon">◯</span>
            <span>FeedHole</span>
          </div>
          <button class="feedhole-badge-close">×</button>
        </div>
        
        <div class="feedhole-badge-stats">
          <div class="feedhole-stat feedhole-stat-clickable" data-action="show-modal">
            <div class="feedhole-stat-value">${this.stats.filtered}</div>
            <div class="feedhole-stat-label">Filtered</div>
          </div>
          <div class="feedhole-stat">
            <div class="feedhole-stat-value">${this.stats.processed}</div>
            <div class="feedhole-stat-label">Processed</div>
          </div>
          <div class="feedhole-stat">
            <div class="feedhole-stat-value">${this.stats.processed > 0 ? Math.round((this.stats.filtered / this.stats.processed) * 100) : 0}%</div>
            <div class="feedhole-stat-label">Filtered</div>
          </div>
        </div>
        
        <div class="feedhole-badge-toggles">
          <label class="feedhole-toggle-row">
            <span>Promoted</span>
            <input type="checkbox" data-rule="hidePromoted" checked>
          </label>
          <label class="feedhole-toggle-row">
            <span>Engagement bait</span>
            <input type="checkbox" data-rule="hideEngagementBait" checked>
          </label>
          <label class="feedhole-toggle-row">
            <span>Origin stories</span>
            <input type="checkbox" data-rule="hideHumbleBrags" checked>
          </label>
          <label class="feedhole-toggle-row">
            <span>Rage hooks</span>
            <input type="checkbox" data-rule="hideRageHooks" checked>
          </label>
          <label class="feedhole-toggle-row">
            <span>Newsletter pitches</span>
            <input type="checkbox" data-rule="hideNewsletterPitches" checked>
          </label>
          <label class="feedhole-toggle-row">
            <span>Reposts</span>
            <input type="checkbox" data-rule="hideReposts" checked>
          </label>
        </div>
        
        <div class="feedhole-badge-footer">
          <button class="feedhole-settings-btn" id="feedhole-full-settings">All settings →</button>
        </div>
      </div>
    `;
  }
  
  handleClick(e) {
    const target = e.target;

    // Close button - check first, highest priority
    if (target.closest('.feedhole-badge-close')) {
      e.stopPropagation();
      this.collapse();
      return;
    }

    // Show modal when clicking filtered count
    if (target.closest('[data-action="show-modal"]')) {
      e.stopPropagation();
      this.showModal();
      return;
    }

    // Full settings button
    if (target.closest('#feedhole-full-settings')) {
      e.stopPropagation();
      try {
        chrome.runtime.sendMessage({ action: 'openOptions' });
      } catch (err) {
        console.log('[FeedHole] Error opening options:', err);
      }
      // Also open directly as backup (more reliable)
      setTimeout(() => {
        window.open(chrome.runtime.getURL('options.html'), '_blank');
      }, 100);
      return;
    }

    // Toggle checkboxes - let the default behavior handle it
    if (target.type === 'checkbox' && target.dataset.rule) {
      this.toggleRule(target.dataset.rule, target.checked);
      return;
    }

    // Clicking on toggle row label (not checkbox) - do nothing, let label handle it
    if (target.closest('.feedhole-toggle-row')) {
      return;
    }

    // Clicking collapsed badge expands it
    if (!this.isExpanded && target.closest('.feedhole-badge-collapsed')) {
      this.expand();
      return;
    }

    // Clicking header area (but not close button) in expanded mode - collapse
    if (this.isExpanded && target.closest('.feedhole-badge-header')) {
      this.collapse();
      return;
    }
  }
  
  expand() {
    this.isExpanded = true;
    this.element.innerHTML = this.renderExpanded();
    this.element.classList.add('expanded');
    this.loadToggles();
  }
  
  collapse() {
    this.isExpanded = false;
    this.element.innerHTML = this.renderCollapsed();
    this.element.classList.remove('expanded');
  }
  
  async loadToggles() {
    try {
      const { feedholeRules } = await chrome.storage.sync.get('feedholeRules');
      if (feedholeRules) {
        this.element.querySelectorAll('[data-rule]').forEach(el => {
          if (el.dataset.rule in feedholeRules) {
            el.checked = feedholeRules[el.dataset.rule];
          }
        });
      }
    } catch (e) {
      console.log('[FeedHole] Error loading toggles');
    }
  }
  
  async toggleRule(rule, value) {
    try {
      const { feedholeRules = {} } = await chrome.storage.sync.get('feedholeRules');
      feedholeRules[rule] = value;
      await chrome.storage.sync.set({ feedholeRules });
    } catch (e) {
      console.log('[FeedHole] Error saving toggle');
    }
  }
  
  updateStats(filtered, processed, recentFiltered = null) {
    this.stats.filtered = filtered;
    this.stats.processed = processed;
    if (recentFiltered) {
      this.recentFiltered = recentFiltered;
    }

    // Update UI
    if (this.isExpanded) {
      const statValues = this.element.querySelectorAll('.feedhole-stat-value');
      if (statValues[0]) statValues[0].textContent = filtered;
      if (statValues[1]) statValues[1].textContent = processed;
      if (statValues[2]) statValues[2].textContent = processed > 0 ? Math.round((filtered / processed) * 100) + '%' : '0%';
    } else {
      const count = this.element.querySelector('.feedhole-badge-count');
      if (count) {
        count.textContent = filtered;
        // Pulse animation on update
        count.classList.remove('pulse');
        void count.offsetWidth; // Trigger reflow
        count.classList.add('pulse');
      }
    }
  }

  async showModal() {
    // Load latest stats from storage
    try {
      const { feedholeStats } = await chrome.storage.local.get('feedholeStats');
      if (feedholeStats?.recentFiltered) {
        this.recentFiltered = feedholeStats.recentFiltered;
      }
    } catch (e) {}

    // Remove existing modal if any
    this.closeModal();

    // Create modal
    this.modal = document.createElement('div');
    this.modal.className = 'feedhole-modal-overlay';
    this.modal.innerHTML = this.renderModal();
    document.body.appendChild(this.modal);

    // Close on overlay click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal || e.target.classList.contains('feedhole-modal-close')) {
        this.closeModal();
      }
    });

    // Close on escape
    this.modalEscHandler = (e) => {
      if (e.key === 'Escape') this.closeModal();
    };
    document.addEventListener('keydown', this.modalEscHandler);
  }

  closeModal() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    if (this.modalEscHandler) {
      document.removeEventListener('keydown', this.modalEscHandler);
      this.modalEscHandler = null;
    }
  }

  renderModal() {
    const items = this.recentFiltered || [];
    const filterIcons = {
      'Promoted': '💰',
      'Repost': '🔄',
      'Author': '🔇',
      'Hashtag': '#️⃣',
      'Emoji': '😀',
      'engagement': '🎣',
      'origin story': '📖',
      'hook pattern': '😤',
      'newsletter': '📧',
      'blocked phrase': '🚫'
    };

    const getIcon = (reasons) => {
      if (!reasons || !reasons.length) return '◯';
      const reason = reasons[0];
      for (const [key, icon] of Object.entries(filterIcons)) {
        if (reason.toLowerCase().includes(key.toLowerCase())) return icon;
      }
      return '◯';
    };

    const formatTime = (ts) => {
      const seconds = Math.floor((Date.now() - ts) / 1000);
      if (seconds < 60) return 'Just now';
      if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
      if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
      return Math.floor(seconds / 86400) + 'd ago';
    };

    const escapeHtml = (text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    const itemsHtml = items.length === 0
      ? `<div class="feedhole-modal-empty">
           <div class="feedhole-modal-empty-icon">◯</div>
           <div>No filtered posts yet</div>
           <div class="feedhole-modal-empty-sub">Browse your LinkedIn feed to see what gets caught</div>
         </div>`
      : items.map(item => `
          <div class="feedhole-modal-item">
            <div class="feedhole-modal-item-icon">${getIcon(item.reasons)}</div>
            <div class="feedhole-modal-item-content">
              <div class="feedhole-modal-item-header">
                <span class="feedhole-modal-item-author">${escapeHtml(item.author || 'Unknown')}</span>
                <span class="feedhole-modal-item-time">${formatTime(item.timestamp)}</span>
              </div>
              <div class="feedhole-modal-item-preview">${escapeHtml(item.preview || '')}</div>
              <div class="feedhole-modal-item-reasons">
                ${item.reasons.map(r => `<span class="feedhole-modal-tag">${escapeHtml(r)}</span>`).join('')}
              </div>
            </div>
          </div>
        `).join('');

    return `
      <div class="feedhole-modal">
        <div class="feedhole-modal-header">
          <div class="feedhole-modal-title">
            <span class="feedhole-modal-icon">◯</span>
            <span>Filtered Posts</span>
            <span class="feedhole-modal-count">${items.length}</span>
          </div>
          <button class="feedhole-modal-close">×</button>
        </div>
        <div class="feedhole-modal-body">
          ${itemsHtml}
        </div>
        <div class="feedhole-modal-footer">
          <div class="feedhole-modal-stats">
            <span>${this.stats.filtered} filtered</span>
            <span class="feedhole-modal-divider">•</span>
            <span>${this.stats.processed} processed</span>
            <span class="feedhole-modal-divider">•</span>
            <span>${this.stats.processed > 0 ? Math.round((this.stats.filtered / this.stats.processed) * 100) : 0}% filter rate</span>
          </div>
        </div>
      </div>
    `;
  }
  
  makeDraggable() {
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    this.element.addEventListener('mousedown', (e) => {
      // Only drag from header or collapsed state
      if (!e.target.closest('.feedhole-badge-collapsed') && 
          !e.target.closest('.feedhole-badge-header')) return;
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
      
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = this.element.offsetLeft;
      startTop = this.element.offsetTop;
      
      this.element.style.transition = 'none';
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      let newLeft = startLeft + dx;
      let newTop = startTop + dy;
      
      // Bounds checking
      newLeft = Math.max(0, Math.min(window.innerWidth - this.element.offsetWidth, newLeft));
      newTop = Math.max(0, Math.min(window.innerHeight - this.element.offsetHeight, newTop));
      
      this.element.style.left = newLeft + 'px';
      this.element.style.top = newTop + 'px';
      this.element.style.right = 'auto';
      this.element.style.bottom = 'auto';
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        this.element.style.transition = '';
        this.savePosition();
      }
    });
  }
  
  async savePosition() {
    try {
      await chrome.storage.local.set({
        feedholeBadgePosition: {
          left: this.element.style.left,
          top: this.element.style.top
        }
      });
    } catch (e) {}
  }
  
  async loadPosition() {
    try {
      const { feedholeBadgePosition } = await chrome.storage.local.get('feedholeBadgePosition');
      if (feedholeBadgePosition) {
        this.element.style.left = feedholeBadgePosition.left;
        this.element.style.top = feedholeBadgePosition.top;
        this.element.style.right = 'auto';
        this.element.style.bottom = 'auto';
      }
    } catch (e) {}
  }
  
  injectStyles() {
    const style = document.createElement('style');
    style.id = 'feedhole-badge-styles';
    style.textContent = `
      #feedhole-badge {
        position: fixed !important;
        bottom: 100px !important;
        left: 20px !important;
        right: auto !important;
        z-index: 9999999 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        user-select: none !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }
      
      /* Collapsed state */
      .feedhole-badge-collapsed {
        display: flex;
        align-items: center;
        gap: 6px;
        background: #111;
        color: #fff;
        padding: 8px 12px;
        border-radius: 20px;
        cursor: pointer;
        box-shadow: 0 2px 12px rgba(0,0,0,0.15);
        transition: transform 0.15s, box-shadow 0.15s;
      }
      
      .feedhole-badge-collapsed:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      }
      
      .feedhole-badge-icon {
        font-size: 14px;
        opacity: 0.9;
      }
      
      .feedhole-badge-count {
        font-size: 13px;
        font-weight: 600;
        min-width: 20px;
        text-align: center;
      }
      
      .feedhole-badge-count.pulse {
        animation: feedhole-pulse 0.3s ease;
      }
      
      @keyframes feedhole-pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
      }
      
      /* Expanded state */
      .feedhole-badge-expanded {
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.15);
        width: 240px;
        overflow: hidden;
      }
      
      .feedhole-badge-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        background: #111;
        color: #fff;
        cursor: move;
      }
      
      .feedhole-badge-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 600;
      }
      
      .feedhole-badge-close {
        background: none;
        border: none;
        color: #fff;
        font-size: 18px;
        cursor: pointer;
        opacity: 0.7;
        padding: 0 4px;
      }
      
      .feedhole-badge-close:hover {
        opacity: 1;
      }
      
      .feedhole-badge-stats {
        display: flex;
        padding: 14px;
        gap: 8px;
        border-bottom: 1px solid #f0f0f0;
      }
      
      .feedhole-stat {
        flex: 1;
        text-align: center;
      }
      
      .feedhole-stat-value {
        font-size: 18px;
        font-weight: 600;
        color: #111;
      }
      
      .feedhole-stat-label {
        font-size: 10px;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-top: 2px;
      }
      
      .feedhole-badge-toggles {
        padding: 8px 14px;
      }
      
      .feedhole-toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 0;
        font-size: 13px;
        color: #333;
        cursor: pointer;
      }
      
      .feedhole-toggle-row input {
        width: 16px;
        height: 16px;
        cursor: pointer;
        accent-color: #111;
      }
      
      .feedhole-badge-footer {
        padding: 10px 14px;
        border-top: 1px solid #f0f0f0;
      }
      
      .feedhole-settings-btn {
        width: 100%;
        background: #f5f5f5;
        border: none;
        padding: 8px;
        border-radius: 6px;
        font-size: 12px;
        color: #666;
        cursor: pointer;
        transition: background 0.15s;
      }
      
      .feedhole-settings-btn:hover {
        background: #eee;
        color: #333;
      }

      /* Clickable stat */
      .feedhole-stat-clickable {
        cursor: pointer;
        border-radius: 8px;
        padding: 8px 4px;
        margin: -8px -4px;
        transition: background 0.15s;
      }

      .feedhole-stat-clickable:hover {
        background: #f5f5f5;
      }

      .feedhole-badge-count {
        cursor: pointer;
      }

      .feedhole-badge-count:hover {
        text-decoration: underline;
      }

      /* Modal Overlay */
      .feedhole-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: feedhole-fade-in 0.2s ease;
      }

      @keyframes feedhole-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      /* Modal */
      .feedhole-modal {
        background: #fff;
        border-radius: 16px;
        width: 480px;
        max-width: 90vw;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
        animation: feedhole-slide-up 0.25s ease;
      }

      @keyframes feedhole-slide-up {
        from { opacity: 0; transform: translateY(20px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      .feedhole-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        border-bottom: 1px solid #f0f0f0;
        flex-shrink: 0;
      }

      .feedhole-modal-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 18px;
        font-weight: 600;
        color: #111;
      }

      .feedhole-modal-icon {
        font-size: 20px;
      }

      .feedhole-modal-count {
        background: #111;
        color: #fff;
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 10px;
        font-weight: 500;
      }

      .feedhole-modal-close {
        background: none;
        border: none;
        font-size: 24px;
        color: #999;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 6px;
        transition: all 0.15s;
      }

      .feedhole-modal-close:hover {
        background: #f5f5f5;
        color: #333;
      }

      .feedhole-modal-body {
        flex: 1;
        overflow-y: auto;
        padding: 16px 24px;
      }

      .feedhole-modal-body::-webkit-scrollbar {
        width: 6px;
      }

      .feedhole-modal-body::-webkit-scrollbar-track {
        background: transparent;
      }

      .feedhole-modal-body::-webkit-scrollbar-thumb {
        background: #ddd;
        border-radius: 3px;
      }

      /* Modal Items */
      .feedhole-modal-item {
        display: flex;
        gap: 14px;
        padding: 16px 0;
        border-bottom: 1px solid #f5f5f5;
      }

      .feedhole-modal-item:last-child {
        border-bottom: none;
      }

      .feedhole-modal-item-icon {
        width: 40px;
        height: 40px;
        background: #f9f9f9;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
      }

      .feedhole-modal-item-content {
        flex: 1;
        min-width: 0;
      }

      .feedhole-modal-item-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 4px;
      }

      .feedhole-modal-item-author {
        font-size: 14px;
        font-weight: 600;
        color: #111;
      }

      .feedhole-modal-item-time {
        font-size: 12px;
        color: #999;
      }

      .feedhole-modal-item-preview {
        font-size: 13px;
        color: #666;
        line-height: 1.4;
        margin-bottom: 8px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .feedhole-modal-item-reasons {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .feedhole-modal-tag {
        font-size: 11px;
        padding: 3px 10px;
        background: #f0f0f0;
        color: #555;
        border-radius: 12px;
        font-weight: 500;
      }

      /* Empty State */
      .feedhole-modal-empty {
        text-align: center;
        padding: 48px 24px;
        color: #999;
      }

      .feedhole-modal-empty-icon {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.4;
      }

      .feedhole-modal-empty-sub {
        font-size: 13px;
        margin-top: 8px;
        color: #bbb;
      }

      /* Modal Footer */
      .feedhole-modal-footer {
        padding: 16px 24px;
        border-top: 1px solid #f0f0f0;
        flex-shrink: 0;
      }

      .feedhole-modal-stats {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-size: 13px;
        color: #888;
      }

      .feedhole-modal-divider {
        color: #ddd;
      }
    `;
    document.head.appendChild(style);
  }
}

// Export for use in content script
window.FeedHoleBadge = FeedHoleBadge;
