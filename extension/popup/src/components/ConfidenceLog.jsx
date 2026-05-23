// popup/src/components/ConfidenceLog.jsx

import { useState, useEffect } from 'react';

export default function ConfidenceLog() {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    chrome.storage.local.get('confidenceLog', (res) => {
      setLog(res.confidenceLog || []);
      setLoading(false);
    });
  }, []);

  const getConfidenceColor = (conf) => {
    if (conf >= 0.85) return '#22c55e';
    if (conf >= 0.65) return '#f59e0b';
    return '#ef4444';
  };

  const getConfidenceLabel = (conf) => {
    if (conf >= 0.85) return 'AUTO';
    if (conf >= 0.65) return 'ASK';
    return 'SKIP';
  };

  const filtered = filter === 'all' ? log :
    filter === 'auto' ? log.filter(l => l.confidence >= 0.85) :
    filter === 'ask' ? log.filter(l => l.confidence >= 0.65 && l.confidence < 0.85) :
    log.filter(l => l.confidence < 0.65);

  const avgConfidence = log.length > 0 
    ? (log.reduce((s, l) => s + (l.confidence || 0), 0) / log.length * 100).toFixed(0)
    : 0;

  if (loading) return <div className="loading-state">Loading log...</div>;

  return (
    <div className="confidence-log">
      <div className="log-summary">
        <div className="summary-stat">
          <span className="sum-val">{log.length}</span>
          <span className="sum-lab">Total</span>
        </div>
        <div className="summary-stat green">
          <span className="sum-val">{log.filter(l => l.confidence >= 0.85).length}</span>
          <span className="sum-lab">Auto-filled</span>
        </div>
        <div className="summary-stat amber">
          <span className="sum-val">{log.filter(l => l.confidence >= 0.65 && l.confidence < 0.85).length}</span>
          <span className="sum-lab">Suggested</span>
        </div>
        <div className="summary-stat">
          <span className="sum-val">{avgConfidence}%</span>
          <span className="sum-lab">Avg Conf.</span>
        </div>
      </div>

      <div className="filter-tabs">
        {['all', 'auto', 'ask', 'skip'].map(f => (
          <button
            key={f}
            className={`filter-tab ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>📊 No entries yet</p>
          <p className="empty-sub">Use autofill on a form to see confidence scores</p>
        </div>
      ) : (
        <div className="log-list">
          {filtered.map((entry, i) => (
            <div key={i} className="log-entry">
              <div className="log-entry-header">
                <span 
                  className="conf-badge"
                  style={{ background: getConfidenceColor(entry.confidence) }}
                >
                  {getConfidenceLabel(entry.confidence)} {Math.round((entry.confidence || 0) * 100)}%
                </span>
                <span className="log-source">{entry.source}</span>
              </div>
              <div className="log-question">{entry.question?.slice(0, 80)}</div>
              <div className="log-answer">{String(entry.answer || '').slice(0, 60)}</div>
              <div className="log-meta">
                <span>{entry.url ? new URL(entry.url).hostname : '—'}</span>
                <span>{entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '—'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
