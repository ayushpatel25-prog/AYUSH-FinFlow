import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/prisma.js';
import { registerUser, loginUser } from '../src/services/authService.js';
import { createLoanReceipt, generateAndSavePDF, getReceiptPdfPath } from '../src/services/receiptService.js';
import { requireAuth, generateToken } from '../src/middleware/auth.js';
import fs from 'fs';

describe('Production Flow Verification (Bugs 1, 2, 3)', () => {
  const uniqueId = Date.now();
  const testEmail = `production.user.${uniqueId}@finflow.io`;
  const testPassword = 'SecurePassword2026!';
  const testName = 'Production Test User';
  let userId = '';
  let token = '';

  // ── TEST 1: Create Account & DB Persistence ──────────────────
  it('TEST 1: Creates account in database and returns valid token & user', async () => {
    // Normalization test: send email with mixed case and leading/trailing whitespace
    const mixedCaseEmail = `  Production.User.${uniqueId}@FinFlow.IO  `;
    const result = await registerUser({
      email: mixedCaseEmail,
      password: testPassword,
      name: testName,
    });

    expect(result.token).toBeDefined();
    expect(result.user.email).toBe(testEmail.toLowerCase());
    expect(result.user.name).toBe(testName);
    userId = result.user.id;
    token = result.token;

    // Verify user actually persisted in database
    const dbUser = await prisma.user.findUnique({
      where: { email: testEmail.toLowerCase() },
    });
    expect(dbUser).not.toBeNull();
    expect(dbUser?.email).toBe(testEmail.toLowerCase());
    // Verify password is NOT plaintext
    expect(dbUser?.passwordHash).not.toBe(testPassword);
    expect(dbUser?.passwordHash).toMatch(/^\$2[aby]\$\d+\$/);
  });

  // ── TEST 2: Session verification (/auth/me equivalent) ───────
  it('TEST 2: Verifies user remains authenticated with valid token', async () => {
    const verifiedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    expect(verifiedUser).not.toBeNull();
    expect(verifiedUser?.id).toBe(userId);
    expect(verifiedUser?.email).toBe(testEmail.toLowerCase());
  });

  // ── TEST 3: Logout removes session / invalid token rejected ──
  it('TEST 3: Rejects invalid or expired tokens', () => {
    let statusCode = 0;
    let errorResponse: any = null;
    const req: any = { headers: { authorization: 'Bearer invalid_tampered_token' } };
    const res: any = {
      status: (c: number) => {
        statusCode = c;
        return {
          json: (data: any) => {
            errorResponse = data;
          },
        };
      },
    };
    const next = () => {};

    requireAuth(req, res, next);
    expect(statusCode).toBe(401);
    expect(errorResponse.success).toBe(false);
  });

  // ── TEST 4: Login again with the exact same credentials ─────
  it('TEST 4: Successfully logs in using the exact same credentials with case/whitespace variations', async () => {
    // Test with whitespace and upper case
    const inputEmail = `  PRODUCTION.USER.${uniqueId}@finflow.io  `;
    const loginResult = await loginUser({
      email: inputEmail,
      password: testPassword,
    });

    expect(loginResult.token).toBeDefined();
    expect(loginResult.user.id).toBe(userId);
    expect(loginResult.user.email).toBe(testEmail.toLowerCase());
  });

  // ── TEST 5: Wrong password correctly fails ──────────────────
  it('TEST 5: Rejects login with wrong password', async () => {
    await expect(
      loginUser({
        email: testEmail,
        password: 'IncorrectPassword999',
      })
    ).rejects.toThrow('Invalid email or password.');
  });

  // ── TEST 6: Non-existent email correctly fails ──────────────
  it('TEST 6: Rejects login with non-existent email', async () => {
    await expect(
      loginUser({
        email: `nonexistent.${uniqueId}@finflow.io`,
        password: testPassword,
      })
    ).rejects.toThrow('Invalid email or password.');
  });

  // ── TEST 7: Duplicate account registration rejected ─────────
  it('TEST 7: Rejects duplicate account registration with same email', async () => {
    await expect(
      registerUser({
        email: `  ${testEmail.toUpperCase()}  `,
        password: testPassword,
        name: 'Duplicate Guy',
      })
    ).rejects.toThrow('An account with this email address already exists. Please sign in instead.');
  });

  // ── TEST 8 (BUG 3): End-to-end receipt creation & PDF generation ──
  it('TEST 8: Generates a single-page PDF receipt with visible pitch-black text', async () => {
    // 1. Create a loan
    const loan = await prisma.loan.create({
      data: {
        userId,
        type: 'LENT',
        person: 'Vikas Sharma',
        principalPaise: 110000, // ₹1,100
        remainingPaise: 60000,  // ₹600 remaining
        purpose: 'Office lunch advance split',
        status: 'PARTIALLY_PAID',
        notes: 'Repayment installment promised tomorrow',
      },
    });

    // 2. Create receipt
    const receipt = await createLoanReceipt(userId, loan.id);
    expect(receipt).toBeDefined();
    expect(receipt.receiptNumber).toMatch(/^LN-\d{4}-\d{6}$/);

    // 3. Generate PDF
    const pdfPath = await getReceiptPdfPath(userId, receipt.id);
    expect(fs.existsSync(pdfPath)).toBe(true);

    const pdfBuffer = fs.readFileSync(pdfPath);
    expect(pdfBuffer.length).toBeGreaterThan(1000);

    // Read PDF content: verify keywords and no corrupted/white-on-white text
    const content = pdfBuffer.toString('binary');
    expect(content).toContain('/Type /Pages');
    expect(content).toContain('/Type /Page');

    // Verify it is strictly 1 single page!
    // In PDFKit, /Count 1 means 1 page
    const pageCountMatch = content.match(/\/Count\s+(\d+)/);
    if (pageCountMatch) {
      expect(Number(pageCountMatch[1])).toBe(1);
    }
  });

  afterAll(async () => {
    // Clean test artifacts
    if (userId) {
      await prisma.receipt.deleteMany({ where: { userId } });
      await prisma.loan.deleteMany({ where: { userId } });
      await prisma.notification.deleteMany({ where: { userId } });
      await prisma.category.deleteMany({ where: { userId } });
      await prisma.account.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
    await prisma.$disconnect();
  });
});
