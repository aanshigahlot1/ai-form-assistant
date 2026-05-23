// backend/src/routes/resume.routes.js
// Parses resume PDF/text and returns structured profile data

import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

const router = Router();
const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

/**
 * POST /api/resume/parse
 * Body: { text } or { pdfBase64 }
 * Returns: { profile }
 */
router.post('/parse', async (req, res) => {
  try {
    const { text, pdfBase64 } = req.body;

    let resumeText = text;

    // If PDF base64 provided, decode to text first
    if (!resumeText && pdfBase64) {
      // Use Claude's document capability to read the PDF
      const pdfResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 }
            },
            { type: 'text', text: 'Extract all text from this resume PDF. Return only the plain text, no formatting.' }
          ]
        }]
      });
      resumeText = pdfResponse.content[0].text;
    }

    if (!resumeText || resumeText.length < 50) {
      return res.status(400).json({ error: 'Resume text too short or missing' });
    }

    // Parse structured data from resume text
    const parseResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Extract structured data from this resume. Return ONLY valid JSON with no preamble or markdown.

Resume:
${resumeText.slice(0, 5000)}

JSON structure to return:
{
  "personalInfo": { "fullName":"","firstName":"","lastName":"","email":"","phone":"","city":"","state":"","country":"","linkedIn":"","github":"","portfolio":"" },
  "education": { "college":"","degree":"","branch":"","cgpa":"","percentage":"","graduationYear":"","tenthPercentage":"","twelfthPercentage":"" },
  "professional": { "skills":[],"languages":[],"tools":[],"frameworks":[],"workExperience":"","internships":"","projects":[],"certifications":[],"achievements":[] }
}`
      }]
    });

    const raw = parseResponse.content[0].text.replace(/```json?|```/g, '').trim();
    const profile = JSON.parse(raw);

    if (!profile.personalInfo.fullName && profile.personalInfo.firstName) {
      profile.personalInfo.fullName = `${profile.personalInfo.firstName} ${profile.personalInfo.lastName}`.trim();
    }

    res.json({ profile, resumeText });
  } catch (err) {
    console.error('[Resume] Parse error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
