// background/background.js  — Manifest V3 Service Worker

// ─── Storage helpers (no ES module imports — service workers bundle inline) ───

async function getProfile() {
  const r = await chrome.storage.local.get('userProfile');
  return r.userProfile || {};
}

async function saveProfile(data) {
  const existing = (await chrome.storage.local.get('userProfile')).userProfile || {};
  const merged = deepMerge(existing, data);
  merged.updatedAt = new Date().toISOString();
  if (!merged.createdAt) merged.createdAt = new Date().toISOString();
  await chrome.storage.local.set({ userProfile: merged });
  return merged;
}

async function getMemory() {
  const r = await chrome.storage.local.get('memoryEntries');
  return r.memoryEntries || [];
}

async function saveMemoryEntry(entry) {
  const entries = await getMemory();
  const idx = entries.findIndex(e => e.id === entry.id || jaccardSim(norm(e.question), norm(entry.question)) > 0.9);
  if (idx >= 0) {
    entries[idx] = { ...entries[idx], ...entry, usageCount: (entries[idx].usageCount || 0) + 1, updatedAt: new Date().toISOString() };
  } else {
    entries.unshift({ ...entry, usageCount: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  const sorted = entries.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)).slice(0, 500);
  await chrome.storage.local.set({ memoryEntries: sorted });
  return entry;
}

async function deleteMemoryEntry(id) {
  const entries = await getMemory();
  await chrome.storage.local.set({ memoryEntries: entries.filter(e => e.id !== id) });
  return { ok: true };
}

async function getAutofillState() {
  const r = await chrome.storage.local.get('autofillActive');
  return { active: r.autofillActive ?? false };
}

async function setAutofillState(active) {
  await chrome.storage.local.set({ autofillActive: active });
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try { await chrome.tabs.sendMessage(tab.id, { type: 'AUTOFILL_STATE_CHANGED', payload: { active } }); }
    catch (_) {}
  }
  return { ok: true };
}

async function getConfidenceLog() {
  const r = await chrome.storage.local.get('confidenceLog');
  return r.confidenceLog || [];
}

async function logConfidence(payload) {
  const log = await getConfidenceLog();
  log.unshift({ ...payload, timestamp: new Date().toISOString() });
  await chrome.storage.local.set({ confidenceLog: log.slice(0, 200) });

  // Update fill stats
  const statsR = await chrome.storage.local.get('fillStats');
  const stats = statsR.fillStats || { filled: 0, suggested: 0, skipped: 0, learned: 0 };
  if (payload.confidence >= 0.85) stats.filled++;
  else if (payload.confidence >= 0.55) stats.suggested++;
  else stats.skipped++;
  await chrome.storage.local.set({ fillStats: stats });
  return { ok: true };
}

// ─── Semantic matching ────────────────────────────────────────────────────────

const FIELD_PATTERNS = {
  'personalInfo.fullName': [/full\s*name/i, /your\s*name/i, /applicant\s*name/i, /^name$/i, /candidate\s*name/i],
  'personalInfo.firstName': [/first\s*name/i, /given\s*name/i, /fname/i],
  'personalInfo.lastName': [/last\s*name/i, /surname/i, /family\s*name/i],
  'personalInfo.email': [/email/i, /e-mail/i, /mail\s*id/i],
  'personalInfo.phone': [/phone/i, /mobile/i, /contact\s*number/i, /cell/i, /whatsapp/i],
  'personalInfo.linkedIn': [/linkedin/i, /linked\s*in/i],
  'personalInfo.github': [/github/i, /git\s*hub/i],
  'personalInfo.portfolio': [/portfolio/i, /personal\s*website/i, /website\s*url/i],
  'personalInfo.city': [/^city$/i, /current\s*city/i, /location/i, /residing\s*city/i],
  'personalInfo.state': [/^state$/i, /province/i],
  'personalInfo.country': [/^country$/i, /nationality/i],
  'personalInfo.dateOfBirth': [/date\s*of\s*birth/i, /dob/i, /birth\s*date/i],
  'personalInfo.gender': [/^gender$/i, /^sex$/i],
  'education.college': [/college/i, /university/i, /institution/i, /alma\s*mater/i],
  'education.degree': [/degree/i, /qualification/i, /education\s*level/i],
  'education.branch': [/branch/i, /major/i, /specialization/i, /field\s*of\s*study/i, /stream/i],
  'education.cgpa': [/cgpa/i, /gpa/i, /cumulative\s*gpa/i, /grade\s*point/i, /academic\s*score/i, /percentage.*semester/i],
  'education.percentage': [/percentage/i, /aggregate\s*marks/i, /score\s*%/i],
  'education.graduationYear': [/graduation\s*year/i, /passing\s*year/i, /year\s*of\s*graduation/i, /expected.*graduation/i, /batch/i],
  'education.tenthPercentage': [/10th/i, /ssc/i, /matriculation/i, /class\s*x\b/i, /secondary\s*school/i],
  'education.twelfthPercentage': [/12th/i, /hsc/i, /intermediate/i, /class\s*xii\b/i, /plus\s*two/i, /senior\s*secondary/i],
  'professional.skills': [/skills/i, /technical\s*skills/i, /key\s*skills/i, /competencies/i, /technologies\s*known/i],
  'professional.workExperience': [/work\s*experience/i, /professional\s*experience/i, /years\s*of\s*experience/i, /experience\s*in\s*years/i],
  'professional.internships': [/internship/i, /intern\s*experience/i],
};

function flattenProfile(profile) {
  if (!profile) return [];
  const items = [];
  const p = profile.personalInfo || {};
  const e = profile.education || {};
  const pr = profile.professional || {};

  const direct = [
    ['personalInfo.fullName', p.fullName], ['personalInfo.firstName', p.firstName],
    ['personalInfo.lastName', p.lastName], ['personalInfo.email', p.email],
    ['personalInfo.phone', p.phone], ['personalInfo.dateOfBirth', p.dateOfBirth],
    ['personalInfo.gender', p.gender], ['personalInfo.linkedIn', p.linkedIn],
    ['personalInfo.github', p.github], ['personalInfo.portfolio', p.portfolio],
    ['personalInfo.city', p.city], ['personalInfo.state', p.state],
    ['personalInfo.country', p.country], ['personalInfo.pincode', p.pincode],
    ['education.college', e.college], ['education.degree', e.degree],
    ['education.branch', e.branch], ['education.cgpa', e.cgpa],
    ['education.percentage', e.percentage], ['education.graduationYear', e.graduationYear],
    ['education.tenthPercentage', e.tenthPercentage], ['education.twelfthPercentage', e.twelfthPercentage],
    ['professional.skills', Array.isArray(pr.skills) ? pr.skills.join(', ') : pr.skills],
    ['professional.workExperience', pr.workExperience],
    ['professional.internships', pr.internships],
  ];

  for (const [field, value] of direct) {
    if (value && String(value).trim()) items.push({ field, value: String(value) });
  }

  // Custom answers
  if (profile.customAnswers) {
    for (const [q, a] of Object.entries(profile.customAnswers)) {
      if (a) items.push({ field: 'custom', customQuestion: q, value: String(a) });
    }
  }
  return items;
}

async function semanticMatch(question, threshold) {
  if (!question) return null;
  const profile = await getProfile();
  const memory = await getMemory();
  const flat = flattenProfile(profile);
  const normQ = norm(question);

  // 1. Custom answers exact/fuzzy match
  for (const item of flat.filter(i => i.field === 'custom')) {
    const score = jaccardSim(normQ, norm(item.customQuestion));
    if (score > 0.75) return { answer: item.value, confidence: Math.min(0.96, score + 0.15), source: 'custom' };
  }

  // 2. Memory entries
  let bestMem = null, bestMemScore = 0;
  for (const entry of memory) {
    const score = jaccardSim(normQ, norm(entry.question));
    if (score > bestMemScore) { bestMemScore = score; bestMem = entry; }
  }
  if (bestMem && bestMemScore > 0.6) {
    return { answer: bestMem.answer, confidence: Math.min(0.95, bestMemScore + 0.2), source: 'memory' };
  }

  // 3. Pattern matching
  for (const [fieldPath, patterns] of Object.entries(FIELD_PATTERNS)) {
    for (const pat of patterns) {
      if (pat.test(question)) {
        const item = flat.find(i => i.field === fieldPath);
        if (item?.value) return { answer: item.value, confidence: 0.88, source: 'pattern', field: fieldPath };
      }
    }
  }

  // 4. Claude API semantic match
  if (flat.length === 0) return null;
  try {
    const profileText = flat.filter(i => i.field !== 'custom')
      .map((i, idx) => `${idx+1}. field="${i.field}" value="${i.value}"`)
      .join('\n');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Form question: "${question}"\n\nUser profile fields:\n${profileText}\n\nFind the BEST matching answer. Return ONLY JSON: {"index":<1-based>,"answer":"<value>","confidence":<0-1>}\nIf no match: {"index":-1,"answer":"","confidence":0}\nconfidence: 0.95=exact, 0.8=clear semantic, 0.65=reasonable, 0=no match`
        }]
      })
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    const text = (data.content?.[0]?.text || '').replace(/```json?|```/g, '').trim();
    const parsed = JSON.parse(text);
    if (parsed.confidence >= (threshold || 0.65) && parsed.answer) {
      return { answer: parsed.answer, confidence: parsed.confidence, source: 'claude_semantic' };
    }
  } catch (err) {
    console.warn('[BG] Claude match failed:', err.message);
  }

  return bestMem && bestMemScore > 0.4
    ? { answer: bestMem.answer, confidence: bestMemScore + 0.1, source: 'memory_low' }
    : null;
}

// ─── Message router ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender)
    .then(sendResponse)
    .catch(err => sendResponse({ error: err.message }));
  return true;
});

async function handleMessage(msg, sender) {
  switch (msg.type) {
    case 'GET_PROFILE':         return getProfile();
    case 'SAVE_PROFILE':        return saveProfile(msg.payload);
    case 'GET_MEMORY':          return getMemory();
    case 'SAVE_MEMORY_ENTRY':   return saveMemoryEntry(msg.payload);
    case 'DELETE_MEMORY_ENTRY': return deleteMemoryEntry(msg.payload.id);
    case 'SEMANTIC_MATCH':      return semanticMatch(msg.payload.question, msg.payload.threshold);
    case 'LEARN_CORRECTION':    return saveMemoryEntry({
        id: Date.now().toString(),
        question: msg.payload.question,
        answer: msg.payload.answer,
        fieldContext: msg.payload.fieldContext,
        source: 'user_correction',
        confidence: 1.0,
        usageCount: 1
      });
    case 'GET_AUTOFILL_STATE':  return getAutofillState();
    case 'SET_AUTOFILL_STATE':  return setAutofillState(msg.payload.active);
    case 'GET_CONFIDENCE_LOG':  return getConfidenceLog();
    case 'LOG_CONFIDENCE':      return logConfidence(msg.payload);
    case 'CLEAR_MEMORY':        
      await chrome.storage.local.set({ memoryEntries: [] });
      return { ok: true };
    case 'CLEAR_STATS':
      await chrome.storage.local.set({ confidenceLog: [], fillStats: {} });
      return { ok: true };
    case 'CAPTURE_TAB': {
      const tabId = sender.tab?.id;
      if (!tabId) return { error: 'no tab' };
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' });
        return { dataUrl };
      } catch (e) { return { error: e.message }; }
    }
    case 'EXPORT_DATA': {
      const [profile, memory, log] = await Promise.all([getProfile(), getMemory(), getConfidenceLog()]);
      return { profile, memoryEntries: memory, confidenceLog: log, exportedAt: new Date().toISOString() };
    }
    case 'IMPORT_DATA': {
      const { profile, memoryEntries } = msg.payload;
      if (profile) await saveProfile(profile);
      if (memoryEntries?.length) await chrome.storage.local.set({ memoryEntries });
      return { ok: true };
    }
    default: throw new Error(`Unknown message: ${msg.type}`);
  }
}

// ─── Context menu ─────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'aifa-fill', title: '🤖 AI Fill This Form', contexts: ['page'] });
  chrome.contextMenus.create({ id: 'aifa-fill-field', title: '🤖 AI Fill This Field', contexts: ['editable'] });
  chrome.contextMenus.create({ id: 'separator', type: 'separator', contexts: ['page'] });
  chrome.contextMenus.create({ id: 'aifa-learn', title: '💡 Learn Selected Text as Answer', contexts: ['selection'] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === 'aifa-fill') {
    chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_AUTOFILL' });
  } else if (info.menuItemId === 'aifa-fill-field') {
    chrome.tabs.sendMessage(tab.id, { type: 'FILL_FOCUSED_FIELD' });
  } else if (info.menuItemId === 'aifa-learn' && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, { type: 'LEARN_SELECTION', payload: { text: info.selectionText } });
  }
});

// ─── Tab events ───────────────────────────────────────────────────────────────

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url || tab.url.startsWith('chrome') || tab.url.startsWith('about')) return;
  const { active } = await getAutofillState();
  if (active) {
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { type: 'PAGE_LOADED' }).catch(() => {});
    }, 800);
  }
});

// ─── Utilities ────────────────────────────────────────────────────────────────

function norm(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function jaccardSim(a, b) {
  const sa = new Set(a.split(' ').filter(Boolean));
  const sb = new Set(b.split(' ').filter(Boolean));
  const inter = [...sa].filter(w => sb.has(w)).length;
  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 0 : inter / union;
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
