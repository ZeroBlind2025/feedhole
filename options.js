/**
 * FeedHole Options Script
 */

const DEFAULT_RULES = {
  maxHashtags: 5,
  maxEmojis: 8,
  hidePromoted: true,
  hideReposts: true,
  hideNewsletterPitches: true,
  hideEngagementBait: true,
  hideHumbleBrags: true,
  hideRageHooks: true,
  blockedPhrases: [],
  mutedAuthors: []
};

let currentRules = { ...DEFAULT_RULES };
let hasChanges = false;

document.addEventListener('DOMContentLoaded', async () => {
  await loadRules();
  attachListeners();
});

/**
 * Load saved rules from storage
 */
async function loadRules() {
  try {
    const { feedholeRules } = await chrome.storage.sync.get('feedholeRules');
    if (feedholeRules) {
      currentRules = { ...DEFAULT_RULES, ...feedholeRules };
    }
  } catch (e) {
    console.log('Error loading rules:', e);
  }
  
  applyRulesToUI();
}

/**
 * Apply current rules to UI elements
 */
function applyRulesToUI() {
  // Checkboxes
  document.querySelectorAll('[data-rule][type="checkbox"]').forEach(el => {
    const rule = el.dataset.rule;
    if (rule in currentRules) {
      el.checked = currentRules[rule];
    }
  });
  
  // Number inputs
  document.querySelectorAll('[data-rule][type="number"]').forEach(el => {
    const rule = el.dataset.rule;
    if (rule in currentRules) {
      el.value = currentRules[rule];
    }
  });
  
  // Textareas (arrays)
  document.querySelectorAll('textarea[data-rule]').forEach(el => {
    const rule = el.dataset.rule;
    if (rule in currentRules && Array.isArray(currentRules[rule])) {
      el.value = currentRules[rule].join('\n');
    }
  });
}

/**
 * Collect rules from UI
 */
function collectRulesFromUI() {
  const rules = { ...currentRules };
  
  // Checkboxes
  document.querySelectorAll('[data-rule][type="checkbox"]').forEach(el => {
    rules[el.dataset.rule] = el.checked;
  });
  
  // Number inputs
  document.querySelectorAll('[data-rule][type="number"]').forEach(el => {
    rules[el.dataset.rule] = parseInt(el.value, 10) || DEFAULT_RULES[el.dataset.rule];
  });
  
  // Textareas (arrays)
  document.querySelectorAll('textarea[data-rule]').forEach(el => {
    const lines = el.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    rules[el.dataset.rule] = lines;
  });
  
  return rules;
}

/**
 * Attach event listeners
 */
function attachListeners() {
  // Track changes
  document.querySelectorAll('[data-rule]').forEach(el => {
    el.addEventListener('change', showSaveBar);
    el.addEventListener('input', showSaveBar);
  });
  
  // Save button
  document.getElementById('save-btn').addEventListener('click', saveRules);
  
  // Reset button
  document.getElementById('reset-btn').addEventListener('click', resetRules);
}

/**
 * Show save bar when changes are made
 */
function showSaveBar() {
  hasChanges = true;
  document.getElementById('save-bar').classList.add('visible');
}

/**
 * Hide save bar
 */
function hideSaveBar() {
  hasChanges = false;
  document.getElementById('save-bar').classList.remove('visible');
}

/**
 * Save rules to storage
 */
async function saveRules() {
  const rules = collectRulesFromUI();
  
  try {
    await chrome.storage.sync.set({ feedholeRules: rules });
    currentRules = rules;
    hideSaveBar();
    showToast('Settings saved');
  } catch (e) {
    console.error('Error saving rules:', e);
    showToast('Error saving settings');
  }
}

/**
 * Reset to default rules
 */
async function resetRules() {
  currentRules = { ...DEFAULT_RULES };
  applyRulesToUI();
  
  try {
    await chrome.storage.sync.set({ feedholeRules: currentRules });
    hideSaveBar();
    showToast('Reset to defaults');
  } catch (e) {
    console.error('Error resetting rules:', e);
  }
}

/**
 * Show toast notification
 */
function showToast(message) {
  const toast = document.getElementById('saved-toast');
  toast.textContent = message;
  toast.classList.add('visible');
  
  setTimeout(() => {
    toast.classList.remove('visible');
  }, 2000);
}
