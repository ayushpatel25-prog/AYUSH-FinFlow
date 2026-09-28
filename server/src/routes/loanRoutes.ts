import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import {
  getLoansSummary,
  createLoan,
  addLoanPayment,
  deleteLoan,
} from '../services/loanService.js';

const router = Router();

const loanSchema = z.object({
  type: z.enum(['LENT', 'BORROWED']),
  person: z.string().min(1, 'Person name is required'),
  principalPaise: z.number().int().positive(),
  date: z.string().optional(),
  dueDate: z.string().optional(),
  purpose: z.string().min(1, 'Purpose is required'),
  notes: z.string().optional(),
  interestRate: z.number().min(0).optional(),
  accountId: z.string().optional(),
});

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const summary = await getLoansSummary(req.user!.id);
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const validated = loanSchema.parse(req.body);
    const created = await createLoan(req.user!.id, validated);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/payments', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const paymentSchema = z.object({
      amountPaise: z.number().int().positive(),
      principalPartPaise: z.number().int().min(0).optional(),
      interestPartPaise: z.number().int().min(0).optional(),
      date: z.string().optional(),
      accountId: z.string().optional(),
      notes: z.string().optional(),
    });
    const validated = paymentSchema.parse(req.body);
    const payment = await addLoanPayment(req.user!.id, req.params.id, validated);
    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await deleteLoan(req.user!.id, req.params.id);
    res.json({ success: true, message: 'Loan record deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

export default router;
