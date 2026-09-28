import prisma from '../prisma.js';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { paiseToRupees, formatINR } from '../utils/money.js';

// ─── Directory Setup ──────────────────────────────────────────────────────────
const UPLOADS_BASE = path.resolve(process.cwd(), 'uploads');
const RECEIPTS_DIR = path.join(UPLOADS_BASE, 'receipts');

if (!fs.existsSync(RECEIPTS_DIR)) {
  fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
}

// ─── Receipt Number Generation ────────────────────────────────────────────────
type ReceiptPrefix = 'LN' | 'RP' | 'ST';

async function generateReceiptNumber(prefix: ReceiptPrefix): Promise<string> {
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-%`;

  // Use raw query to get max receipt number atomically
  const result = await prisma.$queryRaw<{ receiptNumber: string }[]>`
    SELECT receiptNumber FROM Receipt
    WHERE receiptNumber LIKE ${pattern}
    ORDER BY receiptNumber DESC
    LIMIT 1
  `;

  let nextSeq = 1;
  if (result.length > 0) {
    const lastNumber = result[0].receiptNumber;
    const seqPart = lastNumber.split('-')[2];
    nextSeq = parseInt(seqPart, 10) + 1;
  }

  return `${prefix}-${year}-${String(nextSeq).padStart(6, '0')}`;
}

function generateVerificationId(): string {
  const bytes = randomBytes(4).toString('hex').toUpperCase();
  return `VF-${bytes}`;
}

// ─── Receipt Type Helpers ─────────────────────────────────────────────────────
function prefixForType(type: string): ReceiptPrefix {
  if (type === 'LOAN_LENT' || type === 'LOAN_BORROWED') return 'LN';
  if (type === 'SETTLEMENT') return 'ST';
  return 'RP';
}

function labelForType(type: string, loanType: string): string {
  if (type === 'LOAN_LENT') return 'Money Lent Receipt';
  if (type === 'LOAN_BORROWED') return 'Money Borrowed Receipt';
  if (type === 'SETTLEMENT') return loanType === 'LENT' ? 'Settlement — Repayment Received' : 'Settlement — Loan Repaid';
  return 'Repayment Receipt';
}

// ─── Create Loan Receipt ──────────────────────────────────────────────────────
export async function createLoanReceipt(userId: string, loanId: string) {
  const loan = await prisma.loan.findFirst({ where: { id: loanId, userId } });
  if (!loan) throw new Error('Loan not found or unauthorized.');

  const receiptType = loan.type === 'LENT' ? 'LOAN_LENT' : 'LOAN_BORROWED';
  const prefix = prefixForType(receiptType);
  const receiptNumber = await generateReceiptNumber(prefix);
  const verificationId = generateVerificationId();

  const metadata = JSON.stringify({
    person: loan.person,
    purpose: loan.purpose,
    loanType: loan.type,
    principalPaise: loan.principalPaise,
    remainingPaise: loan.remainingPaise,
    interestRate: loan.interestRate,
    date: loan.date,
    dueDate: loan.dueDate,
    notes: loan.notes,
  });

  const receipt = await prisma.receipt.create({
    data: {
      userId,
      loanId,
      repaymentId: null,
      receiptNumber,
      verificationId,
      type: receiptType,
      amountPaise: loan.principalPaise,
      currency: 'INR',
      metadata,
    },
  });

  // Generate PDF asynchronously — do not block the HTTP response
  generateAndSavePDF(receipt.id).catch((err) =>
    console.error(`[Receipt] PDF generation failed for ${receipt.id}:`, err)
  );

  return receipt;
}

// ─── Create Repayment Receipt ─────────────────────────────────────────────────
export async function createRepaymentReceipt(
  userId: string,
  loanId: string,
  repaymentId: string
) {
  const loan = await prisma.loan.findFirst({ where: { id: loanId, userId } });
  if (!loan) throw new Error('Loan not found or unauthorized.');

  const payment = await prisma.loanPayment.findFirst({
    where: { id: repaymentId, loanId, userId },
  });
  if (!payment) throw new Error('Payment record not found.');

  const isSettled = loan.remainingPaise <= 0;
  const receiptType = isSettled ? 'SETTLEMENT' : 'REPAYMENT';
  const prefix = prefixForType(receiptType);
  const receiptNumber = await generateReceiptNumber(prefix);
  const verificationId = generateVerificationId();

  const metadata = JSON.stringify({
    person: loan.person,
    purpose: loan.purpose,
    loanType: loan.type,
    principalPaise: loan.principalPaise,
    remainingPaise: loan.remainingPaise,
    interestRate: loan.interestRate,
    principalPartPaise: payment.principalPartPaise,
    interestPartPaise: payment.interestPartPaise,
    paymentDate: payment.date,
    loanDate: loan.date,
    isSettlement: isSettled,
    notes: payment.notes,
  });

  const receipt = await prisma.receipt.create({
    data: {
      userId,
      loanId,
      repaymentId,
      receiptNumber,
      verificationId,
      type: receiptType,
      amountPaise: payment.amountPaise,
      currency: 'INR',
      metadata,
    },
  });

  generateAndSavePDF(receipt.id).catch((err) =>
    console.error(`[Receipt] PDF generation failed for ${receipt.id}:`, err)
  );

  return receipt;
}

function formatPdfCurrency(paise: number): string {
  const rupees = (paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `Rs. ${rupees}`;
}

// ─── PDF Generation ───────────────────────────────────────────────────────────
export async function generateAndSavePDF(receiptId: string): Promise<string> {
  const receipt = await prisma.receipt.findUnique({ where: { id: receiptId } });
  if (!receipt) throw new Error('Receipt not found.');

  const meta = JSON.parse(receipt.metadata);
  const filePath = path.join(RECEIPTS_DIR, `${receiptId}.pdf`);
  const pdfStorageKey = `receipts/${receiptId}.pdf`;

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 60, left: 60, right: 60, bottom: 60 } });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const W = 595.28 - 120; // usable width

    // ── Header Bar ──────────────────────────────────────────────
    doc.rect(0, 0, 595.28, 90).fill('#0f172a');

    doc.fillColor('#10b981').fontSize(22).font('Helvetica-Bold')
      .text('FinFlow', 60, 28);
    doc.fillColor('#94a3b8').fontSize(8.5).font('Helvetica')
      .text('Personal Finance Command Center • Official Digital Receipt', 60, 55);

    const label = labelForType(receipt.type, meta.loanType);
    doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold')
      .text(label, 60, 28, { align: 'right' });
    doc.fillColor('#10b981').fontSize(9).font('Helvetica-Bold')
      .text(receipt.receiptNumber, 60, 44, { align: 'right' });

    // ── Receipt Amount Box (Classic Navy Dark Box) ────────────────
    let y = 110;
    doc.fillColor('#0f172a').rect(60, y, W, 78).fill();

    doc.fillColor('#10b981').fontSize(9).font('Helvetica-Bold')
      .text('AMOUNT', 80, y + 15);
    doc.fillColor('#ffffff').fontSize(28).font('Helvetica-Bold')
      .text(formatPdfCurrency(receipt.amountPaise), 80, y + 30);
    doc.fillColor('#94a3b8').fontSize(9).font('Helvetica')
      .text(`Receipt #: ${receipt.receiptNumber}`, 80, y + 58, { align: 'right' });

    y += 98;

    // ── Two-column details with Pure Pitch-Black Bold Values ───────
    const colL = 60;
    const colR = 60 + W / 2 + 10;
    const fieldH = 28;

    function field(label: string, value: string, x: number, fy: number, valueColor = '#000000') {
      // Heading label
      doc.fillColor('#334155').fontSize(8.5).font('Helvetica-Bold').text(label.toUpperCase(), x, fy);
      // Value under heading - Extra Bold, Large, Pitch Black
      doc.fillColor(valueColor).fontSize(12).font('Helvetica-Bold').text(value, x, fy + 12);
    }

    // Person & Transaction Type - bold pitch black
    field('Person', meta.person || '—', colL, y, '#000000');
    field('Transaction Type', receipt.type.replace(/_/g, ' '), colR, y, '#000000');
    y += fieldH + 6;

    // Purpose & Date - bold pitch black
    field('Purpose', meta.purpose || '—', colL, y, '#000000');
    field('Date', new Date(receipt.createdAt).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    }), colR, y, '#000000');
    y += fieldH + 6;

    // Principal & Due Date - bold pitch black
    field('Principal Amount', formatPdfCurrency(meta.principalPaise), colL, y, '#000000');
    if (meta.dueDate) {
      field('Due Date', new Date(meta.dueDate).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      }), colR, y, '#000000');
    }
    y += fieldH + 6;

    if (receipt.type === 'REPAYMENT' || receipt.type === 'SETTLEMENT') {
      field('Principal Part Repaid', formatPdfCurrency(meta.principalPartPaise || 0), colL, y, '#000000');
      field('Interest Part', formatPdfCurrency(meta.interestPartPaise || 0), colR, y, '#000000');
      y += fieldH + 6;

      const remainColor = meta.remainingPaise <= 0 ? '#059669' : '#d97706';
      field('Remaining Balance', formatPdfCurrency(meta.remainingPaise), colL, y, remainColor);
      field('Status', meta.isSettlement ? 'FULLY SETTLED ✓' : 'PARTIALLY PAID', colR, y,
        meta.isSettlement ? '#059669' : '#d97706');
      y += fieldH + 6;
    }

    if (meta.interestRate > 0) {
      field('Interest Rate', `${meta.interestRate}% p.a.`, colL, y, '#000000');
      y += fieldH + 6;
    }

    if (meta.notes) {
      y += 4;
      doc.fillColor('#334155').fontSize(8.5).font('Helvetica-Bold').text('NOTES', colL, y);
      doc.fillColor('#000000').fontSize(11).font('Helvetica-Bold').text(meta.notes, colL, y + 12, { width: W });
      y += 34;
    }

    // ── Divider ────────────────────────────────────────────────
    y += 10;
    doc.strokeColor('#94a3b8').lineWidth(1.2).moveTo(60, y).lineTo(60 + W, y).stroke();
    y += 16;

    // ── Verification Box ───────────────────────────────────────
    doc.fillColor('#f1f5f9').rect(60, y, W, 50).fill();
    doc.strokeColor('#cbd5e1').lineWidth(1).rect(60, y, W, 50).stroke();

    doc.fillColor('#334155').fontSize(8.5).font('Helvetica-Bold')
      .text('VERIFICATION ID', 75, y + 10);
    doc.fillColor('#000000').fontSize(12).font('Helvetica-Bold')
      .text(receipt.verificationId, 75, y + 24);

    doc.fillColor('#334155').fontSize(8.5).font('Helvetica-Bold')
      .text('VERIFY AT', 75 + W / 2, y + 10);
    doc.fillColor('#2563eb').fontSize(9.5).font('Helvetica-Bold')
      .text(`${process.env.CORS_ORIGIN || 'https://ayush-finflow-app.vercel.app'}/verify/${receipt.verificationId}`, 75 + W / 2, y + 24);

    // ── Footer ─────────────────────────────────────────────────
    doc.fillColor('#f1f5f9').rect(0, 775, 595.28, 67).fill();
    doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(0, 775).lineTo(595.28, 775).stroke();
    doc.fillColor('#475569').fontSize(8).font('Helvetica')
      .text(
        'This is an authentic, computer-generated receipt from FinFlow Personal Finance Command Center.',
        60, 790, { align: 'center', width: W }
      );
    doc.fillColor('#64748b').fontSize(7.5).font('Helvetica')
      .text(
        `Issued At: ${new Date(receipt.createdAt).toLocaleString('en-IN')} • Digital Proof ID: ${receipt.verificationId}`,
        60, 804, { align: 'center', width: W }
      );

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  // Update DB with storage key
  await prisma.receipt.update({
    where: { id: receiptId },
    data: { pdfStorageKey },
  });

  return filePath;
}

// ─── Get a receipt (ownership-checked) ───────────────────────────────────────
export async function getReceiptById(userId: string, receiptId: string) {
  const receipt = await prisma.receipt.findFirst({
    where: { id: receiptId, userId },
    include: { emailHistory: { orderBy: { createdAt: 'desc' } } },
  });
  if (!receipt) throw new Error('Receipt not found or unauthorized.');
  return receipt;
}

// ─── Get receipts for a loan ──────────────────────────────────────────────────
export async function getLoanReceipts(userId: string, loanId: string) {
  // Verify loan ownership
  const loan = await prisma.loan.findFirst({ where: { id: loanId, userId } });
  if (!loan) throw new Error('Loan not found or unauthorized.');

  return prisma.receipt.findMany({
    where: { loanId, userId },
    include: { emailHistory: { orderBy: { createdAt: 'desc' } } },
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Verify receipt (public endpoint — returns minimal safe info) ─────────────
export async function verifyReceipt(verificationId: string) {
  const receipt = await prisma.receipt.findFirst({
    where: { verificationId },
    select: {
      receiptNumber: true,
      verificationId: true,
      type: true,
      amountPaise: true,
      currency: true,
      createdAt: true,
      metadata: true,
    },
  });
  if (!receipt) return null;

  const meta = JSON.parse(receipt.metadata);
  return {
    receiptNumber: receipt.receiptNumber,
    verificationId: receipt.verificationId,
    type: receipt.type,
    amountPaise: receipt.amountPaise,
    formattedAmount: formatINR(receipt.amountPaise),
    currency: receipt.currency,
    person: meta.person,
    purpose: meta.purpose,
    issuedAt: receipt.createdAt,
    status: 'VALID',
  };
}

// ─── Get PDF file path (with ownership check) ─────────────────────────────────
export async function getReceiptPdfPath(userId: string, receiptId: string): Promise<string> {
  const receipt = await prisma.receipt.findFirst({
    where: { id: receiptId, userId },
  });
  if (!receipt) throw new Error('Receipt not found or unauthorized.');

  // Always regenerate with updated high-contrast professional design
  return generateAndSavePDF(receiptId);
}
