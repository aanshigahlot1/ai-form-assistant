// content/modules/platforms/LinkedIn.js
// Handler for LinkedIn Easy Apply modal

export class LinkedInHandler {
  static PLATFORM = 'linkedin';

  static isActive() {
    return window.location.hostname.includes('linkedin.com');
  }

  /**
   * LinkedIn Easy Apply uses a modal with multiple steps.
   * Detect if the Easy Apply modal is open.
   */
  static isEasyApplyOpen() {
    return !!(
      document.querySelector('.jobs-easy-apply-modal') ||
      document.querySelector('[data-test-modal-id="easy-apply-modal"]') ||
      document.querySelector('.jobs-easy-apply-content')
    );
  }

  /**
   * Extract fields specifically from the LinkedIn Easy Apply modal.
   */
  static extractFields() {
    const modal = document.querySelector(
      '.jobs-easy-apply-modal, [data-test-modal-id="easy-apply-modal"], .jobs-easy-apply-content'
    );
    if (!modal) return [];

    const fields = [];
    const inputs = modal.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]), textarea, select'
    );

    for (const input of inputs) {
      const question = this.extractLinkedInLabel(input);
      if (!question) continue;

      fields.push({
        element: input,
        question,
        type: this.detectType(input),
        options: this.extractOptions(input),
        platform: 'linkedin'
      });
    }

    return fields;
  }

  static extractLinkedInLabel(input) {
    // LinkedIn uses specific label patterns
    const formGroup = input.closest('.fb-dash-form-element, .jobs-easy-apply-form-section__group, [class*="form-group"]');
    if (formGroup) {
      const label = formGroup.querySelector('label, .fb-form-element-label, [class*="label"]');
      if (label) return label.innerText?.trim();
    }

    // Fallback to aria-label or placeholder
    return input.getAttribute('aria-label') || input.getAttribute('placeholder') || null;
  }

  static detectType(input) {
    const tag = input.tagName.toLowerCase();
    if (tag === 'textarea') return 'textarea';
    if (tag === 'select') return 'select';
    const type = (input.getAttribute('type') || 'text').toLowerCase();
    const map = { email: 'email', tel: 'phone', url: 'url', date: 'date', file: 'file', radio: 'radio', checkbox: 'checkbox' };
    return map[type] || 'text';
  }

  static extractOptions(input) {
    if (input.tagName.toLowerCase() !== 'select') return [];
    return Array.from(input.options).map(o => ({ value: o.value, text: o.text }));
  }

  /**
   * Navigate LinkedIn's multi-step Easy Apply form.
   * Returns true if there's a next step, false if done.
   */
  static async clickNext() {
    const nextBtn = document.querySelector(
      'button[aria-label="Continue to next step"], button[aria-label="Review your application"], .jobs-easy-apply-footer button.artdeco-button--primary'
    );
    if (nextBtn && !nextBtn.disabled) {
      nextBtn.click();
      return true;
    }
    return false;
  }

  /**
   * Detect current step number.
   */
  static getCurrentStep() {
    const progress = document.querySelector('.jobs-easy-apply-header__progress-bar-item--active, [aria-valuenow]');
    if (progress) {
      return parseInt(progress.getAttribute('aria-valuenow') || '1');
    }
    return 1;
  }
}
