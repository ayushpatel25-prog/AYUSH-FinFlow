import bcrypt from 'bcryptjs';
import prisma from '../prisma.js';
import { generateToken } from '../middleware/auth.js';

export const DEFAULT_CATEGORIES = [
  { name: 'Food & Dining', type: 'EXPENSE', icon: 'utensils', color: '#f97316' },
  { name: 'Travel & Vacation', type: 'EXPENSE', icon: 'plane', color: '#3b82f6' },
  { name: 'Shopping', type: 'EXPENSE', icon: 'shopping-bag', color: '#ec4899' },
  { name: 'Bills & Utilities', type: 'EXPENSE', icon: 'receipt', color: '#eab308' },
  { name: 'Entertainment', type: 'EXPENSE', icon: 'film', color: '#a855f7' },
  { name: 'Health & Fitness', type: 'EXPENSE', icon: 'heart-pulse', color: '#ef4444' },
  { name: 'Education', type: 'EXPENSE', icon: 'graduation-cap', color: '#06b6d4' },
  { name: 'Transportation', type: 'EXPENSE', icon: 'car', color: '#64748b' },
  { name: 'Other Expense', type: 'EXPENSE', icon: 'tag', color: '#78716c' },
  { name: 'Salary', type: 'INCOME', icon: 'briefcase', color: '#10b981' },
  { name: 'Freelance & Side Gig', type: 'INCOME', icon: 'laptop', color: '#14b8a6' },
  { name: 'Investments & Dividends', type: 'INCOME', icon: 'trending-up', color: '#22c55e' },
  { name: 'Other Income', type: 'INCOME', icon: 'wallet', color: '#84cc16' },
];

export async function registerUser(data: {
  email: string;
  password: string;
  name: string;
  currency?: string;
  currencySymbol?: string;
}) {
  const normalizedEmail = data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    throw new Error('An account with this email address already exists. Please sign in instead.');
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: data.name.trim(),
        currency: data.currency || 'INR',
        currencySymbol: data.currencySymbol || '₹',
        theme: 'dark',
        accentColor: 'emerald',
      },
    });

    if (!user || !user.id) {
      throw new Error('Database insertion failed. Account could not be created.');
    }

    // Create default accounts
    await tx.account.createMany({
      data: [
        {
          userId: user.id,
          name: 'Primary Bank Account',
          type: 'BANK',
          openingBalancePaise: 5000000, // ₹50,000
          currentBalancePaise: 5000000,
          color: '#10b981',
          icon: 'building-2',
        },
        {
          userId: user.id,
          name: 'Cash in Hand',
          type: 'CASH',
          openingBalancePaise: 500000, // ₹5,000
          currentBalancePaise: 500000,
          color: '#06b6d4',
          icon: 'banknote',
        },
        {
          userId: user.id,
          name: 'UPI / Wallet',
          type: 'WALLET',
          openingBalancePaise: 250000, // ₹2,500
          currentBalancePaise: 250000,
          color: '#8b5cf6',
          icon: 'smartphone',
        },
      ],
    });

    // Create default categories for user
    await tx.category.createMany({
      data: DEFAULT_CATEGORIES.map(cat => ({
        userId: user.id,
        name: cat.name,
        type: cat.type,
        icon: cat.icon,
        color: cat.color,
        isSystem: true,
      })),
    });

    // Create welcome notification
    await tx.notification.create({
      data: {
        userId: user.id,
        type: 'SYSTEM',
        title: 'Welcome to FinFlow Command Center! 🚀',
        message: 'Your personal finance command center is ready. Start tracking expenses, planning trips, or monitoring debts.',
      },
    });

    const token = generateToken({ id: user.id, email: user.email });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        currency: user.currency,
        currencySymbol: user.currencySymbol,
        accentColor: user.accentColor,
        theme: user.theme,
      },
    };
  });
}

export async function loginUser(data: { email: string; password: string }) {
  const normalizedEmail = data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new Error('Invalid email or password.');
  }

  const isValid = await bcrypt.compare(data.password, user.passwordHash);
  if (!isValid) {
    throw new Error('Invalid email or password.');
  }

  const token = generateToken({ id: user.id, email: user.email });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      currency: user.currency,
      currencySymbol: user.currencySymbol,
      accentColor: user.accentColor,
      theme: user.theme,
    },
  };
}

export async function updateProfile(userId: string, data: {
  name?: string;
  currency?: string;
  currencySymbol?: string;
  accentColor?: string;
  theme?: string;
}) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      currency: true,
      currencySymbol: true,
      accentColor: true,
      theme: true,
    },
  });
  return updated;
}

export async function changePassword(userId: string, data: { currentPassword: string; newPassword: string }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found.');

  const isValid = await bcrypt.compare(data.currentPassword, user.passwordHash);
  if (!isValid) throw new Error('Current password does not match.');

  const passwordHash = await bcrypt.hash(data.newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
  return { success: true, message: 'Password updated successfully.' };
}

export async function ensureDemoUserExists() {
  try {
    const demoEmail = 'demo@finflow.io';
    const existing = await prisma.user.findUnique({ where: { email: demoEmail } });
    if (!existing) {
      console.log('⚡ Demo account not found. Auto-seeding demo account...');
      const passwordHash = await bcrypt.hash('password123', 10);
      const user = await prisma.user.create({
        data: {
          email: demoEmail,
          passwordHash,
          name: 'Aditya Sharma',
          currency: 'INR',
          currencySymbol: '₹',
          theme: 'dark',
          accentColor: 'indigo',
          monthlyIncomePaise: 8500000,
        },
      });

      await prisma.account.createMany({
        data: [
          {
            userId: user.id,
            name: 'Primary Bank Account',
            type: 'BANK',
            openingBalancePaise: 6500000,
            currentBalancePaise: 7245000,
            color: '#3b82f6',
            icon: 'building-2',
          },
          {
            userId: user.id,
            name: 'Cash in Hand',
            type: 'CASH',
            openingBalancePaise: 200000,
            currentBalancePaise: 200000,
            color: '#06b6d4',
            icon: 'banknote',
          },
          {
            userId: user.id,
            name: 'Paytm UPI Wallet',
            type: 'WALLET',
            openingBalancePaise: 350000,
            currentBalancePaise: 480000,
            color: '#8b5cf6',
            icon: 'smartphone',
          },
        ],
      });

      await prisma.category.createMany({
        data: DEFAULT_CATEGORIES.map((cat) => ({
          userId: user.id,
          name: cat.name,
          type: cat.type,
          icon: cat.icon,
          color: cat.color,
          isSystem: true,
        })),
      });

      console.log('✅ Demo account ready: demo@finflow.io / password123');
    }
  } catch (err) {
    console.error('Failed to ensure demo user:', err);
  }
}

