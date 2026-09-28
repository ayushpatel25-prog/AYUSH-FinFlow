import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting realistic financial database seeding...');

  // Clean existing demo user if present
  const existingUser = await prisma.user.findUnique({
    where: { email: 'demo@finflow.io' },
  });

  if (existingUser) {
    console.log('Cleaning existing demo data...');
    await prisma.transactionSplit.deleteMany({ where: { transaction: { userId: existingUser.id } } });
    await prisma.transaction.deleteMany({ where: { userId: existingUser.id } });
    await prisma.loanPayment.deleteMany({ where: { userId: existingUser.id } });
    await prisma.loan.deleteMany({ where: { userId: existingUser.id } });
    await prisma.tripExpense.deleteMany({ where: { userId: existingUser.id } });
    await prisma.tripBudgetCategory.deleteMany({ where: { trip: { userId: existingUser.id } } });
    await prisma.trip.deleteMany({ where: { userId: existingUser.id } });
    await prisma.goalContribution.deleteMany({ where: { userId: existingUser.id } });
    await prisma.goal.deleteMany({ where: { userId: existingUser.id } });
    await prisma.budget.deleteMany({ where: { userId: existingUser.id } });
    await prisma.bill.deleteMany({ where: { userId: existingUser.id } });
    await prisma.aIInsight.deleteMany({ where: { userId: existingUser.id } });
    await prisma.notification.deleteMany({ where: { userId: existingUser.id } });
    await prisma.account.deleteMany({ where: { userId: existingUser.id } });
    await prisma.category.deleteMany({ where: { userId: existingUser.id } });
    await prisma.user.delete({ where: { id: existingUser.id } });
  }

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create Demo User
  const user = await prisma.user.create({
    data: {
      email: 'demo@finflow.io',
      passwordHash,
      name: 'Aditya Sharma',
      currency: 'INR',
      currencySymbol: '₹',
      accentColor: 'indigo',
      theme: 'dark',
      monthlyIncomePaise: 8500000,
    },
  });

  console.log(`👤 Created user: ${user.name} (${user.email})`);

  // 2. Accounts
  const hdfc = await prisma.account.create({
    data: {
      userId: user.id,
      name: 'HDFC Salary Account',
      type: 'BANK',
      openingBalancePaise: 6500000, // ₹65,000
      currentBalancePaise: 7245000, // ₹72,450
      color: '#3b82f6',
      icon: 'building-2',
    },
  });

  const sbi = await prisma.account.create({
    data: {
      userId: user.id,
      name: 'SBI Emergency Savings',
      type: 'BANK',
      openingBalancePaise: 2500000, // ₹25,000
      currentBalancePaise: 2500000,
      color: '#10b981',
      icon: 'landmark',
    },
  });

  const wallet = await prisma.account.create({
    data: {
      userId: user.id,
      name: 'Paytm UPI Wallet',
      type: 'WALLET',
      openingBalancePaise: 350000, // ₹3,500
      currentBalancePaise: 480000,  // ₹4,800
      color: '#8b5cf6',
      icon: 'smartphone',
    },
  });

  const cash = await prisma.account.create({
    data: {
      userId: user.id,
      name: 'Cash in Hand',
      type: 'CASH',
      openingBalancePaise: 200000, // ₹2,000
      currentBalancePaise: 200000,
      color: '#06b6d4',
      icon: 'banknote',
    },
  });

  // 3. Categories
  const catFood = await prisma.category.create({
    data: { userId: user.id, name: 'Food & Dining', type: 'EXPENSE', icon: 'utensils', color: '#f97316' },
  });
  const catTravel = await prisma.category.create({
    data: { userId: user.id, name: 'Travel & Trips', type: 'EXPENSE', icon: 'plane', color: '#3b82f6' },
  });
  const catShopping = await prisma.category.create({
    data: { userId: user.id, name: 'Shopping', type: 'EXPENSE', icon: 'shopping-bag', color: '#ec4899' },
  });
  const catBills = await prisma.category.create({
    data: { userId: user.id, name: 'Bills & Utilities', type: 'EXPENSE', icon: 'receipt', color: '#eab308' },
  });
  const catEntertainment = await prisma.category.create({
    data: { userId: user.id, name: 'Entertainment', type: 'EXPENSE', icon: 'film', color: '#a855f7' },
  });
  const catHealth = await prisma.category.create({
    data: { userId: user.id, name: 'Health & Fitness', type: 'EXPENSE', icon: 'heart-pulse', color: '#ef4444' },
  });
  const catSalary = await prisma.category.create({
    data: { userId: user.id, name: 'Salary', type: 'INCOME', icon: 'briefcase', color: '#10b981' },
  });
  const catFreelance = await prisma.category.create({
    data: { userId: user.id, name: 'Freelance & Bonus', type: 'INCOME', icon: 'laptop', color: '#14b8a6' },
  });

  // 4. Budgets
  await prisma.budget.createMany({
    data: [
      {
        userId: user.id,
        categoryId: catFood.id,
        amountPaise: 1000000, // ₹10,000
        alertThresholdPercent: 80,
      },
      {
        userId: user.id,
        categoryId: catTravel.id,
        amountPaise: 800000, // ₹8,000
        alertThresholdPercent: 75,
      },
      {
        userId: user.id,
        categoryId: catShopping.id,
        amountPaise: 600000, // ₹6,000
        alertThresholdPercent: 90,
      },
    ],
  });

  // 5. Trip Planner & Calculator: Manali Snow Trip
  const now = new Date();
  const tripStartDate = new Date(now.getFullYear(), now.getMonth() + 2, 15);
  const tripEndDate = new Date(now.getFullYear(), now.getMonth() + 2, 21);

  const manaliTrip = await prisma.trip.create({
    data: {
      userId: user.id,
      name: 'Manali Winter Trip',
      destination: 'Manali, Himachal Pradesh',
      startDate: tripStartDate,
      endDate: tripEndDate,
      travelers: 2,
      currency: 'INR',
      targetBudgetPaise: 3000000, // ₹30,000
      savedAmountPaise: 1850000,  // ₹18,500 (61.7%)
      notes: 'Road trip via Chandigarh, stay in Old Manali, skiing at Solang Valley.',
      status: 'PLANNING',
    },
  });

  await prisma.tripBudgetCategory.createMany({
    data: [
      { tripId: manaliTrip.id, category: 'Transportation', estimatedPaise: 800000, actualPaise: 750000 },
      { tripId: manaliTrip.id, category: 'Accommodation', estimatedPaise: 1000000, actualPaise: 600000 },
      { tripId: manaliTrip.id, category: 'Food', estimatedPaise: 600000, actualPaise: 300000 },
      { tripId: manaliTrip.id, category: 'Activities', estimatedPaise: 400000, actualPaise: 200000 },
      { tripId: manaliTrip.id, category: 'Emergency', estimatedPaise: 200000, actualPaise: 0 },
    ],
  });

  // 6. Savings Goals
  const laptopGoal = await prisma.goal.create({
    data: {
      userId: user.id,
      name: 'MacBook Pro M3',
      category: 'Gadgets',
      targetAmountPaise: 14000000, // ₹1,40,000
      currentAmountPaise: 9500000,  // ₹95,000 (67.8%)
      targetDate: new Date(now.getFullYear(), now.getMonth() + 4, 1),
      priority: 'HIGH',
      status: 'ON_TRACK',
      color: '#3b82f6',
      icon: 'laptop',
      notes: 'Upgrade for freelance software development work.',
    },
  });

  // 7. Loans (Udhaar Module)
  // Lent to Rahul: ₹10,000 with ₹4,000 partial repayment received
  const rahulLoan = await prisma.loan.create({
    data: {
      userId: user.id,
      type: 'LENT',
      person: 'Rahul Verma',
      principalPaise: 1000000, // ₹10,000
      remainingPaise: 600000,  // ₹6,000 remaining
      interestRate: 0,
      date: new Date(now.getFullYear(), now.getMonth() - 1, 10),
      dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5),
      purpose: 'Emergency bike repair',
      notes: 'Promised to pay remaining ₹6,000 before month end.',
      status: 'PARTIALLY_PAID',
      accountId: hdfc.id,
    },
  });

  await prisma.loanPayment.create({
    data: {
      loanId: rahulLoan.id,
      userId: user.id,
      amountPaise: 400000,
      principalPartPaise: 400000,
      date: new Date(now.getFullYear(), now.getMonth(), 2),
      accountId: wallet.id,
      notes: 'First installment paid via GPay',
    },
  });

  // Borrowed from Priya: ₹3,000
  await prisma.loan.create({
    data: {
      userId: user.id,
      type: 'BORROWED',
      person: 'Priya Mehta',
      principalPaise: 300000,
      remainingPaise: 300000,
      date: new Date(now.getFullYear(), now.getMonth(), 12),
      dueDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      purpose: 'Concert tickets booking split',
      status: 'ACTIVE',
      accountId: wallet.id,
    },
  });

  // 8. Bills & Subscriptions
  await prisma.bill.createMany({
    data: [
      {
        userId: user.id,
        name: 'Apartment Rent',
        amountPaise: 1800000, // ₹18,000
        frequency: 'MONTHLY',
        dueDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        nextDueDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        category: 'Housing',
        accountId: hdfc.id,
      },
      {
        userId: user.id,
        name: 'Netflix Premium 4K',
        amountPaise: 64900, // ₹649
        frequency: 'MONTHLY',
        dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3),
        nextDueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3),
        category: 'Entertainment',
        accountId: wallet.id,
      },
      {
        userId: user.id,
        name: 'Airtel Broadband Fiber',
        amountPaise: 99900, // ₹999
        frequency: 'MONTHLY',
        dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6),
        nextDueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6),
        category: 'Bills & Utilities',
        accountId: hdfc.id,
      },
    ],
  });

  // 9. Realistic Transactions (Current & Previous Month)
  // Income
  await prisma.transaction.create({
    data: {
      userId: user.id,
      accountId: hdfc.id,
      categoryId: catSalary.id,
      type: 'INCOME',
      amountPaise: 8500000, // ₹85,000
      date: new Date(now.getFullYear(), now.getMonth(), 1),
      description: 'Monthly Salary Credit - Tech Corp',
      tags: 'salary,regular',
      status: 'COMPLETED',
    },
  });

  await prisma.transaction.create({
    data: {
      userId: user.id,
      accountId: hdfc.id,
      categoryId: catFreelance.id,
      type: 'INCOME',
      amountPaise: 2500000, // ₹25,000
      date: new Date(now.getFullYear(), now.getMonth(), 10),
      description: 'Client Website UI Design Retainer',
      tags: 'freelance,side-gig',
      status: 'COMPLETED',
    },
  });

  // Expenses with split transaction
  const splitTx = await prisma.transaction.create({
    data: {
      userId: user.id,
      accountId: hdfc.id,
      categoryId: catFood.id,
      type: 'EXPENSE',
      amountPaise: 240000, // ₹2,400
      date: new Date(now.getFullYear(), now.getMonth(), 8),
      description: 'Dinner & Bowling at Cyber Hub',
      notes: 'Split bill with colleagues: ₹1,500 dinner + ₹900 bowling',
      tags: 'dining,entertainment,team',
      status: 'COMPLETED',
    },
  });

  await prisma.transactionSplit.createMany({
    data: [
      { transactionId: splitTx.id, categoryId: catFood.id, amountPaise: 150000, notes: 'Italian dinner' },
      { transactionId: splitTx.id, categoryId: catEntertainment.id, amountPaise: 90000, notes: 'Bowling game' },
    ],
  });

  // Food transactions
  await prisma.transaction.createMany({
    data: [
      {
        userId: user.id,
        accountId: wallet.id,
        categoryId: catFood.id,
        type: 'EXPENSE',
        amountPaise: 68000, // ₹680
        date: new Date(now.getFullYear(), now.getMonth(), 12),
        description: 'Swiggy Gourmet Order',
        tags: 'food,online',
        status: 'COMPLETED',
      },
      {
        userId: user.id,
        accountId: hdfc.id,
        categoryId: catFood.id,
        type: 'EXPENSE',
        amountPaise: 420000, // ₹4,200
        date: new Date(now.getFullYear(), now.getMonth(), 5),
        description: 'Nature Basket Weekly Organic Groceries',
        tags: 'groceries',
        status: 'COMPLETED',
      },
      {
        userId: user.id,
        accountId: wallet.id,
        categoryId: catFood.id,
        type: 'EXPENSE',
        amountPaise: 44000, // ₹440
        date: new Date(now.getFullYear(), now.getMonth(), 16),
        description: 'Blue Tokai Specialty Coffee & Croissant',
        tags: 'cafe,coffee',
        status: 'COMPLETED',
      },
    ],
  });

  // Shopping (Over budget demo: ₹7,200 spent on ₹6,000 budget = 120%)
  await prisma.transaction.createMany({
    data: [
      {
        userId: user.id,
        accountId: hdfc.id,
        categoryId: catShopping.id,
        type: 'EXPENSE',
        amountPaise: 450000, // ₹4,500
        date: new Date(now.getFullYear(), now.getMonth(), 4),
        description: 'Zara Autumn Jacket & Shirt',
        tags: 'fashion,shopping',
        status: 'COMPLETED',
      },
      {
        userId: user.id,
        accountId: wallet.id,
        categoryId: catShopping.id,
        type: 'EXPENSE',
        amountPaise: 270000, // ₹2,700
        date: new Date(now.getFullYear(), now.getMonth(), 14),
        description: 'Amazon Prime electronics accessory',
        tags: 'gadgets,shopping',
        status: 'COMPLETED',
      },
    ],
  });

  // Transfer transaction: ₹5,000 from HDFC to Paytm Wallet
  await prisma.transaction.create({
    data: {
      userId: user.id,
      accountId: hdfc.id,
      toAccountId: wallet.id,
      type: 'TRANSFER',
      amountPaise: 500000,
      date: new Date(now.getFullYear(), now.getMonth(), 3),
      description: 'Transfer to UPI wallet for monthly expenses',
      tags: 'transfer',
      status: 'COMPLETED',
    },
  });

  // 10. AI Insights
  await prisma.aIInsight.createMany({
    data: [
      {
        userId: user.id,
        type: 'CATEGORY_INCREASE',
        title: 'Food & Dining spending is up by 23%',
        explanation: 'Your food spending reached ₹6,820 this month, which is 23% higher than your recent monthly average. Dining out accounted for the majority of this change.',
        period: 'September 2026',
        supportingData: JSON.stringify({ current: 6820, previous: 5540, diff: 1280 }),
        confidence: 0.94,
        suggestedAction: 'Consider cooking at home during weekdays to keep monthly food spending within your ₹10,000 target.',
      },
      {
        userId: user.id,
        type: 'BUDGET_RISK',
        title: 'Shopping Budget Exceeded by 20%',
        explanation: 'You have spent ₹7,200 on Shopping against your ₹6,000 monthly limit (120% utilized).',
        period: 'Current Month',
        supportingData: JSON.stringify({ budgetPaise: 600000, spentPaise: 720000, percent: 120 }),
        confidence: 1.0,
        suggestedAction: 'Pause non-urgent shopping purchases for the next 15 days to maintain monthly cash flow.',
      },
      {
        userId: user.id,
        type: 'TRIP_PACE',
        title: 'Manali Trip Savings: On Track',
        explanation: 'You have saved ₹18,500 of ₹30,000 (61.7%). Required monthly saving is ₹3,833 to comfortably hit your goal by mid-December.',
        period: '70 days remaining',
        supportingData: JSON.stringify({ target: 30000, saved: 18500, requiredMonthly: 3833 }),
        confidence: 0.92,
        suggestedAction: 'Deposit your next ₹3,833 installment to stay ahead of flight booking prices.',
      },
    ],
  });

  // 11. Notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: user.id,
        type: 'BUDGET_EXCEEDED',
        title: 'Shopping Budget Alert ⚠️',
        message: 'You have spent ₹7,200 of your ₹6,000 monthly shopping budget (120%).',
        link: '/budgets',
      },
      {
        userId: user.id,
        type: 'LOAN_DUE',
        title: 'Upcoming Udhaar Repayment Due',
        message: 'Rahul Verma has a pending repayment of ₹6,000 due this week.',
        link: '/loans',
      },
      {
        userId: user.id,
        type: 'BILL_DUE',
        title: 'Netflix Subscription Due in 3 Days',
        message: '₹649 will be due on your registered wallet.',
        link: '/bills',
      },
    ],
  });

  console.log('✅ Realistic seed data successfully created for demo@finflow.io!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
