// backend/src/routes/sync.routes.js
import { Router } from 'express';
import { UserProfile } from '../models/UserProfile.model.js';
import { MemoryEntry } from '../models/MemoryEntry.model.js';

const router = Router();

/**
 * POST /api/sync/push
 * Push local extension data to cloud
 */
router.post('/push', async (req, res) => {
  try {
    const { extensionId, profile, memoryEntries } = req.body;
    if (!extensionId) return res.status(400).json({ error: 'extensionId required' });

    const results = { profile: null, memoryCount: 0 };

    if (profile) {
      results.profile = await UserProfile.findOneAndUpdate(
        { extensionId },
        { ...profile, extensionId },
        { upsert: true, new: true }
      );
    }

    if (Array.isArray(memoryEntries) && memoryEntries.length > 0) {
      for (const entry of memoryEntries) {
        await MemoryEntry.findOneAndUpdate(
          { extensionId, question: entry.question },
          { ...entry, extensionId },
          { upsert: true }
        );
      }
      results.memoryCount = memoryEntries.length;
    }

    res.json({ ok: true, synced: results });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/**
 * GET /api/sync/pull/:extensionId
 * Pull cloud data to local extension
 */
router.get('/pull/:extensionId', async (req, res) => {
  try {
    const { extensionId } = req.params;
    const [profile, memoryEntries] = await Promise.all([
      UserProfile.findOne({ extensionId }),
      MemoryEntry.find({ extensionId }).sort({ usageCount: -1 }).limit(200)
    ]);
    res.json({ profile, memoryEntries });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
