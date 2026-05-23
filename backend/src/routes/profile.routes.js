// backend/src/routes/profile.routes.js
import { Router } from 'express';
import { UserProfile } from '../models/UserProfile.model.js';

const router = Router();

router.get('/:extensionId', async (req, res) => {
  try {
    const profile = await UserProfile.findOne({ extensionId: req.params.extensionId });
    res.json(profile || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:extensionId', async (req, res) => {
  try {
    const profile = await UserProfile.findOneAndUpdate(
      { extensionId: req.params.extensionId },
      { ...req.body, extensionId: req.params.extensionId },
      { upsert: true, new: true, runValidators: true }
    );
    res.json(profile);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:extensionId', async (req, res) => {
  try {
    await UserProfile.deleteOne({ extensionId: req.params.extensionId });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
