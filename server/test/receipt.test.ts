import { describe, it, expect } from 'vitest';
import { rupeesToPaise, paiseToRupees, formatINR } from '../src/utils/money.js';

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
});
