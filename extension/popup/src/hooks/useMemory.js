// popup/src/hooks/useMemory.js
import { useState, useEffect, useCallback } from 'react';

export function useMemory() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    chrome.storage.local.get('memoryEntries', (res) => {
      setEntries(res.memoryEntries || []);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteEntry = useCallback(async (id) => {
    await new Promise(resolve =>
      chrome.runtime.sendMessage({ type: 'DELETE_MEMORY_ENTRY', payload: { id } }, resolve)
    );
    setEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  const clearAll = useCallback(async () => {
    await new Promise(resolve =>
      chrome.runtime.sendMessage({ type: 'CLEAR_MEMORY' }, resolve)
    );
    setEntries([]);
  }, []);

  const addEntry = useCallback(async (entry) => {
    await new Promise(resolve =>
      chrome.runtime.sendMessage({ type: 'SAVE_MEMORY_ENTRY', payload: { ...entry, id: Date.now().toString() } }, resolve)
    );
    load();
  }, [load]);

  const stats = {
    total: entries.length,
    bySource: entries.reduce((acc, e) => { acc[e.source] = (acc[e.source] || 0) + 1; return acc; }, {}),
    mostUsed: [...entries].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)).slice(0, 3)
  };

  return { entries, loading, deleteEntry, clearAll, addEntry, reload: load, stats };
}
