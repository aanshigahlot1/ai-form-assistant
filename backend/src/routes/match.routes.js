// backend/src/routes/match.routes.js
import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { UserProfile } from '../models/UserProfile.model.js';
import { MemoryEntry } from '../models/MemoryEntry.model.js';
import { config } from '../config.js';

const router = Router();
const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

/**
 * POST /api/match
 * Body: { extensionId, question, threshold? }
 * Returns: { answer, confidence, source }
 */
router.post('/', async (req, res) => {
  try {
    const { extensionId, question, threshold = 0.7 } = req.body;
    if (!extensionId || !question) {
      return res.status(400).json({ error: 'extensionId and question required' });
    }

    // 1. Check memory entries with text search
    const memoryResults = await MemoryEntry.find({
      extensionId,
      $text: { $search: question }
    }, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(5);

    if (memoryResults.length > 0 && memoryResults[0].score > 0.8) {
      const best = memoryResults[0];
      await MemoryEntry.findByIdAndUpdate(best._id, {
        $inc: { usageCount: 1 },
        lastUsed: new Date()
      });
      return res.json({
        answer: best.answer,
        confidence: Math.min(0.95, best.score / 10),
        source: 'memory_db'
      });
    }

    // 2. Semantic matching with Claude
    const profile = await UserProfile.findOne({ extensionId });
    if (!profile) return res.json({ answer: null, confidence: 0, source: 'no_profile' });

    const profileData = flattenProfile(profile);
    const result = await semanticMatchWithClaude(question, profileData);

    if (result && result.confidence >= threshold) {
      return res.json(result);
    }

    res.json({ answer: null, confidence: 0, source: 'no_match' });
  } catch (err) {
    console.error('[Match] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/match/batch
 * Body: { extensionId, questions: string[] }
 */
router.post('/batch', async (req, res) => {
  try {
    const { extensionId, questions } = req.body;
    if (!extensionId || !Array.isArray(questions)) {
      return res.status(400).json({ error: 'extensionId and questions[] required' });
    }

    const profile = await UserProfile.findOne({ extensionId });
    const memory = await MemoryEntry.find({ extensionId })
      .sort({ usageCount: -1 })
      .limit(100);

    const profileData = flattenProfile(profile);
    
    // Batch all questions in a single Claude call
    const results = await batchMatchWithClaude(questions, profileData, memory);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function flattenProfile(profile) {
  if (!profile) return [];
  const p = profile.personalInfo || {};
  const e = profile.education || {};
  const pr = profile.professional || {};

  return [
    { field: 'fullName', q: 'Full name', a: p.fullName },
    { field: 'email', q: 'Email address', a: p.email },
    { field: 'phone', q: 'Phone number', a: p.phone },
    { field: 'linkedin', q: 'LinkedIn URL', a: p.linkedIn },
    { field: 'github', q: 'GitHub URL', a: p.github },
    { field: 'portfolio', q: 'Portfolio website', a: p.portfolio },
    { field: 'city', q: 'City / location', a: p.city },
    { field: 'state', q: 'State', a: p.state },
    { field: 'country', q: 'Country', a: p.country },
    { field: 'college', q: 'College / university', a: e.college },
    { field: 'degree', q: 'Degree', a: e.degree },
    { field: 'branch', q: 'Branch / major', a: e.branch },
    { field: 'cgpa', q: 'CGPA / GPA', a: e.cgpa },
    { field: 'percentage', q: 'Percentage', a: e.percentage },
    { field: 'graduationYear', q: 'Graduation year', a: e.graduationYear },
    { field: 'skills', q: 'Skills', a: Array.isArray(pr.skills) ? pr.skills.join(', ') : pr.skills },
    { field: 'workExperience', q: 'Work experience', a: pr.workExperience },
    { field: 'internships', q: 'Internship experience', a: pr.internships },
    ...(profile.customAnswers ? 
      [...profile.customAnswers.entries()].map(([q, a]) => ({ field: 'custom', q, a })) 
      : [])
  ].filter(item => item.a && item.a !== '');
}

async function semanticMatchWithClaude(question, profileData) {
  const prompt = `Match this form question to the best user profile data entry.

Form Question: "${question}"

Profile Data:
${profileData.map((p, i) => `${i+1}. [${p.field}] "${p.q}" → "${p.a}"`).join('\n')}

Return ONLY JSON: {"index": <1-based number>, "answer": "<exact answer>", "confidence": <0.0-1.0>}
confidence: 0.95=exact match, 0.80=clear semantic match, 0.65=reasonable, 0.0=no match
If no match: {"index": -1, "answer": "", "confidence": 0}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 150,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text.replace(/```json?|```/g, '').trim();
  const parsed = JSON.parse(text);
  
  if (parsed.confidence > 0 && parsed.answer) {
    return { answer: parsed.answer, confidence: parsed.confidence, source: 'claude_api' };
  }
  return null;
}

async function batchMatchWithClaude(questions, profileData, memory) {
  const prompt = `Match each form question to the best profile data. 

Profile Data:
${profileData.map((p, i) => `P${i+1}. [${p.field}] "${p.q}" → "${p.a}"`).join('\n')}

Memory Entries (user-specific):
${memory.slice(0, 20).map((m, i) => `M${i+1}. "${m.question}" → "${m.answer}"`).join('\n')}

Questions to match:
${questions.map((q, i) => `${i+1}. "${q}"`).join('\n')}

Return ONLY a JSON array where each element is {"answer": "<answer>", "confidence": <0-1>, "source": "<profile|memory|none>"}
Array must have exactly ${questions.length} elements.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text.replace(/```json?|```/g, '').trim();
  return JSON.parse(text);
}

export default router;
