import React from 'react';
import { ShieldCheck, CheckCircle2, Download, Send, ExternalLink, Copy, Check } from 'lucide-react';
import { formatINR } from '../../utils/money.js';
import type { FinancialReceiptData } from '../../types/index.js';

interface FinancialReceiptProps {
  receipt: FinancialReceiptData;
  onDownloadPdf?: () => void;
  onSendEmail?: () => void;
  isDownloadingPdf?: boolean;
  showActions?: boolean;
}

export const FinancialReceipt: React.FC<FinancialReceiptProps> = ({
  receipt,
  onDownloadPdf,
  onSendEmail,
  isDownloadingPdf = false,
  showActions = true,
}) => {
  const [copied, setCopied] = React.useState(false);

  const formatDisplayDate = (d?: string) => {
    if (!d) return 'N/A';
    try {
      const dateObj = new Date(d);
      if (isNaN(dateObj.getTime())) return d;
      return dateObj.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return d;
    }
  };

  const formatDisplayDateTime = (d?: string) => {
    if (!d) return null;
    try {
      const dateObj = new Date(d);
      if (isNaN(dateObj.getTime())) return null;
      return dateObj.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return null;
    }
  };

  const handleCopyVerification = () => {
    if (!receipt.verificationId) return;
    navigator.clipboard?.writeText(receipt.verificationId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Safe field values
  const personName = receipt.person || 'N/A';
  const purpose = receipt.purpose || 'Peer Transaction';
  const transactionType = receipt.type ? receipt.type.replace(/_/g, ' ') : 'TRANSACTION';
  const dateFormatted = formatDisplayDate(receipt.date || receipt.issuedAt);
  const dateTimeFormatted = formatDisplayDateTime(receipt.issuedAt || receipt.date);
  
  const principalAmountText = receipt.principalPaise !== undefined ? formatINR(receipt.principalPaise) : 'N/A';
  const principalPaidText = receipt.principalPaidPaise !== undefined ? formatINR(receipt.principalPaidPaise) : 'N/A';
  const remainingBalanceText = receipt.remainingPaise !== undefined ? formatINR(receipt.remainingPaise) : 'N/A';
  const interestText = receipt.interestPaise !== undefined && receipt.interestPaise > 0 
    ? formatINR(receipt.interestPaise) 
    : (receipt.interestRate ? `${receipt.interestRate}% p.a.` : '₹0.00');

  const statusRaw = (receipt.status || 'ACTIVE').toUpperCase();
  const isSettled = statusRaw.includes('SETTLED');
  const isPartial = statusRaw.includes('PARTIAL');

  const statusBadgeClass = isSettled
    ? 'bg-emerald-100 text-emerald-900 border-emerald-400 font-black'
    : isPartial
    ? 'bg-amber-100 text-amber-950 border-amber-400 font-black'
    : 'bg-indigo-100 text-indigo-950 border-indigo-400 font-black';

  const verifyUrl = `/verify/${receipt.verificationId || ''}`;

  return (
    <div className="w-full max-w-xl mx-auto bg-white border border-slate-300 rounded-2xl shadow-xl overflow-hidden font-sans text-slate-900 antialiased">
      {/* ── 1. HEADER ──────────────────────────────────────────────── */}
      <div className="p-5 sm:p-6 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
              Payment Receipt
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-0.5">
              Transaction Details
            </p>
          </div>

          {/* Verification Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-extrabold tracking-wide shadow-sm shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Verified</span>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-7 space-y-6">
        {/* ── 2. AMOUNT SECTION (Prominent Dark Navy Card) ─────────────── */}
        <div className="bg-[#0f172a] rounded-xl p-5 sm:p-6 text-white shadow-lg border border-slate-800">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-emerald-400">
              AMOUNT
            </span>
            <span className="font-mono text-xs font-bold text-slate-200 bg-slate-800/90 px-2.5 py-1 rounded-md border border-slate-700">
              {receipt.receiptNumber || 'N/A'}
            </span>
          </div>

          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-black text-white tracking-tight block break-words">
              {receipt.amountPaise !== undefined ? formatINR(receipt.amountPaise) : '₹0.00'}
            </span>
          </div>
        </div>

        {/* ── 3. PERSON / TRANSACTION INFORMATION (Two-Column Grid) ────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-8 pt-1">
          {/* LEFT COLUMN */}
          <div className="space-y-5">
            {/* PERSON */}
            <div>
              <span className="text-[11px] sm:text-xs font-black text-slate-500 uppercase tracking-wider block">
                PERSON
              </span>
              <p className="text-[17px] sm:text-[18px] font-black text-slate-950 mt-1 leading-snug break-words">
                {personName}
              </p>
            </div>

            {/* PURPOSE */}
            <div>
              <span className="text-[11px] sm:text-xs font-black text-slate-500 uppercase tracking-wider block">
                PURPOSE
              </span>
              <p className="text-[15px] sm:text-[16px] font-bold text-slate-900 mt-1 leading-snug break-words">
                {purpose}
              </p>
            </div>

            {/* PRINCIPAL AMOUNT */}
            <div>
              <span className="text-[11px] sm:text-xs font-black text-slate-500 uppercase tracking-wider block">
                PRINCIPAL AMOUNT
              </span>
              <p className="text-[15px] sm:text-[16px] font-black text-slate-950 mt-1">
                {principalAmountText}
              </p>
            </div>

            {/* PRINCIPAL PAID */}
            <div>
              <span className="text-[11px] sm:text-xs font-black text-slate-500 uppercase tracking-wider block">
                PRINCIPAL PAID
              </span>
              <p className="text-[15px] sm:text-[16px] font-black text-slate-950 mt-1">
                {principalPaidText}
              </p>
            </div>

            {/* REMAINING BALANCE */}
            <div>
              <span className="text-[11px] sm:text-xs font-black text-slate-500 uppercase tracking-wider block">
                REMAINING BALANCE
              </span>
              <p className={`text-[15px] sm:text-[16px] font-black mt-1 ${isSettled ? 'text-emerald-700' : 'text-slate-950'}`}>
                {remainingBalanceText}
              </p>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-5">
            {/* TRANSACTION TYPE */}
            <div>
              <span className="text-[11px] sm:text-xs font-black text-slate-500 uppercase tracking-wider block">
                TRANSACTION TYPE
              </span>
              <p className="text-[15px] sm:text-[16px] font-black text-slate-950 mt-1 uppercase">
                {transactionType}
              </p>
            </div>

            {/* DATE */}
            <div>
              <span className="text-[11px] sm:text-xs font-black text-slate-500 uppercase tracking-wider block">
                DATE
              </span>
              <p className="text-[15px] sm:text-[16px] font-bold text-slate-900 mt-1">
                {dateFormatted}
              </p>
            </div>

            {/* INTEREST */}
            <div>
              <span className="text-[11px] sm:text-xs font-black text-slate-500 uppercase tracking-wider block">
                INTEREST
              </span>
              <p className="text-[15px] sm:text-[16px] font-black text-slate-950 mt-1">
                {interestText}
              </p>
            </div>

            {/* STATUS */}
            <div>
              <span className="text-[11px] sm:text-xs font-black text-slate-500 uppercase tracking-wider block">
                STATUS
              </span>
              <div className="mt-1">
                <span className={`inline-block px-3 py-1 rounded-md text-xs border uppercase tracking-wider ${statusBadgeClass}`}>
                  {statusRaw}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 5. NOTES (Separate section below transaction info) ──────── */}
        <div className="pt-2 border-t border-slate-200">
          <span className="text-[11px] sm:text-xs font-black text-slate-500 uppercase tracking-wider block mb-1.5">
            NOTES
          </span>
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <p className="text-[14px] sm:text-[15px] font-bold text-slate-900 leading-relaxed whitespace-pre-wrap break-words">
              {receipt.notes || 'N/A'}
            </p>
          </div>
        </div>

        {/* ── 6. VERIFICATION SECTION (Bordered Section at bottom) ───── */}
        <div className="rounded-xl border border-slate-300 bg-slate-50/90 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Official Verification</span>
            </div>
            <button
              type="button"
              onClick={handleCopyVerification}
              className="text-xs font-bold text-slate-600 hover:text-slate-950 flex items-center gap-1 bg-white px-2.5 py-1 rounded border border-slate-300 shadow-2xs transition-colors"
              title="Copy verification ID"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy ID</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                VERIFICATION ID
              </span>
              <p className="font-mono text-sm sm:text-base font-black text-slate-950 tracking-wide mt-0.5 select-all">
                {receipt.verificationId || 'N/A'}
              </p>
            </div>

            <div>
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                VERIFY AT
              </span>
              <a
                href={verifyUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs sm:text-sm font-black text-blue-700 hover:text-blue-900 underline hover:no-underline break-all mt-0.5 inline-flex items-center gap-1"
              >
                <span>{verifyUrl}</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
            </div>
          </div>
        </div>

        {/* ── ACTIONS (Download PDF / Send Email) ───────────────────── */}
        {showActions && (onDownloadPdf || onSendEmail) && (
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            {onDownloadPdf && (
              <button
                type="button"
                onClick={onDownloadPdf}
                disabled={isDownloadingPdf}
                className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download Certified PDF'}</span>
              </button>
            )}

            {onSendEmail && (
              <button
                type="button"
                onClick={onSendEmail}
                className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-900 font-bold text-xs sm:text-sm border border-slate-300 shadow-sm transition-all active:scale-[0.98]"
              >
                <Send className="w-4 h-4 text-indigo-600" />
                <span>Email Receipt</span>
              </button>
            )}
          </div>
        )}

        {/* ── 7. RECEIPT FOOTER ─────────────────────────────────────── */}
        <div className="pt-4 border-t border-slate-200 text-center space-y-1">
          <p className="text-xs font-bold text-slate-600">
            Generated electronically
          </p>
          {dateTimeFormatted && (
            <p className="text-[11px] font-medium text-slate-400">
              {dateTimeFormatted} • FinFlow Certified Transaction
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinancialReceipt;
