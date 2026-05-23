// content/modules/MessageBus.js
// Typed wrapper around chrome.runtime.sendMessage

export class MessageBus {
  async send(type, payload = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type, payload }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  getProfile() { return this.send('GET_PROFILE'); }
  getMemory() { return this.send('GET_MEMORY'); }
  getAutofillState() {
    return this.send('GET_AUTOFILL_STATE').then(r => r?.active ?? false);
  }
  semanticMatch(question, threshold = 0.75) {
    return this.send('SEMANTIC_MATCH', { question, threshold });
  }
  logConfidence(data) { return this.send('LOG_CONFIDENCE', data); }
  learnCorrection(question, answer, fieldContext) {
    return this.send('LEARN_CORRECTION', { question, answer, fieldContext });
  }
}
