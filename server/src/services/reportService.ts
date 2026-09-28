import prisma from '../prisma.js';
import { paiseToRupees } from '../utils/money.js';

export async function getMonthlyReport(userId: string, year: number, month: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const [
    incomeAgg,
    expenseAgg,
    categoryExpenses,
    largestTransactions,
    accounts,
    budgets,
  ] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId, type: 'INCOME', status: 'COMPLETED', date: { gte: startDate, lte: endDate } },
      _sum: { amountPaise: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, type: { in: ['EXPENSE', 'TRIP_EXPENSE'] }, status: 'COMPLETED', date: { gte: startDate, lte: endDate } },
      _sum: { amountPaise: true },
    }),
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId, type: 'EXPENSE', status: 'COMPLETED', date: { gte: startDate, lte: endDate }, categoryId: { not: null } },
      _sum: { amountPaise: true },
      orderBy: { _sum: { amountPaise: 'desc' } },
    }),
    prisma.transaction.findMany({
      where: { userId, type: 'EXPENSE', status: 'COMPLETED', date: { gte: startDate, lte: endDate } },
      orderBy: { amountPaise: 'desc' },
      take: 5,
      include: { category: true, account: true },
    }),
    prisma.account.findMany({ where: { userId, isActive: true } }),
    prisma.budget.findMany({ where: { userId }, include: { category: true } }),
  ]);

  const categories = await prisma.category.findMany({ where: { userId } });
  const catMap = new Map(categories.map(c => [c.id, c.name]));

  const totalIncomePaise = incomeAgg._sum.amountPaise || 0;
  const totalExpensePaise = expenseAgg._sum.amountPaise || 0;
  const netSavingsPaise = totalIncomePaise - totalExpensePaise;
  const savingsRate = totalIncomePaise > 0 ? Number(((netSavingsPaise / totalIncomePaise) * 100).toFixed(1)) : 0;

  const topCategories = categoryExpenses.map(ce => ({
    name: catMap.get(ce.categoryId!) || 'Other',
    amountPaise: ce._sum.amountPaise || 0,
    amountRupees: paiseToRupees(ce._sum.amountPaise || 0),
    percentage: totalExpensePaise > 0 ? Number((((ce._sum.amountPaise || 0) / totalExpensePaise) * 100).toFixed(1)) : 0,
  }));

  return {
    period: { year, month, label: startDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' }) },
    totalIncomePaise,
    totalExpensePaise,
    netSavingsPaise,
    savingsRate,
    topCategories,
    largestTransactions,
    accountBalances: accounts.map(a => ({ id: a.id, name: a.name, type: a.type, balancePaise: a.currentBalancePaise })),
  };
}

export async function getYearlyReport(userId: string, year: number) {
  const monthsData = [];

  for (let m = 0; m < 12; m++) {
    const startDate = new Date(year, m, 1);
    const endDate = new Date(year, m + 1, 0, 23, 59, 59, 999);

    const [income, expense] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId, type: 'INCOME', status: 'COMPLETED', date: { gte: startDate, lte: endDate } },
        _sum: { amountPaise: true },
      }),
      prisma.transaction.aggregate({
        where: { userId, type: { in: ['EXPENSE', 'TRIP_EXPENSE'] }, status: 'COMPLETED', date: { gte: startDate, lte: endDate } },
        _sum: { amountPaise: true },
      }),
    ]);

    const inc = paiseToRupees(income._sum.amountPaise || 0);
    const exp = paiseToRupees(expense._sum.amountPaise || 0);

    monthsData.push({
      month: startDate.toLocaleString('en-IN', { month: 'short' }),
      income: inc,
      expense: exp,
      net: Number((inc - exp).toFixed(2)),
    });
  }

  return {
    year,
    monthsData,
  };
}
