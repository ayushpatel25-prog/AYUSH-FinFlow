import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import {
  getUserBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
} from '../services/budgetService.js';

const router = Router();

const budgetSchema = z.object({
  categoryId: z.string().optional(),
  period: z.enum(['MONTHLY', 'WEEKLY', 'CUSTOM']).default('MONTHLY'),
  amountPaise: z.number().int().positive(),
  alertThresholdPercent: z.number().int().min(1).max(100).default(80),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const budgets = await getUserBudgets(req.user!.id);
    res.json({ success: true, data: budgets });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const validated = budgetSchema.parse(req.body);
    const created = await createBudget(req.user!.id, validated);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const updateSchema = z.object({
      amountPaise: z.number().int().positive().optional(),
      alertThresholdPercent: z.number().int().min(1).max(100).optional(),
      period: z.enum(['MONTHLY', 'WEEKLY', 'CUSTOM']).optional(),
    });
    const validated = updateSchema.parse(req.body);
    const updated = await updateBudget(req.user!.id, req.params.id, validated);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await deleteBudget(req.user!.id, req.params.id);
    res.json({ success: true, message: 'Budget deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

export default router;
