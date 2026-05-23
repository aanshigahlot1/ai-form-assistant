// content/modules/ConfidenceUI.js
// Injects non-intrusive UI elements directly into the page

const COLORS = {
  high: '#22c55e',
  medium: '#f59e0b',
  low: '#ef4444',
  bg: '#0f172a',
  text: '#f1f5f9'
};

export class ConfidenceUI {
  constructor() {
    this.tooltips = new Map();
    this.indicators = new Map();
    this.injectStyles();
  }

  injectStyles() {
    if (document.getElementById('ai-form-assistant-styles')) return;
    const style = document.createElement('style');
    style.id = 'ai-form-assistant-styles';
    style.textContent = `
      .aifa-indicator {
        position: absolute;
        top: 50%;
        right: 8px;
        transform: translateY(-50%);
        width: 8px;
        height: 8px;
        border-radius: 50%;
        pointer-events: none;
        z-index: 999999;
        box-shadow: 0 0 6px currentColor;
        animation: aifa-pulse 2s infinite;
      }
      @keyframes aifa-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      .aifa-tooltip {
        position: absolute;
        background: ${COLORS.bg};
        color: ${COLORS.text};
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        padding: 10px 14px;
        font-size: 13px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        z-index: 999999;
        min-width: 220px;
        max-width: 380px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        backdrop-filter: blur(12px);
        animation: aifa-slide-in 0.15s ease-out;
      }
      @keyframes aifa-slide-in {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .aifa-tooltip .aifa-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
        font-weight: 600;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: rgba(241,245,249,0.5);
      }
      .aifa-tooltip .aifa-answer {
        font-size: 14px;
        color: #f1f5f9;
        margin-bottom: 10px;
        word-break: break-word;
        border-left: 2px solid ${COLORS.medium};
        padding-left: 8px;
      }
      .aifa-tooltip input.aifa-edit {
        width: 100%;
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 4px;
        color: #f1f5f9;
        padding: 5px 8px;
        font-size: 13px;
        margin-bottom: 8px;
        outline: none;
        display: none;
        box-sizing: border-box;
      }
      .aifa-tooltip .aifa-actions {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .aifa-tooltip button {
        padding: 5px 12px;
        border-radius: 5px;
        border: none;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        transition: all 0.15s;
      }
      .aifa-btn-accept {
        background: ${COLORS.high};
        color: white;
      }
      .aifa-btn-edit {
        background: rgba(255,255,255,0.1);
        color: ${COLORS.text};
      }
      .aifa-btn-skip {
        background: transparent;
        color: rgba(241,245,249,0.5);
        font-weight: 400;
      }
      .aifa-confidence-bar {
        height: 3px;
        border-radius: 2px;
        background: rgba(255,255,255,0.1);
        margin-bottom: 8px;
        overflow: hidden;
      }
      .aifa-confidence-fill {
        height: 100%;
        border-radius: 2px;
        transition: width 0.3s ease;
      }
    `;
    document.head.appendChild(style);
  }

  showFillIndicator(element, confidence, mode = 'auto') {
    this.removeIndicator(element);

    const wrapper = element.parentElement;
    if (!wrapper) return;

    // Make wrapper relative for positioning
    const wrapperStyle = window.getComputedStyle(wrapper);
    if (wrapperStyle.position === 'static') {
      wrapper.style.position = 'relative';
    }

    const dot = document.createElement('div');
    dot.className = 'aifa-indicator';
    dot.style.color = COLORS.high;
    dot.style.backgroundColor = COLORS.high;
    dot.title = `AI filled (${Math.round(confidence * 100)}% confidence)`;
    dot.dataset.aifaFor = element.id || element.name || Math.random().toString(36).slice(2);

    wrapper.appendChild(dot);
    this.indicators.set(element, dot);

    // Auto-remove after 4 seconds
    setTimeout(() => this.removeIndicator(element), 4000);
  }

  showSuggestion(element, answer, confidence, onDecision) {
    this.removeTooltip(element);

    const tooltip = document.createElement('div');
    tooltip.className = 'aifa-tooltip';

    const confPercent = Math.round(confidence * 100);
    const confColor = confidence >= 0.75 ? COLORS.high : COLORS.medium;

    tooltip.innerHTML = `
      <div class="aifa-header">
        <span>🤖</span>
        <span>AI Suggestion</span>
      </div>
      <div class="aifa-confidence-bar">
        <div class="aifa-confidence-fill" style="width:${confPercent}%;background:${confColor}"></div>
      </div>
      <div class="aifa-answer">${this.escapeHtml(String(answer).slice(0, 200))}</div>
      <input class="aifa-edit" type="text" value="${this.escapeHtml(String(answer))}" placeholder="Edit answer..."/>
      <div class="aifa-actions">
        <button class="aifa-btn-accept">✓ Use This</button>
        <button class="aifa-btn-edit">✏ Edit</button>
        <button class="aifa-btn-skip">✕ Skip</button>
      </div>
    `;

    // Position tooltip below the element
    this.positionTooltip(tooltip, element);
    document.body.appendChild(tooltip);
    this.tooltips.set(element, tooltip);

    // Event handlers
    const editInput = tooltip.querySelector('.aifa-edit');
    const answerDiv = tooltip.querySelector('.aifa-answer');

    tooltip.querySelector('.aifa-btn-accept').addEventListener('click', () => {
      onDecision(true, null);
      this.removeTooltip(element);
      this.showFillIndicator(element, confidence, 'suggested');
    });

    tooltip.querySelector('.aifa-btn-edit').addEventListener('click', () => {
      answerDiv.style.display = 'none';
      editInput.style.display = 'block';
      editInput.focus();
      editInput.select();

      editInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          onDecision(true, editInput.value);
          this.removeTooltip(element);
        }
        if (e.key === 'Escape') {
          this.removeTooltip(element);
        }
      });
    });

    tooltip.querySelector('.aifa-btn-skip').addEventListener('click', () => {
      this.removeTooltip(element);
    });

    // Auto-dismiss after 15 seconds
    setTimeout(() => this.removeTooltip(element), 15000);
  }

  positionTooltip(tooltip, element) {
    const rect = element.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    tooltip.style.position = 'absolute';
    tooltip.style.top = `${rect.bottom + scrollY + 6}px`;
    tooltip.style.left = `${rect.left + scrollX}px`;
    tooltip.style.zIndex = '2147483647';
  }

  removeTooltip(element) {
    const tooltip = this.tooltips.get(element);
    if (tooltip) {
      tooltip.remove();
      this.tooltips.delete(element);
    }
  }

  removeIndicator(element) {
    const indicator = this.indicators.get(element);
    if (indicator) {
      indicator.remove();
      this.indicators.delete(element);
    }
  }

  hideAll() {
    for (const tooltip of this.tooltips.values()) tooltip.remove();
    for (const indicator of this.indicators.values()) indicator.remove();
    this.tooltips.clear();
    this.indicators.clear();
  }

  escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
