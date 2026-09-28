import prisma from '../prisma.js';
import { calculatePercentage } from '../utils/money.js';

export const DEFAULT_TRIP_CATEGORIES = [
  'Transportation',
  'Accommodation',
  'Food',
  'Local transport',
  'Activities',
  'Shopping',
  'Tickets',
  'Permits',
  'Emergency',
  'Miscellaneous',
];

export interface TripCalculation {
  targetBudgetPaise: number;
  savedAmountPaise: number;
  remainingPaise: number;
  percentageSaved: number;
  daysRemaining: number;
  weeksRemaining: number;
  monthsRemaining: number;
  requiredDailySavingPaise: number;
  requiredWeeklySavingPaise: number;
  requiredMonthlySavingPaise: number;
  currentPaceDailyPaise: number;
  projectedTotalSavingsPaise: number;
  shortfallOrSurplusPaise: number; // positive = surplus, negative = shortfall
  isOnTrack: boolean;
  statusMessage: string;
  recommendation: string;
}

export function computeTripSavingsMetrics(trip: {
  targetBudgetPaise: number;
  savedAmountPaise: number;
  startDate: Date;
  createdAt: Date;
}): TripCalculation {
  const now = new Date();
  const targetDate = new Date(trip.startDate);
  const diffTime = targetDate.getTime() - now.getTime();
  const daysRemaining = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  const weeksRemaining = Math.max(0.1, daysRemaining / 7);
  const monthsRemaining = Math.max(0.1, daysRemaining / 30);

  const remainingPaise = Math.max(0, trip.targetBudgetPaise - trip.savedAmountPaise);
  const percentageSaved = calculatePercentage(trip.savedAmountPaise, trip.targetBudgetPaise);

  const requiredDailySavingPaise = Math.ceil(remainingPaise / daysRemaining);
  const requiredWeeklySavingPaise = Math.ceil(remainingPaise / weeksRemaining);
  const requiredMonthlySavingPaise = Math.ceil(remainingPaise / monthsRemaining);

  // Calculate current pace based on time passed since creation
  const daysPassed = Math.max(1, Math.ceil((now.getTime() - new Date(trip.createdAt).getTime()) / (1000 * 60 * 60 * 24)));
  const currentPaceDailyPaise = Math.round(trip.savedAmountPaise / daysPassed);
  const projectedTotalSavingsPaise = trip.savedAmountPaise + (currentPaceDailyPaise * daysRemaining);
  const shortfallOrSurplusPaise = projectedTotalSavingsPaise - trip.targetBudgetPaise;
  const isOnTrack = shortfallOrSurplusPaise >= 0 || percentageSaved >= 100;

  let statusMessage = 'On Track';
  let recommendation = `Keep saving ₹${(requiredDailySavingPaise / 100).toFixed(0)}/day (₹${(requiredMonthlySavingPaise / 100).toFixed(0)}/month) to comfortably hit your goal!`;

  if (percentageSaved >= 100) {
    statusMessage = 'Goal Completed 🎉';
    recommendation = 'You have fully funded this trip budget! Enjoy your journey.';
  } else if (!isOnTrack) {
    const shortfall = Math.abs(shortfallOrSurplusPaise) / 100;
    statusMessage = 'Behind Schedule';
    recommendation = `At your current pace, you may be ₹${shortfall.toLocaleString('en-IN')} short. Consider increasing monthly savings by ₹${((shortfall / monthsRemaining)).toFixed(0)} or reducing non-essential expenses.`;
  }

  return {
    targetBudgetPaise: trip.targetBudgetPaise,
    savedAmountPaise: trip.savedAmountPaise,
    remainingPaise,
    percentageSaved,
    daysRemaining,
    weeksRemaining: Number(weeksRemaining.toFixed(1)),
    monthsRemaining: Number(monthsRemaining.toFixed(1)),
    requiredDailySavingPaise,
    requiredWeeklySavingPaise,
    requiredMonthlySavingPaise,
    currentPaceDailyPaise,
    projectedTotalSavingsPaise,
    shortfallOrSurplusPaise,
    isOnTrack,
    statusMessage,
    recommendation,
  };
}

export async function getUserTrips(userId: string) {
  const trips = await prisma.trip.findMany({
    where: { userId },
    include: {
      categories: true,
      expenses: {
        orderBy: { date: 'desc' },
      },
    },
    orderBy: { startDate: 'asc' },
  });

  return trips.map((trip) => {
    const calculation = computeTripSavingsMetrics(trip);
    const totalActualExpensePaise = trip.expenses.reduce((sum, e) => sum + e.amountPaise, 0);
    const totalEstimatedPaise = trip.categories.reduce((sum, c) => sum + c.estimatedPaise, 0);
    return {
      ...trip,
      calculation,
      totalActualExpensePaise,
      totalEstimatedPaise,
    };
  });
}

export async function getTripById(userId: string, tripId: string) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, userId },
    include: {
      categories: true,
      expenses: {
        orderBy: { date: 'desc' },
      },
    },
  });
  if (!trip) throw new Error('Trip not found or unauthorized.');

  const calculation = computeTripSavingsMetrics(trip);
  const totalActualExpensePaise = trip.expenses.reduce((sum, e) => sum + e.amountPaise, 0);
  const totalEstimatedPaise = trip.categories.reduce((sum, c) => sum + c.estimatedPaise, 0);

  return {
    ...trip,
    calculation,
    totalActualExpensePaise,
    totalEstimatedPaise,
  };
}

export async function createTrip(userId: string, data: {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers?: number;
  currency?: string;
  targetBudgetPaise: number;
  initialSavedPaise?: number;
  notes?: string;
  categories?: Array<{ category: string; estimatedPaise: number }>;
}) {
  return await prisma.$transaction(async (tx) => {
    const trip = await tx.trip.create({
      data: {
        userId,
        name: data.name.trim(),
        destination: data.destination.trim(),
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        travelers: data.travelers || 1,
        currency: data.currency || 'INR',
        targetBudgetPaise: data.targetBudgetPaise,
        savedAmountPaise: data.initialSavedPaise || 0,
        notes: data.notes,
        status: 'PLANNING',
      },
    });

    const categoryList = data.categories && data.categories.length > 0
      ? data.categories
      : DEFAULT_TRIP_CATEGORIES.map(cat => ({
          category: cat,
          estimatedPaise: Math.round(data.targetBudgetPaise / DEFAULT_TRIP_CATEGORIES.length),
        }));

    await tx.tripBudgetCategory.createMany({
      data: categoryList.map(c => ({
        tripId: trip.id,
        category: c.category,
        estimatedPaise: c.estimatedPaise,
        actualPaise: 0,
      })),
    });

    return trip;
  });
}

export async function addTripContribution(userId: string, tripId: string, data: {
  amountPaise: number;
  accountId: string;
  notes?: string;
}) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, userId },
  });
  if (!trip) throw new Error('Trip not found or unauthorized.');

  const account = await prisma.account.findFirst({
    where: { id: data.accountId, userId },
  });
  if (!account) throw new Error('Account not found or unauthorized.');

  return await prisma.$transaction(async (tx) => {
    const updatedTrip = await tx.trip.update({
      where: { id: tripId },
      data: { savedAmountPaise: { increment: data.amountPaise } },
    });

    // Deduct from account
    await tx.account.update({
      where: { id: data.accountId },
      data: { currentBalancePaise: { decrement: data.amountPaise } },
    });

    // Record as transaction
    await tx.transaction.create({
      data: {
        userId,
        accountId: data.accountId,
        tripId,
        type: 'EXPENSE',
        amountPaise: data.amountPaise,
        date: new Date(),
        description: `Trip Savings: ${trip.name}`,
        notes: data.notes || 'Contribution towards trip savings target',
        tags: 'trip,savings',
        status: 'COMPLETED',
      },
    });

    return updatedTrip;
  });
}

export async function addTripExpense(userId: string, tripId: string, data: {
  category: string;
  amountPaise: number;
  date: string;
  description: string;
  paidBy?: string;
  receiptUrl?: string;
  accountId?: string;
}) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, userId },
  });
  if (!trip) throw new Error('Trip not found or unauthorized.');

  return await prisma.$transaction(async (tx) => {
    const expense = await tx.tripExpense.create({
      data: {
        tripId,
        userId,
        category: data.category,
        amountPaise: data.amountPaise,
        date: new Date(data.date),
        description: data.description.trim(),
        paidBy: data.paidBy || 'Me',
        receiptUrl: data.receiptUrl,
      },
    });

    // Update actual on category
    const cat = await tx.tripBudgetCategory.findFirst({
      where: { tripId, category: data.category },
    });
    if (cat) {
      await tx.tripBudgetCategory.update({
        where: { id: cat.id },
        data: { actualPaise: { increment: data.amountPaise } },
      });
    }

    // If linked to an account, record transaction
    if (data.accountId) {
      await tx.account.update({
        where: { id: data.accountId },
        data: { currentBalancePaise: { decrement: data.amountPaise } },
      });

      await tx.transaction.create({
        data: {
          userId,
          accountId: data.accountId,
          tripId,
          type: 'TRIP_EXPENSE',
          amountPaise: data.amountPaise,
          date: new Date(data.date),
          description: `[Trip] ${data.description}`,
          notes: `Trip: ${trip.name} - ${data.category}`,
          tags: 'trip',
          status: 'COMPLETED',
        },
      });
    }

    return expense;
  });
}

export async function deleteTrip(userId: string, tripId: string) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, userId },
  });
  if (!trip) throw new Error('Trip not found or unauthorized.');

  return await prisma.trip.delete({
    where: { id: tripId },
  });
}
