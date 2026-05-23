// popup/src/components/ResumeUploader.jsx
import { useState } from 'react';

export default function ResumeUploader({ onNotify, onProfileParsed }) {
  const [mode, setMode] = useState('paste');
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [parseMethod, setParseMethod] = useState('local'); // 'local' | 'api'

  // ── Local parser — NO API KEY NEEDED ──────────────────────────────────────
  const parseResumeLocally = (resumeText) => {
    const t = resumeText;

    const find = (patterns) => {
      for (const p of patterns) {
        const m = t.match(p);
        if (m) return (m[1] || m[0]).trim().replace(/[,;]$/, '').trim();
      }
      return '';
    };

    const findAll = (patterns) => {
      const results = new Set();
      for (const p of patterns) {
        const matches = t.matchAll(p);
        for (const m of matches) {
          const val = (m[1] || m[0]).trim();
          if (val.length > 1 && val.length < 60) results.add(val);
        }
      }
      return [...results].slice(0, 15);
    };

    // Email
    const email = find([/[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/]);

    // Phone
    const phone = find([
      /(?:\+91[\s-]?)?[6-9]\d{9}/,
      /\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/,
      /\+\d[\d\s\-().]{8,}/
    ]);

    // Name — usually first non-empty line or line before email
    const lines = t.split('\n').map(l => l.trim()).filter(Boolean);
    const nameLine = lines.find(l =>
      l.length > 3 && l.length < 60 &&
      !/[@\d{3}http|linkedin|github|skills|education|experience|project]/i.test(l) &&
      /^[A-Z][a-zA-Z\s.]+$/.test(l)
    ) || '';
    const nameParts = nameLine.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // LinkedIn
    const linkedin = find([
      /linkedin\.com\/in\/([\w-]+)/i,
      /linkedin:\s*([\S]+)/i
    ]);

    // GitHub
    const github = find([
      /github\.com\/([\w-]+)/i,
      /github:\s*([\S]+)/i
    ]);

    // Portfolio
    const portfolio = find([
      /portfolio[:\s]+(https?:\/\/[\S]+)/i,
      /website[:\s]+(https?:\/\/[\S]+)/i
    ]);

    // City
    const city = find([
      /(?:location|city|address)[:\s]+([A-Za-z\s]+?)(?:,|\n|$)/i,
      /([A-Za-z]+),\s*(?:India|UP|Delhi|Maharashtra|Karnataka|Tamil Nadu)/i
    ]);

    // College
    const college = find([
      /(?:university|college|institute|institution)[:\s]+(.+?)(?:\n|,|$)/i,
      /(?:b\.?tech|b\.?e|m\.?tech|bca|mca|b\.?sc)[^\n]*(?:from|at)\s+(.+?)(?:\n|,|$)/i,
      /((?:IIT|NIT|BITS|DTU|VIT|KIIT|SRM|Amity|Manipal|LPU|AKTU|GLA|HBTU|MMMUT|KNIT|IERT|GCET)[^\n,]{0,60})/i
    ]);

    // Degree
    const degree = find([
      /\b(B\.?Tech|B\.?E\.?|M\.?Tech|BCA|MCA|B\.?Sc|M\.?Sc|MBA|B\.?Com|B\.?A)\b/i
    ]);

    // Branch
    const branch = find([
      /(?:branch|major|specialization|stream)[:\s]+(.+?)(?:\n|,|$)/i,
      /\b(Computer Science|CSE|IT|Information Technology|ECE|Electronics|Mechanical|Civil|Chemical|Electrical|EEE|Data Science|AI|Artificial Intelligence|Machine Learning)\b/i
    ]);

    // CGPA
    const cgpa = find([
      /(?:cgpa|gpa|cumulative)[:\s]*([\d.]+)\s*(?:\/\s*[\d.]+)?/i,
      /\b([\d]\.\d{1,2})\s*(?:\/\s*10|cgpa|gpa)/i
    ]);

    // Percentage
    const percentage = find([
      /(?:percentage|marks|score)[:\s]*([\d.]+)\s*%/i,
      /([\d.]+)\s*%/
    ]);

    // Graduation year
    const graduationYear = find([
      /(?:graduation|passing|batch|class of|expected)[:\s]*(\d{4})/i,
      /(\d{4})\s*[-–]\s*(?:present|ongoing|pursuing|\d{4})/i,
      /\b(202[0-9]|2019|2018)\b/
    ]);

    // 10th
    const tenth = find([
      /(?:10th|ssc|class\s*x|matriculation)[^\n]*?([\d.]+)\s*%/i,
      /(?:10th|ssc)[:\s]*([\d.]+)/i
    ]);

    // 12th
    const twelfth = find([
      /(?:12th|hsc|class\s*xii|intermediate|plus\s*two)[^\n]*?([\d.]+)\s*%/i,
      /(?:12th|hsc)[:\s]*([\d.]+)/i
    ]);

    // Skills — look for skills section
    const skillsSection = t.match(/skills?[:\s\n]+([\s\S]{10,400}?)(?:\n\n|\n[A-Z]|experience|education|project)/i);
    let skills = [];
    if (skillsSection) {
      skills = skillsSection[1]
        .split(/[,|•\n\/]/)
        .map(s => s.trim().replace(/^[-*]\s*/, ''))
        .filter(s => s.length > 1 && s.length < 40 && !/^\d+$/.test(s))
        .slice(0, 20);
    }
    if (skills.length === 0) {
      skills = findAll([
        /\b(React|Node\.js|Python|Java|JavaScript|TypeScript|C\+\+|MongoDB|SQL|HTML|CSS|Django|Flask|Express|Spring|Angular|Vue|Docker|Git|AWS|Machine Learning|Deep Learning|TensorFlow|PyTorch|Figma|Canva|Excel|Power BI|Tableau)\b/gi
      ]);
    }

    // Programming languages
    const languages = findAll([
      /\b(Python|Java|JavaScript|TypeScript|C\+\+|C#|Go|Rust|Swift|Kotlin|PHP|Ruby|R|MATLAB|Scala)\b/g
    ]);

    // Internships — find company names near internship keyword
    const internshipSection = t.match(/(?:internship|intern)[:\s\n]+([\s\S]{10,600}?)(?:\n\n|project|education|skill)/i);
    const internships = internshipSection ? internshipSection[1].trim().slice(0, 300) : '';

    // Work experience
    const expYears = find([
      /(\d+)\+?\s*years?\s*(?:of\s*)?experience/i,
      /experience[:\s]+(\d+)/i
    ]);

    // Certifications
    const certifications = findAll([
      /(?:certified?|certification)[:\s]+(.+?)(?:\n|,|$)/gi,
      /\b(AWS Certified|Google Analytics|HackerRank|Coursera|Udemy|NPTEL|Oracle|Microsoft Certified)[^\n,]{0,60}/gi
    ]);

    return {
      personalInfo: {
        fullName: nameLine,
        firstName,
        lastName,
        email,
        phone,
        city,
        state: '',
        country: 'India',
        linkedIn: linkedin ? `https://linkedin.com/in/${linkedin}` : '',
        github: github ? `https://github.com/${github}` : '',
        portfolio
      },
      education: {
        college,
        degree,
        branch,
        cgpa,
        percentage,
        graduationYear,
        tenthPercentage: tenth,
        twelfthPercentage: twelfth
      },
      professional: {
        skills,
        languages,
        tools: [],
        frameworks: [],
        workExperience: expYears ? `${expYears} years` : 'Fresher',
        internships,
        certifications,
        achievements: []
      }
    };
  };

  // ── API parser — uses Anthropic (needs key in Settings) ───────────────────
  const parseResumeWithAPI = async (resumeText) => {
    const settings = await new Promise(r =>
      chrome.storage.local.get('settings', d => r(d.settings || {}))
    );
    const apiKey = settings.apiKey || '';

    if (!apiKey) {
      onNotify('⚠️ No API key. Go to Settings ⚙️ and add your Anthropic key, or use Local Parse instead.', 'error');
      return null;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `Extract structured information from this resume. Return ONLY valid JSON, no markdown fences, no preamble.

Resume text:
${resumeText.slice(0, 4000)}

Return this exact JSON structure (use empty string "" for missing fields, [] for missing arrays):
{
  "personalInfo": { "fullName":"","firstName":"","lastName":"","email":"","phone":"","city":"","state":"","country":"","linkedIn":"","github":"","portfolio":"" },
  "education": { "college":"","degree":"","branch":"","cgpa":"","percentage":"","graduationYear":"","tenthPercentage":"","twelfthPercentage":"" },
  "professional": { "skills":[],"languages":[],"tools":[],"frameworks":[],"workExperience":"","internships":"","certifications":[],"achievements":[] }
}`
        }]
      })
    });

    if (!response.ok) throw new Error(`API error: ${response.status} — check your API key in Settings`);
    const data = await response.json();
    const raw = data.content?.[0]?.text || '{}';
    return JSON.parse(raw.replace(/```json?|```/g, '').trim());
  };

  // ── Main parse handler ────────────────────────────────────────────────────
  const parseResume = async (resumeText) => {
    if (!resumeText?.trim() || resumeText.trim().length < 50) {
      onNotify('⚠️ Resume text too short — paste more content', 'error');
      return;
    }
    setParsing(true);
    try {
      let parsed;
      if (parseMethod === 'api') {
        parsed = await parseResumeWithAPI(resumeText);
        if (!parsed) return; // Error already shown
      } else {
        parsed = parseResumeLocally(resumeText);
      }

      if (!parsed.personalInfo.fullName && parsed.personalInfo.firstName) {
        parsed.personalInfo.fullName = `${parsed.personalInfo.firstName} ${parsed.personalInfo.lastName}`.trim();
      }
      setPreview(parsed);
      onNotify('✅ Resume parsed! Review and apply below.');
    } catch (err) {
      onNotify('❌ Parse failed: ' + err.message, 'error');
    } finally {
      setParsing(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (ev) => { setText(ev.target.result); parseResume(ev.target.result); };
      reader.readAsText(file);
    } else {
      onNotify('⚠️ Upload .txt file, or use Paste mode for PDF text', 'error');
    }
  };

  const applyToProfile = () => {
    if (!preview) return;
    chrome.storage.local.get('userProfile', (res) => {
      const merged = deepMerge(res.userProfile || {}, preview);
      merged.resumeText = text;
      merged.updatedAt = new Date().toISOString();
      chrome.storage.local.set({ userProfile: merged }, () => {
        onNotify('✅ Profile updated from resume!');
        onProfileParsed?.(merged);
        setPreview(null);
        setText('');
      });
    });
  };

  return (
    <div className="resume-uploader">

      {/* Method selector */}
      <div className="parse-method-box">
        <p className="parse-method-title">Choose Parse Method:</p>
        <div className="parse-method-btns">
          <button
            className={`method-btn ${parseMethod === 'local' ? 'active' : ''}`}
            onClick={() => setParseMethod('local')}
          >
            ⚡ Local Parse
            <span className="method-badge free">FREE</span>
          </button>
          <button
            className={`method-btn ${parseMethod === 'api' ? 'active' : ''}`}
            onClick={() => setParseMethod('api')}
          >
            🤖 AI Parse
            <span className="method-badge paid">API Key</span>
          </button>
        </div>
        <p className="parse-method-hint">
          {parseMethod === 'local'
            ? '⚡ Works offline, no API key needed. Good for standard resumes.'
            : '🤖 Claude AI reads your resume. More accurate but needs API key in Settings ⚙️'}
        </p>
      </div>

      {/* Input mode tabs */}
      <div className="mode-tabs">
        <button className={`mode-tab ${mode === 'paste' ? 'active' : ''}`} onClick={() => setMode('paste')}>📋 Paste Text</button>
        <button className={`mode-tab ${mode === 'file' ? 'active' : ''}`} onClick={() => setMode('file')}>📁 Upload .txt</button>
      </div>

      {mode === 'paste' ? (
        <>
          <textarea
            className="resume-textarea"
            placeholder={
              "Paste your resume text here.\n\n" +
              "For PDF:\n" +
              "1. Open PDF in Chrome browser\n" +
              "2. Press Ctrl+A (select all)\n" +
              "3. Press Ctrl+C (copy)\n" +
              "4. Click here and press Ctrl+V (paste)"
            }
            value={text}
            onChange={e => setText(e.target.value)}
            rows={9}
          />
          {text.trim().length > 0 && (
            <p className="char-count">{text.length} characters pasted ✓</p>
          )}
          <button
            className="parse-btn"
            onClick={() => parseResume(text)}
            disabled={parsing || !text.trim()}
          >
            {parsing
              ? '⏳ Parsing...'
              : parseMethod === 'local'
                ? '⚡ Parse Resume (Free)'
                : '🤖 Parse with AI'}
          </button>
        </>
      ) : (
        <div className="file-drop">
          <input type="file" accept=".txt,.text" id="resume-file" onChange={handleFileUpload} style={{ display: 'none' }} />
          <label htmlFor="resume-file" className="file-label">
            <span className="file-icon">📄</span>
            <span className="file-main">Click to choose a .txt file</span>
            <span className="file-hint">
              Save your resume as .txt first:<br />
              Word → File → Save As → Plain Text (.txt)<br />
              Or use Paste mode for PDF
            </span>
          </label>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="preview-card">
          <div className="preview-header">
            <span>✅ Parsed — Review Below</span>
            <button className="preview-close" onClick={() => setPreview(null)}>✕</button>
          </div>
          <div className="preview-grid">
            {[
              ['Name',      preview.personalInfo?.fullName],
              ['Email',     preview.personalInfo?.email],
              ['Phone',     preview.personalInfo?.phone],
              ['City',      preview.personalInfo?.city],
              ['LinkedIn',  preview.personalInfo?.linkedIn],
              ['GitHub',    preview.personalInfo?.github],
              ['College',   preview.education?.college],
              ['Degree',    preview.education?.degree],
              ['Branch',    preview.education?.branch],
              ['CGPA',      preview.education?.cgpa],
              ['Grad Year', preview.education?.graduationYear],
              ['10th',      preview.education?.tenthPercentage],
              ['12th',      preview.education?.twelfthPercentage],
              ['Skills',    Array.isArray(preview.professional?.skills) ? preview.professional.skills.slice(0, 5).join(', ') : ''],
              ['Internship',preview.professional?.internships],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label} className="preview-row">
                <span className="preview-label">{label}</span>
                <span className="preview-value">{String(value).slice(0, 55)}</span>
              </div>
            ))}
          </div>
          <p className="preview-note">⚠️ Wrong fields? Edit them manually in the Profile tab after applying.</p>
          <button className="apply-btn" onClick={applyToProfile}>
            💾 Apply to Profile
          </button>
        </div>
      )}
    </div>
  );
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source || {})) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else if (Array.isArray(source[key]) && source[key].length > 0) {
      result[key] = source[key];
    } else if (source[key] !== '' && source[key] !== null && source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
}
