import prisma from '../prisma.js';

export async function performGlobalSearch(userId: string, query: string) {
  if (!query || query.trim().length === 0) {
    return {
      transactions: [],
      trips: [],
      goals: [],
      loans: [],
      bills: [],
      categories: [],
    };
  }

  const q = query.trim();
  const numericQuery = parseInt(q.replace(/[^0-9]/g, ''), 10);
  const numericPaise = !isNaN(numericQuery) ? numericQuery * 100 : undefined;

  const [transactions, trips, goals, loans, bills, categories] = await Promise.all([
    // Transactions
    prisma.transaction.findMany({
      where: {
        userId,
        OR: [
          { description: { contains: q } },
          { notes: { contains: q } },
          { person: { contains: q } },
          { tags: { contains: q } },
          ...(numericPaise ? [{ amountPaise: { equals: numericPaise } }] : []),
        ],
      },
      take: 8,
      include: { category: true, account: true },
      orderBy: { date: 'desc' },
    }),

    // Trips
    prisma.trip.findMany({
      where: {
        userId,
        OR: [
          { name: { contains: q } },
          { destination: { contains: q } },
          { notes: { contains: q } },
        ],
      },
      take: 5,
    }),

    // Goals
    prisma.goal.findMany({
      where: {
        userId,
        OR: [
          { name: { contains: q } },
          { category: { contains: q } },
          { notes: { contains: q } },
        ],
      },
      take: 5,
    }),

    // Loans / People
    prisma.loan.findMany({
      where: {
        userId,
        OR: [
          { person: { contains: q } },
          { purpose: { contains: q } },
          { notes: { contains: q } },
        ],
      },
      take: 5,
    }),

    // Bills
    prisma.bill.findMany({
      where: {
        userId,
        OR: [
          { name: { contains: q } },
          { category: { contains: q } },
        ],
      },
      take: 5,
    }),

    // Categories
    prisma.category.findMany({
      where: {
        userId,
        name: { contains: q },
      },
      take: 5,
    }),
  ]);

  return {
    transactions,
    trips,
    goals,
    loans,
    bills,
    categories,
  };
}
