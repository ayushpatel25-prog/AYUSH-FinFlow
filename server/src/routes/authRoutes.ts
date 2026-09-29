import { Router } from 'express';
import { z } from 'zod';
import { registerUser, loginUser, updateProfile, changePassword } from '../services/authService.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

const emailSchema = z
  .string({ required_error: 'Email is required' })
  .min(1, 'Email is required')
  .transform((val) => val.trim().toLowerCase())
  .pipe(z.string().email('Please enter a valid email address'));

const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().trim().min(1, 'Name is required'),
  currency: z.string().optional(),
  currencySymbol: z.string().optional(),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

router.post('/register', async (req, res, next) => {
  try {
    const validated = registerSchema.parse(req.body);
    const result = await registerUser(validated);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const validated = loginSchema.parse(req.body);
    const result = await loginUser(validated);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, (req: AuthRequest, res) => {
  res.json({ success: true, data: req.user });
});

router.patch('/profile', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      name: z.string().optional(),
      currency: z.string().optional(),
      currencySymbol: z.string().optional(),
      accentColor: z.string().optional(),
      theme: z.string().optional(),
    });
    const validated = schema.parse(req.body);
    const updated = await updateProfile(req.user!.id, validated);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.post('/change-password', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(6),
    });
    const validated = schema.parse(req.body);
    const result = await changePassword(req.user!.id, validated);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
