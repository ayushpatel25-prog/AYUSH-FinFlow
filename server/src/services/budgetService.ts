import prisma from '../prisma.js';
import { calculatePercentage } from '../utils/money.js';

export async function getUserBudgets(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  
  // Previous month for comparison
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const daysRemainingInMonth = Math.max(1, endOfMonth.getDate() - now.getDate());

  const budgets = await prisma.budget.findMany({
    where: { userId },
    include: { category: true },
    orderBy: { createdAt: 'desc' },
  });

  const enrichedBudgets = await Promise.all(
    budgets.map(async (b) => {
      // Find current period spending
      const currentWhere: any = {
        userId,
        type: 'EXPENSE',
        status: 'COMPLETED',
        date: { gte: startOfMonth, lte: endOfMonth },
      };
      if (b.categoryId) currentWhere.categoryId = b.categoryId;

      const currentSpentAgg = await prisma.transaction.aggregate({
        where: currentWhere,
        _sum: { amountPaise: true },
      });
      const currentSpentPaise = currentSpentAgg._sum.amountPaise || 0;

      // Find previous period spending for historical comparison
      const prevWhere: any = {
        userId,
        type: 'EXPENSE',
        status: 'COMPLETED',
        date: { gte: startOfPrevMonth, lte: endOfPrevMonth },
      };
      if (b.categoryId) prevWhere.categoryId = b.categoryId;

      const prevSpentAgg = await prisma.transaction.aggregate({
        where: prevWhere,
        _sum: { amountPaise: true },
      });
      const prevSpentPaise = prevSpentAgg._sum.amountPaise || 0;

      const remainingPaise = Math.max(0, b.amountPaise - currentSpentPaise);
      const isOverBudget = currentSpentPaise > b.amountPaise;
      const overAmountPaise = isOverBudget ? currentSpentPaise - b.amountPaise : 0;
      const percentage = calculatePercentage(currentSpentPaise, b.amountPaise);
      const dailyRecommendedPaise = remainingPaise > 0 ? Math.floor(remainingPaise / daysRemainingInMonth) : 0;

      // Historical comparison percentage change
      let historicalChangePct = 0;
      if (prevSpentPaise > 0) {
        historicalChangePct = Number((((currentSpentPaise - prevSpentPaise) / prevSpentPaise) * 100).toFixed(1));
      }

      return {
        ...b,
        currentSpentPaise,
        prevSpentPaise,
        remainingPaise,
        isOverBudget,
        overAmountPaise,
        percentage,
        dailyRecommendedPaise,
        historicalChangePct,
        daysRemainingInMonth,
      };
    })
  );

  return enrichedBudgets;
}

export async function createBudget(userId: string, data: {
  categoryId?: string;
  period?: string;
  amountPaise: number;
  alertThresholdPercent?: number;
  startDate?: string;
  endDate?: string;
}) {
  return await prisma.budget.create({
    data: {
      userId,
      categoryId: data.categoryId || null,
      period: data.period || 'MONTHLY',
      amountPaise: data.amountPaise,
      alertThresholdPercent: data.alertThresholdPercent || 80,
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      endDate: data.endDate ? new Date(data.endDate) : null,
    },
    include: { category: true },
  });
}

export async function updateBudget(userId: string, budgetId: string, data: {
  amountPaise?: number;
  alertThresholdPercent?: number;
  period?: string;
}) {
  const existing = await prisma.budget.findFirst({
    where: { id: budgetId, userId },
  });
  if (!existing) throw new Error('Budget not found or unauthorized.');

  return await prisma.budget.update({
    where: { id: budgetId },
    data,
    include: { category: true },
  });
}

export async function deleteBudget(userId: string, budgetId: string) {
  const existing = await prisma.budget.findFirst({
    where: { id: budgetId, userId },
  });
  if (!existing) throw new Error('Budget not found or unauthorized.');

  return await prisma.budget.delete({
    where: { id: budgetId },
  });
}
