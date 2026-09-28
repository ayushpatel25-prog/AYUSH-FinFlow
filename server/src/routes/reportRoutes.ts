import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { getMonthlyReport, getYearlyReport } from '../services/reportService.js';

const router = Router();

router.get('/monthly', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const now = new Date();
    const year = req.query.year ? parseInt(req.query.year as string, 10) : now.getFullYear();
    const month = req.query.month ? parseInt(req.query.month as string, 10) : (now.getMonth() + 1);

    const report = await getMonthlyReport(req.user!.id, year, month);
    res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
});

router.get('/yearly', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const now = new Date();
    const year = req.query.year ? parseInt(req.query.year as string, 10) : now.getFullYear();

    const report = await getYearlyReport(req.user!.id, year);
    res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
});

export default router;
