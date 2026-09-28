import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { performGlobalSearch } from '../services/searchService.js';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const q = (req.query.q as string) || '';
    const results = await performGlobalSearch(req.user!.id, q);
    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
});

export default router;
