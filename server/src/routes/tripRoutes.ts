import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import {
  getUserTrips,
  getTripById,
  createTrip,
  addTripContribution,
  addTripExpense,
  deleteTrip,
} from '../services/tripService.js';

const router = Router();

const tripSchema = z.object({
  name: z.string().min(1, 'Trip name is required'),
  destination: z.string().min(1, 'Destination is required'),
  startDate: z.string(),
  endDate: z.string(),
  travelers: z.number().int().min(1).default(1),
  currency: z.string().default('INR'),
  targetBudgetPaise: z.number().int().positive(),
  initialSavedPaise: z.number().int().min(0).default(0),
  notes: z.string().optional(),
  categories: z.array(z.object({
    category: z.string(),
    estimatedPaise: z.number().int().min(0),
  })).optional(),
});

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const trips = await getUserTrips(req.user!.id);
    res.json({ success: true, data: trips });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const trip = await getTripById(req.user!.id, req.params.id);
    res.json({ success: true, data: trip });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const validated = tripSchema.parse(req.body);
    const created = await createTrip(req.user!.id, validated);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/contributions', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      amountPaise: z.number().int().positive(),
      accountId: z.string().min(1),
      notes: z.string().optional(),
    });
    const validated = schema.parse(req.body);
    const updated = await addTripContribution(req.user!.id, req.params.id, validated);
    res.status(201).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/expenses', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      category: z.string().min(1),
      amountPaise: z.number().int().positive(),
      date: z.string(),
      description: z.string().min(1),
      paidBy: z.string().optional(),
      receiptUrl: z.string().optional(),
      accountId: z.string().optional(),
    });
    const validated = schema.parse(req.body);
    const expense = await addTripExpense(req.user!.id, req.params.id, validated);
    res.status(201).json({ success: true, data: expense });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await deleteTrip(req.user!.id, req.params.id);
    res.json({ success: true, message: 'Trip deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

export default router;
