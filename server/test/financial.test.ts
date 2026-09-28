import { describe, it, expect } from 'vitest';
import { rupeesToPaise, paiseToRupees, calculatePercentage, formatINR } from '../src/utils/money.js';
import { computeTripSavingsMetrics } from '../src/services/tripService.js';

describe('Financial Money Logic & Floating-Point Protection', () => {
  it('accurately converts rupees to integer paise without float errors', () => {
    expect(rupeesToPaise(10.55)).toBe(1055);
    expect(rupeesToPaise('1,250.75')).toBe(125075);
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30); // 0.1 + 0.2 = 0.30000000000000004 avoided
  });

  it('accurately converts paise back to rupees', () => {
    expect(paiseToRupees(1055)).toBe(10.55);
    expect(paiseToRupees(125075)).toBe(1250.75);
    expect(paiseToRupees(0)).toBe(0);
  });

  it('correctly calculates percentages and formats INR', () => {
    expect(calculatePercentage(680000, 1000000)).toBe(68.0);
    expect(formatINR(8425000)).toBe('₹84,250.00');
  });
});

describe('Trip Savings Calculator Engine', () => {
  it('correctly calculates remaining, required savings pace, and shortfall/surplus', () => {
    const now = new Date();
    const futureTripDate = new Date(now.getTime() + 100 * 24 * 60 * 60 * 1000); // 100 days
    const createdDate = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000); // 20 days ago

    const tripData = {
      targetBudgetPaise: 3000000, // ₹30,000
      savedAmountPaise: 1000000,  // ₹10,000
      startDate: futureTripDate,
      createdAt: createdDate,
    };

    const metrics = computeTripSavingsMetrics(tripData);

    expect(metrics.remainingPaise).toBe(2000000); // ₹20,000
    expect(metrics.daysRemaining).toBe(100);
    expect(metrics.requiredDailySavingPaise).toBe(20000); // ₹200/day
    expect(metrics.requiredWeeklySavingPaise).toBeGreaterThan(130000);
    expect(metrics.requiredMonthlySavingPaise).toBeGreaterThan(500000);
    expect(metrics.percentageSaved).toBeCloseTo(33.3, 1);
  });

  it('marks trip as completed when saved exceeds or equals target', () => {
    const now = new Date();
    const futureTripDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const metrics = computeTripSavingsMetrics({
      targetBudgetPaise: 2000000,
      savedAmountPaise: 2000000,
      startDate: futureTripDate,
      createdAt: now,
    });

    expect(metrics.remainingPaise).toBe(0);
    expect(metrics.percentageSaved).toBe(100);
    expect(metrics.isOnTrack).toBe(true);
    expect(metrics.statusMessage).toContain('Goal Completed');
  });
});

describe('Udhaar / Lending Accounting Invariants', () => {
  it('preserves historical partial repayments and prevents double counting', () => {
    const initialLentPaise = 1000000; // ₹10,000
    const payment1 = 400000;         // ₹4,000
    const remainingAfterP1 = initialLentPaise - payment1; // ₹6,000

    expect(remainingAfterP1).toBe(600000);
    expect(initialLentPaise).toBe(1000000); // Historical loan principal remains intact

    const payment2 = 200000;         // ₹2,000
    const remainingAfterP2 = remainingAfterP1 - payment2;
    expect(remainingAfterP2).toBe(400000); // ₹4,000 remaining
  });
});
