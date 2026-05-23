// popup/src/components/Settings.jsx
import { useState, useEffect } from 'react';

export default function Settings({ onNotify }) {
  const [apiKey, setApiKey] = useState('');
  const [backendUrl, setBackendUrl] = useState('http://localhost:3001');
  const [visionEnabled, setVisionEnabled] = useState(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState(85);
  const [suggestThreshold, setSuggestThreshold] = useState(55);
  const [autoLearn, setAutoLearn] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(['settings'], (res) => {
      const s = res.settings || {};
      setApiKey(s.apiKey || '');
      setBackendUrl(s.backendUrl || 'http://localhost:3001');
      setVisionEnabled(s.visionEnabled || false);
      setConfidenceThreshold(s.confidenceThreshold ?? 85);
      setSuggestThreshold(s.suggestThreshold ?? 55);
      setAutoLearn(s.autoLearn ?? true);
    });
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    const settings = { apiKey, backendUrl, visionEnabled, confidenceThreshold, suggestThreshold, autoLearn };
    await chrome.storage.local.set({ settings });
    setSaving(false);
    onNotify('✅ Settings saved');
  };

  const exportData = async () => {
    const result = await new Promise(resolve =>
      chrome.runtime.sendMessage({ type: 'EXPORT_DATA' }, resolve)
    );
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aifa-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('📦 Data exported!');
  };

  const importData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        await new Promise(resolve =>
          chrome.runtime.sendMessage({ type: 'IMPORT_DATA', payload: data }, resolve)
        );
        onNotify('✅ Data imported successfully!');
      } catch (err) {
        onNotify('❌ Import failed: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  };

  const syncToCloud = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${backendUrl}/health`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error('Backend not reachable');

      const [profileData, memData] = await Promise.all([
        new Promise(r => chrome.storage.local.get('userProfile', d => r(d.userProfile))),
        new Promise(r => chrome.storage.local.get('memoryEntries', d => r(d.memoryEntries || [])))
      ]);

      const extId = chrome.runtime.id;
      const syncRes = await fetch(`${backendUrl}/api/sync/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extensionId: extId, profile: profileData, memoryEntries: memData })
      });
      if (!syncRes.ok) throw new Error(`Sync failed: ${syncRes.status}`);
      onNotify('☁️ Synced to cloud!');
    } catch (err) {
      onNotify('❌ ' + err.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const clearAllData = async () => {
    if (!confirm('⚠️ This will delete your profile, memory, and all logs. Are you sure?')) return;
    await chrome.storage.local.clear();
    onNotify('🗑️ All data cleared');
  };

  return (
    <div className="settings">

      {/* AI Configuration */}
      <div className="settings-section">
        <h3 className="settings-title">🤖 AI Configuration</h3>
        <div className="field-row">
          <label className="field-label">Anthropic API Key</label>
          <input className="field-input" type="password" value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="sk-ant-..." />
          <p className="hint-text">Used for semantic matching. Leave blank to use built-in matching.</p>
        </div>
        <div className="field-row">
          <label className="field-label">Backend URL (optional)</label>
          <input className="field-input" type="url" value={backendUrl}
            onChange={e => setBackendUrl(e.target.value)}
            placeholder="http://localhost:3001" />
        </div>
      </div>

      {/* Confidence Thresholds */}
      <div className="settings-section">
        <h3 className="settings-title">🎯 Confidence Thresholds</h3>
        <div className="field-row">
          <label className="field-label">Auto-fill threshold: {confidenceThreshold}%</label>
          <input type="range" min="60" max="99" value={confidenceThreshold}
            onChange={e => setConfidenceThreshold(+e.target.value)}
            className="slider" />
          <p className="hint-text">Fields above this confidence are filled automatically</p>
        </div>
        <div className="field-row">
          <label className="field-label">Suggestion threshold: {suggestThreshold}%</label>
          <input type="range" min="30" max="84" value={suggestThreshold}
            onChange={e => setSuggestThreshold(+e.target.value)}
            className="slider" />
          <p className="hint-text">Fields above this confidence show a suggestion tooltip</p>
        </div>
      </div>

      {/* Behaviour */}
      <div className="settings-section">
        <h3 className="settings-title">⚙️ Behaviour</h3>
        <div className="toggle-row">
          <div>
            <span className="toggle-label">Auto-learn from corrections</span>
            <p className="hint-text">Save your edits to memory for future forms</p>
          </div>
          <button className={`toggle-btn ${autoLearn ? 'on' : ''}`} onClick={() => setAutoLearn(!autoLearn)}>
            {autoLearn ? 'ON' : 'OFF'}
          </button>
        </div>
        <div className="toggle-row">
          <div>
            <span className="toggle-label">Vision Mode (Phase 4)</span>
            <p className="hint-text">Use AI screenshot analysis for hidden labels</p>
          </div>
          <button className={`toggle-btn ${visionEnabled ? 'on' : ''}`} onClick={() => setVisionEnabled(!visionEnabled)}>
            {visionEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Data Management */}
      <div className="settings-section">
        <h3 className="settings-title">💾 Data Management</h3>
        <div className="data-actions">
          <button className="data-btn" onClick={exportData}>📦 Export Backup</button>
          <label className="data-btn" style={{ cursor: 'pointer' }}>
            📥 Import Backup
            <input type="file" accept=".json" onChange={importData} style={{ display: 'none' }} />
          </label>
          <button className="data-btn sync" onClick={syncToCloud} disabled={syncing}>
            {syncing ? '⏳ Syncing...' : '☁️ Sync to Cloud'}
          </button>
          <button className="data-btn danger" onClick={clearAllData}>🗑️ Clear All Data</button>
        </div>
      </div>

      <button className="save-btn" onClick={saveSettings} disabled={saving}>
        {saving ? '⏳ Saving...' : '💾 Save Settings'}
      </button>
    </div>
  );
}
