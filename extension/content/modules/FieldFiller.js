// content/modules/FieldFiller.js
// Fills form fields while triggering appropriate React/Vue/Angular events

export class FieldFiller {

  async fill(field, answer) {
    if (!answer && answer !== 0) return false;

    try {
      switch (field.type) {
        case 'text':
        case 'email':
        case 'phone':
        case 'url':
        case 'number':
          return this.fillText(field.element, String(answer));
        case 'textarea':
        case 'richtext':
          return this.fillTextarea(field.element, String(answer));
        case 'select':
          return this.fillSelect(field.element, String(answer), field.options);
        case 'radio':
          return this.fillRadio(field, String(answer));
        case 'checkbox':
          return this.fillCheckbox(field, answer);
        case 'date':
          return this.fillDate(field.element, String(answer));
        case 'file':
          return false; // File upload needs special handling — skip for safety
        default:
          return this.fillText(field.element, String(answer));
      }
    } catch (err) {
      console.warn('[FieldFiller] Fill error:', err);
      return false;
    }
  }

  // ─── Text Input ────────────────────────────────────────────────────────────

  fillText(element, value) {
    this.setNativeValue(element, value);
    this.triggerEvents(element, ['input', 'change', 'blur']);
    return true;
  }

  fillTextarea(element, value) {
    if (element.getAttribute('contenteditable') === 'true') {
      element.innerText = value;
      this.triggerEvents(element, ['input', 'change', 'blur', 'keyup']);
    } else {
      this.setNativeValue(element, value);
      this.triggerEvents(element, ['input', 'change', 'blur']);
    }
    return true;
  }

  // ─── Select ────────────────────────────────────────────────────────────────

  fillSelect(element, answer, options = []) {
    const lowerAnswer = answer.toLowerCase();
    
    // Try to find best matching option
    const allOptions = options.length > 0 ? options : 
      Array.from(element.options || []).map(o => ({ value: o.value, text: o.text }));

    // Exact value match
    let match = allOptions.find(o => o.value.toLowerCase() === lowerAnswer);
    // Exact text match
    if (!match) match = allOptions.find(o => o.text.toLowerCase() === lowerAnswer);
    // Contains match
    if (!match) match = allOptions.find(o => 
      o.text.toLowerCase().includes(lowerAnswer) || 
      lowerAnswer.includes(o.text.toLowerCase())
    );
    // Partial match
    if (!match) {
      const words = lowerAnswer.split(' ');
      match = allOptions.find(o => words.some(w => o.text.toLowerCase().includes(w)));
    }

    if (match && element.tagName.toLowerCase() === 'select') {
      element.value = match.value;
      this.triggerEvents(element, ['change', 'input', 'blur']);
      return true;
    }

    // Handle custom dropdown (click + type)
    if (element.getAttribute('role') === 'combobox') {
      element.click();
      this.triggerEvents(element, ['focus']);
      this.setNativeValue(element, answer);
      this.triggerEvents(element, ['input', 'keydown', 'keyup']);
      return true;
    }

    return false;
  }

  // ─── Radio Buttons ────────────────────────────────────────────────────────

  fillRadio(field, answer) {
    const lowerAnswer = answer.toLowerCase();
    const options = field.options;
    if (!options?.length) return false;

    // Find best matching radio option
    let target = options.find(o => o.value.toLowerCase() === lowerAnswer || 
      (o.text && o.text.toLowerCase() === lowerAnswer));
    
    if (!target) {
      target = options.find(o => 
        o.value.toLowerCase().includes(lowerAnswer) || 
        (o.text && o.text.toLowerCase().includes(lowerAnswer))
      );
    }

    // Handle Yes/No
    if (!target && ['yes', 'true', '1'].includes(lowerAnswer)) {
      target = options.find(o => ['yes', 'true', '1'].includes(o.value.toLowerCase()));
    }
    if (!target && ['no', 'false', '0'].includes(lowerAnswer)) {
      target = options.find(o => ['no', 'false', '0'].includes(o.value.toLowerCase()));
    }

    if (target?.element) {
      target.element.checked = true;
      this.triggerEvents(target.element, ['click', 'change', 'input']);
      return true;
    }

    return false;
  }

  // ─── Checkboxes ───────────────────────────────────────────────────────────

  fillCheckbox(field, answer) {
    const element = field.element;
    const shouldCheck = this.parseBoolean(answer);
    
    if (element.checked !== shouldCheck) {
      element.checked = shouldCheck;
      this.triggerEvents(element, ['click', 'change', 'input']);
    }
    return true;
  }

  // ─── Date ────────────────────────────────────────────────────────────────

  fillDate(element, value) {
    // Try to normalize date to YYYY-MM-DD
    const normalized = this.normalizeDate(value);
    if (normalized) {
      this.setNativeValue(element, normalized);
      this.triggerEvents(element, ['input', 'change', 'blur']);
      return true;
    }
    return false;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Set native input value to trigger React/Vue/Angular change detection.
   */
  setNativeValue(element, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set;
    const nativeTextareaSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set;

    if (element.tagName === 'INPUT' && nativeInputValueSetter) {
      nativeInputValueSetter.call(element, value);
    } else if (element.tagName === 'TEXTAREA' && nativeTextareaSetter) {
      nativeTextareaSetter.call(element, value);
    } else {
      element.value = value;
    }
  }

  triggerEvents(element, eventNames) {
    for (const eventName of eventNames) {
      const event = new Event(eventName, { bubbles: true, cancelable: true });
      element.dispatchEvent(event);
    }
  }

  parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    const str = String(value).toLowerCase().trim();
    return ['yes', 'true', '1', 'on', 'checked'].includes(str);
  }

  normalizeDate(dateStr) {
    try {
      // Try parsing common formats
      const formats = [
        /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD (already normalized)
        /^(\d{2})\/(\d{2})\/(\d{4})$/, // MM/DD/YYYY
        /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
      ];
      
      // YYYY-MM-DD already good
      if (formats[0].test(dateStr)) return dateStr;
      
      const d = new Date(dateStr);
      if (!isNaN(d)) {
        return d.toISOString().split('T')[0];
      }
    } catch (_) {}
    return null;
  }
}
