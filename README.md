<div align="center">

<img src="extension/icons/icon128.png" alt="AI Job Form Assistant" width="80" height="80"/>

# AI Job Form Assistant

### A Chrome Extension that automatically fills job & internship application forms using AI

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=flat&logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-brightgreen?style=flat)](https://developer.chrome.com/docs/extensions/mv3/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)](https://reactjs.org/)
[![Claude AI](https://img.shields.io/badge/Claude-AI-D97706?style=flat)](https://anthropic.com)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat&logo=mongodb&logoColor=white)](https://mongodb.com)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat)](LICENSE)

<br/>

**Stop filling the same form fields over and over.**  
This extension learns your profile once and fills any job application — Google Forms, LinkedIn Easy Apply, Workday, Unstop, and more — automatically.

<br/>

[🚀 Quick Start](#-quick-start) · [✨ Features](#-features) · [🛠 Tech Stack](#-tech-stack) · [📁 Project Structure](#-project-structure) · [🤝 Contributing](#-contributing)

</div>

---

## 📸 Demo

> **How it works in 3 steps:**

| Step 1 — Fill your profile once | Step 2 — Turn ON autofill | Step 3 — Watch it fill forms |
|---|---|---|
| Add your name, college, CGPA, skills etc. | Click the power button in the popup | Fields fill automatically with confidence scores |

---

## ✨ Features

### 🤖 Intelligent Form Detection
- Scans **any website** for form fields — inputs, textareas, dropdowns, radio buttons, checkboxes
- Extracts question labels using **9 fallback strategies** — label tags, aria attributes, placeholder text, nearby DOM text, and more
- Handles **dynamic SPAs** via MutationObserver — detects new fields added after page load

### 🧠 Semantic Understanding
- Goes beyond keyword matching — understands that *"Current CGPA"*, *"Academic Score"*, *"Cumulative GPA"* and *"Percentage till current semester"* all mean the same thing
- **3-layer matching pipeline:**
  1. Custom Q&A pairs (your own saved answers)
  2. Pattern matching (instant, offline, no API needed)
  3. Claude AI semantic matching (for ambiguous questions)

### 📊 Confidence System
| Confidence | Action | Visual |
|---|---|---|
| ≥ 85% | Auto-fills the field silently | 🟢 Green dot indicator |
| 55–84% | Shows suggestion tooltip — you decide | 🟡 Yellow tooltip with ✓ Use / ✏ Edit / ✕ Skip |
| < 55% | Skips silently | Nothing |

### 💡 Learning System
- When you **edit a suggestion**, the correction is saved to memory
- Next time the same question appears (on any website), it auto-fills with your corrected answer
- Memory viewer lets you browse, search, and delete learned answers

### 🌐 Platform Support
| Platform | Status | Special Handling |
|---|---|---|
| Google Forms | ✅ Full support | Question title extraction |
| LinkedIn Easy Apply | ✅ Full support | Modal-scoped scanning |
| Workday | ✅ Full support | data-automation-id mapping |
| Unstop | ✅ Full support | Angular ng-select handling |
| Greenhouse | ✅ Full support | Standard HTML forms |
| Lever | ✅ Full support | Standard HTML forms |
| Any Custom Form | ✅ Full support | Full DOM heuristics |

### 📄 Resume Parser
- Paste your resume text → AI extracts all fields automatically
- **Free local parser** (no API key needed) using regex pattern extraction
- **AI parser** (with API key) for higher accuracy

### ☁️ Optional Cloud Sync
- MongoDB backend for cross-device profile sync
- Vector memory with ChromaDB for enhanced semantic search
- Export/Import your data as JSON backup

---

## 🛠 Tech Stack

### Extension (Frontend)
| Technology | Purpose |
|---|---|
| **Chrome Extension Manifest V3** | Extension architecture |
| **React 18 + Vite** | Popup UI |
| **Vanilla JS (IIFE)** | Content script injected into pages |
| **MutationObserver API** | Dynamic form detection |
| **chrome.storage.local** | Local data persistence |

### Backend (Optional)
| Technology | Purpose |
|---|---|
| **Node.js + Express** | REST API server |
| **MongoDB + Mongoose** | User profiles and memory storage |
| **ChromaDB** | Vector database for semantic search |
| **Anthropic Claude API** | AI semantic matching and resume parsing |
| **Docker** | Local database containers |

---

## 🚀 Quick Start

### Option A — Extension Only (No Backend Needed)

> Works fully offline. No API key required for basic autofill.

**1. Clone the repository**
```bash
git clone https://github.com/YOUR_USERNAME/ai-form-assistant.git
cd ai-form-assistant
```

**2. Build the popup**
```bash
cd extension/popup
npm install
npm run build
cd ../..
```

**3. Assemble the extension**
```bash
node scripts/build-extension.js
```

**4. Load in Chrome**
1. Open Chrome → go to `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder
5. Pin the 🤖 icon to your toolbar

**5. Fill your profile**
1. Click the 🤖 icon → **Profile tab** 👤
2. Enter your details (name, email, college, CGPA, skills...)
3. Click **Save Profile**

**6. Start autofilling**
1. Go to any job application form
2. Click the 🤖 icon → press **ON**
3. Watch it fill! 🎉

---

### Option B — Full Stack (With Backend + Cloud Sync)

**Prerequisites:** Node.js ≥ 18, Docker Desktop, Anthropic API key

**1. Start databases**
```bash
docker compose up -d
```

**2. Configure backend**
```bash
cd backend
cp .env.example .env
# Edit .env — add your ANTHROPIC_API_KEY and MONGODB_URI
```

**3. Start backend server**
```bash
npm install
npm run dev
# → Running on http://localhost:3001
```

**4. Build and load extension** (same as Option A steps 2–5)

**5. Connect extension to backend**
- Extension popup → **Settings** ⚙️ → set Backend URL to `http://localhost:3001` → Save

---

## 📁 Project Structure

```
ai-form-assistant/
│
├── 📦 dist/                          ← Load THIS in Chrome
│   ├── manifest.json
│   ├── background/background.js
│   ├── content/content.bundle.js
│   ├── icons/
│   └── popup/
│
├── 🔧 extension/
│   ├── manifest/manifest.json        ← Chrome MV3 manifest
│   ├── background/background.js      ← Service worker (AI matching, message routing)
│   ├── content/
│   │   ├── content.js                ← Injected into every page
│   │   ├── modules/
│   │   │   ├── FormScanner.js        ← Universal form field detector
│   │   │   ├── FieldFiller.js        ← Smart field filler (React/Vue/Angular aware)
│   │   │   ├── DOMObserver.js        ← Watches for dynamic form changes
│   │   │   ├── ConfidenceUI.js       ← In-page tooltip UI
│   │   │   └── platforms/            ← Platform-specific handlers
│   │   │       ├── GoogleForms.js
│   │   │       ├── Workday.js
│   │   │       ├── LinkedIn.js
│   │   │       └── Unstop.js
│   │   └── services/
│   │       ├── EmbeddingService.js   ← 3-layer semantic matching
│   │       ├── ResumeParser.js       ← Resume text → structured profile
│   │       └── BackendSyncService.js ← Local ↔ cloud sync
│   │
│   └── popup/
│       └── src/
│           ├── App.jsx               ← Main popup (6 tabs)
│           └── components/
│               ├── Dashboard.jsx     ← Stats and quick actions
│               ├── ProfileEditor.jsx ← Full profile form
│               ├── ResumeUploader.jsx← AI + local resume parser
│               ├── MemoryViewer.jsx  ← Browse learned answers
│               ├── ConfidenceLog.jsx ← Fill history
│               └── Settings.jsx      ← API keys, thresholds, sync
│
├── 🖥 backend/
│   └── src/
│       ├── server.js                 ← Express app
│       ├── routes/
│       │   ├── profile.routes.js
│       │   ├── memory.routes.js
│       │   ├── match.routes.js       ← Claude semantic matching API
│       │   ├── sync.routes.js        ← Push/pull sync
│       │   └── resume.routes.js      ← PDF/text resume parsing
│       └── models/
│           ├── UserProfile.model.js
│           └── MemoryEntry.model.js
│
├── 🧠 vector-memory/
│   ├── ChromaService.js              ← ChromaDB v2 client
│   ├── EmbeddingPipeline.js          ← Text embeddings + semantic search
│   └── test-chroma.js                ← Smoke tests
│
├── 📜 scripts/
│   ├── build-extension.js            ← Assembles dist/
│   ├── package-extension.js          ← Creates .zip for Web Store
│   └── generate-icons.js             ← Generates PNG icons
│
├── docker-compose.yml                ← MongoDB + ChromaDB
└── SETUP.md                          ← Detailed setup guide
```

---

## 🔌 Extension Message API

The background service worker handles these messages from the popup and content scripts:

| Message Type | Payload | Returns |
|---|---|---|
| `GET_PROFILE` | — | UserProfile object |
| `SAVE_PROFILE` | profile data | Updated profile |
| `SEMANTIC_MATCH` | `{ question, threshold }` | `{ answer, confidence, source }` |
| `LEARN_CORRECTION` | `{ question, answer }` | Saved memory entry |
| `GET_AUTOFILL_STATE` | — | `{ active: bool }` |
| `SET_AUTOFILL_STATE` | `{ active: bool }` | `{ ok: true }` |
| `EXPORT_DATA` | — | Full data backup JSON |
| `CAPTURE_TAB` | — | Screenshot base64 (Vision Mode) |

---

## 🔧 Backend REST API

Base URL: `http://localhost:3001`

```
GET    /health                        → Server status
GET    /api/profile/:extensionId      → Fetch profile
POST   /api/profile/:extensionId      → Save profile
GET    /api/memory/:extensionId       → List memory entries
POST   /api/memory/:extensionId       → Add memory entry
DELETE /api/memory/:extensionId/:id   → Delete entry
POST   /api/match                     → Semantic question match
POST   /api/match/batch               → Batch match multiple questions
POST   /api/sync/push                 → Upload local data to cloud
GET    /api/sync/pull/:extensionId    → Download cloud data
POST   /api/resume/parse              → Parse resume PDF/text
```

---

## ⚙️ Environment Variables

Create `backend/.env` from `backend/.env.example`:

```env
PORT=3001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/ai-form-assistant
ANTHROPIC_API_KEY=sk-ant-your-key-here
CORS_ORIGINS=http://localhost:5173
CHROMA_URL=http://localhost:8000
```

---

## 🔄 Development Workflow

After making any code change:

```bash
# 1. Rebuild popup (only needed for popup/src changes)
cd extension/popup && npm run build && cd ../..

# 2. Rebuild extension dist
node scripts/build-extension.js

# 3. Reload in Chrome
# → chrome://extensions/ → click ↺ refresh on the extension

# 4. Hard refresh the form page
# → Ctrl + Shift + R
```

---

## 🗺 Roadmap

- [x] Core autofill engine (pattern matching + Claude semantic)
- [x] 9-strategy DOM label extraction
- [x] MutationObserver for SPA/dynamic forms
- [x] Confidence scoring system
- [x] In-page suggestion tooltips with learning
- [x] Platform handlers (Google Forms, Workday, LinkedIn, Unstop)
- [x] React popup with 6 tabs
- [x] Resume parser (local + AI)
- [x] MongoDB backend + ChromaDB vector memory
- [x] Export/Import data backup
- [ ] PDF resume upload (drag & drop)
- [ ] Vision Mode — Claude multimodal for hidden labels
- [ ] Multiple profile support
- [ ] Firefox extension support
- [ ] Chrome Web Store listing
- [ ] Analytics dashboard

---

## 🤔 How the Matching Works

```
Form question: "Cumulative academic score out of 10"
        │
        ▼
┌─── Layer 1: Custom Q&A ─────────────────────────┐
│ Did user save a custom answer for this? → No     │
└──────────────────────────────────────────────────┘
        │
        ▼
┌─── Layer 2: Pattern Matching ───────────────────┐
│ Does it match /cgpa|gpa|academic score/i? → Yes  │
│ Profile has cgpa = "8.7" → confidence: 88%       │
│ 88% ≥ 85% threshold → AUTO-FILL ✓               │
└──────────────────────────────────────────────────┘
```

If pattern matching fails, Claude AI reads the question and your profile together and picks the best match — explaining its reasoning with a confidence score.

---

## 🐛 Troubleshooting

**Extension popup is blank white**
```
→ Run: cd extension/popup && npm run build && cd ../..
→ Run: node scripts/build-extension.js
→ Go to chrome://extensions/ → remove extension → Load unpacked again
```

**Fields not being filled**
```
→ Make sure autofill is ON (green status bar in popup)
→ Right-click on page → "🤖 AI Fill This Form"
→ Check DevTools console for [AIFA] log messages
→ Make sure your profile has the relevant fields filled
```

**Yellow tooltip not appearing**
```
→ Tooltip appears just below the form field
→ Scroll down — it may be below the visible area
→ It auto-dismisses after 30 seconds
→ Confidence must be 55–84% to show tooltip
```

**Resume parser shows wrong fields**
```
→ Try AI Parse mode (needs API key in Settings)
→ Manually fix wrong fields in Profile tab
→ The local parser works best with plain text format
```

---

## 📚 What I Learned Building This

- **Chrome Extension Manifest V3** architecture — service workers, content scripts, message passing
- **React synthetic events** — why `input.value = x` doesn't work in React and how to fix it using native input value setters
- **MutationObserver** with debouncing for SPA form detection
- **Content Security Policy** in extensions — why Google Fonts are blocked and how to handle it
- **Semantic similarity** without embeddings — Jaccard similarity + regex pattern banks
- **Claude AI integration** — prompt engineering for structured JSON output, confidence scoring
- **DOM traversal strategies** — 9 different ways to find a form field's label across different platforms
- **Vector databases** — ChromaDB v2 API, cosine similarity, embedding pipelines

---

## 🤝 Contributing

Pull requests are welcome! For major changes, open an issue first.

```bash
git checkout -b feature/your-feature-name
git commit -m "Add: your feature description"
git push origin feature/your-feature-name
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built with ❤️ using React, Chrome Extensions API, and Claude AI

⭐ **Star this repo if it helped you!** ⭐

</div>
