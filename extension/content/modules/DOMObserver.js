// content/modules/DOMObserver.js
// Handles SPA/Workday dynamic forms with debounced MutationObserver

export class DOMObserver {
  constructor(onChangeCallback) {
    this.callback = onChangeCallback;
    this.observer = null;
    this.debounceTimer = null;
    this.DEBOUNCE_MS = 600;
  }

  start() {
    if (this.observer) return;

    this.observer = new MutationObserver((mutations) => {
      const hasRelevantChange = mutations.some(mutation => {
        // New nodes added
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (this.containsFormField(node)) return true;
            }
          }
        }
        // Attribute changes on form elements
        if (mutation.type === 'attributes') {
          const target = mutation.target;
          if (this.isFormField(target)) return true;
        }
        return false;
      });

      if (hasRelevantChange) {
        this.debouncedCallback();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden', 'aria-hidden', 'disabled']
    });
  }

  stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }

  debouncedCallback() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.callback();
    }, this.DEBOUNCE_MS);
  }

  containsFormField(node) {
    if (this.isFormField(node)) return true;
    return node.querySelector?.(
      'input:not([type="hidden"]):not([type="submit"]), textarea, select, [role="textbox"], [role="combobox"]'
    ) !== null;
  }

  isFormField(el) {
    if (!el.tagName) return false;
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute?.('type') || '').toLowerCase();
    const role = (el.getAttribute?.('role') || '').toLowerCase();

    return (
      (tag === 'input' && !['hidden', 'submit', 'button', 'reset'].includes(type)) ||
      tag === 'textarea' ||
      tag === 'select' ||
      ['textbox', 'combobox', 'listbox'].includes(role)
    );
  }
}
