// backend/src/routes/memory.routes.js
import { Router } from 'express';
import { MemoryEntry } from '../models/MemoryEntry.model.js';

const router = Router();

router.get('/:extensionId', async (req, res) => {
  try {
    const entries = await MemoryEntry.find({ extensionId: req.params.extensionId })
      .sort({ usageCount: -1 })
      .limit(200);
    res.json(entries);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:extensionId', async (req, res) => {
  try {
    const { question, answer, fieldContext, source, confidence } = req.body;
    
    // Check for existing similar question
    const existing = await MemoryEntry.findOne({
      extensionId: req.params.extensionId,
      question: { $regex: new RegExp(question.slice(0, 20), 'i') }
    });

    if (existing) {
      existing.answer = answer;
      existing.usageCount += 1;
      existing.source = source || existing.source;
      existing.lastUsed = new Date();
      await existing.save();
      return res.json(existing);
    }

    const entry = new MemoryEntry({
      extensionId: req.params.extensionId,
      question, answer, fieldContext,
      source: source || 'manual',
      confidence: confidence || 1.0
    });
    await entry.save();
    res.status(201).json(entry);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:extensionId/:id', async (req, res) => {
  try {
    await MemoryEntry.deleteOne({ 
      _id: req.params.id, 
      extensionId: req.params.extensionId 
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:extensionId', async (req, res) => {
  try {
    await MemoryEntry.deleteMany({ extensionId: req.params.extensionId });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
