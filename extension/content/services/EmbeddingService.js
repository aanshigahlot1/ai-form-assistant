// content/services/EmbeddingService.js
// Semantic matching using Claude API — works offline with keyword fallback

import { UserProfileStore } from '../stores/UserProfileStore.js';

// ─── Semantic Field Patterns ──────────────────────────────────────────────────
// These patterns allow fast offline matching without API calls for common fields

const FIELD_PATTERNS = {
  fullName: [
    /full\s*name/i, /your\s*name/i, /applicant\s*name/i, /candidate\s*name/i,
    /name\s*of\s*applicant/i, /^name$/i
  ],
  firstName: [
    /first\s*name/i, /given\s*name/i, /fname/i
  ],
  lastName: [
    /last\s*name/i, /surname/i, /family\s*name/i, /lname/i
  ],
  email: [
    /email/i, /e-mail/i, /mail\s*id/i, /email\s*address/i, /contact\s*email/i
  ],
  phone: [
    /phone/i, /mobile/i, /contact\s*number/i, /cell/i, /telephone/i, /whatsapp/i
  ],
  linkedin: [
    /linkedin/i, /linked\s*in/i, /li\s*profile/i, /linkedin\s*url/i
  ],
  github: [
    /github/i, /git\s*hub/i, /github\s*profile/i, /github\s*url/i
  ],
  portfolio: [
    /portfolio/i, /personal\s*website/i, /website\s*url/i, /personal\s*url/i
  ],
  college: [
    /college/i, /university/i, /institution/i, /institute/i, /school\s*name/i,
    /educational\s*institution/i, /alma\s*mater/i
  ],
  degree: [
    /degree/i, /qualification/i, /education\s*level/i, /highest\s*qualification/i,
    /course/i, /program/i
  ],
  branch: [
    /branch/i, /major/i, /specialization/i, /department/i, /stream/i,
    /field\s*of\s*study/i, /discipline/i
  ],
  cgpa: [
    /cgpa/i, /gpa/i, /cumulative\s*gpa/i, /academic\s*score/i, /grade\s*point/i,
    /percentage.*semester/i, /current.*score/i, /academic.*performance/i,
    /marks/i, /grades/i
  ],
  percentage: [
    /percentage/i, /percent/i, /score\s*%/i, /aggregate/i
  ],
  graduationYear: [
    /graduation\s*year/i, /passing\s*year/i, /year\s*of\s*(graduation|passing)/i,
    /expected.*graduation/i, /batch/i
  ],
  tenthPercentage: [
    /10th/i, /ssc/i, /matriculation/i, /class\s*10/i, /secondary\s*(school|board)/i
  ],
  twelfthPercentage: [
    /12th/i, /hsc/i, /intermediate/i, /class\s*12/i, /senior\s*secondary/i, /plus\s*two/i
  ],
  skills: [
    /skills/i, /technical\s*skills/i, /key\s*skills/i, /competencies/i,
    /technologies/i, /what\s*(are\s*your|skills)/i
  ],
  workExperience: [
    /work\s*experience/i, /professional\s*experience/i, /years\s*of\s*experience/i,
    /experience/i, /job\s*history/i
  ],
  internships: [
    /internship/i, /intern/i, /internship\s*experience/i
  ],
  city: [
    /city/i, /current\s*city/i, /location/i, /place/i, /residing/i
  ],
  state: [
    /state/i, /province/i
  ],
  country: [
    /country/i, /nationality/i
  ],
  gender: [
    /gender/i, /sex/i
  ],
  dateOfBirth: [
    /date\s*of\s*birth/i, /dob/i, /birth\s*date/i, /born\s*on/i
  ]
};

export class EmbeddingService {

  /**
   * Find the best matching answer for a form question.
   * Uses:
   * 1. Memory entries (user-specific learned answers) — highest priority
   * 2. Pattern matching (fast, offline)
   * 3. Claude API semantic matching (for ambiguous questions)
   */
  static async findBestMatch(question, profile, memoryEntries, threshold = 0.75) {
    if (!question) return null;

    // ── Step 1: Check memory entries first ──────────────────────────────────
    const memoryMatch = this.matchFromMemory(question, memoryEntries);
    if (memoryMatch && memoryMatch.confidence >= threshold) {
      return memoryMatch;
    }

    // ── Step 2: Pattern matching against profile ─────────────────────────────
    const patternMatch = this.matchFromPatterns(question, profile);
    if (patternMatch && patternMatch.confidence >= threshold) {
      return patternMatch;
    }

    // ── Step 3: Claude semantic matching via API ─────────────────────────────
    const flatProfile = UserProfileStore.flattenForMatching(profile);
    if (flatProfile.length === 0) return memoryMatch || patternMatch || null;

    try {
      const apiMatch = await this.matchWithClaude(question, flatProfile);
      if (apiMatch) {
        // Combine with any existing lower-confidence matches
        return apiMatch;
      }
    } catch (err) {
      console.warn('[EmbeddingService] API match failed, using fallback:', err.message);
    }

    // Return best fallback
    return memoryMatch || patternMatch || null;
  }

  // ─── Memory Matching ──────────────────────────────────────────────────────

  static matchFromMemory(question, entries) {
    if (!entries?.length) return null;
    const normalQ = this.normalize(question);
    let best = null;
    let bestScore = 0;

    for (const entry of entries) {
      const score = this.jaccardSimilarity(normalQ, this.normalize(entry.question));
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }

    if (best && bestScore > 0.6) {
      return {
        answer: best.answer,
        confidence: Math.min(0.95, bestScore + 0.2), // Boost for being in memory
        source: 'memory',
        entryId: best.id
      };
    }
    return null;
  }

  // ─── Pattern Matching ─────────────────────────────────────────────────────

  static matchFromPatterns(question, profile) {
    const flat = UserProfileStore.flattenForMatching(profile);

    for (const [fieldKey, patterns] of Object.entries(FIELD_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(question)) {
          const profileEntry = flat.find(f => f.field === fieldKey);
          if (profileEntry?.answer) {
            return {
              answer: profileEntry.answer,
              confidence: 0.88,
              source: 'pattern',
              field: fieldKey
            };
          }
        }
      }
    }
    return null;
  }

  // ─── Claude API Semantic Matching ─────────────────────────────────────────

  static async matchWithClaude(question, profileEntries) {
    const entriesText = profileEntries
      .map((e, i) => `${i + 1}. Field: "${e.field}" | Q: "${e.question}" | A: "${e.answer}"`)
      .join('\n');

    const prompt = `You are a form-filling assistant. Given a form question and a list of user profile data, find the BEST matching answer.

Form question: "${question}"

User profile data:
${entriesText}

Instructions:
- Find the semantically closest matching profile entry
- Return ONLY a JSON object: {"index": <number>, "confidence": <0.0-1.0>, "answer": "<the answer>"}
- confidence = 0.95 for exact/near-exact match, 0.80 for good semantic match, 0.65 for reasonable guess, 0.0 if no match
- If no good match exists (confidence < 0.6), return {"index": -1, "confidence": 0, "answer": ""}
- Return ONLY the JSON, no other text`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    const cleaned = text.replace(/```json?|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (parsed.confidence >= 0.6 && parsed.answer) {
      return {
        answer: parsed.answer,
        confidence: parsed.confidence,
        source: 'claude_semantic'
      };
    }
    return null;
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  static normalize(str) {
    return (str || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static jaccardSimilarity(a, b) {
    const setA = new Set(a.split(' ').filter(Boolean));
    const setB = new Set(b.split(' ').filter(Boolean));
    const intersection = [...setA].filter(w => setB.has(w)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
  }
}
