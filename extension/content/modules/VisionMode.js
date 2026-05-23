// content/modules/VisionMode.js
// Phase 4: AI Vision — captures page screenshot, OCRs it, uses Claude multimodal
// to detect hidden labels and unusual form layouts.

export class VisionMode {
  constructor() {
    this.enabled = false;
    this.processing = false;
  }

  async isAvailable() {
    // Vision mode requires the background service worker to capture tab
    return !!(chrome?.tabs?.captureVisibleTab !== undefined);
  }

  /**
   * Capture the visible tab as a base64 PNG, then send to Claude vision API
   * to extract form fields that DOM scanning missed.
   */
  async analyzePageWithVision(profile) {
    if (this.processing) return [];
    this.processing = true;

    try {
      // Step 1: Capture visible tab screenshot
      const screenshotDataUrl = await this.captureTab();
      if (!screenshotDataUrl) return [];

      // Step 2: Send to Claude with multimodal prompt
      const fields = await this.extractFieldsWithClaude(screenshotDataUrl, profile);
      return fields;
    } catch (err) {
      console.warn('[VisionMode] Error:', err.message);
      return [];
    } finally {
      this.processing = false;
    }
  }

  async captureTab() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'CAPTURE_TAB' }, (response) => {
        if (chrome.runtime.lastError || !response?.dataUrl) {
          resolve(null);
        } else {
          resolve(response.dataUrl);
        }
      });
    });
  }

  async extractFieldsWithClaude(screenshotDataUrl, profile) {
    // Remove data:image/png;base64, prefix
    const base64Image = screenshotDataUrl.replace(/^data:image\/\w+;base64,/, '');

    const profileSummary = [
      `Name: ${profile?.personalInfo?.fullName || ''}`,
      `Email: ${profile?.personalInfo?.email || ''}`,
      `College: ${profile?.education?.college || ''}`,
      `CGPA: ${profile?.education?.cgpa || ''}`,
      `Skills: ${Array.isArray(profile?.professional?.skills) ? profile.professional.skills.join(', ') : ''}`,
    ].join('\n');

    const prompt = `You are analyzing a screenshot of a job/internship application form.

User profile:
${profileSummary}

Task: Identify ALL form fields visible in this screenshot. For each field found:
1. What question/label is being asked
2. What the best answer would be from the user profile above (or "UNKNOWN" if not in profile)
3. Estimated position on screen (top/middle/bottom, left/right)

Return ONLY a JSON array:
[
  {
    "question": "field label text",
    "suggestedAnswer": "answer from profile or UNKNOWN",
    "confidence": 0.0-1.0,
    "position": "description",
    "fieldType": "text|email|select|radio|textarea|file"
  }
]

If no form fields are visible, return: []`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: base64Image
                }
              },
              { type: 'text', text: prompt }
            ]
          }
        ]
      })
    });

    if (!response.ok) throw new Error(`Vision API error: ${response.status}`);
    const data = await response.json();
    const text = data.content?.[0]?.text || '[]';
    const clean = text.replace(/```json?|```/g, '').trim();
    return JSON.parse(clean);
  }

  /**
   * Match vision-detected fields to actual DOM elements using text similarity.
   */
  matchVisionFieldsToDOM(visionFields, domFields) {
    const matches = [];

    for (const vField of visionFields) {
      if (vField.confidence < 0.6 || vField.suggestedAnswer === 'UNKNOWN') continue;

      // Find closest DOM field by question text similarity
      let bestMatch = null;
      let bestScore = 0;

      for (const dField of domFields) {
        const score = this.textSimilarity(vField.question, dField.question);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = dField;
        }
      }

      if (bestMatch && bestScore > 0.4) {
        matches.push({
          domField: bestMatch,
          answer: vField.suggestedAnswer,
          confidence: Math.min(vField.confidence, bestScore),
          source: 'vision'
        });
      }
    }

    return matches;
  }

  textSimilarity(a, b) {
    if (!a || !b) return 0;
    const normalize = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    const wa = new Set(normalize(a));
    const wb = new Set(normalize(b));
    const intersection = [...wa].filter(w => wb.has(w)).length;
    const union = new Set([...wa, ...wb]).size;
    return union === 0 ? 0 : intersection / union;
  }
}
