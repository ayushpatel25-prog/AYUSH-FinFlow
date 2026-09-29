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

function sanitizePdfText(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/[₹]/g, 'Rs. ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2022]/g, '*');
}

// ─── PDF Generation ───────────────────────────────────────────────────────────
export async function generateAndSavePDF(receiptId: string): Promise<string> {
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: { loan: true },
  });
  if (!receipt) throw new Error('Receipt not found.');

  let meta: any = {};
  try {
    meta = JSON.parse(receipt.metadata || '{}');
  } catch {
    meta = {};
  }

  const filePath = path.join(RECEIPTS_DIR, `${receiptId}.pdf`);
  const pdfStorageKey = `receipts/${receiptId}.pdf`;

  const loan = receipt.loan;
  const personName = sanitizePdfText(meta.person || loan?.person || 'N/A');
  const purposeText = sanitizePdfText(meta.purpose || loan?.purpose || 'Peer Transaction');

  // Determine financial values
  const principalPaise = meta.principalPaise ?? loan?.principalPaise ?? receipt.amountPaise;
  const remainingPaise = meta.remainingPaise ?? loan?.remainingPaise ?? 0;
  const principalPaidPaise = meta.principalPartPaise ?? (
    receipt.type === 'LOAN_LENT' || receipt.type === 'LOAN_BORROWED'
      ? receipt.amountPaise
      : Math.max(0, principalPaise - remainingPaise)
  );

  const interestPaise = meta.interestPartPaise ?? 0;
  const interestText = interestPaise > 0
    ? formatPdfCurrency(interestPaise)
    : (meta.interestRate || loan?.interestRate ? `${meta.interestRate || loan?.interestRate}% p.a.` : 'Rs. 0.00');

  const isSettled = !!meta.isSettlement || remainingPaise <= 0;
  const statusText = isSettled
    ? 'FULLY SETTLED'
    : receipt.type === 'REPAYMENT'
    ? 'PARTIALLY PAID'
    : 'ACTIVE';

  const statusBg = isSettled ? '#d1fae5' : receipt.type === 'REPAYMENT' ? '#fef3c7' : '#e0e7ff';
  const statusBorder = isSettled ? '#34d399' : receipt.type === 'REPAYMENT' ? '#fbbf24' : '#818cf8';
  const statusColor = isSettled ? '#065f46' : receipt.type === 'REPAYMENT' ? '#78350f' : '#1e1b4b';

  const dateStr = new Date(meta.paymentDate || meta.loanDate || loan?.date || receipt.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  const rawDueDate = meta.dueDate || loan?.dueDate;
  const dueDateStr = rawDueDate
    ? new Date(rawDueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'N/A';

  const notesText = sanitizePdfText(meta.notes || loan?.notes || 'N/A');

  const verifyHost = process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== '*'
    ? process.env.CORS_ORIGIN.split(',')[0].trim()
    : 'https://ayush-finflow-app.vercel.app';
  const verifyUrl = `${verifyHost}/verify/${receipt.verificationId}`;

  await new Promise<void>((resolve, reject) => {
    // Single page A4 (595.28 x 841.89) with explicit margins: 0 to prevent extra blank pages
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      autoFirstPage: true,
    });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const marginX = 45;
    const contentW = 505.28;
    const colW = (contentW / 2) - 15;

    // ── 0. Solid Opaque White Background (Prevents transparency issues in mobile/dark viewers)
    doc.rect(0, 0, 595.28, 841.89).fill('#ffffff');

    // ── 1. Header Bar ──────────────────────────────────────────────
    doc.rect(0, 0, 595.28, 80).fill('#0f172a');

    doc.fillColor('#10b981').fontSize(22).font('Helvetica-Bold')
      .text('FinFlow', marginX, 20);
    doc.fillColor('#94a3b8').fontSize(8.5).font('Helvetica')
      .text('Personal Finance Command Center • Certified Digital Receipt', marginX, 48);

    doc.fillColor('#ffffff').fontSize(13).font('Helvetica-Bold')
      .text('PAYMENT RECEIPT', 350, 20, { width: 200, align: 'right' });
    doc.fillColor('#10b981').fontSize(9).font('Helvetica-Bold')
      .text('Verified • Official Record', 350, 38, { width: 200, align: 'right' });
    doc.fillColor('#94a3b8').fontSize(8.5).font('Helvetica')
      .text(`Receipt #: ${receipt.receiptNumber}`, 350, 52, { width: 200, align: 'right' });

    // ── 2. Prominent Dark Navy Amount Card ────────────────────────
    let y = 100;
    doc.roundedRect(marginX, y, contentW, 76, 8).fill('#0f172a');

    doc.fillColor('#10b981').fontSize(9.5).font('Helvetica-Bold')
      .text('AMOUNT', marginX + 20, y + 14);
    doc.fillColor('#94a3b8').fontSize(9).font('Helvetica')
      .text(receipt.currency || 'INR', 350, y + 14, { width: 180, align: 'right' });

    doc.fillColor('#ffffff').fontSize(28).font('Helvetica-Bold')
      .text(formatPdfCurrency(receipt.amountPaise), marginX + 20, y + 30);

    // ── 3. Two-Column Information Grid ────────────────────────────
    y = 195;
    const col1X = marginX;
    const col2X = marginX + contentW / 2 + 15;
    const rowGap = 44;

    function renderCell(label: string, value: string, x: number, cy: number, valColor = '#000000', valSize = 13) {
      doc.save();
      doc.fillOpacity(1.0).strokeOpacity(1.0);
      doc.fillColor('#475569').fontSize(8.5).font('Helvetica-Bold');
      doc.text(label.toUpperCase(), x, cy, { width: colW, lineBreak: false, ellipsis: true });

      doc.fillColor(valColor || '#000000').fontSize(valSize).font('Helvetica-Bold');
      doc.text(String(value || 'N/A'), x, cy + 13, { width: colW, lineBreak: false, ellipsis: true });
      doc.restore();
    }

    // Row 1: PERSON & TRANSACTION TYPE
    renderCell('PERSON', personName, col1X, y, '#000000', 14);
    renderCell('TRANSACTION TYPE', receipt.type.replace(/_/g, ' '), col2X, y, '#000000', 13);

    // Row 2: PURPOSE & DATE
    y += rowGap;
    renderCell('PURPOSE', purposeText, col1X, y, '#000000', 12);
    renderCell('DATE', dateStr, col2X, y, '#000000', 12);

    // Row 3: PRINCIPAL AMOUNT & INTEREST
    y += rowGap;
    renderCell('PRINCIPAL AMOUNT', formatPdfCurrency(principalPaise), col1X, y, '#000000', 13);
    renderCell('INTEREST', interestText, col2X, y, '#000000', 13);

    // Row 4: PRINCIPAL PAID & STATUS
    y += rowGap;
    renderCell('PRINCIPAL PAID', formatPdfCurrency(principalPaidPaise), col1X, y, '#000000', 13);

    // Status Badge
    doc.save();
    doc.fillOpacity(1.0).strokeOpacity(1.0);
    doc.fillColor('#475569').fontSize(8.5).font('Helvetica-Bold').text('STATUS', col2X, y);
    doc.roundedRect(col2X, y + 12, 125, 20, 4).fill(statusBg);
    doc.strokeColor(statusBorder).lineWidth(1).roundedRect(col2X, y + 12, 125, 20, 4).stroke();
    doc.fillColor(statusColor).fontSize(9.5).font('Helvetica-Bold')
      .text(statusText, col2X, y + 16, { width: 125, align: 'center' });
    doc.restore();

    // Row 5: REMAINING BALANCE & DUE DATE
    y += rowGap;
    const remainColor = isSettled ? '#059669' : '#000000';
    renderCell('REMAINING BALANCE', formatPdfCurrency(remainingPaise), col1X, y, remainColor, 13);
    renderCell('DUE DATE', dueDateStr, col2X, y, '#000000', 12);

    // ── 5. NOTES (Dedicated container below grid) ──────────────────
    y += rowGap + 6;
    doc.save();
    doc.fillOpacity(1.0).strokeOpacity(1.0);
    doc.fillColor('#475569').fontSize(8.5).font('Helvetica-Bold').text('NOTES', marginX, y);
    doc.roundedRect(marginX, y + 12, contentW, 40, 6).fill('#f8fafc');
    doc.strokeColor('#cbd5e1').lineWidth(1).roundedRect(marginX, y + 12, contentW, 40, 6).stroke();
    doc.fillColor('#000000').fontSize(10.5).font('Helvetica-Bold')
      .text(notesText, marginX + 12, y + 24, { width: contentW - 24 });
    doc.restore();

    // ── 6. VERIFICATION SECTION ────────────────────────────────────
    y += 66;
    doc.strokeColor('#94a3b8').lineWidth(1).moveTo(marginX, y).lineTo(marginX + contentW, y).stroke();

    y += 12;
    doc.roundedRect(marginX, y, contentW, 52, 6).fill('#f1f5f9');
    doc.strokeColor('#cbd5e1').lineWidth(1).roundedRect(marginX, y, contentW, 52, 6).stroke();

    doc.save();
    doc.fillOpacity(1.0).strokeOpacity(1.0);
    doc.fillColor('#475569').fontSize(8.5).font('Helvetica-Bold').text('VERIFICATION ID', marginX + 15, y + 10);
    doc.fillColor('#000000').fontSize(13).font('Courier-Bold').text(receipt.verificationId, marginX + 15, y + 24);

    doc.fillColor('#475569').fontSize(8.5).font('Helvetica-Bold').text('VERIFY AT', col2X, y + 10);
    doc.fillColor('#1d4ed8').fontSize(9.5).font('Helvetica-Bold').text(verifyUrl, col2X, y + 25);
    doc.restore();

    // ── 7. FOOTER ──────────────────────────────────────────────────
    y = 745;
    doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(marginX, y).lineTo(marginX + contentW, y).stroke();
    doc.fillColor('#475569').fontSize(8.5).font('Helvetica-Bold')
      .text('Generated electronically by FinFlow Personal Finance Command Center', marginX, y + 10, {
        align: 'center', width: contentW
      });
    doc.fillColor('#64748b').fontSize(8).font('Helvetica')
      .text(
        `Issued At: ${new Date(receipt.createdAt).toLocaleString('en-IN')} • Authentic Proof ID: ${receipt.verificationId}`,
        marginX, y + 22, { align: 'center', width: contentW }
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

// ─── Verify receipt (public endpoint — returns safe financial details) ─────────
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

  let meta: any = {};
  try {
    meta = JSON.parse(receipt.metadata || '{}');
  } catch {
    meta = {};
  }

  const isSettlement = !!meta.isSettlement;
  const status = isSettlement
    ? 'FULLY SETTLED'
    : receipt.type === 'REPAYMENT'
    ? 'PARTIALLY PAID'
    : meta.remainingPaise !== undefined && meta.remainingPaise <= 0
    ? 'SETTLED'
    : 'ACTIVE';

  const principal = meta.principalPaise ?? receipt.amountPaise;
  const remaining = meta.remainingPaise ?? 0;
  const principalPaid = meta.principalPartPaise ?? (
    receipt.type === 'LOAN_LENT' || receipt.type === 'LOAN_BORROWED'
      ? receipt.amountPaise
      : Math.max(0, principal - remaining)
  );

  return {
    receiptNumber: receipt.receiptNumber,
    verificationId: receipt.verificationId,
    type: receipt.type,
    amountPaise: receipt.amountPaise,
    formattedAmount: formatINR(receipt.amountPaise),
    currency: receipt.currency || 'INR',
    person: meta.person || 'N/A',
    purpose: meta.purpose || 'Peer Transaction',
    principalPaise: principal,
    principalPaidPaise: principalPaid,
    remainingPaise: remaining,
    interestPaise: meta.interestPartPaise ?? 0,
    interestRate: meta.interestRate ?? 0,
    dueDate: meta.dueDate || null,
    notes: meta.notes || null,
    date: meta.paymentDate || meta.loanDate || receipt.createdAt,
    issuedAt: receipt.createdAt,
    status,
    isVerified: true,
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
