// content/services/BackendSyncService.js
// Optional cloud sync — sends local data to backend when configured

const BACKEND_URL = 'http://localhost:3001';

export class BackendSyncService {
  static async getExtensionId() {
    return chrome.runtime.id;
  }

  static async isBackendAvailable() {
    try {
      const res = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Push local profile + memory to backend.
   */
  static async push() {
    const available = await this.isBackendAvailable();
    if (!available) return { ok: false, reason: 'backend_unavailable' };

    const extensionId = await this.getExtensionId();
    const result = await chrome.storage.local.get(['userProfile', 'memoryEntries']);

    const response = await fetch(`${BACKEND_URL}/api/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extensionId,
        profile: result.userProfile,
        memoryEntries: result.memoryEntries || []
      })
    });

    if (!response.ok) throw new Error(`Sync push failed: ${response.status}`);
    return response.json();
  }

  /**
   * Pull data from backend and merge into local storage.
   */
  static async pull() {
    const available = await this.isBackendAvailable();
    if (!available) return { ok: false, reason: 'backend_unavailable' };

    const extensionId = await this.getExtensionId();
    const response = await fetch(`${BACKEND_URL}/api/sync/pull/${extensionId}`);
    if (!response.ok) throw new Error(`Sync pull failed: ${response.status}`);

    const { profile, memoryEntries } = await response.json();

    if (profile) await chrome.storage.local.set({ userProfile: profile });
    if (memoryEntries?.length) await chrome.storage.local.set({ memoryEntries });

    return { ok: true, profileSynced: !!profile, memorySynced: memoryEntries?.length || 0 };
  }

  /**
   * Remote semantic match — delegates to the more powerful backend Claude service.
   */
  static async remoteMatch(question, threshold = 0.7) {
    const available = await this.isBackendAvailable();
    if (!available) return null;

    const extensionId = await this.getExtensionId();

    const response = await fetch(`${BACKEND_URL}/api/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extensionId, question, threshold })
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.answer ? data : null;
  }
}
