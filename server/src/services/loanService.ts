import prisma from '../prisma.js';
import { createLoanReceipt, createRepaymentReceipt } from './receiptService.js';

export async function getLoansSummary(userId: string) {
  const now = new Date();

  const loans = await prisma.loan.findMany({
    where: { userId },
    include: {
      payments: {
        orderBy: { date: 'desc' },
      },
      receipts: {
        include: { emailHistory: { orderBy: { createdAt: 'desc' } } },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Automatically mark overdue if past due date and not settled
  const updatedLoans = loans.map((l) => {
    let computedStatus = l.status;
    if (l.remainingPaise <= 0) {
      computedStatus = 'SETTLED';
    } else if (l.dueDate && new Date(l.dueDate) < now && l.status !== 'CANCELLED') {
      computedStatus = 'OVERDUE';
    } else if (l.remainingPaise < l.principalPaise) {
      computedStatus = 'PARTIALLY_PAID';
    } else {
      computedStatus = 'ACTIVE';
    }

    const totalPaidPaise = l.principalPaise - l.remainingPaise;
    return {
      ...l,
      computedStatus,
      totalPaidPaise,
    };
  });

  // Calculate aggregates
  const lentList = updatedLoans.filter(l => l.type === 'LENT');
  const borrowedList = updatedLoans.filter(l => l.type === 'BORROWED');

  const totalLentPaise = lentList.reduce((acc, l) => acc + l.principalPaise, 0);
  const totalReceivedPaise = lentList.reduce((acc, l) => acc + (l.principalPaise - l.remainingPaise), 0);
  const outstandingReceivablePaise = lentList.reduce((acc, l) => acc + (l.status !== 'CANCELLED' ? l.remainingPaise : 0), 0);

  const totalBorrowedPaise = borrowedList.reduce((acc, l) => acc + l.principalPaise, 0);
  const totalRepaidPaise = borrowedList.reduce((acc, l) => acc + (l.principalPaise - l.remainingPaise), 0);
  const outstandingPayablePaise = borrowedList.reduce((acc, l) => acc + (l.status !== 'CANCELLED' ? l.remainingPaise : 0), 0);

  const overdueList = updatedLoans.filter(l => l.computedStatus === 'OVERDUE');
  const overdueAmountPaise = overdueList.reduce((acc, l) => acc + l.remainingPaise, 0);

  return {
    loans: updatedLoans,
    lentList,
    borrowedList,
    totalLentPaise,
    totalReceivedPaise,
    outstandingReceivablePaise,
    totalBorrowedPaise,
    totalRepaidPaise,
    outstandingPayablePaise,
    overdueList,
    overdueAmountPaise,
    activeCount: updatedLoans.filter(l => ['ACTIVE', 'PARTIALLY_PAID', 'OVERDUE'].includes(l.computedStatus)).length,
  };
}

export async function createLoan(userId: string, data: {
  type: 'LENT' | 'BORROWED';
  person: string;
  principalPaise: number;
  date?: string;
  dueDate?: string;
  purpose: string;
  notes?: string;
  interestRate?: number;
  accountId?: string;
}) {
  const result = await prisma.$transaction(async (tx) => {
    const loan = await tx.loan.create({
      data: {
        userId,
        type: data.type,
        person: data.person.trim(),
        principalPaise: data.principalPaise,
        remainingPaise: data.principalPaise,
        interestRate: data.interestRate || 0,
        date: data.date ? new Date(data.date) : new Date(),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        purpose: data.purpose.trim(),
        notes: data.notes?.trim(),
        status: 'ACTIVE',
        accountId: data.accountId,
      },
    });

    // If linked to an account:
    // If LENT: money leaves user's account -> balance decrements
    // If BORROWED: money enters user's account -> balance increments
    if (data.accountId) {
      if (data.type === 'LENT') {
        await tx.account.update({
          where: { id: data.accountId },
          data: { currentBalancePaise: { decrement: data.principalPaise } },
        });
        await tx.transaction.create({
          data: {
            userId,
            accountId: data.accountId,
            loanId: loan.id,
            type: 'LEND',
            amountPaise: data.principalPaise,
            date: data.date ? new Date(data.date) : new Date(),
            description: `Lent to ${data.person}`,
            notes: data.purpose,
            person: data.person,
            tags: 'udhaar,lent',
            status: 'COMPLETED',
          },
        });
      } else {
        await tx.account.update({
          where: { id: data.accountId },
          data: { currentBalancePaise: { increment: data.principalPaise } },
        });
        await tx.transaction.create({
          data: {
            userId,
            accountId: data.accountId,
            loanId: loan.id,
            type: 'BORROW',
            amountPaise: data.principalPaise,
            date: data.date ? new Date(data.date) : new Date(),
            description: `Borrowed from ${data.person}`,
            notes: data.purpose,
            person: data.person,
            tags: 'udhaar,borrowed',
            status: 'COMPLETED',
          },
        });
      }
    }

    return loan;
  });

  // Generate receipt synchronously so it is available immediately in the API response
  let receipt = null;
  try {
    receipt = await createLoanReceipt(userId, result.id);
  } catch (err) {
    console.error('[LoanService] Receipt generation failed:', err);
  }

  return { ...result, receipt };
}

export async function addLoanPayment(userId: string, loanId: string, data: {
  amountPaise: number;
  principalPartPaise?: number;
  interestPartPaise?: number;
  date?: string;
  accountId?: string;
  notes?: string;
}) {
  const loan = await prisma.loan.findFirst({
    where: { id: loanId, userId },
  });
  if (!loan) throw new Error('Loan record not found or unauthorized.');

  const principalPart = data.principalPartPaise !== undefined ? data.principalPartPaise : data.amountPaise;
  const interestPart = data.interestPartPaise || 0;

  const paymentResult = await prisma.$transaction(async (tx) => {
    // Record payment history - never overwritten
    const payment = await tx.loanPayment.create({
      data: {
        loanId,
        userId,
        amountPaise: data.amountPaise,
        principalPartPaise: principalPart,
        interestPartPaise: interestPart,
        date: data.date ? new Date(data.date) : new Date(),
        accountId: data.accountId,
        notes: data.notes,
      },
    });

    const newRemaining = Math.max(0, loan.remainingPaise - principalPart);
    const newStatus = newRemaining === 0 ? 'SETTLED' : 'PARTIALLY_PAID';

    await tx.loan.update({
      where: { id: loanId },
      data: {
        remainingPaise: newRemaining,
        status: newStatus,
      },
    });

    // Account adjustments:
    // If LENT: repayment is RECEIVED into account -> balance increments
    // If BORROWED: repayment is PAID from account -> balance decrements
    if (data.accountId) {
      if (loan.type === 'LENT') {
        await tx.account.update({
          where: { id: data.accountId },
          data: { currentBalancePaise: { increment: data.amountPaise } },
        });
        await tx.transaction.create({
          data: {
            userId,
            accountId: data.accountId,
            loanId,
            type: 'LOAN_REPAYMENT',
            amountPaise: data.amountPaise,
            date: data.date ? new Date(data.date) : new Date(),
            description: `Repayment received from ${loan.person}`,
            notes: data.notes,
            person: loan.person,
            tags: 'udhaar,repayment_in',
            status: 'COMPLETED',
          },
        });
      } else {
        await tx.account.update({
          where: { id: data.accountId },
          data: { currentBalancePaise: { decrement: data.amountPaise } },
        });
        await tx.transaction.create({
          data: {
            userId,
            accountId: data.accountId,
            loanId,
            type: 'EXPENSE',
            amountPaise: data.amountPaise,
            date: data.date ? new Date(data.date) : new Date(),
            description: `Loan repayment to ${loan.person}`,
            notes: data.notes,
            person: loan.person,
            tags: 'udhaar,repayment_out',
            status: 'COMPLETED',
          },
        });
      }
    }

    return payment;
  });

  // Generate repayment receipt synchronously so it is available immediately
  let receipt = null;
  try {
    receipt = await createRepaymentReceipt(userId, loanId, paymentResult.id);
  } catch (err) {
    console.error('[LoanService] Repayment receipt generation failed:', err);
  }

  return { ...paymentResult, receipt };
}

export async function deleteLoan(userId: string, loanId: string) {
  const loan = await prisma.loan.findFirst({
    where: { id: loanId, userId },
  });
  if (!loan) throw new Error('Loan not found or unauthorized.');

  return await prisma.loan.delete({
    where: { id: loanId },
  });
}
