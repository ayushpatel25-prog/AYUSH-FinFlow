import prisma from '../prisma.js';
import { calculatePercentage } from '../utils/money.js';

export async function getUserGoals(userId: string) {
  const goals = await prisma.goal.findMany({
    where: { userId },
    include: {
      contributions: {
        orderBy: { date: 'desc' },
      },
    },
    orderBy: [
      { priority: 'asc' },
      { targetDate: 'asc' },
    ],
  });

  const now = new Date();

  return goals.map((goal) => {
    const remainingPaise = Math.max(0, goal.targetAmountPaise - goal.currentAmountPaise);
    const percentage = calculatePercentage(goal.currentAmountPaise, goal.targetAmountPaise);

    const diffDays = Math.max(1, Math.ceil((new Date(goal.targetDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const monthsRemaining = Math.max(0.1, diffDays / 30);
    const requiredMonthlyPaise = Math.ceil(remainingPaise / monthsRemaining);

    let status = goal.status;
    if (percentage >= 100) {
      status = 'COMPLETED';
    } else if (diffDays <= 15 && percentage < 70) {
      status = 'BEHIND';
    } else if (diffDays <= 30 && percentage < 85) {
      status = 'AT_RISK';
    } else {
      status = 'ON_TRACK';
    }

    return {
      ...goal,
      remainingPaise,
      percentage,
      diffDays,
      monthsRemaining: Number(monthsRemaining.toFixed(1)),
      requiredMonthlyPaise,
      computedStatus: status,
    };
  });
}

export async function createGoal(userId: string, data: {
  name: string;
  category?: string;
  targetAmountPaise: number;
  initialAmountPaise?: number;
  targetDate: string;
  priority?: string;
  color?: string;
  icon?: string;
  notes?: string;
}) {
  return await prisma.goal.create({
    data: {
      userId,
      name: data.name.trim(),
      category: data.category || 'Savings',
      targetAmountPaise: data.targetAmountPaise,
      currentAmountPaise: data.initialAmountPaise || 0,
      targetDate: new Date(data.targetDate),
      priority: data.priority || 'MEDIUM',
      color: data.color || '#3b82f6',
      icon: data.icon || 'target',
      notes: data.notes,
      status: 'ON_TRACK',
    },
  });
}

export async function addGoalContribution(userId: string, goalId: string, data: {
  amountPaise: number;
  accountId?: string;
  notes?: string;
  date?: string;
}) {
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId },
  });
  if (!goal) throw new Error('Goal not found or unauthorized.');

  return await prisma.$transaction(async (tx) => {
    const contribution = await tx.goalContribution.create({
      data: {
        goalId,
        userId,
        accountId: data.accountId,
        amountPaise: data.amountPaise,
        date: data.date ? new Date(data.date) : new Date(),
        notes: data.notes,
      },
    });

    const updatedCurrent = goal.currentAmountPaise + data.amountPaise;
    const isCompleted = updatedCurrent >= goal.targetAmountPaise;

    await tx.goal.update({
      where: { id: goalId },
      data: {
        currentAmountPaise: updatedCurrent,
        status: isCompleted ? 'COMPLETED' : goal.status,
      },
    });

    // If deducted from account
    if (data.accountId) {
      await tx.account.update({
        where: { id: data.accountId },
        data: { currentBalancePaise: { decrement: data.amountPaise } },
      });

      await tx.transaction.create({
        data: {
          userId,
          accountId: data.accountId,
          goalId,
          type: 'GOAL_CONTRIBUTION',
          amountPaise: data.amountPaise,
          date: data.date ? new Date(data.date) : new Date(),
          description: `Goal Contribution: ${goal.name}`,
          notes: data.notes || 'Savings goal contribution',
          tags: 'goal,savings',
          status: 'COMPLETED',
        },
      });
    }

    return contribution;
  });
}

export async function deleteGoal(userId: string, goalId: string) {
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId },
  });
  if (!goal) throw new Error('Goal not found or unauthorized.');

  return await prisma.goal.delete({
    where: { id: goalId },
  });
}
