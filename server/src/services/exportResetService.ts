import bcrypt from 'bcryptjs';
import prisma from '../prisma.js';

export async function exportAllUserData(userId: string) {
  const [
    user,
    accounts,
    categories,
    transactions,
    budgets,
    goals,
    goalContributions,
    trips,
    tripCategories,
    tripExpenses,
    loans,
    loanPayments,
    bills,
    insights,
    notifications,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, currency: true, currencySymbol: true, theme: true, accentColor: true, createdAt: true },
    }),
    prisma.account.findMany({ where: { userId } }),
    prisma.category.findMany({ where: { userId } }),
    prisma.transaction.findMany({ where: { userId }, include: { splits: true } }),
    prisma.budget.findMany({ where: { userId } }),
    prisma.goal.findMany({ where: { userId } }),
    prisma.goalContribution.findMany({ where: { userId } }),
    prisma.trip.findMany({ where: { userId } }),
    prisma.tripBudgetCategory.findMany({ where: { trip: { userId } } }),
    prisma.tripExpense.findMany({ where: { userId } }),
    prisma.loan.findMany({ where: { userId } }),
    prisma.loanPayment.findMany({ where: { userId } }),
    prisma.bill.findMany({ where: { userId } }),
    prisma.aIInsight.findMany({ where: { userId } }),
    prisma.notification.findMany({ where: { userId } }),
  ]);

  return {
    metadata: {
      exportedAt: new Date().toISOString(),
      formatVersion: '1.0',
      application: 'FinFlow Command Center',
    },
    user,
    accounts,
    categories,
    transactions,
    budgets,
    goals,
    goalContributions,
    trips,
    tripCategories,
    tripExpenses,
    loans,
    loanPayments,
    bills,
    insights,
    notifications,
  };
}

export function exportTransactionsAsCSV(transactions: any[]): string {
  const headers = ['ID', 'Date', 'Type', 'Amount (INR)', 'Description', 'Category', 'Account', 'Person', 'Tags', 'Status'];
  const rows = transactions.map(t => [
    `"${t.id}"`,
    `"${new Date(t.date).toISOString().split('T')[0]}"`,
    `"${t.type}"`,
    `"${(t.amountPaise / 100).toFixed(2)}"`,
    `"${(t.description || '').replace(/"/g, '""')}"`,
    `"${(t.category?.name || '').replace(/"/g, '""')}"`,
    `"${(t.account?.name || '').replace(/"/g, '""')}"`,
    `"${(t.person || '').replace(/"/g, '""')}"`,
    `"${(t.tags || '').replace(/"/g, '""')}"`,
    `"${t.status}"`,
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export async function resetFinancialData(userId: string, data: { confirmationText: string; password: string }) {
  if (data.confirmationText !== 'RESET') {
    throw new Error('Confirmation string mismatch. You must explicitly type "RESET" to confirm.');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found.');

  const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
  if (!isPasswordValid) {
    throw new Error('Password verification failed. Data reset aborted.');
  }

  // Atomically wipe financial records but preserve the user profile
  await prisma.$transaction(async (tx) => {
    // Delete transactions & splits
    await tx.transactionSplit.deleteMany({ where: { transaction: { userId } } });
    await tx.transaction.deleteMany({ where: { userId } });

    // Delete loan payments & loans
    await tx.loanPayment.deleteMany({ where: { userId } });
    await tx.loan.deleteMany({ where: { userId } });

    // Delete trip expenses, categories, trips
    await tx.tripExpense.deleteMany({ where: { userId } });
    await tx.tripBudgetCategory.deleteMany({ where: { trip: { userId } } });
    await tx.trip.deleteMany({ where: { userId } });

    // Delete goal contributions & goals
    await tx.goalContribution.deleteMany({ where: { userId } });
    await tx.goal.deleteMany({ where: { userId } });

    // Delete budgets
    await tx.budget.deleteMany({ where: { userId } });

    // Delete bills
    await tx.bill.deleteMany({ where: { userId } });

    // Delete insights & notifications
    await tx.aIInsight.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });

    // Reset account balances to 0 or opening balance
    await tx.account.updateMany({
      where: { userId },
      data: { currentBalancePaise: 0, openingBalancePaise: 0 },
    });

    // Record audit event
    await tx.auditEvent.create({
      data: {
        userId,
        action: 'DATA_RESET',
        entityType: 'USER_DATA',
        details: JSON.stringify({ timestamp: new Date(), ip: 'self' }),
      },
    });

    // Add confirmation notification
    await tx.notification.create({
      data: {
        userId,
        type: 'SYSTEM',
        title: 'Financial Data Reset Completed',
        message: 'All your previous transactions, debts, trips, and budgets have been permanently cleared as requested.',
      },
    });
  });

  return { success: true, message: 'All financial data has been permanently and safely reset.' };
}
