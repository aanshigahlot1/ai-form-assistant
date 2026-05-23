// content/stores/MemoryStore.js

export class MemoryStore {
  static async getAll() {
    const result = await chrome.storage.local.get('memoryEntries');
    return result.memoryEntries || [];
  }

  static async saveEntry(entry) {
    const entries = await this.getAll();
    const existingIdx = entries.findIndex(e => 
      e.id === entry.id || 
      this.questionSimilarity(e.question, entry.question) > 0.9
    );

    if (existingIdx >= 0) {
      // Update existing entry
      entries[existingIdx] = {
        ...entries[existingIdx],
        ...entry,
        usageCount: (entries[existingIdx].usageCount || 0) + 1,
        updatedAt: new Date().toISOString()
      };
    } else {
      entries.unshift({
        ...entry,
        usageCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // Keep max 500 entries, sorted by usage
    const sorted = entries
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, 500);

    await chrome.storage.local.set({ memoryEntries: sorted });
    return entry;
  }

  static async deleteEntry(id) {
    const entries = await this.getAll();
    const filtered = entries.filter(e => e.id !== id);
    await chrome.storage.local.set({ memoryEntries: filtered });
    return { ok: true };
  }

  static async clearAll() {
    await chrome.storage.local.set({ memoryEntries: [] });
    return { ok: true };
  }

  static async incrementUsage(id) {
    const entries = await this.getAll();
    const entry = entries.find(e => e.id === id);
    if (entry) {
      entry.usageCount = (entry.usageCount || 0) + 1;
      entry.lastUsed = new Date().toISOString();
      await chrome.storage.local.set({ memoryEntries: entries });
    }
  }

  // Simple similarity for deduplication
  static questionSimilarity(a, b) {
    if (!a || !b) return 0;
    const normalize = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const na = normalize(a);
    const nb = normalize(b);
    if (na === nb) return 1;

    const wordsA = new Set(na.split(/\s+/));
    const wordsB = new Set(nb.split(/\s+/));
    const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;
    return union === 0 ? 0 : intersection / union;
  }
}
