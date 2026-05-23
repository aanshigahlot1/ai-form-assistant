// popup/src/App.jsx
import { useState, useEffect, useCallback } from 'react';
import ProfileEditor from './components/ProfileEditor';
import MemoryViewer from './components/MemoryViewer';
import ConfidenceLog from './components/ConfidenceLog';
import Dashboard from './components/Dashboard';
import ResumeUploader from './components/ResumeUploader';
import Settings from './components/Settings';
import './styles/app.css';

const TABS = [
  { id: 'dashboard', label: 'Home',     icon: '⚡' },
  { id: 'profile',   label: 'Profile',  icon: '👤' },
  { id: 'resume',    label: 'Resume',   icon: '📄' },
  { id: 'memory',    label: 'Memory',   icon: '🧠' },
  { id: 'log',       label: 'Log',      icon: '📊' },
  { id: 'settings',  label: 'Settings', icon: '⚙️' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [autofillActive, setAutofillActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    chrome.storage.local.get('autofillActive', (res) => {
      setAutofillActive(res.autofillActive ?? false);
      setLoading(false);
    });
  }, []);

  const toggleAutofill = useCallback(async () => {
    const next = !autofillActive;
    setAutofillActive(next);
    chrome.runtime.sendMessage({ type: 'SET_AUTOFILL_STATE', payload: { active: next } });
    if (next) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_AUTOFILL' }).catch(() => {});
    }
    showNotification(next ? '🤖 Autofill ON' : '⏹ Autofill OFF');
  }, [autofillActive]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 2500);
  };

  if (loading) return <div className="app loading"><div className="loader-ring" /></div>;

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <span className="logo-icon">🤖</span>
          <div className="logo-text">
            <span className="logo-title">AI Form Assistant</span>
            <span className="logo-subtitle">v1.0 · claude-powered</span>
          </div>
        </div>
        <button className={`power-btn ${autofillActive ? 'active' : ''}`} onClick={toggleAutofill}>
          <span className="power-icon">⏻</span>
          <span>{autofillActive ? 'ON' : 'OFF'}</span>
        </button>
      </header>

      <div className={`status-bar ${autofillActive ? 'status-active' : 'status-idle'}`}>
        <div className="status-dot" />
        <span>{autofillActive ? 'Watching for forms on this page...' : 'Autofill is paused — press ON to start'}</span>
      </div>

      {notification && (
        <div className={`notification notification-${notification.type}`}>{notification.message}</div>
      )}

      <nav className="tab-nav">
        {TABS.map(tab => (
          <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}>
            <span className="tab-icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="tab-content">
        {activeTab === 'dashboard' && <Dashboard autofillActive={autofillActive} onToggle={toggleAutofill} onNotify={showNotification} />}
        {activeTab === 'profile'   && <ProfileEditor onNotify={showNotification} />}
        {activeTab === 'resume'    && <ResumeUploader onNotify={showNotification} onProfileParsed={() => setActiveTab('profile')} />}
        {activeTab === 'memory'    && <MemoryViewer onNotify={showNotification} />}
        {activeTab === 'log'       && <ConfidenceLog />}
        {activeTab === 'settings'  && <Settings onNotify={showNotification} />}
      </main>
    </div>
  );
}
