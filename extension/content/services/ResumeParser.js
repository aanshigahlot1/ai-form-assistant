// content/services/ResumeParser.js
// Parses resume text/PDF and auto-populates the user profile using Claude

export class ResumeParser {
  /**
   * Parse resume text and return structured profile data.
   * Call this when the user pastes their resume or uploads a PDF.
   */
  static async parse(resumeText) {
    if (!resumeText || resumeText.trim().length < 50) {
      throw new Error('Resume text too short');
    }

    const prompt = `Extract structured information from this resume. Return ONLY a JSON object with no additional text.

Resume:
${resumeText.slice(0, 4000)}

Return this exact JSON structure (leave fields empty string if not found):
{
  "personalInfo": {
    "fullName": "",
    "firstName": "",
    "lastName": "",
    "email": "",
    "phone": "",
    "city": "",
    "state": "",
    "country": "",
    "linkedIn": "",
    "github": "",
    "portfolio": ""
  },
  "education": {
    "college": "",
    "degree": "",
    "branch": "",
    "cgpa": "",
    "percentage": "",
    "graduationYear": "",
    "tenthPercentage": "",
    "twelfthPercentage": ""
  },
  "professional": {
    "skills": [],
    "languages": [],
    "tools": [],
    "frameworks": [],
    "workExperience": "",
    "internships": "",
    "projects": [],
    "certifications": [],
    "achievements": []
  }
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    const text = data.content?.[0]?.text || '{}';
    const clean = text.replace(/```json?|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // Post-process: derive fullName from first+last if missing
    if (!parsed.personalInfo.fullName && parsed.personalInfo.firstName) {
      parsed.personalInfo.fullName = `${parsed.personalInfo.firstName} ${parsed.personalInfo.lastName}`.trim();
    }

    return parsed;
  }

  /**
   * Extract plain text from a PDF file (base64 encoded).
   * Uses the backend /api/resume/parse endpoint.
   */
  static async parsePDFBase64(base64PDF) {
    const response = await fetch('http://localhost:3001/api/resume/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfBase64: base64PDF })
    });
    if (!response.ok) throw new Error('PDF parse failed');
    const data = await response.json();
    return data.profile;
  }
}
