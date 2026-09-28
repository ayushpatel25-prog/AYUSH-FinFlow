import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import {
  exportAllUserData,
  exportTransactionsAsCSV,
  resetFinancialData,
} from '../services/exportResetService.js';
import prisma from '../prisma.js';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const data = await exportAllUserData(req.user!.id);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="finflow-backup-${Date.now()}.json"`);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/csv', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.user!.id },
      include: { category: true, account: true },
      orderBy: { date: 'desc' },
    });
    const csv = exportTransactionsAsCSV(transactions);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="finflow-transactions-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

router.post('/reset', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      confirmationText: z.literal('RESET', {
        errorMap: () => ({ message: 'You must type "RESET" in all capitals to confirm.' }),
      }),
      password: z.string().min(1, 'Password is required for identity re-verification.'),
    });

    const validated = schema.parse(req.body);
    const result = await resetFinancialData(req.user!.id, validated);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
