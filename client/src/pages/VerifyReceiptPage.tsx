import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { api } from '../api/client.js';
import { FinancialReceipt } from '../components/receipt/FinancialReceipt.js';
import type { FinancialReceiptData } from '../types/index.js';

export const VerifyReceiptPage: React.FC = () => {
  const { verificationId } = useParams<{ verificationId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FinancialReceiptData | null>(null);

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
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col items-center justify-start p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-xl space-y-4">
        {/* Brand Header */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center shadow font-black text-emerald-400 text-base">
              F
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-slate-900 block leading-tight">
                FinFlow
              </span>
              <span className="text-[11px] text-slate-500 block tracking-wider uppercase font-bold">
                Certified Receipt Verification
              </span>
            </div>
          </div>
          <Link
            to="/loans"
            className="text-xs font-bold text-slate-600 hover:text-slate-950 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-300 shadow-2xs transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to App
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-lg">
            <div className="w-10 h-10 border-3 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-bold text-slate-800">Verifying digital receipt authenticity...</p>
            <p className="text-xs text-slate-500 mt-1 font-mono">{verificationId}</p>
          </div>
        ) : error || !data ? (
          <div className="bg-white border border-rose-300 rounded-2xl p-8 text-center shadow-lg">
            <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-black text-slate-900 mb-1">Receipt Verification Failed</h2>
            <p className="text-xs font-medium text-slate-600 mb-4">{error}</p>
            <div className="p-3 rounded-lg bg-slate-100 text-xs font-mono text-slate-700 border border-slate-200 max-w-xs mx-auto">
              ID: {verificationId}
            </div>
          </div>
        ) : (
          <FinancialReceipt
            receipt={data}
            showActions={false}
          />
        )}
      </div>
    </div>
  );
};

export default VerifyReceiptPage;
