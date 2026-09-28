import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShieldCheck, AlertCircle, ArrowLeft, CheckCircle2, Calendar, User, FileText } from 'lucide-react';
import { api } from '../api/client.js';
import { formatINR, formatDate } from '../utils/money.js';
import { Card } from '../components/common/Card.js';

interface VerifiedReceipt {
  receiptNumber: string;
  verificationId: string;
  type: string;
  amountPaise: number;
  formattedAmount: string;
  currency: string;
  person: string;
  purpose: string;
  issuedAt: string;
  status: string;
}

export const VerifyReceiptPage: React.FC = () => {
  const { verificationId } = useParams<{ verificationId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<VerifiedReceipt | null>(null);

  useEffect(() => {
    if (!verificationId) {
      setError('No verification ID provided');
      setLoading(false);
      return;
    }

    api.receipts
      .verify(verificationId)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Receipt could not be verified. It may be invalid or expired.');
        setLoading(false);
      });
  }, [verificationId]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg space-y-6">
        {/* Brand header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 font-black text-slate-950 text-base">
              F
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-white block">FinFlow</span>
              <span className="text-[10px] text-slate-400 block tracking-wider uppercase font-semibold">
                Receipt Verification System
              </span>
            </div>
          </div>
          <Link
            to="/auth"
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to App
          </Link>
        </div>

        {loading ? (
          <Card className="p-8 text-center border-slate-800 bg-slate-900/90">
            <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-semibold text-slate-300">Verifying authenticity of digital receipt...</p>
            <p className="text-xs text-slate-500 mt-1 font-mono">{verificationId}</p>
          </Card>
        ) : error || !data ? (
          <Card className="p-8 text-center border-rose-500/30 bg-slate-900/90">
            <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Verification Failed</h2>
            <p className="text-xs text-slate-400 mb-4">{error}</p>
            <div className="p-3 rounded-lg bg-slate-800/60 text-[11px] text-slate-400 font-mono">
              Verification ID: {verificationId}
            </div>
          </Card>
        ) : (
          <Card className="p-6 sm:p-8 border-emerald-500/30 bg-slate-900/90 shadow-2xl relative overflow-hidden">
            {/* Top decorative accent */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500" />

            <div className="flex items-center justify-between pb-5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </span>
                <div>
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                    Authentic Verified Record
                  </span>
                  <span className="text-[11px] text-slate-400">Cryptographically issued by FinFlow</span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Valid
              </span>
            </div>

            {/* Amount Banner */}
            <div className="my-6 p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Transaction Amount
                </span>
                <span className="text-2xl sm:text-3xl font-black text-white block mt-0.5">
                  {formatINR(data.amountPaise)}
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {data.type.replace(/_/g, ' ')}
              </span>
            </div>

            {/* Receipt Details */}
            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800/70">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-500" /> Receipt Number
                </span>
                <span className="font-mono font-bold text-white">{data.receiptNumber}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-800/70">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" /> Counterparty
                </span>
                <span className="font-semibold text-slate-200">{data.person}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-800/70">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-500" /> Purpose
                </span>
                <span className="font-semibold text-slate-200">{data.purpose || 'Peer Transaction'}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-800/70">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" /> Issue Timestamp
                </span>
                <span className="text-slate-300">{formatDate(data.issuedAt)}</span>
              </div>

              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Verification ID</span>
                <span className="font-mono text-emerald-400 font-bold">{data.verificationId}</span>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="mt-6 pt-4 border-t border-slate-800 text-center">
              <p className="text-[10px] text-slate-500">
                This verification proves this receipt was generated directly within the FinFlow Personal Finance platform.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default VerifyReceiptPage;
