// content/modules/platforms/Unstop.js
// Handler for Unstop.com (formerly Dare2Compete) registration/application forms

export class UnstopHandler {
  static PLATFORM = 'unstop';

  static isActive() {
    const host = window.location.hostname;
    return host.includes('unstop.com') || host.includes('dare2compete.com');
  }

  /**
   * Unstop uses Angular-based forms with custom components.
   * Extract fields from their registration modals and application forms.
   */
  static extractFields() {
    const fields = [];
    const seen = new WeakSet();

    // Unstop form containers
    const containers = document.querySelectorAll(
      '.registration-form, .application-form, [class*="apply"], form, .modal-body'
    );

    for (const container of containers) {
      const inputs = container.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]), textarea, select, ng-select'
      );

      for (const input of inputs) {
        if (seen.has(input)) continue;
        seen.add(input);

        const question = this.extractLabel(input);
        if (!question) continue;

        fields.push({
          element: input,
          question,
          type: this.detectType(input),
          options: this.extractOptions(input),
          platform: 'unstop'
        });
      }
    }

    return fields;
  }

  static extractLabel(input) {
    // Unstop specific patterns
    const parent = input.closest('.form-group, .field-wrapper, [class*="form-field"], mat-form-field');
    if (parent) {
      const label = parent.querySelector('label, mat-label, .label, .field-label, [class*="label"]');
      if (label) return label.innerText?.trim();
    }

    return input.getAttribute('placeholder') ||
      input.getAttribute('aria-label') ||
      input.getAttribute('name')?.replace(/_/g, ' ') ||
      null;
  }

  static detectType(input) {
    const tag = input.tagName.toLowerCase();
    if (tag === 'textarea') return 'textarea';
    if (tag === 'select' || tag === 'ng-select') return 'select';
    const type = (input.getAttribute('type') || 'text').toLowerCase();
    const map = { email: 'email', tel: 'phone', number: 'number', date: 'date', file: 'file', radio: 'radio', checkbox: 'checkbox' };
    return map[type] || 'text';
  }

  static extractOptions(input) {
    if (!['select', 'ng-select'].includes(input.tagName.toLowerCase())) return [];
    return Array.from(input.querySelectorAll('option, .ng-option')).map(o => ({
      value: o.value || o.getAttribute('ng-reflect-value') || o.innerText,
      text: o.innerText?.trim()
    }));
  }

  /**
   * Handle ng-select (Angular Select) dropdowns on Unstop.
   */
  static async fillNgSelect(ngSelectEl, value) {
    // Open the dropdown
    ngSelectEl.click();
    await sleep(300);

    // Search/filter
    const searchInput = ngSelectEl.querySelector('input[role="combobox"], .ng-input input');
    if (searchInput) {
      searchInput.value = value;
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(400);
    }

    // Click matching option
    const options = document.querySelectorAll('.ng-option:not(.ng-option-disabled), .ng-dropdown-panel .ng-option');
    const lowerVal = value.toLowerCase();
    for (const opt of options) {
      if (opt.innerText?.toLowerCase().includes(lowerVal)) {
        opt.click();
        return true;
      }
    }
    return false;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
