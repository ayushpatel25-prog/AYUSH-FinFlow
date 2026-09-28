import prisma from '../prisma.js';
import { paiseToRupees } from '../utils/money.js';
import { computeTripSavingsMetrics } from './tripService.js';
import { getStoredInsights } from './aiService.js';

export async function getDashboardData(userId: string) {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  // Parallel database calls
  const [
    accounts,
    currentMonthIncomeAgg,
    currentMonthExpenseAgg,
    prevMonthIncomeAgg,
    prevMonthExpenseAgg,
    categories,
    budgets,
    trips,
    loans,
    bills,
    recentTransactions,
    aiInsights,
  ] = await Promise.all([
    // Active accounts
    prisma.account.findMany({ where: { userId, isActive: true } }),
    // Current month income
    prisma.transaction.aggregate({
      where: {
        userId,
        type: 'INCOME',
        status: 'COMPLETED',
        date: { gte: currentMonthStart, lte: currentMonthEnd },
      },
      _sum: { amountPaise: true },
    }),
    // Current month expense
    prisma.transaction.aggregate({
      where: {
        userId,
        type: { in: ['EXPENSE', 'TRIP_EXPENSE'] },
        status: 'COMPLETED',
        date: { gte: currentMonthStart, lte: currentMonthEnd },
      },
      _sum: { amountPaise: true },
    }),
    // Prev month income
    prisma.transaction.aggregate({
      where: {
        userId,
        type: 'INCOME',
        status: 'COMPLETED',
        date: { gte: prevMonthStart, lte: prevMonthEnd },
      },
      _sum: { amountPaise: true },
    }),
    // Prev month expense
    prisma.transaction.aggregate({
      where: {
        userId,
        type: { in: ['EXPENSE', 'TRIP_EXPENSE'] },
        status: 'COMPLETED',
        date: { gte: prevMonthStart, lte: prevMonthEnd },
      },
      _sum: { amountPaise: true },
    }),
    // Categories
    prisma.category.findMany({ where: { userId } }),
    // Budgets
    prisma.budget.findMany({
      where: { userId },
      include: { category: true },
    }),
    // Active Trips
    prisma.trip.findMany({
      where: { userId, status: { in: ['PLANNING', 'SAVING', 'ACTIVE'] } },
      take: 2,
      orderBy: { startDate: 'asc' },
    }),
    // Loans
    prisma.loan.findMany({
      where: { userId, status: { not: 'CANCELLED' } },
    }),
    // Upcoming bills in next 30 days
    prisma.bill.findMany({
      where: { userId, status: { not: 'CANCELLED' } },
      orderBy: { nextDueDate: 'asc' },
      take: 5,
    }),
    // Recent 7 transactions
    prisma.transaction.findMany({
      where: { userId, status: { not: 'ARCHIVED' } },
      orderBy: { date: 'desc' },
      take: 7,
      include: {
        category: true,
        account: true,
      },
    }),
    // AI insights
    getStoredInsights(userId),
  ]);

  // Total balance across active accounts
  const totalBalancePaise = accounts.reduce((acc, a) => acc + a.currentBalancePaise, 0);

  const currentIncomePaise = currentMonthIncomeAgg._sum.amountPaise || 0;
  const currentExpensePaise = currentMonthExpenseAgg._sum.amountPaise || 0;
  const prevIncomePaise = prevMonthIncomeAgg._sum.amountPaise || 0;
  const prevExpensePaise = prevMonthExpenseAgg._sum.amountPaise || 0;

  // Available to spend
  const availableToSpendPaise = Math.max(0, currentIncomePaise - currentExpensePaise);

  // Percentage changes
  const incomeChangePct = prevIncomePaise > 0
    ? Number((((currentIncomePaise - prevIncomePaise) / prevIncomePaise) * 100).toFixed(1))
    : 0;

  const expenseChangePct = prevExpensePaise > 0
    ? Number((((currentExpensePaise - prevExpensePaise) / prevExpensePaise) * 100).toFixed(1))
    : 0;

  // Financial Health Score Calculation (0 - 100)
  // Breakdown:
  // 1. Savings rate (max 25 pts): >=20% gets 25 pts
  let savingsPts = 10;
  if (currentIncomePaise > 0) {
    const savingsRate = (availableToSpendPaise / currentIncomePaise) * 100;
    if (savingsRate >= 30) savingsPts = 25;
    else if (savingsRate >= 20) savingsPts = 20;
    else if (savingsRate >= 10) savingsPts = 15;
    else if (savingsRate >= 0) savingsPts = 8;
    else savingsPts = 2;
  }

  // 2. Budget Control (max 25 pts)
  let budgetPts = 20;
  let overBudgetCount = 0;
  const enrichedBudgets = await Promise.all(
    budgets.map(async (b) => {
      const spent = await prisma.transaction.aggregate({
        where: {
          userId,
          type: 'EXPENSE',
          status: 'COMPLETED',
          date: { gte: currentMonthStart, lte: currentMonthEnd },
          ...(b.categoryId ? { categoryId: b.categoryId } : {}),
        },
        _sum: { amountPaise: true },
      });
      const spentPaise = spent._sum.amountPaise || 0;
      const pct = Math.round((spentPaise / b.amountPaise) * 100);
      if (pct > 100) overBudgetCount++;
      return {
        id: b.id,
        categoryName: b.category?.name || 'Overall',
        icon: b.category?.icon || 'pie-chart',
        color: b.category?.color || '#3b82f6',
        allocatedPaise: b.amountPaise,
        spentPaise,
        percent: pct,
        isOver: pct > 100,
      };
    })
  );
  if (overBudgetCount > 0) budgetPts = Math.max(5, 25 - overBudgetCount * 7);
  else if (budgets.length > 0) budgetPts = 24;

  // 3. Debt health (max 25 pts)
  const lentLoans = loans.filter(l => l.type === 'LENT');
  const borrowedLoans = loans.filter(l => l.type === 'BORROWED');
  const totalReceivablePaise = lentLoans.reduce((s, l) => s + l.remainingPaise, 0);
  const totalPayablePaise = borrowedLoans.reduce((s, l) => s + l.remainingPaise, 0);
  
  let debtPts = 25;
  if (totalPayablePaise > totalBalancePaise && totalBalancePaise > 0) debtPts = 10;
  else if (totalPayablePaise > 0) debtPts = 18;

  // 4. Spending consistency (max 25 pts)
  let consistencyPts = 20;
  if (expenseChangePct > 35) consistencyPts = 12;
  else if (expenseChangePct < 15) consistencyPts = 23;

  const healthScore = Math.min(100, Math.max(0, savingsPts + budgetPts + debtPts + consistencyPts));
  const healthExplanation = healthScore >= 80
    ? 'Excellent financial discipline! Strong savings rate, disciplined budget control, and low debt burden.'
    : healthScore >= 65
    ? 'Good financial health. Watch category budget overruns and prioritize paying down short-term debts.'
    : 'Attention recommended: Expenses are high relative to income, and some budgets have exceeded limits.';

  // Spending breakdown donut data
  const categoryExpenses = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: {
      userId,
      type: 'EXPENSE',
      status: 'COMPLETED',
      date: { gte: currentMonthStart, lte: currentMonthEnd },
      categoryId: { not: null },
    },
    _sum: { amountPaise: true },
    orderBy: { _sum: { amountPaise: 'desc' } },
  });

  const catMap = new Map(categories.map(c => [c.id, { name: c.name, color: c.color }]));
  const spendingBreakdown = categoryExpenses.map(ce => {
    const info = catMap.get(ce.categoryId!) || { name: 'Other', color: '#64748b' };
    return {
      categoryId: ce.categoryId,
      name: info.name,
      color: info.color,
      valueRupees: paiseToRupees(ce._sum.amountPaise || 0),
      amountPaise: ce._sum.amountPaise || 0,
      percentage: currentExpensePaise > 0 ? Number((((ce._sum.amountPaise || 0) / currentExpensePaise) * 100).toFixed(1)) : 0,
    };
  });

  // Cash flow series for 30 days & 6 months
  const cashFlow30d = await generateCashflowSeries(userId, 30);
  const cashFlow6m = await generateMonthlyCashflowSeries(userId, 6);

  // Trips with calculation
  const enrichedTrips = trips.map(t => {
    const calc = computeTripSavingsMetrics(t);
    return {
      id: t.id,
      name: t.name,
      destination: t.destination,
      startDate: t.startDate,
      targetBudgetPaise: t.targetBudgetPaise,
      savedAmountPaise: t.savedAmountPaise,
      calculation: calc,
    };
  });

  return {
    summary: {
      totalBalancePaise,
      monthlyIncomePaise: currentIncomePaise,
      monthlyExpensesPaise: currentExpensePaise,
      availableToSpendPaise,
      incomeChangePct,
      expenseChangePct,
    },
    health: {
      score: healthScore,
      breakdown: {
        savings: savingsPts,
        budgetControl: budgetPts,
        debt: debtPts,
        consistency: consistencyPts,
      },
      explanation: healthExplanation,
      disclaimer: 'This score is an informational heuristic based on your tracked data, not formal financial advice.',
    },
    cashFlow: {
      days30: cashFlow30d,
      months6: cashFlow6m,
    },
    spendingBreakdown,
    budgets: enrichedBudgets,
    tripWidget: enrichedTrips[0] || null,
    lendBorrow: {
      totalReceivablePaise,
      totalPayablePaise,
      activeLoansCount: loans.filter(l => l.remainingPaise > 0).length,
    },
    upcomingPayments: bills.map(b => ({
      id: b.id,
      name: b.name,
      amountPaise: b.amountPaise,
      nextDueDate: b.nextDueDate,
      category: b.category,
      frequency: b.frequency,
    })),
    recentTransactions: recentTransactions.map(t => ({
      id: t.id,
      description: t.description,
      type: t.type,
      amountPaise: t.amountPaise,
      date: t.date,
      accountName: t.account?.name || 'Account',
      categoryName: t.category?.name || 'Uncategorized',
      categoryColor: t.category?.color || '#64748b',
      categoryIcon: t.category?.icon || 'tag',
    })),
    aiInsights: aiInsights.slice(0, 3),
  };
}

async function generateCashflowSeries(userId: string, days: number) {
  const result = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
    const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

    const [income, expense] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId, type: 'INCOME', status: 'COMPLETED', date: { gte: dayStart, lte: dayEnd } },
        _sum: { amountPaise: true },
      }),
      prisma.transaction.aggregate({
        where: { userId, type: { in: ['EXPENSE', 'TRIP_EXPENSE'] }, status: 'COMPLETED', date: { gte: dayStart, lte: dayEnd } },
        _sum: { amountPaise: true },
      }),
    ]);

    const incRupees = paiseToRupees(income._sum.amountPaise || 0);
    const expRupees = paiseToRupees(expense._sum.amountPaise || 0);

    result.push({
      date: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      income: incRupees,
      expenses: expRupees,
      net: Number((incRupees - expRupees).toFixed(2)),
    });
  }
  return result;
}

async function generateMonthlyCashflowSeries(userId: string, monthsCount: number) {
  const result = [];
  const now = new Date();

  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

    const [income, expense] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId, type: 'INCOME', status: 'COMPLETED', date: { gte: monthStart, lte: monthEnd } },
        _sum: { amountPaise: true },
      }),
      prisma.transaction.aggregate({
        where: { userId, type: { in: ['EXPENSE', 'TRIP_EXPENSE'] }, status: 'COMPLETED', date: { gte: monthStart, lte: monthEnd } },
        _sum: { amountPaise: true },
      }),
    ]);

    const incRupees = paiseToRupees(income._sum.amountPaise || 0);
    const expRupees = paiseToRupees(expense._sum.amountPaise || 0);

    result.push({
      month: d.toLocaleDateString('en-IN', { month: 'short' }),
      income: incRupees,
      expenses: expRupees,
      net: Number((incRupees - expRupees).toFixed(2)),
    });
  }
  return result;
}
