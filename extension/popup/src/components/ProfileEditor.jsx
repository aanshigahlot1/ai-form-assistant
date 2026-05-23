// popup/src/components/ProfileEditor.jsx

import { useState, useEffect } from 'react';

const SECTIONS = [
  {
    id: 'personal', title: '👤 Personal Info', fields: [
      { key: 'personalInfo.fullName', label: 'Full Name', type: 'text', placeholder: 'Arjun Sharma' },
      { key: 'personalInfo.firstName', label: 'First Name', type: 'text' },
      { key: 'personalInfo.lastName', label: 'Last Name', type: 'text' },
      { key: 'personalInfo.email', label: 'Email', type: 'email', placeholder: 'arjun@example.com' },
      { key: 'personalInfo.phone', label: 'Phone', type: 'tel', placeholder: '+91 9876543210' },
      { key: 'personalInfo.dateOfBirth', label: 'Date of Birth', type: 'date' },
      { key: 'personalInfo.gender', label: 'Gender', type: 'select', options: ['', 'Male', 'Female', 'Non-binary', 'Prefer not to say'] },
      { key: 'personalInfo.city', label: 'City', type: 'text', placeholder: 'Delhi' },
      { key: 'personalInfo.state', label: 'State', type: 'text', placeholder: 'Delhi' },
      { key: 'personalInfo.country', label: 'Country', type: 'text', placeholder: 'India' },
    ]
  },
  {
    id: 'links', title: '🔗 Links', fields: [
      { key: 'personalInfo.linkedIn', label: 'LinkedIn URL', type: 'url', placeholder: 'https://linkedin.com/in/...' },
      { key: 'personalInfo.github', label: 'GitHub URL', type: 'url', placeholder: 'https://github.com/...' },
      { key: 'personalInfo.portfolio', label: 'Portfolio URL', type: 'url', placeholder: 'https://myportfolio.com' },
    ]
  },
  {
    id: 'education', title: '🎓 Education', fields: [
      { key: 'education.college', label: 'College / University', type: 'text', placeholder: 'IIT Delhi' },
      { key: 'education.degree', label: 'Degree', type: 'text', placeholder: 'B.Tech' },
      { key: 'education.branch', label: 'Branch / Major', type: 'text', placeholder: 'Computer Science' },
      { key: 'education.cgpa', label: 'CGPA', type: 'text', placeholder: '8.5' },
      { key: 'education.percentage', label: 'Percentage', type: 'text', placeholder: '85%' },
      { key: 'education.graduationYear', label: 'Graduation Year', type: 'text', placeholder: '2025' },
      { key: 'education.tenthPercentage', label: '10th Percentage', type: 'text', placeholder: '95%' },
      { key: 'education.twelfthPercentage', label: '12th Percentage', type: 'text', placeholder: '92%' },
    ]
  },
  {
    id: 'professional', title: '💼 Professional', fields: [
      { key: 'professional.skills', label: 'Skills (comma-separated)', type: 'textarea', placeholder: 'React, Node.js, Python, Machine Learning' },
      { key: 'professional.languages', label: 'Programming Languages', type: 'textarea', placeholder: 'JavaScript, Python, Java, C++' },
      { key: 'professional.workExperience', label: 'Work Experience (years)', type: 'text', placeholder: '0 (Fresher) or 2 years' },
      { key: 'professional.internships', label: 'Internship Experience', type: 'textarea', placeholder: 'Describe your internships...' },
    ]
  }
];

function getNestedValue(obj, path) {
  if (!obj) return '';
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current === null || current === undefined) return '';
    current = current[key];
  }
  if (Array.isArray(current)) return current.join(', ');
  return current ?? '';
}

function setNestedValue(obj, path, value) {
  const result = JSON.parse(JSON.stringify(obj));
  const keys = path.split('.');
  let current = result;
  for (let i = 0; i < keys.length - 1; i++) {
    current = current[keys[i]] = current[keys[i]] || {};
  }
  current[keys[keys.length - 1]] = value;
  return result;
}

export default function ProfileEditor({ onNotify }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedSection, setExpandedSection] = useState('personal');
  const [newCustomQ, setNewCustomQ] = useState('');
  const [newCustomA, setNewCustomA] = useState('');

  useEffect(() => {
    chrome.storage.local.get('userProfile', (res) => {
      setProfile(res.userProfile || {
        personalInfo: {}, education: {}, professional: {}, preferences: {}, customAnswers: {}
      });
      setLoading(false);
    });
  }, []);

  const handleChange = (path, value) => {
    setProfile(prev => setNestedValue(prev, path, value));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Convert comma-separated skills back to arrays
      const toSave = JSON.parse(JSON.stringify(profile));
      if (typeof toSave.professional?.skills === 'string') {
        toSave.professional.skills = toSave.professional.skills.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (typeof toSave.professional?.languages === 'string') {
        toSave.professional.languages = toSave.professional.languages.split(',').map(s => s.trim()).filter(Boolean);
      }
      toSave.updatedAt = new Date().toISOString();
      await chrome.storage.local.set({ userProfile: toSave });
      onNotify('✅ Profile saved!');
    } catch (err) {
      onNotify('❌ Save failed: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const addCustomAnswer = () => {
    if (!newCustomQ.trim() || !newCustomA.trim()) return;
    const updated = {
      ...profile,
      customAnswers: {
        ...(profile.customAnswers || {}),
        [newCustomQ]: newCustomA
      }
    };
    setProfile(updated);
    setNewCustomQ('');
    setNewCustomA('');
  };

  const removeCustomAnswer = (key) => {
    const { [key]: _, ...rest } = profile.customAnswers || {};
    setProfile({ ...profile, customAnswers: rest });
  };

  if (loading) return <div className="loading-state">Loading profile...</div>;

  return (
    <div className="profile-editor">
      {SECTIONS.map(section => (
        <div key={section.id} className="section-block">
          <button
            className="section-header"
            onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
          >
            <span>{section.title}</span>
            <span className="chevron">{expandedSection === section.id ? '▲' : '▼'}</span>
          </button>
          
          {expandedSection === section.id && (
            <div className="section-fields">
              {section.fields.map(field => (
                <div key={field.key} className="field-row">
                  <label className="field-label">{field.label}</label>
                  {field.type === 'select' ? (
                    <select
                      className="field-input"
                      value={getNestedValue(profile, field.key)}
                      onChange={e => handleChange(field.key, e.target.value)}
                    >
                      {field.options.map(opt => (
                        <option key={opt} value={opt}>{opt || 'Select...'}</option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      className="field-input field-textarea"
                      value={getNestedValue(profile, field.key)}
                      onChange={e => handleChange(field.key, e.target.value)}
                      placeholder={field.placeholder || ''}
                      rows={3}
                    />
                  ) : (
                    <input
                      className="field-input"
                      type={field.type}
                      value={getNestedValue(profile, field.key)}
                      onChange={e => handleChange(field.key, e.target.value)}
                      placeholder={field.placeholder || ''}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Custom Q&A Section */}
      <div className="section-block">
        <button
          className="section-header"
          onClick={() => setExpandedSection(expandedSection === 'custom' ? null : 'custom')}
        >
          <span>✏️ Custom Answers</span>
          <span className="chevron">{expandedSection === 'custom' ? '▲' : '▼'}</span>
        </button>
        
        {expandedSection === 'custom' && (
          <div className="section-fields">
            <p className="hint-text">Add specific Q&A pairs for questions you frequently encounter</p>
            
            {Object.entries(profile.customAnswers || {}).map(([q, a]) => (
              <div key={q} className="custom-qa-row">
                <div className="qa-content">
                  <span className="qa-q">{q}</span>
                  <span className="qa-a">{a}</span>
                </div>
                <button className="qa-delete" onClick={() => removeCustomAnswer(q)}>✕</button>
              </div>
            ))}
            
            <div className="add-custom">
              <input
                className="field-input"
                type="text"
                placeholder="Question (e.g., Why do you want to join us?)"
                value={newCustomQ}
                onChange={e => setNewCustomQ(e.target.value)}
              />
              <textarea
                className="field-input field-textarea"
                placeholder="Your answer..."
                value={newCustomA}
                onChange={e => setNewCustomA(e.target.value)}
                rows={3}
              />
              <button className="add-btn" onClick={addCustomAnswer}>+ Add Answer</button>
            </div>
          </div>
        )}
      </div>

      <button
        className="save-btn"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? '⏳ Saving...' : '💾 Save Profile'}
      </button>
    </div>
  );
}
