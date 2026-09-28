import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import {
  createTransaction,
  getTransactions,
  deleteTransaction,
  duplicateTransaction,
} from '../services/transactionService.js';
import prisma from '../prisma.js';

const router = Router();

const transactionSchema = z.object({
  accountId: z.string().min(1),
  toAccountId: z.string().optional(),
  categoryId: z.string().optional(),
  tripId: z.string().optional(),
  goalId: z.string().optional(),
  loanId: z.string().optional(),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER', 'LEND', 'BORROW', 'LOAN_REPAYMENT', 'TRIP_EXPENSE', 'GOAL_CONTRIBUTION']),
  amountPaise: z.number().int().positive('Amount must be positive'),
  date: z.string().or(z.date()),
  description: z.string().min(1, 'Description is required'),
  notes: z.string().optional(),
  person: z.string().optional(),
  tags: z.string().optional(),
  receiptUrl: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurringFrequency: z.string().optional(),
  splits: z.array(z.object({
    categoryId: z.string(),
    amountPaise: z.number().int().positive(),
    notes: z.string().optional(),
  })).optional(),
});

// Get Categories
router.get('/categories', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { userId: req.user!.id },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
});

// Create Category
router.post('/categories', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      type: z.enum(['EXPENSE', 'INCOME']),
      icon: z.string().optional(),
      color: z.string().optional(),
    });
    const validated = schema.parse(req.body);
    const created = await prisma.category.create({
      data: {
        userId: req.user!.id,
        name: validated.name.trim(),
        type: validated.type,
        icon: validated.icon || 'tag',
        color: validated.color || '#64748b',
      },
    });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
});

// Get Transactions
router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const {
      page,
      limit,
      startDate,
      endDate,
      type,
      categoryId,
      accountId,
      tripId,
      goalId,
      loanId,
      person,
      search,
      status,
      minAmountPaise,
      maxAmountPaise,
      tag,
      sort,
    } = req.query;

    const result = await getTransactions(req.user!.id, {
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      startDate: startDate as string,
      endDate: endDate as string,
      type: type as string,
      categoryId: categoryId as string,
      accountId: accountId as string,
      tripId: tripId as string,
      goalId: goalId as string,
      loanId: loanId as string,
      person: person as string,
      search: search as string,
      status: status as string,
      minAmountPaise: minAmountPaise ? parseInt(minAmountPaise as string, 10) : undefined,
      maxAmountPaise: maxAmountPaise ? parseInt(maxAmountPaise as string, 10) : undefined,
      tag: tag as string,
      sort: sort as any,
    });

    res.json({ success: true, data: result.items, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
});

// Create Transaction
router.post('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const validated = transactionSchema.parse(req.body);
    const result = await createTransaction(req.user!.id, validated);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Duplicate Transaction
router.post('/:id/duplicate', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const result = await duplicateTransaction(req.user!.id, req.params.id);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Delete Transaction
router.delete('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const result = await deleteTransaction(req.user!.id, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
