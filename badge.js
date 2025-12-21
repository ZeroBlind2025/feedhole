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
    this.element = null;
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
  }
  
  renderCollapsed() {
    return `
      <div class="feedhole-badge-collapsed">
        <span class="feedhole-badge-icon">◯</span>
        <span class="feedhole-badge-count">${this.stats.filtered}</span>
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
          <div class="feedhole-stat">
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
    
    // Close button
    if (target.classList.contains('feedhole-badge-close')) {
      this.collapse();
      return;
    }
    
    // Full settings button
    if (target.id === 'feedhole-full-settings') {
      chrome.runtime.sendMessage({ action: 'openOptions' });
      return;
    }
    
    // Toggle checkboxes
    if (target.type === 'checkbox' && target.dataset.rule) {
      this.toggleRule(target.dataset.rule, target.checked);
      return;
    }
    
    // Clicking collapsed badge expands it
    if (!this.isExpanded && target.closest('.feedhole-badge-collapsed')) {
      this.expand();
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
  
  updateStats(filtered, processed) {
    this.stats.filtered = filtered;
    this.stats.processed = processed;
    
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
    style.textContent = `
      #feedhole-badge {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        user-select: none;
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
    `;
    document.head.appendChild(style);
  }
}

// Export for use in content script
window.FeedHoleBadge = FeedHoleBadge;
