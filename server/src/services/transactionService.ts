import prisma from '../prisma.js';
import { syncAccountBalance } from './accountService.js';

export interface CreateTransactionInput {
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  tripId?: string;
  goalId?: string;
  loanId?: string;
  type: string; // INCOME, EXPENSE, TRANSFER, LEND, BORROW, LOAN_REPAYMENT, TRIP_EXPENSE, GOAL_CONTRIBUTION
  amountPaise: number;
  date: Date | string;
  description: string;
  notes?: string;
  person?: string;
  tags?: string;
  receiptUrl?: string;
  isRecurring?: boolean;
  recurringFrequency?: string;
  splits?: Array<{ categoryId: string; amountPaise: number; notes?: string }>;
}

export async function createTransaction(userId: string, data: CreateTransactionInput) {
  // Validate accounts belong to user
  const account = await prisma.account.findFirst({
    where: { id: data.accountId, userId },
  });
  if (!account) throw new Error('Source account not found or unauthorized.');

  if (data.type === 'TRANSFER') {
    if (!data.toAccountId) throw new Error('Target account is required for transfers.');
    if (data.accountId === data.toAccountId) throw new Error('Source and destination accounts must be different.');
    const toAccount = await prisma.account.findFirst({
      where: { id: data.toAccountId, userId },
    });
    if (!toAccount) throw new Error('Destination account not found or unauthorized.');
  }

  const transaction = await prisma.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        userId,
        accountId: data.accountId,
        toAccountId: data.toAccountId,
        categoryId: data.categoryId,
        tripId: data.tripId,
        goalId: data.goalId,
        loanId: data.loanId,
        type: data.type,
        amountPaise: data.amountPaise,
        date: new Date(data.date),
        description: data.description.trim(),
        notes: data.notes?.trim(),
        person: data.person?.trim(),
        tags: data.tags?.trim(),
        receiptUrl: data.receiptUrl,
        isRecurring: !!data.isRecurring,
        recurringFrequency: data.recurringFrequency,
        status: 'COMPLETED',
        splits: data.splits && data.splits.length > 0 ? {
          create: data.splits.map(s => ({
            categoryId: s.categoryId,
            amountPaise: s.amountPaise,
            notes: s.notes,
          })),
        } : undefined,
      },
      include: {
        account: true,
        toAccount: true,
        category: true,
        splits: { include: { category: true } },
      },
    });

    // Update account balances atomically
    if (data.type === 'TRANSFER' && data.toAccountId) {
      await tx.account.update({
        where: { id: data.accountId },
        data: { currentBalancePaise: { decrement: data.amountPaise } },
      });
      await tx.account.update({
        where: { id: data.toAccountId },
        data: { currentBalancePaise: { increment: data.amountPaise } },
      });
    } else if (data.type === 'INCOME' || data.type === 'LOAN_REPAYMENT' || data.type === 'BORROW') {
      await tx.account.update({
        where: { id: data.accountId },
        data: { currentBalancePaise: { increment: data.amountPaise } },
      });
    } else {
      // EXPENSE, LEND, TRIP_EXPENSE, GOAL_CONTRIBUTION
      await tx.account.update({
        where: { id: data.accountId },
        data: { currentBalancePaise: { decrement: data.amountPaise } },
      });
    }

    // Handle Goal link
    if (data.goalId && data.type === 'GOAL_CONTRIBUTION') {
      await tx.goal.update({
        where: { id: data.goalId },
        data: { currentAmountPaise: { increment: data.amountPaise } },
      });
      await tx.goalContribution.create({
        data: {
          goalId: data.goalId,
          userId,
          accountId: data.accountId,
          amountPaise: data.amountPaise,
          date: new Date(data.date),
          notes: data.description,
        },
      });
    }

    // Handle Trip link
    if (data.tripId && data.type === 'TRIP_EXPENSE') {
      const tripCategory = data.description || 'General';
      await tx.tripExpense.create({
        data: {
          tripId: data.tripId,
          userId,
          category: tripCategory,
          amountPaise: data.amountPaise,
          date: new Date(data.date),
          description: data.description,
        },
      });
      // Also update TripBudgetCategory if exists
      const existingCat = await tx.tripBudgetCategory.findFirst({
        where: { tripId: data.tripId, category: tripCategory },
      });
      if (existingCat) {
        await tx.tripBudgetCategory.update({
          where: { id: existingCat.id },
          data: { actualPaise: { increment: data.amountPaise } },
        });
      }
    }

    return created;
  });

  return transaction;
}

export async function getTransactions(userId: string, filters: {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  type?: string;
  categoryId?: string;
  accountId?: string;
  tripId?: string;
  goalId?: string;
  loanId?: string;
  person?: string;
  search?: string;
  status?: string;
  minAmountPaise?: number;
  maxAmountPaise?: number;
  tag?: string;
  sort?: 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';
}) {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 30));
  const skip = (page - 1) * limit;

  const where: any = {
    userId,
    status: filters.status || { not: 'ARCHIVED' },
  };

  if (filters.startDate || filters.endDate) {
    where.date = {};
    if (filters.startDate) where.date.gte = new Date(filters.startDate);
    if (filters.endDate) where.date.lte = new Date(filters.endDate);
  }

  if (filters.type && filters.type !== 'ALL') {
    where.type = filters.type;
  }
  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }
  if (filters.accountId) {
    where.OR = [
      { accountId: filters.accountId },
      { toAccountId: filters.accountId },
    ];
  }
  if (filters.tripId) where.tripId = filters.tripId;
  if (filters.goalId) where.goalId = filters.goalId;
  if (filters.loanId) where.loanId = filters.loanId;
  if (filters.person) where.person = { contains: filters.person };
  if (filters.tag) where.tags = { contains: filters.tag };

  if (filters.minAmountPaise !== undefined || filters.maxAmountPaise !== undefined) {
    where.amountPaise = {};
    if (filters.minAmountPaise !== undefined) where.amountPaise.gte = filters.minAmountPaise;
    if (filters.maxAmountPaise !== undefined) where.amountPaise.lte = filters.maxAmountPaise;
  }

  if (filters.search) {
    const q = filters.search.trim();
    where.OR = [
      { description: { contains: q } },
      { notes: { contains: q } },
      { person: { contains: q } },
      { tags: { contains: q } },
    ];
  }

  let orderBy: any = { date: 'desc' };
  if (filters.sort === 'date_asc') orderBy = { date: 'asc' };
  if (filters.sort === 'amount_desc') orderBy = { amountPaise: 'desc' };
  if (filters.sort === 'amount_asc') orderBy = { amountPaise: 'asc' };

  const [total, items] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        account: { select: { id: true, name: true, type: true, color: true, icon: true } },
        toAccount: { select: { id: true, name: true, type: true, color: true, icon: true } },
        category: { select: { id: true, name: true, icon: true, color: true, type: true } },
        trip: { select: { id: true, name: true } },
        goal: { select: { id: true, name: true } },
        loan: { select: { id: true, person: true, type: true } },
        splits: { include: { category: true } },
      },
    }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function deleteTransaction(userId: string, transactionId: string) {
  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, userId },
  });
  if (!transaction) throw new Error('Transaction not found or unauthorized.');

  await prisma.transaction.delete({
    where: { id: transactionId },
  });

  // Re-sync account balances
  await syncAccountBalance(transaction.accountId);
  if (transaction.toAccountId) {
    await syncAccountBalance(transaction.toAccountId);
  }

  return { success: true };
}

export async function duplicateTransaction(userId: string, transactionId: string) {
  const original = await prisma.transaction.findFirst({
    where: { id: transactionId, userId },
    include: { splits: true },
  });
  if (!original) throw new Error('Transaction not found or unauthorized.');

  return await createTransaction(userId, {
    accountId: original.accountId,
    toAccountId: original.toAccountId || undefined,
    categoryId: original.categoryId || undefined,
    tripId: original.tripId || undefined,
    goalId: original.goalId || undefined,
    loanId: original.loanId || undefined,
    type: original.type,
    amountPaise: original.amountPaise,
    date: new Date(),
    description: `${original.description} (Copy)`,
    notes: original.notes || undefined,
    person: original.person || undefined,
    tags: original.tags || undefined,
    isRecurring: false,
    splits: original.splits.map(s => ({
      categoryId: s.categoryId,
      amountPaise: s.amountPaise,
      notes: s.notes || undefined,
    })),
  });
}
