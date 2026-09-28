import prisma from '../prisma.js';

export async function getUserAccounts(userId: string) {
  const accounts = await prisma.account.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: {
      _count: {
        select: { transactions: true },
      },
    },
  });

  return accounts;
}

export async function createAccount(userId: string, data: {
  name: string;
  type: string;
  openingBalancePaise: number;
  color?: string;
  icon?: string;
}) {
  return await prisma.account.create({
    data: {
      userId,
      name: data.name.trim(),
      type: data.type,
      openingBalancePaise: data.openingBalancePaise,
      currentBalancePaise: data.openingBalancePaise, // initially matches opening
      color: data.color || '#10b981',
      icon: data.icon || 'wallet',
    },
  });
}

export async function updateAccount(userId: string, accountId: string, data: {
  name?: string;
  type?: string;
  color?: string;
  icon?: string;
  isActive?: boolean;
}) {
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId },
  });
  if (!account) throw new Error('Account not found or unauthorized.');

  return await prisma.account.update({
    where: { id: accountId },
    data,
  });
}

export async function deleteAccount(userId: string, accountId: string) {
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId },
  });
  if (!account) throw new Error('Account not found or unauthorized.');

  return await prisma.account.delete({
    where: { id: accountId },
  });
}

/**
 * Re-computes accurate account balance based on opening balance and all non-archived transactions
 */
export async function syncAccountBalance(accountId: string) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
  });
  if (!account) return;

  const [inflow, outflow, incomingTransfers, outgoingTransfers] = await Promise.all([
    // ordinary income & repayment received into this account
    prisma.transaction.aggregate({
      where: {
        accountId,
        type: { in: ['INCOME', 'LOAN_REPAYMENT'] },
        status: 'COMPLETED',
      },
      _sum: { amountPaise: true },
    }),
    // ordinary expenses, lent money, goal contributions, trip expenses from this account
    prisma.transaction.aggregate({
      where: {
        accountId,
        type: { in: ['EXPENSE', 'LEND', 'GOAL_CONTRIBUTION', 'TRIP_EXPENSE'] },
        status: 'COMPLETED',
      },
      _sum: { amountPaise: true },
    }),
    // transfers arriving into this account
    prisma.transaction.aggregate({
      where: {
        toAccountId: accountId,
        type: 'TRANSFER',
        status: 'COMPLETED',
      },
      _sum: { amountPaise: true },
    }),
    // transfers leaving this account
    prisma.transaction.aggregate({
      where: {
        accountId,
        type: 'TRANSFER',
        status: 'COMPLETED',
      },
      _sum: { amountPaise: true },
    }),
  ]);

  const totalIn = (inflow._sum.amountPaise || 0) + (incomingTransfers._sum.amountPaise || 0);
  const totalOut = (outflow._sum.amountPaise || 0) + (outgoingTransfers._sum.amountPaise || 0);
  const computedBalance = account.openingBalancePaise + totalIn - totalOut;

  await prisma.account.update({
    where: { id: accountId },
    data: { currentBalancePaise: computedBalance },
  });

  return computedBalance;
}
