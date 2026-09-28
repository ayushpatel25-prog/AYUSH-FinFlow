import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import {
  getStoredInsights,
  dismissInsight,
  handleAIChat,
} from '../services/aiService.js';

const router = Router();

router.get('/insights', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const insights = await getStoredInsights(req.user!.id);
    res.json({ success: true, data: insights });
  } catch (error) {
    next(error);
  }
});

router.post('/insights/:id/dismiss', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await dismissInsight(req.user!.id, req.params.id);
    res.json({ success: true, message: 'Insight dismissed.' });
  } catch (error) {
    next(error);
  }
});

router.post('/chat', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      message: z.string().min(1, 'Message is required'),
    });
    const validated = schema.parse(req.body);
    const response = await handleAIChat(req.user!.id, validated.message);
    res.json({ success: true, ...response });
  } catch (error) {
    next(error);
  }
});

export default router;
