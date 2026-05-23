// content/content.js — Injected into every page (bundled, no ES module imports)
// All modules are bundled into content.bundle.js by the build script

(function () {
  'use strict';

  // Guard: don't inject twice
  if (window.__AIFA_LOADED__) return;
  window.__AIFA_LOADED__ = true;

  // ─── MessageBus ──────────────────────────────────────────────────────────────

  class MessageBus {
    send(type, payload = {}) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type, payload }, (response) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          if (response?.error) return reject(new Error(response.error));
          resolve(response);
        });
      });
    }
    getProfile()      { return this.send('GET_PROFILE'); }
    getMemory()       { return this.send('GET_MEMORY'); }
    getAutofillState(){ return this.send('GET_AUTOFILL_STATE').then(r => r?.active ?? false); }
    semanticMatch(q)  { return this.send('SEMANTIC_MATCH', { question: q, threshold: 0.65 }); }
    logConfidence(d)  { return this.send('LOG_CONFIDENCE', d); }
    learnCorrection(question, answer, ctx) {
      return this.send('LEARN_CORRECTION', { question, answer, fieldContext: ctx });
    }
  }

  // ─── FormScanner ─────────────────────────────────────────────────────────────

  class FormScanner {
    scanPage() {
      const fields = [];
      const seen = new WeakSet();
      const selectors = [
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"])',
        'textarea',
        'select',
        '[role="textbox"]',
        '[role="combobox"]',
        '[contenteditable="true"]'
      ].join(', ');

      for (const el of document.querySelectorAll(selectors)) {
        if (seen.has(el) || this._isHidden(el)) continue;
        seen.add(el);
        const field = this._extractField(el);
        if (field) fields.push(field);
      }
      return fields;
    }

    _extractField(el) {
      const type = this._detectType(el);
      if (type === 'unknown') return null;
      const question = this._extractQuestion(el);
      if (!question || question.length < 2) return null;
      return {
        element: el,
        type,
        question,
        context: { id: el.id, name: el.name || '', placeholder: el.getAttribute('placeholder') || '' },
        options: this._extractOptions(el),
        required: el.required || el.getAttribute('aria-required') === 'true',
        platform: this._detectPlatform()
      };
    }

    _detectType(el) {
      const tag = el.tagName.toLowerCase();
      const type = (el.getAttribute('type') || '').toLowerCase();
      const role = (el.getAttribute('role') || '').toLowerCase();
      if (tag === 'textarea') return 'textarea';
      if (tag === 'select') return 'select';
      if (tag === 'input') {
        const map = { email:'email', tel:'phone', url:'url', number:'number', date:'date', file:'file', radio:'radio', checkbox:'checkbox' };
        return map[type] || (type === 'text' || type === '' ? 'text' : 'unknown');
      }
      if (role === 'textbox') return 'text';
      if (role === 'combobox') return 'select';
      if (el.getAttribute('contenteditable') === 'true') return 'richtext';
      return 'unknown';
    }

    _extractQuestion(el) {
      const strategies = [
        () => this._getLabelText(el),
        () => el.getAttribute('aria-label'),
        () => { const id = el.getAttribute('aria-labelledby'); return id ? document.getElementById(id)?.innerText?.trim() : null; },
        () => el.getAttribute('placeholder'),
        () => el.getAttribute('data-label'),
        () => el.getAttribute('data-automation-id')?.replace(/-/g, ' '),
        () => this._getNearbyText(el),
        () => el.getAttribute('name')?.replace(/[-_]/g, ' '),
        () => el.getAttribute('id')?.replace(/[-_]/g, ' ')
      ];
      for (const s of strategies) {
        try {
          const t = s()?.trim();
          if (t && t.length > 1 && t.length < 400) return t.replace(/\s+/g, ' ').replace(/[*：:]\s*$/, '').trim();
        } catch (_) {}
      }
      return null;
    }

    _getLabelText(el) {
      if (el.id) {
        const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lbl) return lbl.innerText || lbl.textContent;
      }
      const wrap = el.closest('label');
      if (wrap) { const c = wrap.cloneNode(true); c.querySelectorAll('input,textarea,select').forEach(e => e.remove()); return c.innerText || c.textContent; }
      if (el.labels?.length) return el.labels[0].innerText || el.labels[0].textContent;
      return null;
    }

    _getNearbyText(el) {
      let node = el.parentElement;
      for (let d = 0; d < 5 && node; d++, node = node.parentElement) {
        for (const sel of ['label', 'legend', '[class*="label"]', '[class*="question"]', 'p', 'span']) {
          const found = node.querySelector(sel);
          if (found && found !== el) {
            const t = found.innerText?.trim();
            if (t && t.length > 2 && t.length < 250) return t;
          }
        }
        let sib = el.previousElementSibling;
        for (let i = 0; sib && i < 3; i++, sib = sib.previousElementSibling) {
          const t = sib.innerText?.trim();
          if (t && t.length > 2 && t.length < 250) return t;
        }
      }
      return null;
    }

    _extractOptions(el) {
      const tag = el.tagName.toLowerCase();
      if (tag === 'select') return Array.from(el.options).map(o => ({ value: o.value, text: o.text.trim() }));
      if (el.type === 'radio' || el.type === 'checkbox') {
        const name = el.name;
        if (!name) return [];
        return Array.from(document.querySelectorAll(`input[name="${CSS.escape(name)}"]`)).map(r => ({
          value: r.value, text: this._getLabelText(r) || r.value, element: r
        }));
      }
      return [];
    }

    _isHidden(el) {
      if (el.type === 'hidden') return true;
      const s = window.getComputedStyle(el);
      return s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.01;
    }

    _detectPlatform() {
      const h = window.location.hostname;
      if (h.includes('docs.google.com')) return 'google_forms';
      if (h.includes('myworkday') || h.includes('workday.com')) return 'workday';
      if (h.includes('linkedin.com')) return 'linkedin';
      if (h.includes('unstop.com') || h.includes('dare2compete')) return 'unstop';
      if (h.includes('greenhouse.io')) return 'greenhouse';
      if (h.includes('lever.co')) return 'lever';
      return 'custom';
    }
  }

  // ─── FieldFiller ─────────────────────────────────────────────────────────────

  class FieldFiller {
    async fill(field, answer) {
      if (answer === null || answer === undefined || answer === '') return false;
      const val = String(answer);
      try {
        switch (field.type) {
          case 'text': case 'email': case 'phone': case 'url': case 'number': return this._fillText(field.element, val);
          case 'textarea': case 'richtext': return this._fillTextarea(field.element, val);
          case 'select': return this._fillSelect(field.element, val, field.options);
          case 'radio': return this._fillRadio(field, val);
          case 'checkbox': return this._fillCheckbox(field.element, val);
          case 'date': return this._fillDate(field.element, val);
          default: return this._fillText(field.element, val);
        }
      } catch (e) { console.warn('[AIFA Filler]', e); return false; }
    }

    _setNative(el, value) {
      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(el, value);
      else el.value = value;
    }

    _fire(el, events) {
      for (const name of events) el.dispatchEvent(new Event(name, { bubbles: true, cancelable: true }));
    }

    _fillText(el, v) { this._setNative(el, v); this._fire(el, ['input','change','blur']); return true; }

    _fillTextarea(el, v) {
      if (el.getAttribute('contenteditable') === 'true') {
        el.innerText = v; this._fire(el, ['input','change','blur','keyup']);
      } else { this._setNative(el, v); this._fire(el, ['input','change','blur']); }
      return true;
    }

    _fillSelect(el, answer, options = []) {
      const lo = answer.toLowerCase();
      const opts = options.length ? options : Array.from(el.options || []).map(o => ({ value: o.value, text: o.text }));
      const match = opts.find(o => o.value?.toLowerCase() === lo)
        || opts.find(o => o.text?.toLowerCase() === lo)
        || opts.find(o => o.text?.toLowerCase().includes(lo) || lo.includes(o.text?.toLowerCase()));
      if (match && el.tagName === 'SELECT') { el.value = match.value; this._fire(el, ['change','input','blur']); return true; }
      if (el.getAttribute('role') === 'combobox') {
        el.click(); this._fire(el, ['focus']); this._setNative(el, answer); this._fire(el, ['input','keydown','keyup']); return true;
      }
      return false;
    }

    _fillRadio(field, answer) {
      const lo = answer.toLowerCase();
      const opts = field.options || [];
      let target = opts.find(o => o.value?.toLowerCase() === lo || o.text?.toLowerCase() === lo)
        || opts.find(o => o.value?.toLowerCase().includes(lo) || o.text?.toLowerCase().includes(lo));
      if (!target && ['yes','true','1'].includes(lo)) target = opts.find(o => ['yes','true','1'].includes(o.value?.toLowerCase()));
      if (!target && ['no','false','0'].includes(lo)) target = opts.find(o => ['no','false','0'].includes(o.value?.toLowerCase()));
      if (target?.element) { target.element.checked = true; this._fire(target.element, ['click','change','input']); return true; }
      return false;
    }

    _fillCheckbox(el, answer) {
      const check = ['yes','true','1','on','checked'].includes(String(answer).toLowerCase().trim());
      if (el.checked !== check) { el.checked = check; this._fire(el, ['click','change','input']); }
      return true;
    }

    _fillDate(el, val) {
      try { const d = new Date(val); if (!isNaN(d)) { this._setNative(el, d.toISOString().split('T')[0]); this._fire(el, ['input','change']); return true; } } catch (_) {}
      return false;
    }
  }

  // ─── DOMObserver ─────────────────────────────────────────────────────────────

  class DOMObserver {
    constructor(cb) { this.cb = cb; this.obs = null; this.timer = null; }
    start() {
      if (this.obs) return;
      this.obs = new MutationObserver(muts => {
        const relevant = muts.some(m => {
          if (m.addedNodes.length) for (const n of m.addedNodes) {
            if (n.nodeType === 1 && (n.matches?.('input,textarea,select,[role="textbox"]') || n.querySelector?.('input,textarea,select,[role="textbox"]'))) return true;
          }
          return false;
        });
        if (relevant) { clearTimeout(this.timer); this.timer = setTimeout(this.cb, 700); }
      });
      this.obs.observe(document.body, { childList: true, subtree: true });
    }
    stop() { this.obs?.disconnect(); this.obs = null; clearTimeout(this.timer); }
  }

  // ─── ConfidenceUI ────────────────────────────────────────────────────────────

  class ConfidenceUI {
    constructor() {
      this.tooltips = new Map();
      this._injectStyles();
    }

    _injectStyles() {
      if (document.getElementById('__aifa_styles__')) return;
      const s = document.createElement('style');
      s.id = '__aifa_styles__';
      s.textContent = `
        .__aifa_tip {
          position: fixed; z-index: 2147483647;
          background: #0f172a; color: #f1f5f9;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px; padding: 10px 14px;
          font: 600 12px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          min-width: 200px; max-width: 360px;
          animation: __aifa_in .15s ease-out;
          pointer-events: auto;
        }
        @keyframes __aifa_in { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:none} }
        .__aifa_tip .hdr { font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:rgba(241,245,249,.45);margin-bottom:6px; }
        .__aifa_tip .ans { font-size:13px;border-left:2px solid #f59e0b;padding-left:8px;margin-bottom:8px;word-break:break-word; }
        .__aifa_tip .bar { height:3px;background:rgba(255,255,255,.1);border-radius:2px;margin-bottom:8px;overflow:hidden; }
        .__aifa_tip .bar-fill { height:100%;border-radius:2px;transition:width .3s; }
        .__aifa_tip input.__aifa_edit { display:none;width:100%;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:4px;color:#f1f5f9;padding:5px 8px;font-size:12px;margin-bottom:8px;box-sizing:border-box;outline:none; }
        .__aifa_tip .btns { display:flex;gap:5px;flex-wrap:wrap; }
        .__aifa_tip button { padding:5px 10px;border-radius:5px;border:none;cursor:pointer;font:600 11px -apple-system,sans-serif;transition:opacity .15s; }
        .__aifa_tip .ok  { background:#22c55e;color:#fff; }
        .__aifa_tip .ed  { background:rgba(255,255,255,.12);color:#f1f5f9; }
        .__aifa_tip .sk  { background:none;color:rgba(241,245,249,.4);font-weight:400; }
        .__aifa_dot {
          position:absolute; width:8px;height:8px;border-radius:50%;
          pointer-events:none; z-index:2147483646;
          animation:__aifa_pulse 2s infinite;
        }
        @keyframes __aifa_pulse { 0%,100%{opacity:1}50%{opacity:.3} }
      `;
      document.head.appendChild(s);
    }

    showFillIndicator(el, conf) {
      const wrap = el.parentElement;
      if (!wrap) return;
      const old = wrap.querySelector('.__aifa_dot');
      if (old) old.remove();
      if (window.getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
      const dot = document.createElement('div');
      dot.className = '__aifa_dot';
      dot.style.cssText = `top:50%;right:6px;transform:translateY(-50%);background:#22c55e;box-shadow:0 0 6px #22c55e;`;
      dot.title = `AI filled (${Math.round(conf*100)}%)`;
      wrap.appendChild(dot);
      setTimeout(() => dot.remove(), 3500);
    }

    showSuggestion(el, answer, conf, onDecision) {
      this._removeTooltip(el);
      const tip = document.createElement('div');
      tip.className = '__aifa_tip';
      const pct = Math.round(conf * 100);
      const col = conf >= 0.75 ? '#22c55e' : '#f59e0b';
      const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      tip.innerHTML = `
        <div class="hdr">🤖 AI Suggestion — ${pct}% confidence</div>
        <div class="bar"><div class="bar-fill" style="width:${pct}%;background:${col}"></div></div>
        <div class="ans">${esc(String(answer).slice(0,200))}</div>
        <input class="__aifa_edit" type="text" value="${esc(String(answer))}"/>
        <div class="btns">
          <button class="ok">✓ Use</button>
          <button class="ed">✏ Edit</button>
          <button class="sk">✕ Skip</button>
        </div>`;

      // Position relative to element
      const rect = el.getBoundingClientRect();
      // Fixed positioning uses viewport coords (no scroll offset needed)
      const vw = window.innerWidth;
      let tipLeft = rect.left;
      // Keep tooltip within viewport
      if (tipLeft + 360 > vw) tipLeft = Math.max(4, vw - 364);
      tip.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - 160)}px`;
      tip.style.left = `${Math.max(4, tipLeft)}px`;
      document.body.appendChild(tip);
      this.tooltips.set(el, tip);

      const editEl = tip.querySelector('.__aifa_edit');
      const ansDiv = tip.querySelector('.ans');

      tip.querySelector('.ok').onclick = () => { onDecision(true, null); this._removeTooltip(el); this.showFillIndicator(el, conf); };
      tip.querySelector('.ed').onclick = () => {
        ansDiv.style.display = 'none'; editEl.style.display = 'block'; editEl.focus(); editEl.select();
        editEl.onkeydown = e => {
          if (e.key === 'Enter') { onDecision(true, editEl.value); this._removeTooltip(el); }
          if (e.key === 'Escape') this._removeTooltip(el);
        };
      };
      tip.querySelector('.sk').onclick = () => this._removeTooltip(el);
      setTimeout(() => this._removeTooltip(el), 30000);
    }

    _removeTooltip(el) { const t = this.tooltips.get(el); if (t) { t.remove(); this.tooltips.delete(el); } }
    hideAll() { for (const t of this.tooltips.values()) t.remove(); this.tooltips.clear(); }
  }

  // ─── Platform detector ────────────────────────────────────────────────────────

  function getPlatformFields() {
    const host = window.location.hostname;

    if (host.includes('docs.google.com') && window.location.pathname.includes('/forms/')) {
      // Google Forms: question title is in .freebirdFormviewerComponentsQuestionBaseTitle
      return null; // Use standard scanner, it handles Google Forms well
    }

    if (host.includes('linkedin.com')) {
      // Only scan the Easy Apply modal
      const modal = document.querySelector('.jobs-easy-apply-modal, .jobs-easy-apply-content');
      if (!modal) return []; // No modal open, skip
      return null; // Let standard scanner run within modal scope
    }

    return null; // Use standard scanner for all others
  }

  // ─── AIFormAssistant ─────────────────────────────────────────────────────────

  class AIFormAssistant {
    constructor() {
      this.bus = new MessageBus();
      this.scanner = new FormScanner();
      this.filler = new FieldFiller();
      this.observer = new DOMObserver(() => this._onDOMChange());
      this.ui = new ConfidenceUI();
      this.active = false;
      this.filledFields = new WeakSet();
      this.processing = false;
      this.processingQueue = Promise.resolve();
    }

    async init() {
      try {
        this.active = await this.bus.getAutofillState();
      } catch (_) { this.active = false; }

      this._setupListeners();
      this.observer.start();

      if (this.active) {
        setTimeout(() => this._scanAndFill(), 500);
      }
    }

    _setupListeners() {
      chrome.runtime.onMessage.addListener((msg, _s, respond) => {
        this._handleMsg(msg).then(respond).catch(e => respond({ error: e.message }));
        return true;
      });
    }

    async _handleMsg(msg) {
      switch (msg.type) {
        case 'TRIGGER_AUTOFILL':       await this._scanAndFill(); return { ok: true };
        case 'FILL_FOCUSED_FIELD':     await this._fillFocusedField(); return { ok: true };
        case 'AUTOFILL_STATE_CHANGED': this.active = msg.payload.active; if (this.active) await this._scanAndFill(); else this.ui.hideAll(); return { ok: true };
        case 'PAGE_LOADED':            if (this.active) setTimeout(() => this._scanAndFill(), 600); return { ok: true };
        case 'STOP_AUTOFILL':          this.active = false; this.ui.hideAll(); return { ok: true };
        case 'LEARN_SELECTION':        await this._handleLearnSelection(msg.payload.text); return { ok: true };
        default: return { ok: true };
      }
    }

    async _onDOMChange() {
      if (!this.active) return;
      this.processingQueue = this.processingQueue.then(() => this._scanAndFill());
    }

    async _scanAndFill() {
      if (this.processing) return;
      this.processing = true;
      try {
        const platformResult = getPlatformFields();
        if (platformResult !== null && platformResult.length === 0) return; // Platform says no fields

        const fields = this.scanner.scanPage();
        const unfilled = fields.filter(f => !this.filledFields.has(f.element));
        if (unfilled.length === 0) return;

        for (const field of unfilled) {
          await this._processField(field);
          await _sleep(60);
        }
      } finally {
        this.processing = false;
      }
    }

    async _processField(field) {
      try {
        const match = await this.bus.semanticMatch(field.question);
        if (!match || !match.answer) return;

        const { answer, confidence, source } = match;

        this.bus.logConfidence({ question: field.question, answer, confidence, source, url: window.location.href, fieldType: field.type }).catch(() => {});

        if (confidence >= 0.85) {
          const filled = await this.filler.fill(field, answer);
          if (filled) {
            this.filledFields.add(field.element);
            this.ui.showFillIndicator(field.element, confidence);
          }
        } else if (confidence >= 0.55) {
          this.ui.showSuggestion(field.element, answer, confidence, async (accepted, edited) => {
            const final = edited ?? answer;
            await this.filler.fill(field, final);
            this.filledFields.add(field.element);
            if (edited && edited !== answer) {
              await this.bus.learnCorrection(field.question, edited, field.context);
            }
          });
        }
      } catch (err) {
        console.warn('[AIFA]', field.question, err.message);
      }
    }

    async _fillFocusedField() {
      const el = document.activeElement;
      if (!el || !['INPUT','TEXTAREA'].includes(el.tagName)) return;
      const scanner = new FormScanner();
      const field = scanner._extractField(el);
      if (field) await this._processField(field);
    }

    async _handleLearnSelection(text) {
      const el = document.activeElement;
      if (el) {
        const scanner = new FormScanner();
        const field = scanner._extractField(el);
        if (field) await this.bus.learnCorrection(field.question, text, field.context);
      }
    }
  }

  function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ─── Boot ─────────────────────────────────────────────────────────────────────
  const assistant = new AIFormAssistant();
  assistant.init().catch(console.error);

})();
