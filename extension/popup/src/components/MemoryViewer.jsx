// popup/src/components/MemoryViewer.jsx

import { useState, useEffect } from 'react';

export default function MemoryViewer({ onNotify }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState('usageCount');

  useEffect(() => { loadEntries(); }, []);

  const loadEntries = async () => {
    chrome.storage.local.get('memoryEntries', (res) => {
      setEntries(res.memoryEntries || []);
      setLoading(false);
    });
  };

  const deleteEntry = async (id) => {
    const updated = entries.filter(e => e.id !== id);
    setEntries(updated);
    await chrome.storage.local.set({ memoryEntries: updated });
    onNotify('Memory entry removed');
  };

  const clearAll = async () => {
    if (!confirm('Clear all memory entries?')) return;
    setEntries([]);
    await chrome.storage.local.set({ memoryEntries: [] });
    onNotify('Memory cleared');
  };

  const filtered = entries
    .filter(e => 
      !filter || 
      e.question?.toLowerCase().includes(filter.toLowerCase()) ||
      e.answer?.toLowerCase().includes(filter.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'usageCount') return (b.usageCount || 0) - (a.usageCount || 0);
      if (sortBy === 'recent') return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      return 0;
    });

  const sourceColors = {
    user_correction: '#22c55e',
    claude_semantic: '#8b5cf6',
    pattern: '#3b82f6',
    memory: '#f59e0b'
  };

  if (loading) return <div className="loading-state">Loading memory...</div>;

  return (
    <div className="memory-viewer">
      <div className="memory-header">
        <div className="memory-stats">
          <span className="memory-count">{entries.length}</span>
          <span className="memory-count-label">entries</span>
        </div>
        <div className="memory-controls">
          <select 
            className="mini-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="usageCount">Most Used</option>
            <option value="recent">Most Recent</option>
          </select>
          <button className="danger-btn-sm" onClick={clearAll}>Clear All</button>
        </div>
      </div>

      <input
        className="search-input"
        type="text"
        placeholder="🔍 Search memory..."
        value={filter}
        onChange={e => setFilter(e.target.value)}
      />

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>🧠 No memory yet</p>
          <p className="empty-sub">Start filling forms and the AI will learn your answers</p>
        </div>
      ) : (
        <div className="memory-list">
          {filtered.map(entry => (
            <div key={entry.id} className="memory-card">
              <div className="memory-card-header">
                <span 
                  className="source-badge"
                  style={{ background: sourceColors[entry.source] || '#6b7280' }}
                >
                  {entry.source?.replace('_', ' ')}
                </span>
                <span className="usage-count">× {entry.usageCount || 1}</span>
              </div>
              <div className="memory-q">{entry.question}</div>
              <div className="memory-a">{String(entry.answer).slice(0, 120)}{entry.answer?.length > 120 ? '...' : ''}</div>
              <div className="memory-footer">
                <span className="memory-date">
                  {entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString() : '—'}
                </span>
                <button className="delete-btn" onClick={() => deleteEntry(entry.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
