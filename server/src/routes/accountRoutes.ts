import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { getUserAccounts, createAccount, updateAccount, deleteAccount } from '../services/accountService.js';

const router = Router();

const accountSchema = z.object({
  name: z.string().min(1, 'Account name is required'),
  type: z.enum(['BANK', 'CASH', 'WALLET', 'CREDIT_CARD', 'INVESTMENT', 'OTHER']),
  openingBalancePaise: z.number().int().default(0),
  color: z.string().optional(),
  icon: z.string().optional(),
});

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const accounts = await getUserAccounts(req.user!.id);
    res.json({ success: true, data: accounts });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const validated = accountSchema.parse(req.body);
    const created = await createAccount(req.user!.id, validated);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const updateSchema = z.object({
      name: z.string().optional(),
      type: z.enum(['BANK', 'CASH', 'WALLET', 'CREDIT_CARD', 'INVESTMENT', 'OTHER']).optional(),
      color: z.string().optional(),
      icon: z.string().optional(),
      isActive: z.boolean().optional(),
    });
    const validated = updateSchema.parse(req.body);
    const updated = await updateAccount(req.user!.id, req.params.id, validated);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await deleteAccount(req.user!.id, req.params.id);
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
