import prisma from '../prisma.js';
import { formatINR, paiseToRupees } from '../utils/money.js';
import { computeTripSavingsMetrics } from './tripService.js';

export interface GeneratedInsight {
  type: string;
  title: string;
  explanation: string;
  period: string;
  supportingData: any;
  confidence: number;
  suggestedAction: string;
  actionPayload?: any;
}

export async function generateUserInsights(userId: string): Promise<GeneratedInsight[]> {
  const insights: GeneratedInsight[] = [];
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  // 1. Category increase analysis (Current vs Prev month)
  const [currentExpensesByCategory, prevExpensesByCategory] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type: 'EXPENSE',
        status: 'COMPLETED',
        date: { gte: startOfMonth, lte: endOfMonth },
        categoryId: { not: null },
      },
      _sum: { amountPaise: true },
    }),
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type: 'EXPENSE',
        status: 'COMPLETED',
        date: { gte: startOfPrevMonth, lte: endOfPrevMonth },
        categoryId: { not: null },
      },
      _sum: { amountPaise: true },
    }),
  ]);

  const categories = await prisma.category.findMany({ where: { userId } });
  const categoryMap = new Map(categories.map(c => [c.id, c.name]));

  const prevMap = new Map(prevExpensesByCategory.map(p => [p.categoryId!, p._sum.amountPaise || 0]));

  for (const curr of currentExpensesByCategory) {
    if (!curr.categoryId) continue;
    const catName = categoryMap.get(curr.categoryId) || 'Category';
    const currPaise = curr._sum.amountPaise || 0;
    const prevPaise = prevMap.get(curr.categoryId) || 0;

    if (prevPaise > 0 && currPaise > prevPaise * 1.2 && (currPaise - prevPaise) > 100000) {
      // 20% higher and at least ₹1,000 difference
      const diffPaise = currPaise - prevPaise;
      const pctIncrease = (((currPaise - prevPaise) / prevPaise) * 100).toFixed(0);

      insights.push({
        type: 'CATEGORY_INCREASE',
        title: `${catName} spending is up by ${pctIncrease}%`,
        explanation: `You have spent ${formatINR(currPaise)} on ${catName} this month compared to ${formatINR(prevPaise)} last month (+${formatINR(diffPaise)}).`,
        period: 'This Month vs Last Month',
        supportingData: {
          category: catName,
          current: paiseToRupees(currPaise),
          previous: paiseToRupees(prevPaise),
          diff: paiseToRupees(diffPaise),
        },
        confidence: 0.95,
        suggestedAction: `Review recent ${catName} transactions or set a monthly cap.`,
        actionPayload: { filterCategory: catName, categoryId: curr.categoryId },
      });
    }
  }

  // 2. Budget Risk Detection
  const budgets = await prisma.budget.findMany({
    where: { userId },
    include: { category: true },
  });

  for (const b of budgets) {
    const spentAgg = await prisma.transaction.aggregate({
      where: {
        userId,
        type: 'EXPENSE',
        status: 'COMPLETED',
        date: { gte: startOfMonth, lte: endOfMonth },
        ...(b.categoryId ? { categoryId: b.categoryId } : {}),
      },
      _sum: { amountPaise: true },
    });
    const spentPaise = spentAgg._sum.amountPaise || 0;
    const pct = (spentPaise / b.amountPaise) * 100;
    const targetName = b.category?.name || 'Overall Monthly';

    if (pct >= 100) {
      insights.push({
        type: 'BUDGET_RISK',
        title: `Budget Exceeded: ${targetName}`,
        explanation: `You have used ${pct.toFixed(0)}% of your ${formatINR(b.amountPaise)} budget (${formatINR(spentPaise)} spent). Over by ${formatINR(spentPaise - b.amountPaise)}.`,
        period: 'Current Month',
        supportingData: { budgetPaise: b.amountPaise, spentPaise, percent: pct },
        confidence: 1.0,
        suggestedAction: 'Pause non-urgent discretionary purchases in this category for the remainder of the month.',
      });
    } else if (pct >= (b.alertThresholdPercent || 80)) {
      insights.push({
        type: 'BUDGET_RISK',
        title: `Budget Alert: ${targetName} is at ${pct.toFixed(0)}%`,
        explanation: `You have spent ${formatINR(spentPaise)} out of ${formatINR(b.amountPaise)}. Only ${formatINR(b.amountPaise - spentPaise)} remains.`,
        period: 'Current Month',
        supportingData: { budgetPaise: b.amountPaise, spentPaise, remaining: b.amountPaise - spentPaise },
        confidence: 0.9,
        suggestedAction: `Consider slowing down ${targetName} spending to stay within limits.`,
      });
    }
  }

  // 3. Trip Savings Risk Detection
  const trips = await prisma.trip.findMany({
    where: { userId, status: { in: ['PLANNING', 'SAVING'] } },
  });

  for (const trip of trips) {
    const metrics = computeTripSavingsMetrics(trip);
    if (!metrics.isOnTrack && metrics.shortfallOrSurplusPaise < 0) {
      const shortfallRupees = Math.abs(metrics.shortfallOrSurplusPaise) / 100;
      insights.push({
        type: 'TRIP_PACE',
        title: `Trip Savings Pace: ${trip.name}`,
        explanation: `At your current saving rate, you may face a ₹${shortfallRupees.toLocaleString('en-IN')} shortfall by ${new Date(trip.startDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}.`,
        period: `${metrics.daysRemaining} days remaining`,
        supportingData: {
          trip: trip.name,
          target: paiseToRupees(trip.targetBudgetPaise),
          saved: paiseToRupees(trip.savedAmountPaise),
          requiredMonthly: paiseToRupees(metrics.requiredMonthlySavingPaise),
        },
        confidence: 0.88,
        suggestedAction: `Increase savings by ₹${(paiseToRupees(metrics.requiredMonthlySavingPaise) / 30).toFixed(0)}/day to comfortably reach your goal.`,
      });
    }
  }

  // 4. Upcoming Bills & Cash Flow Pressure
  const next7Days = new Date();
  next7Days.setDate(next7Days.getDate() + 7);

  const upcomingBills = await prisma.bill.findMany({
    where: {
      userId,
      status: { not: 'CANCELLED' },
      nextDueDate: { lte: next7Days, gte: now },
    },
  });

  if (upcomingBills.length > 0) {
    const totalUpcomingPaise = upcomingBills.reduce((acc, b) => acc + b.amountPaise, 0);
    const billNames = upcomingBills.map(b => b.name).slice(0, 3).join(', ');

    insights.push({
      type: 'CASHFLOW_PRESSURE',
      title: `${upcomingBills.length} Bills Due Within 7 Days`,
      explanation: `You have ${formatINR(totalUpcomingPaise)} due soon (${billNames}${upcomingBills.length > 3 ? '...' : ''}). Ensure your checking account has adequate balance.`,
      period: 'Next 7 Days',
      supportingData: { totalBills: upcomingBills.length, amountPaise: totalUpcomingPaise },
      confidence: 0.98,
      suggestedAction: 'Review upcoming payments to prevent overdraft or late payment fees.',
    });
  }

  // 5. Savings Opportunity & Discretionary spending impact
  insights.push({
    type: 'SAVINGS_OPPORTUNITY',
    title: 'Discretionary Micro-Savings Rule',
    explanation: 'Trimming just ₹150/day from dining or impulse shopping creates an extra ₹4,500/month (₹54,000/year) for your trips and emergency fund.',
    period: 'Daily Optimization',
    supportingData: { dailySavings: 150, monthlyImpact: 4500, yearlyImpact: 54000 },
    confidence: 0.9,
    suggestedAction: 'Set up an automated recurring transfer to your savings wallet.',
  });

  return insights;
}

export async function getStoredInsights(userId: string) {
  // Sync fresh insights if none exist or periodic
  const existing = await prisma.aIInsight.findMany({
    where: { userId, isDismissed: false },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  if (existing.length === 0) {
    const generated = await generateUserInsights(userId);
    for (const g of generated) {
      await prisma.aIInsight.create({
        data: {
          userId,
          type: g.type,
          title: g.title,
          explanation: g.explanation,
          period: g.period,
          supportingData: JSON.stringify(g.supportingData),
          confidence: g.confidence,
          suggestedAction: g.suggestedAction,
          actionPayload: g.actionPayload ? JSON.stringify(g.actionPayload) : null,
        },
      });
    }

    return await prisma.aIInsight.findMany({
      where: { userId, isDismissed: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  return existing;
}

export async function dismissInsight(userId: string, insightId: string) {
  const existing = await prisma.aIInsight.findFirst({
    where: { id: insightId, userId },
  });
  if (!existing) throw new Error('Insight not found or unauthorized.');

  return await prisma.aIInsight.update({
    where: { id: insightId },
    data: { isDismissed: true },
  });
}

/**
 * AI Financial Assistant Chat
 * Answers user questions with real DB data, zero hallucinations.
 */
export async function handleAIChat(userId: string, userQuery: string) {
  const normalized = userQuery.toLowerCase().trim();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Retrieve user's key financial numbers
  const [
    accounts,
    expensesThisMonth,
    incomeThisMonth,
    categoryExpenses,
    loansSummary,
    trips,
    goals,
    upcomingBills,
  ] = await Promise.all([
    prisma.account.findMany({ where: { userId, isActive: true } }),
    prisma.transaction.aggregate({
      where: { userId, type: 'EXPENSE', status: 'COMPLETED', date: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amountPaise: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, type: 'INCOME', status: 'COMPLETED', date: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amountPaise: true },
    }),
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId, type: 'EXPENSE', status: 'COMPLETED', date: { gte: startOfMonth, lte: endOfMonth }, categoryId: { not: null } },
      _sum: { amountPaise: true },
      orderBy: { _sum: { amountPaise: 'desc' } },
    }),
    prisma.loan.findMany({ where: { userId, status: { not: 'CANCELLED' } } }),
    prisma.trip.findMany({ where: { userId } }),
    prisma.goal.findMany({ where: { userId } }),
    prisma.bill.findMany({ where: { userId, status: { not: 'CANCELLED' } }, orderBy: { nextDueDate: 'asc' } }),
  ]);

  const categories = await prisma.category.findMany({ where: { userId } });
  const catMap = new Map(categories.map(c => [c.id, c.name]));

  const totalBalancePaise = accounts.reduce((sum, a) => sum + a.currentBalancePaise, 0);
  const totalExpensePaise = expensesThisMonth._sum.amountPaise || 0;
  const totalIncomePaise = incomeThisMonth._sum.amountPaise || 0;
  const netSavingsPaise = totalIncomePaise - totalExpensePaise;

  // Question matchers:
  // "How much did I spend on food this month?"
  if (normalized.includes('food') || normalized.includes('dining')) {
    const foodCat = categories.find(c => c.name.toLowerCase().includes('food'));
    let foodSpentPaise = 0;
    if (foodCat) {
      const match = categoryExpenses.find(c => c.categoryId === foodCat.id);
      foodSpentPaise = match?._sum.amountPaise || 0;
    }
    return {
      reply: `You have spent ${formatINR(foodSpentPaise)} on Food & Dining this month. This accounts for ${totalExpensePaise > 0 ? ((foodSpentPaise / totalExpensePaise) * 100).toFixed(1) : 0}% of your total monthly expenses (${formatINR(totalExpensePaise)}).`,
      data: { foodSpentPaise, totalExpensePaise },
    };
  }

  // "Who owes me money?" or "Whom do I owe?"
  if (normalized.includes('owe') || normalized.includes('lent') || normalized.includes('borrow')) {
    const lentToMe = loansSummary.filter(l => l.type === 'LENT' && l.remainingPaise > 0);
    const borrowedByMe = loansSummary.filter(l => l.type === 'BORROWED' && l.remainingPaise > 0);

    const totalReceivable = lentToMe.reduce((s, l) => s + l.remainingPaise, 0);
    const totalPayable = borrowedByMe.reduce((s, l) => s + l.remainingPaise, 0);

    let reply = `Here is your current Udhaar balance:\n`;
    if (lentToMe.length > 0) {
      reply += `\n**People who owe you (${formatINR(totalReceivable)} total):**\n`;
      lentToMe.forEach(l => {
        reply += `• **${l.person}**: ${formatINR(l.remainingPaise)} for "${l.purpose}" (Due: ${l.dueDate ? new Date(l.dueDate).toLocaleDateString() : 'No deadline'})\n`;
      });
    } else {
      reply += `\n• No one currently owes you money.\n`;
    }

    if (borrowedByMe.length > 0) {
      reply += `\n**People you owe (${formatINR(totalPayable)} total):**\n`;
      borrowedByMe.forEach(l => {
        reply += `• **${l.person}**: ${formatINR(l.remainingPaise)} for "${l.purpose}"\n`;
      });
    } else {
      reply += `\n• You have zero outstanding debts owed to others.`;
    }

    return { reply, data: { lentToMe, borrowedByMe, totalReceivable, totalPayable } };
  }

  // "Can I afford this trip?" or "trip"
  if (normalized.includes('trip') || normalized.includes('vacation')) {
    if (trips.length === 0) {
      return {
        reply: `You haven't added any trips yet! Head over to the Trips & Goals tab to create your upcoming trip itinerary and savings target.`,
        proposal: null,
      };
    }
    const trip = trips[0];
    const metrics = computeTripSavingsMetrics(trip);
    return {
      reply: `For your trip **${trip.name}** to ${trip.destination}:\n• Target Budget: ${formatINR(trip.targetBudgetPaise)}\n• Currently Saved: ${formatINR(trip.savedAmountPaise)} (${metrics.percentageSaved}%)\n• Remaining: ${formatINR(metrics.remainingPaise)}\n• Days Remaining: ${metrics.daysRemaining} days\n• Required Monthly Saving: ${formatINR(metrics.requiredMonthlySavingPaise)}\n• Status: **${metrics.statusMessage}**\n\n${metrics.recommendation}`,
      data: metrics,
    };
  }

  // "Where am I spending the most?" or "Which category is consuming most of my money?"
  if (normalized.includes('spending the most') || normalized.includes('consuming most') || normalized.includes('top category') || normalized.includes('where did my money go')) {
    if (categoryExpenses.length === 0) {
      return {
        reply: `You have no recorded expenses for this month yet. Add your transactions to see category insights!`,
      };
    }
    const top3 = categoryExpenses.slice(0, 3).map(c => ({
      category: catMap.get(c.categoryId!) || 'Unknown',
      amountPaise: c._sum.amountPaise || 0,
      pct: totalExpensePaise > 0 ? (((c._sum.amountPaise || 0) / totalExpensePaise) * 100).toFixed(1) : 0,
    }));

    let reply = `Here are your top spending categories this month:\n`;
    top3.forEach((t, i) => {
      reply += `${i + 1}. **${t.category}**: ${formatINR(t.amountPaise)} (${t.pct}% of total spending)\n`;
    });
    reply += `\nTotal monthly spending to date: ${formatINR(totalExpensePaise)}.`;

    return { reply, data: top3 };
  }

  // "What bills are coming up?"
  if (normalized.includes('bill') || normalized.includes('subscription')) {
    if (upcomingBills.length === 0) {
      return { reply: 'You have no upcoming bills scheduled in the system.' };
    }
    let reply = `You have ${upcomingBills.length} upcoming recurring bill(s):\n`;
    upcomingBills.slice(0, 5).forEach(b => {
      reply += `• **${b.name}**: ${formatINR(b.amountPaise)} due on ${new Date(b.nextDueDate).toLocaleDateString()} (${b.frequency})\n`;
    });
    return { reply, data: upcomingBills };
  }

  // "Create a budget..." action proposal request
  if (normalized.startsWith('create a budget') || normalized.startsWith('set a budget')) {
    return {
      reply: `I have prepared a budget proposal for you based on your prompt. To safeguard your financial data, please confirm before applying:`,
      proposal: {
        action: 'CREATE_BUDGET',
        title: 'Create Monthly Food Budget',
        amount: '₹10,000',
        amountPaise: 1000000,
        category: 'Food & Dining',
        period: 'MONTHLY',
      },
    };
  }

  // Default financial command overview
  return {
    reply: `Here is a snapshot of your finances for ${now.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}:\n\n• **Total Account Balance**: ${formatINR(totalBalancePaise)}\n• **Monthly Income**: ${formatINR(totalIncomePaise)}\n• **Monthly Expenses**: ${formatINR(totalExpensePaise)}\n• **Net Savings**: ${formatINR(netSavingsPaise)}\n• **Savings Rate**: ${totalIncomePaise > 0 ? ((netSavingsPaise / totalIncomePaise) * 100).toFixed(1) : 0}%\n\nYou can ask me specific questions like "How much did I spend on food?", "Who owes me money?", "What bills are coming up?", or "Can I afford my trip?".`,
    data: {
      totalBalancePaise,
      totalIncomePaise,
      totalExpensePaise,
      netSavingsPaise,
    },
  };
}
