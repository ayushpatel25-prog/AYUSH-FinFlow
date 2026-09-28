import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../services/notificationService.js';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const list = await getUserNotifications(req.user!.id);
    res.json({ success: true, data: list });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/read', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const updated = await markNotificationAsRead(req.user!.id, req.params.id);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.post('/mark-all-read', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await markAllNotificationsAsRead(req.user!.id);
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    next(error);
  }
});

export default router;
