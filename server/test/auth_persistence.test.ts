import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/prisma.js';
import { PrismaClient } from '@prisma/client';
import { registerUser, loginUser } from '../src/services/authService.js';
import bcrypt from 'bcryptjs';

describe('Comprehensive Authentication & Data Persistence Suite (Tests 1-6)', { timeout: 20000 }, () => {
  const timestamp = Date.now();
  const rawEmail = `Permanent.User.${timestamp}@FinFlow.IO`;
  const normalizedEmail = `permanent.user.${timestamp}@finflow.io`;
  const rawPassword = 'SecretProductionPassword2026!';
  const userName = 'Permanent Test User';

  let registeredUserId = '';
  let deviceAToken = '';
  let deviceBToken = '';
  let createdAccountId = '';
  let createdTransactionId = '';

  // ─────────────────────────────────────────────────────────────
  // TEST 1: User Registration & Backend Database Persistence
  // ─────────────────────────────────────────────────────────────
  it('TEST 1: User Registration - persists user to database with bcrypt hash', async () => {
    const regResult = await registerUser({
      email: `  ${rawEmail}  `, // mixed case with extra whitespace
      password: rawPassword,
      name: userName,
      currency: 'INR',
      currencySymbol: '₹',
    });

    expect(regResult).toBeDefined();
    expect(regResult.token).toBeDefined();
    expect(regResult.user.id).toBeDefined();
    expect(regResult.user.email).toBe(normalizedEmail);
    expect(regResult.user.name).toBe(userName);

    registeredUserId = regResult.user.id;
    deviceAToken = regResult.token;

    // Directly query database to confirm permanent persistence
    const dbUser = await prisma.user.findUnique({
      where: { id: registeredUserId },
    });
    expect(dbUser).not.toBeNull();
    expect(dbUser?.email).toBe(normalizedEmail);

    // Verify password is NOT stored in plaintext
    expect(dbUser?.passwordHash).not.toBe(rawPassword);
    const isBcryptHash = await bcrypt.compare(rawPassword, dbUser!.passwordHash);
    expect(isBcryptHash).toBe(true);

    // Verify initial default categories and accounts were provisioned
    const accounts = await prisma.account.findMany({ where: { userId: registeredUserId } });
    expect(accounts.length).toBeGreaterThan(0);
    createdAccountId = accounts[0].id;
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 2: User Login with Same Email & Password
  // ─────────────────────────────────────────────────────────────
  it('TEST 2: User Login - validates credentials against database and issues valid token', async () => {
    const loginResult = await loginUser({
      email: normalizedEmail,
      password: rawPassword,
    });

    expect(loginResult.token).toBeDefined();
    expect(loginResult.user.id).toBe(registeredUserId);
    expect(loginResult.user.email).toBe(normalizedEmail);
    expect(loginResult.user.name).toBe(userName);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 3: Email Case Insensitivity
  // ─────────────────────────────────────────────────────────────
  it('TEST 3: Email Case Insensitivity - authenticates regardless of casing or surrounding whitespace', async () => {
    const uppercaseEmail = rawEmail.toUpperCase();
    const loginUpper = await loginUser({
      email: uppercaseEmail,
      password: rawPassword,
    });
    expect(loginUpper.user.id).toBe(registeredUserId);
    expect(loginUpper.user.email).toBe(normalizedEmail);

    const paddedEmail = `   ${rawEmail.toLowerCase()}   `;
    const loginPadded = await loginUser({
      email: paddedEmail,
      password: rawPassword,
    });
    expect(loginPadded.user.id).toBe(registeredUserId);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 4: Data Creation & Database Persistence
  // ─────────────────────────────────────────────────────────────
  it('TEST 4: Data Creation & Persistence - adds financial records bound to user in database', async () => {
    // Create a transaction under the registered user
    const txn = await prisma.transaction.create({
      data: {
        userId: registeredUserId,
        accountId: createdAccountId,
        type: 'EXPENSE',
        amountPaise: 450000, // ₹4,500
        description: 'Office Supplies & Desk Setup',
        date: new Date(),
        status: 'COMPLETED',
      },
    });

    expect(txn.id).toBeDefined();
    expect(txn.userId).toBe(registeredUserId);
    createdTransactionId = txn.id;

    // Verify transaction exists in the database
    const dbTxn = await prisma.transaction.findUnique({
      where: { id: createdTransactionId },
    });
    expect(dbTxn).not.toBeNull();
    expect(dbTxn?.amountPaise).toBe(450000);
    expect(dbTxn?.description).toBe('Office Supplies & Desk Setup');
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 5: Logout & Multi-Device Simulation
  // ─────────────────────────────────────────────────────────────
  it('TEST 5: Multi-Device Login - logging out on Device A and logging in on Device B retains all user data', async () => {
    // Simulate Device A Logout: token is discarded on client; DB is NEVER touched
    deviceAToken = ''; // cleared on client

    // Simulate Device B Login from another browser / phone
    const deviceBLogin = await loginUser({
      email: `  ${rawEmail}  `,
      password: rawPassword,
    });

    deviceBToken = deviceBLogin.token;
    expect(deviceBToken).toBeDefined();
    expect(deviceBLogin.user.id).toBe(registeredUserId);

    // Verify Device B retrieves all previously saved transactions and accounts
    const userTxns = await prisma.transaction.findMany({
      where: { userId: deviceBLogin.user.id },
    });
    expect(userTxns.length).toBeGreaterThanOrEqual(1);
    const savedTxn = userTxns.find(t => t.id === createdTransactionId);
    expect(savedTxn).toBeDefined();
    expect(savedTxn?.description).toBe('Office Supplies & Desk Setup');
    expect(savedTxn?.amountPaise).toBe(450000);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 6: Server Restart Simulation
  // ─────────────────────────────────────────────────────────────
  it('TEST 6: Server Restart Simulation - fresh database client connection preserves accounts and data', async () => {
    // Simulate complete server shutdown and restart by spawning a fresh Prisma client instance
    const freshPrisma = new PrismaClient();
    try {
      // 1. Verify user can still be found and authenticated after restart
      const user = await freshPrisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      expect(user).not.toBeNull();
      expect(user?.id).toBe(registeredUserId);

      // 2. Verify password verification still works perfectly
      const valid = await bcrypt.compare(rawPassword, user!.passwordHash);
      expect(valid).toBe(true);

      // 3. Verify user's transactions are still intact
      const txn = await freshPrisma.transaction.findUnique({
        where: { id: createdTransactionId },
      });
      expect(txn).not.toBeNull();
      expect(txn?.userId).toBe(registeredUserId);
      expect(txn?.amountPaise).toBe(450000);
    } finally {
      await freshPrisma.$disconnect();
    }
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 7: Duplicate Account & Invalid Credential Guards
  // ─────────────────────────────────────────────────────────────
  it('TEST 7: Security Guards - prevents duplicate registration and rejects invalid passwords', async () => {
    // Duplicate email registration should fail
    await expect(
      registerUser({
        email: normalizedEmail,
        password: 'AnotherPassword123',
        name: 'Imposter',
      })
    ).rejects.toThrow(/already exists/i);

    // Invalid password login should fail
    await expect(
      loginUser({
        email: normalizedEmail,
        password: 'WrongPassword!',
      })
    ).rejects.toThrow(/invalid email or password/i);
  });

  afterAll(async () => {
    // Clean up test records
    try {
      if (registeredUserId) {
        await prisma.transaction.deleteMany({ where: { userId: registeredUserId } });
        await prisma.account.deleteMany({ where: { userId: registeredUserId } });
        await prisma.category.deleteMany({ where: { userId: registeredUserId } });
        await prisma.notification.deleteMany({ where: { userId: registeredUserId } });
        await prisma.user.delete({ where: { id: registeredUserId } });
      }
    } catch (e) {
      // Ignored in cleanup
    }
  });
});
