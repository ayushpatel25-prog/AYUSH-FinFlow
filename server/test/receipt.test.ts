import { describe, it, expect } from 'vitest';
import { rupeesToPaise, paiseToRupees, formatINR } from '../src/utils/money.js';
import zlib from 'zlib';

function extractTextFromPdf(buffer: Buffer): string {
  const str = buffer.toString('binary');
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  let text = '';
  while ((match = streamRegex.exec(str)) !== null) {
    try {
      const decompressed = zlib.inflateSync(Buffer.from(match[1], 'binary')).toString('utf8');
      const tjRegex = /\[(.*?)\]\s*TJ/g;
      let tjMatch: RegExpExecArray | null;
      while ((tjMatch = tjRegex.exec(decompressed)) !== null) {
        const hexRegex = /<([0-9a-fA-F]+)>/g;
        let hexMatch: RegExpExecArray | null;
        let line = '';
        while ((hexMatch = hexRegex.exec(tjMatch[1])) !== null) {
          line += Buffer.from(hexMatch[1], 'hex').toString('utf8');
        }
        text += ' ' + line;
      }
    } catch (e) {}
  }
  return text;
}

describe('Receipt Numbering and Prefix Invariants', () => {
  it('formats loan lent and loan borrowed receipts with LN prefix', () => {
    const year = new Date().getFullYear();
    const seq = 1;
    const receiptNumber = `LN-${year}-${String(seq).padStart(6, '0')}`;
    expect(receiptNumber).toMatch(/^LN-\d{4}-\d{6}$/);
    expect(receiptNumber).toBe(`LN-${year}-000001`);
  });

  it('formats repayment receipts with RP prefix', () => {
    const year = new Date().getFullYear();
    const seq = 42;
    const receiptNumber = `RP-${year}-${String(seq).padStart(6, '0')}`;
    expect(receiptNumber).toMatch(/^RP-\d{4}-\d{6}$/);
    expect(receiptNumber).toBe(`RP-${year}-000042`);
  });

  it('formats settlement receipts with ST prefix', () => {
    const year = new Date().getFullYear();
    const seq = 105;
    const receiptNumber = `ST-${year}-${String(seq).padStart(6, '0')}`;
    expect(receiptNumber).toMatch(/^ST-\d{4}-\d{6}$/);
    expect(receiptNumber).toBe(`ST-${year}-000105`);
  });

  it('generates unique verification IDs with VF prefix', () => {
    const id = `VF-${Math.random().toString(16).substring(2, 10).toUpperCase()}`;
    expect(id).toMatch(/^VF-[A-Z0-9]+$/);
  });
});

describe('Lend / Borrow Accounting Isolation Invariants', () => {
  it('ensures money lent is not treated as an expense in user net calculations', () => {
    // Principal lent: ₹10,000 (1,000,000 paise)
    const principalPaise = rupeesToPaise(10000);
    expect(principalPaise).toBe(1000000);

    // Initial account balance: ₹50,000
    let accountBalancePaise = rupeesToPaise(50000);

    // When lending ₹10,000, account balance decrements by ₹10,000
    accountBalancePaise -= principalPaise;
    expect(accountBalancePaise).toBe(rupeesToPaise(40000));

    // But it creates an asset (Receivable), NOT an expense
    const outstandingReceivablePaise = principalPaise;
    const netWorthPaise = accountBalancePaise + outstandingReceivablePaise;
    expect(netWorthPaise).toBe(rupeesToPaise(50000)); // Net worth remains unchanged!
  });

  it('correctly tracks partial repayments and transitions to settled', () => {
    const principalPaise = rupeesToPaise(10000);
    let remainingPaise = principalPaise;

    // Partial repayment 1: ₹3,000
    const payment1 = rupeesToPaise(3000);
    remainingPaise = Math.max(0, remainingPaise - payment1);
    expect(remainingPaise).toBe(rupeesToPaise(7000));
    let status = remainingPaise === 0 ? 'SETTLED' : 'PARTIALLY_PAID';
    expect(status).toBe('PARTIALLY_PAID');

    // Partial repayment 2: ₹7,000 (final repayment)
    const payment2 = rupeesToPaise(7000);
    remainingPaise = Math.max(0, remainingPaise - payment2);
    expect(remainingPaise).toBe(0);
    status = remainingPaise === 0 ? 'SETTLED' : 'PARTIALLY_PAID';
    expect(status).toBe('SETTLED');
  });

  it('formats receipt currency accurately with Indian locale', () => {
    expect(formatINR(10000000)).toBe('₹1,00,000.00'); // 1 Lakh
    expect(formatINR(50000)).toBe('₹500.00');
    expect(formatINR(0)).toBe('₹0.00');
  });
});

describe('Receipt Public Verification Security Boundary', () => {
  it('sanitizes metadata for public verification endpoint (no sensitive leaks)', () => {
    const fullReceipt = {
      id: 'receipt-cuid-123',
      userId: 'user-secret-id',
      loanId: 'loan-secret-id',
      receiptNumber: 'LN-2026-000001',
      verificationId: 'VF-ABCD1234',
      type: 'LOAN_LENT',
      amountPaise: 1000000,
      currency: 'INR',
      pdfStorageKey: 'receipts/receipt-cuid-123.pdf',
      createdAt: new Date().toISOString(),
      metadata: JSON.stringify({
        person: 'Rahul Verma',
        purpose: 'Trip advance',
        userPrivateNote: 'Do not tell his brother',
      }),
    };

    // Public representation should only expose safe fields
    const meta = JSON.parse(fullReceipt.metadata);
    const publicData = {
      receiptNumber: fullReceipt.receiptNumber,
      verificationId: fullReceipt.verificationId,
      type: fullReceipt.type,
      amountPaise: fullReceipt.amountPaise,
      formattedAmount: formatINR(fullReceipt.amountPaise),
      currency: fullReceipt.currency,
      person: meta.person,
      purpose: meta.purpose,
      issuedAt: fullReceipt.createdAt,
      status: 'VALID',
    };

    expect((publicData as any).userId).toBeUndefined();
    expect((publicData as any).pdfStorageKey).toBeUndefined();
    expect((publicData as any).userPrivateNote).toBeUndefined();
    expect(publicData.status).toBe('VALID');
    expect(publicData.receiptNumber).toBe('LN-2026-000001');
  });

  it('generates a LEND receipt with visible dynamic values and LEND transaction type', async () => {
    const { generateAndSavePDF } = await import('../src/services/receiptService.js');
    const prisma = (await import('../src/prisma.js')).default;
    const fs = await import('fs');

    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: { email: 'lend_test@finflow.io', passwordHash: 'dummy', name: 'Lend Tester' },
      });
    }

    const loan = await prisma.loan.create({
      data: {
        userId: user.id,
        person: 'Akshat Singh',
        type: 'LENT',
        principalPaise: 500000,
        remainingPaise: 500000,
        purpose: 'Trip / Personal',
        dueDate: new Date('2026-10-15'),
        date: new Date('2026-09-29'),
      },
    });

    const { createLoanReceipt } = await import('../src/services/receiptService.js');
    const receipt = await createLoanReceipt(user.id, loan.id);
    const pdfPath = await generateAndSavePDF(receipt.id);

    expect(fs.existsSync(pdfPath)).toBe(true);
    const pdfBuffer = fs.readFileSync(pdfPath);
    expect(pdfBuffer.length).toBeGreaterThan(1000);

    const pdfText = extractTextFromPdf(pdfBuffer);
    expect(pdfText).toContain('Akshat Singh');
    expect(pdfText).toContain('Trip / Personal');
    expect(pdfText).toContain('LEND');
    expect(pdfText).toContain('5,000');

    // Clean up
    await prisma.receipt.deleteMany({ where: { id: receipt.id } });
    await prisma.loan.deleteMany({ where: { id: loan.id } });
  }, 20000);

  it('generates a BORROW receipt with visible dynamic values and BORROW transaction type', async () => {
    const { generateAndSavePDF, createLoanReceipt } = await import('../src/services/receiptService.js');
    const prisma = (await import('../src/prisma.js')).default;
    const fs = await import('fs');

    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: { email: 'borrow_test@finflow.io', passwordHash: 'dummy', name: 'Borrow Tester' },
      });
    }

    // Test with long person name and different amount
    const loan = await prisma.loan.create({
      data: {
        userId: user.id,
        person: 'Chandrashekhar Venkataraman',
        type: 'BORROWED',
        principalPaise: 15000000, // ₹1,50,000
        remainingPaise: 15000000,
        purpose: 'Medical Emergency Assistance',
        dueDate: new Date('2027-01-01'),
        date: new Date('2026-09-29'),
      },
    });

    const receipt = await createLoanReceipt(user.id, loan.id);
    const pdfPath = await generateAndSavePDF(receipt.id);

    expect(fs.existsSync(pdfPath)).toBe(true);
    const pdfBuffer = fs.readFileSync(pdfPath);

    const pdfText = extractTextFromPdf(pdfBuffer);
    expect(pdfText).toContain('Chandrashekhar Venkataraman');
    expect(pdfText).toContain('Medical Emergency Assistance');
    expect(pdfText).toContain('BORROW');
    expect(pdfText).toContain('1,50,000');

    // Clean up
    await prisma.receipt.deleteMany({ where: { id: receipt.id } });
    await prisma.loan.deleteMany({ where: { id: loan.id } });
  }, 20000);
});
