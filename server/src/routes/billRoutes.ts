import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import {
  getUserBills,
  createBill,
  payBill,
  deleteBill,
} from '../services/billService.js';

const router = Router();

const billSchema = z.object({
  name: z.string().min(1, 'Bill name is required'),
  amountPaise: z.number().int().positive(),
  frequency: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM']).default('MONTHLY'),
  dueDate: z.string(),
  category: z.string().optional(),
  accountId: z.string().optional(),
  autoRenew: z.boolean().optional(),
  reminderDays: z.number().int().min(1).default(3),
});

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const bills = await getUserBills(req.user!.id);
    res.json({ success: true, data: bills });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const validated = billSchema.parse(req.body);
    const created = await createBill(req.user!.id, validated);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/pay', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      accountId: z.string().optional(),
    });
    const validated = schema.parse(req.body);
    const result = await payBill(req.user!.id, req.params.id, validated);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await deleteBill(req.user!.id, req.params.id);
    res.json({ success: true, message: 'Bill deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

export default router;
