// popup/src/hooks/useProfile.js
import { useState, useEffect, useCallback } from 'react';

const DEFAULT_PROFILE = {
  personalInfo: { fullName:'', firstName:'', lastName:'', email:'', phone:'', dateOfBirth:'', gender:'', linkedIn:'', portfolio:'', github:'', website:'', address:'', city:'', state:'', country:'India', pincode:'' },
  education: { college:'', degree:'', branch:'', cgpa:'', percentage:'', graduationYear:'', tenthPercentage:'', tenthBoard:'', twelfthPercentage:'', twelfthBoard:'' },
  professional: { skills:[], languages:[], tools:[], frameworks:[], workExperience:'', internships:'', projects:[], certifications:[], achievements:[] },
  preferences: { jobTypes:[], locations:[], expectedCTC:'', noticePeriod:'' },
  customAnswers: {},
  resumeText: ''
};

export function useProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    chrome.storage.local.get('userProfile', (res) => {
      setProfile(deepMerge(DEFAULT_PROFILE, res.userProfile || {}));
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (data) => {
    setSaving(true);
    setError(null);
    try {
      const toSave = deepMerge(profile || DEFAULT_PROFILE, data || profile);
      // Normalize comma-separated arrays
      if (typeof toSave.professional?.skills === 'string') {
        toSave.professional.skills = toSave.professional.skills.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (typeof toSave.professional?.languages === 'string') {
        toSave.professional.languages = toSave.professional.languages.split(',').map(s => s.trim()).filter(Boolean);
      }
      toSave.updatedAt = new Date().toISOString();
      if (!toSave.createdAt) toSave.createdAt = new Date().toISOString();
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ userProfile: toSave }, () => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve();
        });
      });
      setProfile(toSave);
      return toSave;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [profile]);

  const updateField = useCallback((path, value) => {
    setProfile(prev => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]] = cur[keys[i]] || {};
      cur[keys[keys.length - 1]] = value;
      return next;
    });
  }, []);

  const completionPercent = profile ? (() => {
    const checks = [
      profile.personalInfo?.fullName, profile.personalInfo?.email, profile.personalInfo?.phone,
      profile.personalInfo?.city, profile.personalInfo?.linkedIn,
      profile.education?.college, profile.education?.degree, profile.education?.branch,
      profile.education?.cgpa, profile.education?.graduationYear,
      profile.professional?.skills?.length > 0, profile.professional?.workExperience,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  })() : 0;

  return { profile, loading, saving, error, save, updateField, reload: load, completionPercent };
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source || {})) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
