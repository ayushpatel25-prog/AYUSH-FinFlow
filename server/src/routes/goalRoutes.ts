import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import {
  getUserGoals,
  createGoal,
  addGoalContribution,
  deleteGoal,
} from '../services/goalService.js';

const router = Router();

const goalSchema = z.object({
  name: z.string().min(1, 'Goal name is required'),
  category: z.string().optional(),
  targetAmountPaise: z.number().int().positive(),
  initialAmountPaise: z.number().int().min(0).default(0),
  targetDate: z.string(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  color: z.string().optional(),
  icon: z.string().optional(),
  notes: z.string().optional(),
});

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const goals = await getUserGoals(req.user!.id);
    res.json({ success: true, data: goals });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const validated = goalSchema.parse(req.body);
    const created = await createGoal(req.user!.id, validated);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/contributions', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      amountPaise: z.number().int().positive(),
      accountId: z.string().optional(),
      notes: z.string().optional(),
      date: z.string().optional(),
    });
    const validated = schema.parse(req.body);
    const result = await addGoalContribution(req.user!.id, req.params.id, validated);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await deleteGoal(req.user!.id, req.params.id);
    res.json({ success: true, message: 'Goal deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

export default router;
