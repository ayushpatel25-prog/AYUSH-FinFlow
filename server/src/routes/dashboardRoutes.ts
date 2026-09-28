import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { getDashboardData } from '../services/dashboardService.js';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const data = await getDashboardData(req.user!.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
