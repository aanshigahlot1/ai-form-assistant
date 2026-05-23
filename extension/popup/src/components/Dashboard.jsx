// popup/src/components/Dashboard.jsx

import { useState, useEffect } from 'react';

export default function Dashboard({ autofillActive, onToggle, onNotify }) {
  const [stats, setStats] = useState({ filled: 0, suggested: 0, skipped: 0, learned: 0 });
  const [currentUrl, setCurrentUrl] = useState('');
  const [profileComplete, setProfileComplete] = useState(0);

  useEffect(() => {
    loadStats();
    loadCurrentTab();
    checkProfileCompletion();
  }, []);

  const loadStats = async () => {
    const result = await chrome.storage.local.get(['fillStats', 'confidenceLog']);
    const log = result.confidenceLog || [];
    const stats = result.fillStats || { filled: 0, suggested: 0, skipped: 0, learned: 0 };
    setStats({
      ...stats,
      total: log.length
    });
  };

  const loadCurrentTab = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      try {
        const url = new URL(tab.url);
        setCurrentUrl(url.hostname);
      } catch (_) {
        setCurrentUrl(tab.url.slice(0, 40));
      }
    }
  };

  const checkProfileCompletion = async () => {
    const result = await chrome.storage.local.get('userProfile');
    const profile = result.userProfile;
    if (!profile) { setProfileComplete(0); return; }

    const fields = [
      profile.personalInfo?.fullName,
      profile.personalInfo?.email,
      profile.personalInfo?.phone,
      profile.education?.college,
      profile.education?.cgpa,
      profile.professional?.skills?.length > 0,
      profile.personalInfo?.linkedIn,
    ];
    const filled = fields.filter(Boolean).length;
    setProfileComplete(Math.round((filled / fields.length) * 100));
  };

  const triggerAutofillNow = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_AUTOFILL' });
      onNotify('🤖 Scanning page for form fields...');
    }
  };

  const clearStats = async () => {
    await chrome.storage.local.set({ confidenceLog: [], fillStats: {} });
    setStats({ filled: 0, suggested: 0, skipped: 0, learned: 0 });
    onNotify('Stats cleared');
  };

  return (
    <div className="dashboard">
      {/* Current Site */}
      <div className="site-card">
        <div className="site-icon">🌐</div>
        <div className="site-info">
          <span className="site-label">Active on</span>
          <span className="site-url">{currentUrl || 'No tab detected'}</span>
        </div>
        <div className={`site-status ${autofillActive ? 'ready' : 'paused'}`}>
          {autofillActive ? 'READY' : 'PAUSED'}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button className="action-btn primary" onClick={triggerAutofillNow}>
          <span>⚡</span>
          <span>Fill This Page</span>
        </button>
        <button className="action-btn secondary" onClick={onToggle}>
          <span>{autofillActive ? '⏸' : '▶'}</span>
          <span>{autofillActive ? 'Pause' : 'Activate'}</span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="stats-section">
        <h3 className="section-title">Session Stats</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-value">{stats.total || 0}</span>
            <span className="stat-label">Fields Scanned</span>
          </div>
          <div className="stat-card green">
            <span className="stat-value">{stats.filled || 0}</span>
            <span className="stat-label">Auto-Filled</span>
          </div>
          <div className="stat-card amber">
            <span className="stat-value">{stats.suggested || 0}</span>
            <span className="stat-label">Suggested</span>
          </div>
          <div className="stat-card blue">
            <span className="stat-value">{stats.learned || 0}</span>
            <span className="stat-label">Learned</span>
          </div>
        </div>
      </div>

      {/* Profile Completeness */}
      <div className="profile-health">
        <div className="health-header">
          <span>Profile Completeness</span>
          <span className="health-pct">{profileComplete}%</span>
        </div>
        <div className="health-bar">
          <div 
            className="health-fill" 
            style={{ width: `${profileComplete}%` }}
          />
        </div>
        {profileComplete < 70 && (
          <p className="health-tip">
            💡 Add more profile info for better autofill accuracy
          </p>
        )}
      </div>

      {/* Supported Sites */}
      <div className="supported-sites">
        <h3 className="section-title">Supported Platforms</h3>
        <div className="platform-list">
          {['Google Forms', 'LinkedIn', 'Workday', 'Unstop', 'Greenhouse', 'Lever', 'Any Custom Form'].map(p => (
            <span key={p} className="platform-tag">{p}</span>
          ))}
        </div>
      </div>

      <button className="clear-btn" onClick={clearStats}>Clear Stats</button>
    </div>
  );
}
