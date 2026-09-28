import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  HandCoins,
  Plus,
  Trash2,
  CheckCircle2,
  Calendar,
  FileText,
  Download,
  Send,
  Mail,
  History,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Clock,
  X,
  Check,
} from 'lucide-react';
import { api } from '../api/client.js';
import { formatINR, formatDate, rupeesToPaise } from '../utils/money.js';
import { Button } from '../components/common/Button.js';
import { Card } from '../components/common/Card.js';
import { Modal } from '../components/common/Modal.js';
import { Input } from '../components/common/Input.js';
import { CurrencyInput } from '../components/common/CurrencyInput.js';
import { Select } from '../components/common/Select.js';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton.js';
import type { Loan, Receipt, ReceiptEmail } from '../types/index.js';

export const UdhaarPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'LENT' | 'BORROWED'>('LENT');

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isRepaymentOpen, setIsRepaymentOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);

  // Receipts drawer / modal state
  const [isReceiptsModalOpen, setIsReceiptsModalOpen] = useState(false);
  const [activeLoanForReceipts, setActiveLoanForReceipts] = useState<Loan | null>(null);

  // Send Email Modal state
  const [isSendEmailOpen, setIsSendEmailOpen] = useState(false);
  const [receiptToSend, setReceiptToSend] = useState<Receipt | null>(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatusMessage, setEmailStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Email History Modal state
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyReceipt, setHistoryReceipt] = useState<Receipt | null>(null);
  const [emailHistoryList, setEmailHistoryList] = useState<ReceiptEmail[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Post-Action Prompt Modal state
  const [postActionData, setPostActionData] = useState<{
    title: string;
    subtitle: string;
    receipt?: Receipt;
    loanId: string;
  } | null>(null);

  // Downloading PDF tracking
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);

  // New Loan Form
  const [person, setPerson] = useState('');
  const [amountRupees, setAmountRupees] = useState<number>(0);
  const [purpose, setPurpose] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [notes, setNotes] = useState('');

  // Repayment Form
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [error, setError] = useState('');

  const { data: summary, isLoading } = useQuery({
    queryKey: ['loans'],
    queryFn: api.loans.getSummary,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: api.accounts.getAll,
  });

  // Query for receipts of selected active loan
  const {
    data: activeLoanReceipts = [],
    isLoading: isLoadingReceipts,
    refetch: refetchReceipts,
  } = useQuery({
    queryKey: ['loan-receipts', activeLoanForReceipts?.id],
    queryFn: () => (activeLoanForReceipts ? api.receipts.getForLoan(activeLoanForReceipts.id) : Promise.resolve([])),
    enabled: !!activeLoanForReceipts,
  });

  // ── Create Loan ────────────────────────────────────────────────────────────
  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountRupees <= 0) {
      setError('Amount must be greater than 0');
      return;
    }
    setIsLoadingSubmit(true);
    setError('');

    try {
      const createdLoan = await api.loans.create({
        type: activeTab,
        person,
        principalPaise: rupeesToPaise(amountRupees),
        purpose,
        dueDate: dueDate || undefined,
        accountId: accountId || undefined,
        notes,
      });

      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsAddOpen(false);

      // Reset form
      const loanPerson = person;
      setPerson('');
      setAmountRupees(0);
      setPurpose('');
      setDueDate('');
      setNotes('');

      // Wait a moment for background receipt generation, then load receipt
      setTimeout(async () => {
        try {
          const receipts = await api.receipts.getForLoan(createdLoan.id);
          const latest = receipts[0];
          setPostActionData({
            title: activeTab === 'LENT' ? 'Money Lent Recorded!' : 'Money Borrowed Recorded!',
            subtitle: `Record created for ${loanPerson}. An immutable digital receipt has been generated.`,
            receipt: latest,
            loanId: createdLoan.id,
          });
        } catch {
          // Handled silently
        }
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Failed to save loan record');
    } finally {
      setIsLoadingSubmit(false);
    }
  };

  // ── Record Payment ─────────────────────────────────────────────────────────
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan || paymentAmount <= 0) return;
    setIsLoadingSubmit(true);
    setError('');

    const targetLoan = selectedLoan;

    try {
      await api.loans.addPayment(targetLoan.id, {
        amountPaise: rupeesToPaise(paymentAmount),
        accountId: paymentAccountId || accounts[0]?.id,
        notes: paymentNotes || 'Repayment installment',
      });

      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsRepaymentOpen(false);
      setPaymentAmount(0);
      setPaymentNotes('');
      setSelectedLoan(null);

      // Wait a moment and show post-action prompt with the repayment receipt
      setTimeout(async () => {
        try {
          const receipts = await api.receipts.getForLoan(targetLoan.id);
          const latest = receipts[0];
          setPostActionData({
            title: 'Repayment Recorded Successfully!',
            subtitle: `Payment of ${formatINR(rupeesToPaise(paymentAmount))} recorded for ${targetLoan.person}. Digital receipt generated.`,
            receipt: latest,
            loanId: targetLoan.id,
          });
        } catch {
          // Handled silently
        }
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Failed to record repayment');
    } finally {
      setIsLoadingSubmit(false);
    }
  };

  // ── Delete Loan ────────────────────────────────────────────────────────────
  const handleDeleteLoan = async (id: string) => {
    if (!window.confirm('Delete this loan record? Any associated receipts will be removed.')) return;
    try {
      await api.loans.delete(id);
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err) {
      console.error(err);
    }
  };

  // ── Download Receipt PDF ───────────────────────────────────────────────────
  const handleDownloadPdf = async (receipt: Receipt) => {
    setDownloadingReceiptId(receipt.id);
    try {
      await api.receipts.downloadPdf(receipt.id, `${receipt.receiptNumber}.pdf`);
    } catch (err: any) {
      alert(err.message || 'Failed to download receipt PDF');
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  // ── Open Send Email Modal ──────────────────────────────────────────────────
  const handleOpenSendEmail = (receipt: Receipt, defaultName?: string) => {
    setReceiptToSend(receipt);
    setRecipientEmail('');
    setRecipientName(defaultName || '');
    setCustomMessage('');
    setEmailStatusMessage(null);
    setIsSendEmailOpen(true);
  };

  // ── Send Email Submit ──────────────────────────────────────────────────────
  const handleSendEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptToSend || !recipientEmail) return;

    setIsSendingEmail(true);
    setEmailStatusMessage(null);

    try {
      const res = await api.receipts.sendEmail(receiptToSend.id, {
        recipientEmail: recipientEmail.trim(),
        recipientName: recipientName.trim() || undefined,
        customMessage: customMessage.trim() || undefined,
      });

      if (res.status === 'SENT') {
        setEmailStatusMessage({
          type: 'success',
          text: res.message || `Receipt email successfully delivered to ${recipientEmail}!`,
        });
      } else {
        setEmailStatusMessage({
          type: 'info',
          text: res.message || 'Receipt recorded. Email delivery is disabled or pending configuration in .env.',
        });
      }
      refetchReceipts();
    } catch (err: any) {
      setEmailStatusMessage({
        type: 'error',
        text: err.message || 'Failed to send receipt email.',
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // ── View Email History ─────────────────────────────────────────────────────
  const handleOpenEmailHistory = async (receipt: Receipt) => {
    setHistoryReceipt(receipt);
    setIsLoadingHistory(true);
    setIsHistoryModalOpen(true);
    try {
      const history = await api.receipts.getEmailHistory(receipt.id);
      setEmailHistoryList(history);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // ── Resend Email From History ──────────────────────────────────────────────
  const handleResendFromHistory = async (item: ReceiptEmail) => {
    if (!historyReceipt) return;
    try {
      await api.receipts.resendEmail(historyReceipt.id, {
        recipientEmail: item.recipientEmail,
        recipientName: item.recipientName || undefined,
        customMessage: item.customMessage || undefined,
      });
      // Refresh history
      const updated = await api.receipts.getEmailHistory(historyReceipt.id);
      setEmailHistoryList(updated);
      alert(`Resend attempted for ${item.recipientEmail}`);
    } catch (err: any) {
      alert(err.message || 'Failed to resend email');
    }
  };

  const currentList = activeTab === 'LENT' ? summary?.lentList || [] : summary?.borrowedList || [];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <HandCoins className="w-7 h-7 text-emerald-400" />
            Udhaar & Peer Lending
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track money lent, money borrowed, partial repayments, and auto-generate certified digital receipts.
          </p>
        </div>

        <Button
          onClick={() => {
            setAccountId(accounts[0]?.id || '');
            setIsAddOpen(true);
          }}
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
        >
          {activeTab === 'LENT' ? 'Record Money Lent' : 'Record Money Borrowed'}
        </Button>
      </div>

      {/* Aggregate Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-emerald-500/10 border-emerald-500/20">
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
            Total Outstanding Receivable
          </span>
          <p className="text-2xl font-black text-white mt-1">
            {formatINR(summary?.outstandingReceivablePaise || 0)}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Money lent to {summary?.lentList?.length || 0} person(s)
          </span>
        </Card>

        <Card className="p-4 bg-rose-500/10 border-rose-500/20">
          <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block">
            Total Outstanding Payable
          </span>
          <p className="text-2xl font-black text-white mt-1">
            {formatINR(summary?.outstandingPayablePaise || 0)}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Debts owed to {summary?.borrowedList?.length || 0} person(s)
          </span>
        </Card>

        <Card className="p-4 bg-slate-900 border-slate-800">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Repayments Received
          </span>
          <p className="text-2xl font-black text-emerald-400 mt-1">
            {formatINR(summary?.totalReceivedPaise || 0)}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">Recovered principal</span>
        </Card>

        <Card className="p-4 bg-slate-900 border-slate-800">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Overdue Balance
          </span>
          <p className="text-2xl font-black text-amber-400 mt-1">
            {formatINR(summary?.overdueAmountPaise || 0)}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">Past due dates</span>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2 sm:gap-4 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('LENT')}
          className={`pb-3 font-semibold text-xs sm:text-sm whitespace-nowrap transition-all border-b-2 ${
            activeTab === 'LENT'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Money I Lent ({summary?.lentList?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('BORROWED')}
          className={`pb-3 font-semibold text-xs sm:text-sm whitespace-nowrap transition-all border-b-2 ${
            activeTab === 'BORROWED'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Money I Borrowed ({summary?.borrowedList?.length || 0})
        </button>
      </div>

      {/* Loan Records Grid */}
      {isLoading ? (
        <LoadingSkeleton rows={3} height="h-44" />
      ) : currentList.length === 0 ? (
        <Card className="text-center py-16 border-slate-800">
          <HandCoins className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No active records</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            {activeTab === 'LENT'
              ? 'Keep track of money lent with automated digital receipts, payment schedules, and settlement records.'
              : 'Log personal borrowings to maintain transparent records and avoid missed commitments.'}
          </p>
          <Button onClick={() => setIsAddOpen(true)} variant="primary" size="sm">
            {activeTab === 'LENT' ? 'Add Lent Record' : 'Add Borrowed Record'}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {currentList.map((loan: Loan) => {
            const isSettled = loan.remainingPaise === 0;
            const isOverdue = loan.computedStatus === 'OVERDUE';

            return (
              <Card
                key={loan.id}
                className="p-5 border-slate-800 bg-slate-900/90 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight">{loan.person}</h3>
                      <span className="text-xs text-slate-400">{loan.purpose}</span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        isSettled
                          ? 'bg-slate-800 text-slate-400 border-slate-700'
                          : isOverdue
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                      }`}
                    >
                      {loan.computedStatus}
                    </span>
                  </div>

                  {/* Balances */}
                  <div className="flex items-baseline justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-800 my-3">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Remaining</span>
                      <p className={`text-xl font-black ${isSettled ? 'text-slate-400' : 'text-white'}`}>
                        {formatINR(loan.remainingPaise)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Principal</span>
                      <p className="text-xs font-bold text-slate-300">{formatINR(loan.principalPaise)}</p>
                    </div>
                  </div>

                  {/* Date & Details */}
                  <div className="text-xs text-slate-400 space-y-1.5">
                    <div className="flex justify-between">
                      <span>Date Given:</span>
                      <span className="text-slate-200">{formatDate(loan.date)}</span>
                    </div>
                    {loan.dueDate && (
                      <div className="flex justify-between">
                        <span>Due Date:</span>
                        <span className={isOverdue ? 'text-rose-400 font-bold' : 'text-slate-200'}>
                          {formatDate(loan.dueDate)}
                        </span>
                      </div>
                    )}
                    {loan.payments && loan.payments.length > 0 && (
                      <div className="flex justify-between text-emerald-400 font-semibold">
                        <span>Repaid:</span>
                        <span>
                          {formatINR(loan.totalPaidPaise)} ({loan.payments.length} part{loan.payments.length > 1 ? 's' : ''})
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Action Section */}
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    {!isSettled ? (
                      <Button
                        onClick={() => {
                          setSelectedLoan(loan);
                          setPaymentAccountId(accounts[0]?.id || '');
                          setIsRepaymentOpen(true);
                        }}
                        variant="primary"
                        size="sm"
                        className="text-xs flex-1"
                      >
                        + Repayment
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 py-1">
                        <CheckCircle2 className="w-4 h-4" /> Settled
                      </div>
                    )}

                    {/* Receipts Button */}
                    <Button
                      onClick={() => {
                        setActiveLoanForReceipts(loan);
                        setIsReceiptsModalOpen(true);
                      }}
                      variant="secondary"
                      size="sm"
                      className="text-xs flex items-center gap-1.5"
                      leftIcon={<FileText className="w-3.5 h-3.5 text-indigo-400" />}
                    >
                      Receipts
                    </Button>

                    <button
                      onClick={() => handleDeleteLoan(loan.id)}
                      className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── CREATE LOAN MODAL ──────────────────────────────────────────────── */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title={activeTab === 'LENT' ? 'Record Money Lent' : 'Record Money Borrowed'}
        maxWidth="sm"
      >
        <form onSubmit={handleCreateLoan} className="space-y-4">
          {error && <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 text-xs">{error}</div>}

          <Input
            label="Person / Counterparty"
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            placeholder="e.g. Rahul Verma"
            required
            autoFocus
          />

          <CurrencyInput
            label="Principal Amount"
            value={amountRupees || ''}
            onChange={setAmountRupees}
            placeholder="5000"
            required
          />

          <Input
            label="Purpose / Reason"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="e.g. Travel tickets split or emergency loan"
            required
          />

          <Input
            label="Expected Repayment Due Date (Optional)"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />

          <Select
            label="Deduct/Credit Account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            options={[
              { value: '', label: 'Do not adjust account balance' },
              ...accounts.map((a) => ({
                value: a.id,
                label: `${a.name} (${formatINR(a.currentBalancePaise)})`,
              })),
            ]}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isLoadingSubmit}>
              Save & Generate Receipt
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── RECORD REPAYMENT MODAL ─────────────────────────────────────────── */}
      <Modal
        isOpen={isRepaymentOpen}
        onClose={() => setIsRepaymentOpen(false)}
        title={`Record Repayment — ${selectedLoan?.person}`}
        maxWidth="sm"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <p className="text-xs text-slate-300">
            Remaining balance: <strong className="text-white">{formatINR(selectedLoan?.remainingPaise || 0)}</strong>
          </p>

          <CurrencyInput
            label="Payment Amount"
            value={paymentAmount || ''}
            onChange={setPaymentAmount}
            placeholder="1000"
            required
            autoFocus
          />

          <Select
            label="Adjust Account"
            value={paymentAccountId}
            onChange={(e) => setPaymentAccountId(e.target.value)}
            options={accounts.map((a) => ({
              value: a.id,
              label: `${a.name} (${formatINR(a.currentBalancePaise)})`,
            }))}
          />

          <Input
            label="Notes / Transaction Reference"
            value={paymentNotes}
            onChange={(e) => setPaymentNotes(e.target.value)}
            placeholder="e.g. Paid via UPI GPay"
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsRepaymentOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isLoadingSubmit}>
              Save & Issue Receipt
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── POST-ACTION SUCCESS PROMPT MODAL ───────────────────────────────── */}
      <Modal
        isOpen={!!postActionData}
        onClose={() => setPostActionData(null)}
        title={postActionData?.title || 'Success'}
        maxWidth="md"
      >
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-slate-300">{postActionData?.subtitle}</p>
              {postActionData?.receipt && (
                <div className="mt-2 text-xs font-mono font-bold text-emerald-400">
                  Receipt Number: {postActionData.receipt.receiptNumber}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            {postActionData?.receipt && (
              <>
                <Button
                  onClick={() => handleDownloadPdf(postActionData.receipt!)}
                  variant="primary"
                  className="w-full sm:w-auto flex-1 text-xs"
                  isLoading={downloadingReceiptId === postActionData.receipt.id}
                  leftIcon={<Download className="w-3.5 h-3.5" />}
                >
                  Download Receipt PDF
                </Button>

                <Button
                  onClick={() => {
                    const r = postActionData.receipt!;
                    setPostActionData(null);
                    handleOpenSendEmail(r);
                  }}
                  variant="secondary"
                  className="w-full sm:w-auto flex-1 text-xs"
                  leftIcon={<Send className="w-3.5 h-3.5 text-indigo-400" />}
                >
                  Email Receipt
                </Button>
              </>
            )}

            <Button
              onClick={() => setPostActionData(null)}
              variant="ghost"
              className="w-full sm:w-auto text-xs"
            >
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── LOAN RECEIPTS DRAWER / MODAL ────────────────────────────────────── */}
      <Modal
        isOpen={isReceiptsModalOpen}
        onClose={() => {
          setIsReceiptsModalOpen(false);
          setActiveLoanForReceipts(null);
        }}
        title={`Receipts & Audit Trail — ${activeLoanForReceipts?.person}`}
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
            <span>
              Principal: <strong className="text-white">{formatINR(activeLoanForReceipts?.principalPaise || 0)}</strong>
            </span>
            <span>
              Remaining: <strong className="text-emerald-400">{formatINR(activeLoanForReceipts?.remainingPaise || 0)}</strong>
            </span>
            <Button
              onClick={() => refetchReceipts()}
              variant="ghost"
              size="sm"
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh
            </Button>
          </div>

          {isLoadingReceipts ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading digital receipts...</div>
          ) : activeLoanReceipts.length === 0 ? (
            <div className="py-8 text-center">
              <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No receipts generated yet for this record.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {activeLoanReceipts.map((receipt) => {
                const isDownloading = downloadingReceiptId === receipt.id;
                const emailCount = receipt.emailHistory?.length || 0;

                const badgeColor =
                  receipt.type === 'LOAN_LENT'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : receipt.type === 'LOAN_BORROWED'
                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                    : receipt.type === 'SETTLEMENT'
                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                    : 'bg-teal-500/10 text-teal-400 border-teal-500/20';

                return (
                  <div
                    key={receipt.id}
                    className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-white">{receipt.receiptNumber}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${badgeColor}`}>
                            {receipt.type.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          Issued on {formatDate(receipt.createdAt)}
                        </span>
                      </div>

                      <div className="text-right sm:text-right">
                        <span className="text-base font-black text-white">{formatINR(receipt.amountPaise)}</span>
                      </div>
                    </div>

                    {/* Action buttons on receipt item */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-700/50">
                      <div className="flex items-center gap-2">
                        {/* Download PDF button */}
                        <Button
                          onClick={() => handleDownloadPdf(receipt)}
                          variant="secondary"
                          size="sm"
                          className="text-xs"
                          isLoading={isDownloading}
                          leftIcon={<Download className="w-3.5 h-3.5 text-emerald-400" />}
                        >
                          PDF
                        </Button>

                        {/* Send Email button */}
                        <Button
                          onClick={() => handleOpenSendEmail(receipt, activeLoanForReceipts?.person)}
                          variant="secondary"
                          size="sm"
                          className="text-xs"
                          leftIcon={<Send className="w-3.5 h-3.5 text-indigo-400" />}
                        >
                          Email
                        </Button>

                        {/* Email Logs button */}
                        <Button
                          onClick={() => handleOpenEmailHistory(receipt)}
                          variant="ghost"
                          size="sm"
                          className="text-xs text-slate-400"
                          leftIcon={<History className="w-3.5 h-3.5" />}
                        >
                          Logs ({emailCount})
                        </Button>
                      </div>

                      {/* Public Verify link */}
                      <a
                        href={`/verify/${receipt.verificationId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-mono hover:underline"
                        title="Open public verification page"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        {receipt.verificationId}
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* ── SEND RECEIPT EMAIL MODAL ────────────────────────────────────────── */}
      <Modal
        isOpen={isSendEmailOpen}
        onClose={() => setIsSendEmailOpen(false)}
        title={`Send Receipt — ${receiptToSend?.receiptNumber}`}
        maxWidth="sm"
      >
        <form onSubmit={handleSendEmailSubmit} className="space-y-4">
          <p className="text-xs text-slate-300">
            Delivers a certified PDF receipt with an embedded verification link directly to the recipient's inbox.
          </p>

          {emailStatusMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                emailStatusMessage.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                  : emailStatusMessage.type === 'info'
                  ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                  : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
              }`}
            >
              {emailStatusMessage.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              )}
              <span>{emailStatusMessage.text}</span>
            </div>
          )}

          <Input
            label="Recipient Email Address"
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="rahul@example.com"
            required
            autoFocus
          />

          <Input
            label="Recipient Name (Optional)"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Rahul Verma"
          />

          <Input
            label="Custom Message Note (Optional)"
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="e.g. Thanks Rahul, attached is the digital receipt."
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsSendEmailOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSendingEmail}
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              Send PDF Receipt
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── EMAIL DELIVERY AUDIT HISTORY MODAL ──────────────────────────────── */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Email Delivery Logs — ${historyReceipt?.receiptNumber}`}
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Audit history of all email delivery attempts for this receipt. Resend capability does not alter loan or payment records.
          </p>

          {isLoadingHistory ? (
            <div className="py-6 text-center text-xs text-slate-400">Loading delivery history...</div>
          ) : emailHistoryList.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              No emails sent yet for this receipt.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {emailHistoryList.map((log) => {
                const isSent = log.status === 'SENT';
                const isFailed = log.status === 'FAILED';

                return (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{log.recipientEmail}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isSent
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : isFailed
                              ? 'bg-rose-500/10 text-rose-400'
                              : 'bg-amber-500/10 text-amber-400'
                          }`}
                        >
                          {log.status}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        {log.sentAt ? formatDate(log.sentAt) : formatDate(log.createdAt)}
                      </span>
                      {log.errorMessage && (
                        <span className="text-[10px] text-rose-400 block mt-1">{log.errorMessage}</span>
                      )}
                    </div>

                    <Button
                      onClick={() => handleResendFromHistory(log)}
                      variant="ghost"
                      size="sm"
                      className="text-xs text-slate-300"
                      leftIcon={<RefreshCw className="w-3 h-3" />}
                    >
                      Resend
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-800">
            <Button onClick={() => setIsHistoryModalOpen(false)} variant="secondary" size="sm">
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default UdhaarPage;
