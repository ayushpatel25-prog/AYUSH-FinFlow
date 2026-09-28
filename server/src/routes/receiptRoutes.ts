import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import {
  getReceiptById,
  getLoanReceipts,
  getReceiptPdfPath,
  verifyReceipt,
  generateAndSavePDF,
} from '../services/receiptService.js';
import {
  sendReceiptEmail,
  resendReceiptEmail,
  getReceiptEmailHistory,
} from '../services/emailService.js';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';

const router = Router();

// Stricter rate limit for email sending
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { success: false, error: 'Too many email requests. Please try again later.' },
});

// ─── GET /api/loans/:loanId/receipts ─────────────────────────────────────────
router.get('/loans/:loanId/receipts', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const receipts = await getLoanReceipts(req.user!.id, req.params.loanId);
    res.json({ success: true, data: receipts });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/receipts/verify/:verificationId (public) ───────────────────────
router.get('/verify/:verificationId', async (req, res, next) => {
  try {
    const result = await verifyReceipt(req.params.verificationId);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Receipt not found. Verification ID may be invalid.' });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/receipts/:receiptId ────────────────────────────────────────────
router.get('/:receiptId', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const receipt = await getReceiptById(req.user!.id, req.params.receiptId);
    res.json({ success: true, data: receipt });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/receipts/:receiptId/pdf ────────────────────────────────────────
router.get('/:receiptId/pdf', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const filePath = await getReceiptPdfPath(req.user!.id, req.params.receiptId);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'PDF file not found. Please try regenerating.' });
    }

    const fileName = path.basename(filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    fileStream.on('error', next);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/receipts/:receiptId/pdf/regenerate ────────────────────────────
router.post('/:receiptId/pdf/regenerate', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await generateAndSavePDF(req.params.receiptId);
    res.json({ success: true, data: { message: 'PDF regenerated successfully.' } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/receipts/:receiptId/email ─────────────────────────────────────
const emailSchema = z.object({
  recipientEmail: z.string().email('Invalid email address'),
  recipientName: z.string().max(100).optional(),
  customMessage: z.string().max(500).optional(),
});

router.post('/:receiptId/email', requireAuth, emailLimiter, async (req: AuthRequest, res, next) => {
  try {
    const body = emailSchema.parse(req.body);
    const result = await sendReceiptEmail(
      req.user!.id,
      req.params.receiptId,
      body.recipientEmail,
      body.recipientName,
      body.customMessage
    );
    const statusCode = result.status === 'SENT' ? 200 : 422;
    res.status(statusCode).json({ success: result.status === 'SENT', data: result });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/receipts/:receiptId/resend ────────────────────────────────────
const resendSchema = z.object({
  recipientEmail: z.string().email().optional(),
  recipientName: z.string().max(100).optional(),
  customMessage: z.string().max(500).optional(),
});

router.post('/:receiptId/resend', requireAuth, emailLimiter, async (req: AuthRequest, res, next) => {
  try {
    const body = resendSchema.parse(req.body);
    const result = await resendReceiptEmail(
      req.user!.id,
      req.params.receiptId,
      body.recipientEmail,
      body.recipientName,
      body.customMessage
    );
    const statusCode = result.status === 'SENT' ? 200 : 422;
    res.status(statusCode).json({ success: result.status === 'SENT', data: result });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/receipts/:receiptId/email-history ───────────────────────────────
router.get('/:receiptId/email-history', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const history = await getReceiptEmailHistory(req.user!.id, req.params.receiptId);
    res.json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
});

export default router;
