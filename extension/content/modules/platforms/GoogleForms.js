// content/modules/platforms/GoogleForms.js
// Specialized scanner/filler for Google Forms

export class GoogleFormsHandler {
  static PLATFORM = 'google_forms';

  static isActive() {
    return (
      window.location.hostname.includes('docs.google.com') &&
      window.location.pathname.includes('/forms/')
    );
  }

  /**
   * Extracts all question blocks from a Google Form.
   * Returns an array of { element, question, type, options }
   */
  static extractFields() {
    const fields = [];

    // Each question container
    const questionBlocks = document.querySelectorAll('[data-params], .freebirdFormviewerViewItemsItemItem');

    for (const block of questionBlocks) {
      const titleEl = block.querySelector(
        '.freebirdFormviewerComponentsQuestionBaseTitle, [data-params] span[dir]'
      );
      const question = titleEl?.innerText?.trim();
      if (!question) continue;

      // Short text / Long text
      const textInput = block.querySelector('input[type="text"], textarea');
      if (textInput) {
        fields.push({ element: textInput, question, type: textInput.tagName === 'TEXTAREA' ? 'textarea' : 'text', options: [] });
        continue;
      }

      // Multiple choice / Radio
      const radioButtons = block.querySelectorAll('input[type="radio"]');
      if (radioButtons.length > 0) {
        const options = [];
        for (const radio of radioButtons) {
          const label = radio.closest('[data-value]')?.getAttribute('data-value') ||
            radio.parentElement?.innerText?.trim() || radio.value;
          options.push({ value: radio.value, text: label, element: radio });
        }
        fields.push({ element: radioButtons[0], question, type: 'radio', options });
        continue;
      }

      // Checkboxes
      const checkboxes = block.querySelectorAll('input[type="checkbox"]');
      if (checkboxes.length > 0) {
        const options = [];
        for (const cb of checkboxes) {
          const label = cb.closest('[data-value]')?.getAttribute('data-value') ||
            cb.parentElement?.innerText?.trim() || cb.value;
          options.push({ value: cb.value, text: label, element: cb });
        }
        fields.push({ element: checkboxes[0], question, type: 'checkbox', options });
        continue;
      }

      // Dropdown
      const select = block.querySelector('select, [role="listbox"]');
      if (select) {
        const options = Array.from(select.querySelectorAll('option, [role="option"]')).map(o => ({
          value: o.value || o.getAttribute('data-value') || o.innerText,
          text: o.innerText?.trim()
        }));
        fields.push({ element: select, question, type: 'select', options });
        continue;
      }

      // Date
      const dateInput = block.querySelector('input[type="date"]');
      if (dateInput) {
        fields.push({ element: dateInput, question, type: 'date', options: [] });
      }
    }

    return fields;
  }

  /**
   * Fill a Google Forms field using its native reactivity
   */
  static fillField(element, value) {
    // Google Forms uses React internals — must use nativeInputValueSetter
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }
}
