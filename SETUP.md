# AI Job Form Assistant — Complete Setup Guide

## What This Is

A production Chrome Extension that uses AI (Claude) to automatically fill internship and job application forms. Works on Google Forms, LinkedIn Easy Apply, Workday, Unstop, Greenhouse, Lever, and any custom HTML form.

**How it works:**
1. You fill in your profile once (name, email, CGPA, skills, etc.)
2. The extension watches every page for form fields
3. It semantically matches each question to your profile using Claude AI
4. High-confidence fields (≥85%) are filled automatically; medium-confidence (55–84%) show a suggestion tooltip
5. When you correct a suggestion, it learns and remembers for next time

---

## Prerequisites

| Tool | Version | Required For |
|------|---------|-------------|
| Node.js | ≥ 18.0 | Building popup, running backend |
| npm | ≥ 9.0 | Package management |
| Chrome | ≥ 109 | Extension host (Manifest V3) |
| Docker | any | MongoDB + ChromaDB (optional) |
| MongoDB | ≥ 6.0 | Cloud sync (optional) |

---

## Quick Start (Extension Only — No Backend Needed)

The extension works fully offline with `chrome.storage.local`. The backend is only needed for cloud sync and enhanced vector search.

### Step 1 — Build the Popup

```bash
cd extension/popup
npm install
npm run build
```

This creates `extension/popup/dist/` with the compiled React app.

### Step 2 — Assemble the Extension

```bash
# From project root
node scripts/build-extension.js
```

This creates `dist/` — the loadable Chrome extension folder.

### Step 3 — Load in Chrome

1. Open Chrome → navigate to `chrome://extensions/`
2. Toggle **Developer mode** ON (top right)
3. Click **Load unpacked**
4. Select the `dist/` folder
5. The 🤖 icon appears in your toolbar

### Step 4 — Fill Your Profile

1. Click the 🤖 toolbar icon
2. Go to **Profile** tab
3. Fill in your details (name, email, college, CGPA, skills, etc.)
4. Click **Save Profile**

Or use the **Resume** tab to paste your resume text — Claude will auto-extract all fields.

### Step 5 — Start Autofilling

1. Navigate to any job application form
2. Click **ON** in the popup (or use the power button)
3. Watch fields get filled automatically!

---

## Full Stack Setup (With Backend + Vector Memory)

### Step 1 — Start Databases

```bash
# MongoDB + ChromaDB via Docker
docker compose up -d

# Verify:
# MongoDB: mongodb://localhost:27017
# ChromaDB: http://localhost:8000/api/v1/heartbeat
```

### Step 2 — Configure Backend

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:
```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/ai-form-assistant
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE
```

Get your API key at: https://console.anthropic.com/

### Step 3 — Start Backend

```bash
cd backend
npm install
npm run dev
# → Server running on http://localhost:3001
# → Health: http://localhost:3001/health
```

### Step 4 — Build and Load Extension

```bash
# From project root
cd extension/popup && npm install && npm run build && cd ../..
node scripts/build-extension.js
```

Load `dist/` as unpacked extension (same as above).

### Step 5 — Configure Extension to Use Backend

1. Open extension popup → **Settings** tab
2. Set Backend URL: `http://localhost:3001`
3. Set Anthropic API Key (same key as backend .env)
4. Click **Save Settings**
5. Click **Sync to Cloud** to push your profile to MongoDB

---

## Project Structure

```
ai-job-form-assistant/
│
├── dist/                          ← LOAD THIS IN CHROME
│   ├── manifest.json
│   ├── background/background.js
│   ├── content/content.bundle.js
│   ├── content/content.css
│   ├── icons/
│   └── popup/
│
├── extension/
│   ├── manifest/manifest.json     ← Chrome Extension Manifest V3
│   ├── background/
│   │   └── background.js          ← Service worker (all message handling, matching logic)
│   ├── content/
│   │   ├── content.js             ← Injected into every page (self-contained IIFE)
│   │   ├── content.css            ← Tooltip/indicator styles
│   │   ├── modules/
│   │   │   ├── FormScanner.js     ← Universal form field detector
│   │   │   ├── FieldFiller.js     ← Fills fields with React/Vue/Angular event support
│   │   │   ├── DOMObserver.js     ← MutationObserver for SPA/dynamic forms
│   │   │   ├── ConfidenceUI.js    ← Inline suggestion tooltips
│   │   │   ├── MessageBus.js      ← Typed chrome.runtime.sendMessage wrapper
│   │   │   ├── VisionMode.js      ← Phase 4: Screenshot + Claude multimodal
│   │   │   └── platforms/
│   │   │       ├── GoogleForms.js
│   │   │       ├── Workday.js
│   │   │       ├── LinkedIn.js
│   │   │       └── Unstop.js
│   │   ├── services/
│   │   │   ├── EmbeddingService.js   ← Semantic matching (patterns + Claude API)
│   │   │   ├── ResumeParser.js       ← Resume text → structured profile
│   │   │   └── BackendSyncService.js ← Local ↔ backend sync
│   │   └── stores/
│   │       ├── UserProfileStore.js   ← chrome.storage profile management
│   │       └── MemoryStore.js        ← Learned Q&A memory
│   ├── icons/
│   └── popup/
│       ├── src/
│       │   ├── App.jsx             ← Main popup shell (6 tabs)
│       │   ├── main.jsx
│       │   ├── components/
│       │   │   ├── Dashboard.jsx   ← Stats, quick actions, platform list
│       │   │   ├── ProfileEditor.jsx ← Full profile form (collapsible sections)
│       │   │   ├── ResumeUploader.jsx ← Paste/upload resume → AI parse
│       │   │   ├── MemoryViewer.jsx  ← Browse/delete learned answers
│       │   │   ├── ConfidenceLog.jsx ← Per-field fill history
│       │   │   └── Settings.jsx     ← API keys, thresholds, export/import
│       │   ├── hooks/
│       │   │   ├── useProfile.js
│       │   │   └── useMemory.js
│       │   └── styles/app.css
│       ├── package.json
│       └── vite.config.js
│
├── backend/
│   ├── src/
│   │   ├── server.js              ← Express app entry point
│   │   ├── config.js              ← Environment config
│   │   ├── middleware/
│   │   │   └── auth.middleware.js ← Extension ID validation, rate limiting
│   │   ├── models/
│   │   │   ├── UserProfile.model.js
│   │   │   └── MemoryEntry.model.js
│   │   └── routes/
│   │       ├── profile.routes.js  ← GET/POST/DELETE profile
│   │       ├── memory.routes.js   ← CRUD memory entries
│   │       ├── match.routes.js    ← Semantic question matching (Claude)
│   │       ├── sync.routes.js     ← Push/pull sync between extension and DB
│   │       └── resume.routes.js   ← PDF/text resume parsing
│   ├── .env.example
│   └── package.json
│
├── vector-memory/
│   ├── ChromaService.js           ← ChromaDB REST client
│   ├── EmbeddingPipeline.js       ← Text → vector → store/query
│   ├── test-chroma.js             ← Smoke tests
│   └── package.json
│
├── scripts/
│   ├── build-extension.js         ← Assembles dist/
│   ├── package-extension.js       ← Creates .zip for Web Store
│   └── generate-icons.js          ← Generates PNG icons programmatically
│
├── docker-compose.yml             ← MongoDB + ChromaDB
├── package.json                   ← Root scripts
└── SETUP.md                       ← This file
```

---

## API Reference

### Backend REST API

**Base URL:** `http://localhost:3001`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server health check |
| GET | `/api/profile/:extensionId` | Fetch user profile |
| POST | `/api/profile/:extensionId` | Save/update profile |
| DELETE | `/api/profile/:extensionId` | Delete profile |
| GET | `/api/memory/:extensionId` | List memory entries |
| POST | `/api/memory/:extensionId` | Add memory entry |
| DELETE | `/api/memory/:extensionId/:id` | Delete entry |
| POST | `/api/match` | Semantic match question → answer |
| POST | `/api/match/batch` | Match multiple questions at once |
| POST | `/api/sync/push` | Upload local data to cloud |
| GET | `/api/sync/pull/:extensionId` | Download cloud data |
| POST | `/api/resume/parse` | Parse resume text/PDF → profile |

### Extension Messages (chrome.runtime.sendMessage)

| Type | Payload | Returns |
|------|---------|---------|
| `GET_PROFILE` | — | UserProfile object |
| `SAVE_PROFILE` | profile data | Updated profile |
| `GET_MEMORY` | — | MemoryEntry[] |
| `SAVE_MEMORY_ENTRY` | entry | Saved entry |
| `DELETE_MEMORY_ENTRY` | `{ id }` | `{ ok: true }` |
| `SEMANTIC_MATCH` | `{ question, threshold }` | `{ answer, confidence, source }` |
| `LEARN_CORRECTION` | `{ question, answer, fieldContext }` | Saved entry |
| `GET_AUTOFILL_STATE` | — | `{ active: bool }` |
| `SET_AUTOFILL_STATE` | `{ active: bool }` | `{ ok: true }` |
| `LOG_CONFIDENCE` | log data | `{ ok: true }` |
| `GET_CONFIDENCE_LOG` | — | LogEntry[] |
| `EXPORT_DATA` | — | `{ profile, memoryEntries, confidenceLog }` |
| `IMPORT_DATA` | `{ profile, memoryEntries }` | `{ ok: true }` |
| `CAPTURE_TAB` | — | `{ dataUrl: string }` |
| `CLEAR_MEMORY` | — | `{ ok: true }` |
| `CLEAR_STATS` | — | `{ ok: true }` |

---

## Confidence System

| Range | Action | Color |
|-------|--------|-------|
| ≥ 85% | Auto-fill silently | 🟢 Green dot |
| 55–84% | Show suggestion tooltip | 🟡 Amber tooltip |
| < 55% | Skip | — |

**Confidence sources (ranked by priority):**
1. `custom` — User's own custom Q&A pairs (≈95%)
2. `memory` — Previously learned answers (80–95%)
3. `pattern` — Regex pattern matching (88%)
4. `claude_semantic` — Claude API semantic match (65–95%)

---

## Supported Platforms

| Platform | Detection | Special Handling |
|----------|-----------|-----------------|
| Google Forms | `docs.google.com/forms` | Question title extraction |
| LinkedIn Easy Apply | `linkedin.com` + modal | Modal-scoped scanning |
| Workday | `myworkday.com` | `data-automation-id` mapping |
| Unstop | `unstop.com` | Angular `ng-select` handling |
| Greenhouse | `greenhouse.io` | Standard HTML forms |
| Lever | `lever.co` | Standard HTML forms |
| Any Custom Form | All other URLs | Full DOM heuristics |

---

## Troubleshooting

**Extension not filling fields:**
- Make sure you clicked **ON** in the popup
- Check that your profile has the relevant fields filled
- Open DevTools console on the form page and look for `[AIFA]` logs
- Try right-clicking → "🤖 AI Fill This Form"

**Low confidence / wrong answers:**
- Add more detail to your profile
- Use the **Resume** tab to auto-populate from your CV
- Manually add custom Q&A pairs for repeated questions
- Check the **Log** tab to see what questions were detected

**Popup shows blank:**
- Open `chrome://extensions/` → find the extension → click "Errors"
- Make sure `dist/popup/index.html` exists (rebuild with `npm run build`)

**Backend connection failed:**
- Verify `docker compose up -d` ran without errors
- Check `http://localhost:3001/health` in browser
- Make sure `ANTHROPIC_API_KEY` is set in `backend/.env`

---

## Packaging for Chrome Web Store

```bash
# Build everything
cd extension/popup && npm run build && cd ../..
node scripts/build-extension.js

# Create .zip
npm install  # installs archiver
node scripts/package-extension.js
# → ai-form-assistant-v1.0.0.zip
```

Upload the `.zip` to https://chrome.google.com/webstore/devconsole

---

## Roadmap

- **Phase 1** ✅ Core autofill (pattern + Claude semantic matching)
- **Phase 2** ✅ Learning system (memory store, correction learning)
- **Phase 3** ✅ Cloud sync (MongoDB backend, push/pull)
- **Phase 4** 🔜 Vision Mode (screenshot + Claude multimodal for hidden labels)
- **Phase 5** 🔜 Resume upload (PDF parsing, auto-profile population)
- **Phase 6** 🔜 Multi-profile support (different profiles for different job types)
