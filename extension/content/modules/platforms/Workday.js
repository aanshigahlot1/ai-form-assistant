// content/modules/platforms/Workday.js
// Specialized handler for Workday ATS (myworkday.com / wd3.myworkdayjobs.com)

export class WorkdayHandler {
  static PLATFORM = 'workday';

  static isActive() {
    const host = window.location.hostname;
    return host.includes('myworkday') || host.includes('workday.com');
  }

  /**
   * Workday uses data-automation-id attributes extensively.
   * Map automation IDs to profile fields.
   */
  static AUTOMATION_ID_MAP = {
    'firstName': 'firstName',
    'lastName': 'lastName',
    'email': 'email',
    'phone': 'phone',
    'address': 'address',
    'city': 'city',
    'state': 'state',
    'postalCode': 'pincode',
    'country': 'country',
    'legalName--firstName': 'firstName',
    'legalName--lastName': 'lastName',
    'name--firstName': 'firstName',
    'name--lastName': 'lastName',
    'phone-number': 'phone',
    'email-address': 'email',
    'linkedin': 'linkedin',
    'website': 'portfolio',
    'school': 'college',
    'degree': 'degree',
    'major': 'branch',
    'gpa': 'cgpa',
    'graduationDate': 'graduationYear',
  };

  /**
   * Scan all Workday form inputs using automation IDs
   */
  static extractFields() {
    const fields = [];
    const seen = new WeakSet();

    // Primary: data-automation-id elements
    const automatedEls = document.querySelectorAll('[data-automation-id]');
    for (const el of automatedEls) {
      if (seen.has(el)) continue;
      const automationId = el.getAttribute('data-automation-id');

      // Find actual input within this container
      const input = el.matches('input, textarea, select')
        ? el
        : el.querySelector('input:not([type="hidden"]), textarea, select');

      if (!input || seen.has(input)) continue;

      const mappedField = this.AUTOMATION_ID_MAP[automationId];
      const label = this.extractWorkdayLabel(el) || automationId.replace(/-/g, ' ');

      seen.add(el);
      seen.add(input);

      fields.push({
        element: input,
        question: label,
        type: this.detectType(input),
        options: this.extractOptions(input),
        workdayAutomationId: automationId,
        mappedField,
        platform: 'workday'
      });
    }

    return fields;
  }

  static extractWorkdayLabel(container) {
    // Workday label patterns
    const selectors = [
      '[data-automation-id*="label"]',
      'label',
      '[class*="label"]',
      'legend'
    ];
    for (const sel of selectors) {
      const el = container.querySelector(sel) || container.closest('div')?.querySelector(sel);
      if (el && el.innerText?.trim()) return el.innerText.trim();
    }
    return null;
  }

  static detectType(input) {
    const tag = input.tagName.toLowerCase();
    if (tag === 'textarea') return 'textarea';
    if (tag === 'select') return 'select';
    const type = (input.getAttribute('type') || 'text').toLowerCase();
    const typeMap = { email: 'email', tel: 'phone', url: 'url', date: 'date', file: 'file', radio: 'radio', checkbox: 'checkbox' };
    return typeMap[type] || 'text';
  }

  static extractOptions(input) {
    if (input.tagName.toLowerCase() !== 'select') return [];
    return Array.from(input.options).map(o => ({ value: o.value, text: o.text }));
  }

  /**
   * Workday-specific fill: handles their custom dropdowns and React components.
   */
  static async fillDropdown(element, value) {
    // Click to open the dropdown
    element.click();
    await sleep(300);

    // Search for the value in the dropdown list
    const listbox = document.querySelector('[role="listbox"], [data-automation-id="promptOption"]');
    if (listbox) {
      const options = listbox.querySelectorAll('[role="option"], [data-automation-id*="option"]');
      const lowerVal = value.toLowerCase();
      for (const option of options) {
        if (option.innerText?.toLowerCase().includes(lowerVal)) {
          option.click();
          return true;
        }
      }
    }

    // Fallback: type into the input
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) nativeSetter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(400);

    // Pick first suggestion
    const suggestion = document.querySelector('[role="option"]:first-child, [data-automation-id="promptOption"]:first-child');
    if (suggestion) { suggestion.click(); return true; }

    return false;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
