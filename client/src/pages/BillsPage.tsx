import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Receipt, Plus, CheckCircle2, Clock, Trash2, Calendar, CreditCard, AlertCircle } from 'lucide-react';
import { api } from '../api/client.js';
import { formatINR, formatDate, formatRelativeTime, rupeesToPaise } from '../utils/money.js';
import { Button } from '../components/common/Button.js';
import { Card } from '../components/common/Card.js';
import { Modal } from '../components/common/Modal.js';
import { Input } from '../components/common/Input.js';
import { CurrencyInput } from '../components/common/CurrencyInput.js';
import { Select } from '../components/common/Select.js';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton.js';
import type { Bill } from '../types/index.js';

export const BillsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [amountRupees, setAmountRupees] = useState<number>(0);
  const [frequency, setFrequency] = useState('MONTHLY');
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState('Bills & Utilities');
  const [accountId, setAccountId] = useState('');
  const [payAccountId, setPayAccountId] = useState('');

  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [error, setError] = useState('');

  const { data: bills = [], isLoading } = useQuery({
    queryKey: ['bills'],
    queryFn: api.bills.getAll,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: api.accounts.getAll,
  });

  const totalMonthlyCommitment = bills.reduce((sum: number, b: Bill) => {
    if (b.frequency === 'MONTHLY') return sum + b.amountPaise;
    if (b.frequency === 'YEARLY') return sum + Math.round(b.amountPaise / 12);
    if (b.frequency === 'WEEKLY') return sum + b.amountPaise * 4;
    return sum + b.amountPaise;
  }, 0);

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountRupees <= 0) {
      setError('Please enter a bill amount greater than 0');
      return;
    }
    setIsLoadingSubmit(true);
    setError('');

    try {
      await api.bills.create({
        name,
        amountPaise: rupeesToPaise(amountRupees),
        frequency,
        dueDate,
        category,
        accountId: accountId || undefined,
      });

      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsAddOpen(false);
      setName('');
      setAmountRupees(0);
      setDueDate('');
    } catch (err: any) {
      setError(err.message || 'Failed to create bill');
    } finally {
      setIsLoadingSubmit(false);
    }
  };

  const handlePayBill = async () => {
    if (!selectedBill) return;
    setIsLoadingSubmit(true);
    try {
      await api.bills.pay(selectedBill.id, { accountId: payAccountId || undefined });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsPayOpen(false);
      setSelectedBill(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingSubmit(false);
    }
  };

  const handleDeleteBill = async (id: string) => {
    if (!window.confirm('Delete this recurring bill?')) return;
    try {
      await api.bills.delete(id);
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Recurring Bills & Subscriptions</h1>
          <p className="text-xs text-slate-400 mt-1">
            Total Monthly Recurring Commitments: <strong className="text-white">{formatINR(totalMonthlyCommitment)}</strong>
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
          Add Subscription
        </Button>
      </div>

      {/* Bills Grid */}
      {isLoading ? (
        <LoadingSkeleton rows={3} height="h-36" />
      ) : bills.length === 0 ? (
        <Card className="text-center py-16">
          <Receipt className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No recurring bills tracked</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            Track subscriptions like Netflix, Rent, Electricity, and WiFi so you never get surprised.
          </p>
          <Button onClick={() => setIsAddOpen(true)} variant="primary" size="sm">
            Add Your First Subscription
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {bills.map((bill: Bill) => {
            const isOverdue = bill.computedStatus === 'OVERDUE';
            return (
              <Card key={bill.id} className="p-5 border-slate-800 bg-slate-900/90 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{bill.name}</h3>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {bill.category} • {bill.frequency}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      isOverdue
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                    }`}
                  >
                    {isOverdue ? 'Overdue' : bill.computedStatus}
                  </span>
                </div>

                <div className="flex items-baseline justify-between pt-2">
                  <span className="text-2xl font-black text-white">{formatINR(bill.amountPaise)}</span>
                  <span className="text-xs text-slate-400">
                    Due in <strong className="text-slate-200">{formatRelativeTime(bill.nextDueDate)}</strong>
                  </span>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <Button
                    onClick={() => {
                      setSelectedBill(bill);
                      setPayAccountId(bill.accountId || accounts[0]?.id || '');
                      setIsPayOpen(true);
                    }}
                    variant="primary"
                    size="sm"
                    className="text-xs"
                  >
                    Pay & Advance Cycle
                  </Button>

                  <button
                    onClick={() => handleDeleteBill(bill.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                    title="Delete bill"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Subscription Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Recurring Bill" maxWidth="sm">
        <form onSubmit={handleCreateBill} className="space-y-4">
          {error && <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 text-xs">{error}</div>}

          <Input
            label="Service / Bill Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Netflix, Apartment Rent, Gym"
            required
            autoFocus
          />

          <CurrencyInput
            label="Amount"
            value={amountRupees || ''}
            onChange={setAmountRupees}
            placeholder="649"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              options={[
                { value: 'MONTHLY', label: 'Monthly' },
                { value: 'WEEKLY', label: 'Weekly' },
                { value: 'QUARTERLY', label: 'Quarterly' },
                { value: 'YEARLY', label: 'Yearly' },
              ]}
            />
            <Input
              label="First Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>

          <Select
            label="Primary Payment Account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            options={accounts.map(a => ({ value: a.id, label: `${a.name} (${formatINR(a.currentBalancePaise)})` }))}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isLoadingSubmit}>
              Save Subscription
            </Button>
          </div>
        </form>
      </Modal>

      {/* Pay Bill Modal */}
      <Modal
        isOpen={isPayOpen}
        onClose={() => setIsPayOpen(false)}
        title={`Confirm Payment for ${selectedBill?.name}`}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-300">
            This will deduct <strong className="text-white">{formatINR(selectedBill?.amountPaise || 0)}</strong> from your account, log an expense transaction, and advance the next due date by 1 {selectedBill?.frequency.toLowerCase()}.
          </p>

          <Select
            label="Deduct From Account"
            value={payAccountId}
            onChange={(e) => setPayAccountId(e.target.value)}
            options={accounts.map(a => ({ value: a.id, label: `${a.name} (${formatINR(a.currentBalancePaise)})` }))}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="ghost" onClick={() => setIsPayOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handlePayBill} isLoading={isLoadingSubmit}>
              Confirm Payment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
