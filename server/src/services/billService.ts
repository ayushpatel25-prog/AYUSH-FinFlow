import prisma from '../prisma.js';

export async function getUserBills(userId: string) {
  const now = new Date();

  const bills = await prisma.bill.findMany({
    where: { userId },
    include: { account: true },
    orderBy: { nextDueDate: 'asc' },
  });

  return bills.map((bill) => {
    const diffDays = Math.ceil((new Date(bill.nextDueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    let computedStatus = bill.status;
    if (bill.status !== 'CANCELLED') {
      if (diffDays < 0) computedStatus = 'OVERDUE';
      else if (diffDays <= 7) computedStatus = 'UPCOMING';
    }

    return {
      ...bill,
      diffDays,
      computedStatus,
    };
  });
}

export async function createBill(userId: string, data: {
  name: string;
  amountPaise: number;
  frequency?: string;
  dueDate: string;
  category?: string;
  accountId?: string;
  autoRenew?: boolean;
  reminderDays?: number;
}) {
  const dDate = new Date(data.dueDate);
  return await prisma.bill.create({
    data: {
      userId,
      name: data.name.trim(),
      amountPaise: data.amountPaise,
      frequency: data.frequency || 'MONTHLY',
      dueDate: dDate,
      nextDueDate: dDate,
      category: data.category || 'Bills & Utilities',
      accountId: data.accountId,
      autoRenew: data.autoRenew !== undefined ? data.autoRenew : true,
      reminderDays: data.reminderDays || 3,
      status: 'UPCOMING',
    },
    include: { account: true },
  });
}

export async function payBill(userId: string, billId: string, data?: { accountId?: string }) {
  const bill = await prisma.bill.findFirst({
    where: { id: billId, userId },
  });
  if (!bill) throw new Error('Bill not found or unauthorized.');

  const payAccountId = data?.accountId || bill.accountId;

  return await prisma.$transaction(async (tx) => {
    // Advance nextDueDate based on frequency
    const currentDue = new Date(bill.nextDueDate);
    const nextDue = new Date(currentDue);
    if (bill.frequency === 'WEEKLY') {
      nextDue.setDate(nextDue.getDate() + 7);
    } else if (bill.frequency === 'YEARLY') {
      nextDue.setFullYear(nextDue.getFullYear() + 1);
    } else if (bill.frequency === 'QUARTERLY') {
      nextDue.setMonth(nextDue.getMonth() + 3);
    } else {
      // MONTHLY
      nextDue.setMonth(nextDue.getMonth() + 1);
    }

    const updated = await tx.bill.update({
      where: { id: billId },
      data: {
        dueDate: currentDue,
        nextDueDate: nextDue,
        status: 'PAID',
      },
    });

    if (payAccountId) {
      await tx.account.update({
        where: { id: payAccountId },
        data: { currentBalancePaise: { decrement: bill.amountPaise } },
      });

      await tx.transaction.create({
        data: {
          userId,
          accountId: payAccountId,
          type: 'EXPENSE',
          amountPaise: bill.amountPaise,
          date: new Date(),
          description: `Bill Payment: ${bill.name}`,
          notes: `Recurring ${bill.frequency} bill`,
          tags: 'bill,recurring',
          isRecurring: true,
          status: 'COMPLETED',
        },
      });
    }

    return updated;
  });
}

export async function deleteBill(userId: string, billId: string) {
  const bill = await prisma.bill.findFirst({
    where: { id: billId, userId },
  });
  if (!bill) throw new Error('Bill not found or unauthorized.');

  return await prisma.bill.delete({
    where: { id: billId },
  });
}
