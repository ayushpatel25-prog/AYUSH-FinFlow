import nodemailer from 'nodemailer';
import fs from 'fs';
import prisma from '../prisma.js';
import { getReceiptPdfPath } from './receiptService.js';
import { formatINR } from '../utils/money.js';

// ─── Transporter Factory ──────────────────────────────────────────────────────
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const enabled = process.env.EMAIL_ENABLED === 'true';

  if (!enabled || !host || !user || !pass) {
    return null; // Email not configured — dev mode
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
  });
}

// ─── Build Email HTML ─────────────────────────────────────────────────────────
function buildEmailHTML(
  receiptNumber: string,
  type: string,
  person: string,
  purpose: string,
  amountPaise: number,
  verificationId: string,
  customMessage?: string | null
): string {
  const typeLabel =
    type === 'LOAN_LENT' ? 'Money Lent Receipt' :
    type === 'LOAN_BORROWED' ? 'Money Borrowed Receipt' :
    type === 'SETTLEMENT' ? 'Settlement Receipt' : 'Repayment Receipt';

  const appUrl = process.env.CORS_ORIGIN || 'http://localhost:5173';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${typeLabel}</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0f172a;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">
          <!-- Header -->
          <tr>
            <td style="background:#0f172a;padding:24px 32px;border-bottom:1px solid #334155;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#10b981;letter-spacing:-0.5px;">FinFlow</p>
              <p style="margin:4px 0 0;font-size:11px;color:#64748b;">Personal Finance Command Center</p>
            </td>
          </tr>

          <!-- Receipt Type -->
          <tr>
            <td style="padding:24px 32px 8px;">
              <p style="margin:0;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:1px;">${typeLabel}</p>
              <p style="margin:4px 0 0;font-size:28px;font-weight:800;color:#ffffff;">${formatINR(amountPaise)}</p>
              <p style="margin:6px 0 0;font-size:11px;color:#64748b;">Receipt # ${receiptNumber}</p>
            </td>
          </tr>

          <!-- Details -->
          <tr>
            <td style="padding:16px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:8px 0;border-top:1px solid #334155;">
                    <span style="font-size:11px;color:#64748b;">PERSON</span><br/>
                    <strong style="font-size:13px;color:#f1f5f9;">${person}</strong>
                  </td>
                  <td style="padding:8px 0;border-top:1px solid #334155;text-align:right;">
                    <span style="font-size:11px;color:#64748b;">PURPOSE</span><br/>
                    <strong style="font-size:13px;color:#f1f5f9;">${purpose || '—'}</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${customMessage ? `
          <!-- Custom Message -->
          <tr>
            <td style="padding:0 32px 16px;">
              <div style="background:#0f172a;border-radius:8px;padding:12px 16px;border-left:3px solid #10b981;">
                <p style="margin:0;font-size:12px;color:#94a3b8;">${customMessage}</p>
              </div>
            </td>
          </tr>` : ''}

          <!-- Verification -->
          <tr>
            <td style="padding:0 32px 24px;">
              <div style="background:#0f172a;border-radius:8px;padding:12px 16px;border:1px solid #334155;">
                <p style="margin:0 0 4px;font-size:10px;color:#64748b;text-transform:uppercase;">Verification ID</p>
                <p style="margin:0;font-size:13px;font-weight:700;color:#3b82f6;letter-spacing:1px;">${verificationId}</p>
                <p style="margin:6px 0 0;font-size:10px;color:#475569;">
                  Verify at: <a href="${appUrl}/verify/${verificationId}" style="color:#3b82f6;">${appUrl}/verify/${verificationId}</a>
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0f172a;padding:16px 32px;border-top:1px solid #1e293b;text-align:center;">
              <p style="margin:0;font-size:10px;color:#475569;">
                This is a computer-generated receipt. PDF attached for your records.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

// ─── Send Receipt Email ───────────────────────────────────────────────────────
export async function sendReceiptEmail(
  userId: string,
  receiptId: string,
  recipientEmail: string,
  recipientName?: string,
  customMessage?: string
): Promise<{ emailId: string; status: 'SENT' | 'FAILED'; message: string }> {

  // Validate receipt ownership
  const receipt = await prisma.receipt.findFirst({ where: { id: receiptId, userId } });
  if (!receipt) throw new Error('Receipt not found or unauthorized.');

  const meta = JSON.parse(receipt.metadata);

  // Create ReceiptEmail record as PENDING first
  const emailRecord = await prisma.receiptEmail.create({
    data: {
      receiptId,
      userId,
      recipientEmail,
      recipientName: recipientName || null,
      customMessage: customMessage || null,
      status: 'PENDING',
    },
  });

  const transporter = createTransporter();

  if (!transporter) {
    // Email not configured — update status and return graceful message
    await prisma.receiptEmail.update({
      where: { id: emailRecord.id },
      data: {
        status: 'FAILED',
        errorMessage: 'Email service not configured. Set SMTP_* env vars and EMAIL_ENABLED=true.',
      },
    });

    console.log(
      `[Email] DEV MODE — Receipt ${receipt.receiptNumber} would be sent to ${recipientEmail}. ` +
      `Configure SMTP_HOST, SMTP_USER, SMTP_PASS, EMAIL_ENABLED=true in .env.`
    );

    return {
      emailId: emailRecord.id,
      status: 'FAILED',
      message:
        'Email service is not configured. Please set SMTP credentials in .env (SMTP_HOST, SMTP_USER, SMTP_PASS, EMAIL_ENABLED=true). ' +
        'The receipt PDF is still available for download.',
    };
  }

  try {
    // Get or regenerate PDF
    const pdfPath = await getReceiptPdfPath(userId, receiptId);
    const pdfBuffer = fs.readFileSync(pdfPath);

    const html = buildEmailHTML(
      receipt.receiptNumber,
      receipt.type,
      meta.person,
      meta.purpose,
      receipt.amountPaise,
      receipt.verificationId,
      customMessage
    );

    const typeLabel =
      receipt.type === 'LOAN_LENT' ? 'Money Lent Receipt' :
      receipt.type === 'LOAN_BORROWED' ? 'Money Borrowed Receipt' :
      receipt.type === 'SETTLEMENT' ? 'Settlement Receipt' : 'Repayment Receipt';

    const result = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'FinFlow <no-reply@finflow.io>',
      to: recipientName ? `"${recipientName}" <${recipientEmail}>` : recipientEmail,
      subject: `${typeLabel} — ${receipt.receiptNumber}`,
      html,
      attachments: [
        {
          filename: `${receipt.receiptNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    await prisma.receiptEmail.update({
      where: { id: emailRecord.id },
      data: {
        status: 'SENT',
        providerMessageId: result.messageId || null,
        sentAt: new Date(),
      },
    });

    return {
      emailId: emailRecord.id,
      status: 'SENT',
      message: `Receipt sent successfully to ${recipientEmail}.`,
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Unknown email error';

    await prisma.receiptEmail.update({
      where: { id: emailRecord.id },
      data: {
        status: 'FAILED',
        errorMessage: errorMsg.substring(0, 500),
      },
    });

    return {
      emailId: emailRecord.id,
      status: 'FAILED',
      message: `Failed to send email: ${errorMsg}`,
    };
  }
}

// ─── Resend Receipt Email ─────────────────────────────────────────────────────
export async function resendReceiptEmail(
  userId: string,
  receiptId: string,
  recipientEmail?: string,
  recipientName?: string,
  customMessage?: string
) {
  const receipt = await prisma.receipt.findFirst({
    where: { id: receiptId, userId },
    include: { emailHistory: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  if (!receipt) throw new Error('Receipt not found or unauthorized.');

  // Use last known email if not specified
  const email = recipientEmail || receipt.emailHistory[0]?.recipientEmail;
  if (!email) throw new Error('No recipient email provided and no previous send history found.');

  const name = recipientName || receipt.emailHistory[0]?.recipientName || undefined;
  const msg = customMessage || receipt.emailHistory[0]?.customMessage || undefined;

  return sendReceiptEmail(userId, receiptId, email, name, msg);
}

// ─── Get Email History ────────────────────────────────────────────────────────
export async function getReceiptEmailHistory(userId: string, receiptId: string) {
  const receipt = await prisma.receipt.findFirst({ where: { id: receiptId, userId } });
  if (!receipt) throw new Error('Receipt not found or unauthorized.');

  return prisma.receiptEmail.findMany({
    where: { receiptId, userId },
    orderBy: { createdAt: 'desc' },
  });
}
