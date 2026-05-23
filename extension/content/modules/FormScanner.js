// content/modules/FormScanner.js
// Universal form field detector — works across Google Forms, Workday, LinkedIn, etc.

export class FormScanner {
  
  /**
   * Scan the entire page for fillable form fields.
   * @returns {FormField[]}
   */
  scanPage() {
    const fields = [];
    const seen = new WeakSet();

    // Strategy 1: Standard form inputs
    const inputs = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), textarea, select'
    );

    for (const el of inputs) {
      if (seen.has(el) || this.isHidden(el)) continue;
      seen.add(el);
      const field = this.extractField(el);
      if (field) fields.push(field);
    }

    // Strategy 2: Custom/SPA inputs (role="combobox", role="textbox", contenteditable)
    const customInputs = document.querySelectorAll(
      '[role="textbox"], [role="combobox"], [role="listbox"], [contenteditable="true"]'
    );
    for (const el of customInputs) {
      if (seen.has(el) || this.isHidden(el)) continue;
      seen.add(el);
      const field = this.extractField(el);
      if (field) fields.push(field);
    }

    // Strategy 3: Workday-specific selectors
    const workdayFields = document.querySelectorAll(
      '[data-automation-id], [data-uxi-widget-type], [aria-required]'
    );
    for (const el of workdayFields) {
      if (seen.has(el) || this.isHidden(el)) continue;
      seen.add(el);
      const field = this.extractField(el);
      if (field) fields.push(field);
    }

    return fields;
  }

  /**
   * Extract structured data from a DOM element.
   */
  extractField(element) {
    const type = this.detectFieldType(element);
    if (type === 'unknown') return null;

    const question = this.extractQuestion(element);
    if (!question || question.length < 2) return null;

    return {
      element,
      type,
      question,
      context: this.buildContext(element),
      options: this.extractOptions(element),
      required: this.isRequired(element),
      name: element.name || element.id || '',
      platform: this.detectPlatform()
    };
  }

  detectFieldType(el) {
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();
    const role = (el.getAttribute('role') || '').toLowerCase();

    if (tag === 'textarea') return 'textarea';
    if (tag === 'select') return 'select';
    if (tag === 'input') {
      if (type === 'email') return 'email';
      if (type === 'tel' || type === 'phone') return 'phone';
      if (type === 'url') return 'url';
      if (type === 'number') return 'number';
      if (type === 'date') return 'date';
      if (type === 'file') return 'file';
      if (type === 'radio') return 'radio';
      if (type === 'checkbox') return 'checkbox';
      if (type === 'text' || type === '') return 'text';
    }
    if (role === 'textbox') return 'text';
    if (role === 'combobox') return 'select';
    if (el.getAttribute('contenteditable') === 'true') return 'richtext';
    return 'unknown';
  }

  extractQuestion(element) {
    const strategies = [
      () => this.getLabelText(element),
      () => element.getAttribute('aria-label'),
      () => element.getAttribute('aria-labelledby') && this.getTextById(element.getAttribute('aria-labelledby')),
      () => element.getAttribute('placeholder'),
      () => element.getAttribute('data-label'),
      () => element.getAttribute('data-automation-id')?.replace(/-/g, ' '),
      () => element.getAttribute('name')?.replace(/[-_]/g, ' '),
      () => element.getAttribute('id')?.replace(/[-_]/g, ' '),
      () => this.getNearbyText(element),
      () => this.getParentQuestion(element)
    ];

    for (const strategy of strategies) {
      try {
        const text = strategy()?.trim();
        if (text && text.length > 1 && text.length < 500) {
          return this.cleanQuestion(text);
        }
      } catch (_) {}
    }
    return null;
  }

  getLabelText(element) {
    // Explicit label via for attribute
    if (element.id) {
      const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (label) return label.innerText || label.textContent;
    }
    // Wrapping label
    const parentLabel = element.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      clone.querySelectorAll('input, textarea, select').forEach(el => el.remove());
      return clone.innerText || clone.textContent;
    }
    // labels property
    if (element.labels?.length > 0) {
      return element.labels[0].innerText || element.labels[0].textContent;
    }
    return null;
  }

  getTextById(id) {
    if (!id) return null;
    const el = document.getElementById(id);
    return el ? (el.innerText || el.textContent) : null;
  }

  getNearbyText(element) {
    // Check previous sibling or parent's text
    const parent = element.parentElement;
    if (!parent) return null;

    // Look for a question-like element near this field
    const questionSelectors = ['label', 'legend', '[class*="label"]', '[class*="question"]', '[class*="title"]', 'p', 'span', 'div'];
    for (const sel of questionSelectors) {
      const nearby = parent.querySelector(sel);
      if (nearby && nearby !== element) {
        const text = nearby.innerText?.trim();
        if (text && text.length > 2 && text.length < 300 && !text.includes('\n\n')) {
          return text;
        }
      }
    }

    // Previous sibling text
    let sibling = element.previousElementSibling;
    let depth = 0;
    while (sibling && depth < 3) {
      const text = sibling.innerText?.trim();
      if (text && text.length > 2) return text;
      sibling = sibling.previousElementSibling;
      depth++;
    }

    return null;
  }

  getParentQuestion(element) {
    // Climb up the DOM looking for a meaningful question label
    let current = element.parentElement;
    let depth = 0;
    while (current && depth < 6) {
      // Google Forms pattern
      const gFormQ = current.querySelector('[data-params], .freebirdFormviewerComponentsQuestionBaseTitle');
      if (gFormQ) return gFormQ.innerText?.trim();

      // Workday pattern
      const wdLabel = current.querySelector('[data-automation-id*="label"], [class*="label"]');
      if (wdLabel && wdLabel !== element) {
        const text = wdLabel.innerText?.trim();
        if (text && text.length > 2) return text;
      }

      current = current.parentElement;
      depth++;
    }
    return null;
  }

  buildContext(element) {
    return {
      id: element.id,
      name: element.name,
      className: element.className,
      placeholder: element.getAttribute('placeholder'),
      required: this.isRequired(element),
      section: this.detectSection(element)
    };
  }

  extractOptions(element) {
    if (element.tagName.toLowerCase() === 'select') {
      return Array.from(element.options).map(o => ({ value: o.value, text: o.text }));
    }
    // For radio/checkbox groups
    const name = element.name;
    if (name && (element.type === 'radio' || element.type === 'checkbox')) {
      const group = document.querySelectorAll(`input[name="${CSS.escape(name)}"]`);
      return Array.from(group).map(el => ({
        value: el.value,
        text: this.getLabelText(el) || el.value,
        element: el
      }));
    }
    return [];
  }

  isRequired(element) {
    return element.required ||
      element.getAttribute('aria-required') === 'true' ||
      element.getAttribute('data-required') === 'true' ||
      !!element.closest('[required]');
  }

  isHidden(element) {
    if (element.type === 'hidden') return true;
    const style = window.getComputedStyle(element);
    return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
  }

  detectSection(element) {
    // Find the nearest section/fieldset heading
    let current = element.parentElement;
    let depth = 0;
    while (current && depth < 10) {
      const heading = current.querySelector('h1, h2, h3, h4, legend, [class*="section-title"], [class*="sectionTitle"]');
      if (heading) return heading.innerText?.trim().slice(0, 100);
      current = current.parentElement;
      depth++;
    }
    return null;
  }

  detectPlatform() {
    const host = window.location.hostname;
    if (host.includes('google.com')) return 'google_forms';
    if (host.includes('workday.com') || host.includes('myworkday')) return 'workday';
    if (host.includes('linkedin.com')) return 'linkedin';
    if (host.includes('unstop.com') || host.includes('dare2compete')) return 'unstop';
    if (host.includes('greenhouse.io')) return 'greenhouse';
    if (host.includes('lever.co')) return 'lever';
    if (host.includes('taleo.net')) return 'taleo';
    if (host.includes('icims.com')) return 'icims';
    return 'custom';
  }

  cleanQuestion(text) {
    return text
      .replace(/\*$/, '') // Remove required asterisks
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[：:]\s*$/, '') // Remove trailing colons
      .trim();
  }
}
