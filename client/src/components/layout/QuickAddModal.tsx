import React, { useState } from 'react';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { Input } from '../common/Input.js';
import { CurrencyInput } from '../common/CurrencyInput.js';
import { Select } from '../common/Select.js';
import { api } from '../../api/client.js';
import { rupeesToPaise } from '../../utils/money.js';
import type { Account, Category, Trip, Loan } from '../../types/index.js';
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  Compass,
  HandCoins,
  Receipt,
  CheckCircle,
} from 'lucide-react';
import { clsx } from 'clsx';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  trips?: Trip[];
  loans?: Loan[];
  onSuccess: () => void;
}

type TabType = 'EXPENSE' | 'INCOME' | 'TRANSFER' | 'TRIP_SAVING' | 'LEND' | 'BORROW' | 'REPAYMENT' | 'BILL';

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  accounts,
  categories,
  trips = [],
  loans = [],
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('EXPENSE');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Form Fields
  const [amountRupees, setAmountRupees] = useState<number>(0);
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id || '');
  const [toAccountId, setToAccountId] = useState<string>(accounts[1]?.id || '');
  const [categoryId, setCategoryId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [person, setPerson] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [tags, setTags] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState(trips[0]?.id || '');
  const [selectedLoanId, setSelectedLoanId] = useState(loans[0]?.id || '');
  const [billFrequency, setBillFrequency] = useState('MONTHLY');

  const expenseCategories = categories.filter(c => c.type === 'EXPENSE');
  const incomeCategories = categories.filter(c => c.type === 'INCOME');

  const tabs: Array<{ id: TabType; label: string; icon: React.ReactNode }> = [
    { id: 'EXPENSE', label: 'Expense', icon: <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" /> },
    { id: 'INCOME', label: 'Income', icon: <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" /> },
    { id: 'TRANSFER', label: 'Transfer', icon: <ArrowLeftRight className="w-3.5 h-3.5 text-blue-400" /> },
    { id: 'TRIP_SAVING', label: 'Trip Save', icon: <Compass className="w-3.5 h-3.5 text-indigo-400" /> },
    { id: 'LEND', label: 'Lend', icon: <HandCoins className="w-3.5 h-3.5 text-amber-400" /> },
    { id: 'BORROW', label: 'Borrow', icon: <HandCoins className="w-3.5 h-3.5 text-purple-400" /> },
    { id: 'REPAYMENT', label: 'Repayment', icon: <CheckCircle className="w-3.5 h-3.5 text-teal-400" /> },
    { id: 'BILL', label: 'Bill', icon: <Receipt className="w-3.5 h-3.5 text-cyan-400" /> },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountRupees <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const amountPaise = rupeesToPaise(amountRupees);
      const chosenAccount = accountId || accounts[0]?.id;

      if (activeTab === 'EXPENSE') {
        await api.transactions.create({
          type: 'EXPENSE',
          amountPaise,
          accountId: chosenAccount,
          categoryId: categoryId || expenseCategories[0]?.id,
          date,
          description: description || 'Expense',
          notes,
          person,
          tags,
          isRecurring,
        });
      } else if (activeTab === 'INCOME') {
        await api.transactions.create({
          type: 'INCOME',
          amountPaise,
          accountId: chosenAccount,
          categoryId: categoryId || incomeCategories[0]?.id,
          date,
          description: description || 'Income Credit',
          notes,
          tags,
          isRecurring,
        });
      } else if (activeTab === 'TRANSFER') {
        if (!toAccountId || chosenAccount === toAccountId) {
          throw new Error('Please select two distinct accounts for money transfer.');
        }
        await api.transactions.create({
          type: 'TRANSFER',
          amountPaise,
          accountId: chosenAccount,
          toAccountId,
          date,
          description: description || 'Account Transfer',
          notes,
        });
      } else if (activeTab === 'TRIP_SAVING') {
        if (!selectedTripId) throw new Error('Please select a trip target.');
        await api.trips.addContribution(selectedTripId, {
          amountPaise,
          accountId: chosenAccount,
          notes: description || 'Trip saving contribution',
        });
      } else if (activeTab === 'LEND') {
        if (!person) throw new Error('Person name is required.');
        await api.loans.create({
          type: 'LENT',
          person,
          principalPaise: amountPaise,
          purpose: description || 'Personal loan',
          date,
          dueDate: dueDate || undefined,
          accountId: chosenAccount,
          notes,
        });
      } else if (activeTab === 'BORROW') {
        if (!person) throw new Error('Person name is required.');
        await api.loans.create({
          type: 'BORROWED',
          person,
          principalPaise: amountPaise,
          purpose: description || 'Borrowed money',
          date,
          dueDate: dueDate || undefined,
          accountId: chosenAccount,
          notes,
        });
      } else if (activeTab === 'REPAYMENT') {
        if (!selectedLoanId) throw new Error('Please select an active loan.');
        await api.loans.addPayment(selectedLoanId, {
          amountPaise,
          accountId: chosenAccount,
          date,
          notes: description || 'Repayment',
        });
      } else if (activeTab === 'BILL') {
        await api.bills.create({
          name: description || 'Recurring Bill',
          amountPaise,
          frequency: billFrequency,
          dueDate: date,
          accountId: chosenAccount,
        });
      }

      onSuccess();
      onClose();
      // Reset form
      setAmountRupees(0);
      setDescription('');
      setNotes('');
      setPerson('');
      setTags('');
    } catch (err: any) {
      setError(err.message || 'Failed to submit transaction');
    } finally {
      setIsLoading(false);
    }
  };

  const accountOptions = accounts.map(a => ({
    value: a.id,
    label: `${a.name} (₹${(a.currentBalancePaise / 100).toLocaleString('en-IN')})`,
  }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Quick Add" maxWidth="lg">
      {/* Category Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2 border-b border-slate-800 -mx-2 px-2 mb-4 scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              setError('');
            }}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all',
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Amount Input */}
        <div>
          <CurrencyInput
            label="Amount"
            value={amountRupees || ''}
            onChange={setAmountRupees}
            placeholder="0.00"
            autoFocus
          />
        </div>

        {/* Source Account */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label={activeTab === 'TRANSFER' ? 'From Account' : 'Account'}
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            options={accountOptions}
          />

          {activeTab === 'TRANSFER' ? (
            <Select
              label="To Destination Account"
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              options={accountOptions}
            />
          ) : (
            <Input
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          )}
        </div>

        {/* Dynamic Fields Per Tab */}
        {activeTab === 'EXPENSE' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              options={expenseCategories.map(c => ({ value: c.id, label: c.name }))}
            />
            <Input
              label="Tags (comma separated)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="food, dinner, office"
            />
          </div>
        )}

        {activeTab === 'INCOME' && (
          <Select
            label="Income Source Category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={incomeCategories.map(c => ({ value: c.id, label: c.name }))}
          />
        )}

        {(activeTab === 'LEND' || activeTab === 'BORROW') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Person Name"
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              placeholder="e.g. Rahul Verma"
              required
            />
            <Input
              label="Target Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        )}

        {activeTab === 'TRIP_SAVING' && (
          <Select
            label="Select Trip Destination"
            value={selectedTripId}
            onChange={(e) => setSelectedTripId(e.target.value)}
            options={trips.length > 0
              ? trips.map(t => ({ value: t.id, label: `${t.name} (${t.destination})` }))
              : [{ value: '', label: 'No active trips found' }]}
          />
        )}

        {activeTab === 'REPAYMENT' && (
          <Select
            label="Select Loan / Person"
            value={selectedLoanId}
            onChange={(e) => setSelectedLoanId(e.target.value)}
            options={loans.length > 0
              ? loans.map(l => ({
                  value: l.id,
                  label: `${l.type === 'LENT' ? 'Received from' : 'Paid to'} ${l.person} (Remaining: ₹${(l.remainingPaise / 100).toLocaleString('en-IN')})`,
                }))
              : [{ value: '', label: 'No active loans found' }]}
          />
        )}

        {activeTab === 'BILL' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Frequency"
              value={billFrequency}
              onChange={(e) => setBillFrequency(e.target.value)}
              options={[
                { value: 'MONTHLY', label: 'Monthly' },
                { value: 'WEEKLY', label: 'Weekly' },
                { value: 'QUARTERLY', label: 'Quarterly' },
                { value: 'YEARLY', label: 'Yearly' },
              ]}
            />
            <Input
              label="Next Due Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        )}

        {/* Description & Notes */}
        <Input
          label="Description / Title"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={
            activeTab === 'EXPENSE' ? 'e.g. Swiggy Gourmet Burger' :
            activeTab === 'INCOME' ? 'e.g. Salary Credit' :
            activeTab === 'TRANSFER' ? 'e.g. Top up Paytm Wallet' :
            activeTab === 'LEND' ? 'e.g. Emergency bike repair' :
            activeTab === 'BORROW' ? 'e.g. Split concert pass' : 'Description'
          }
          required
        />

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isLoading}>
            Save Record
          </Button>
        </div>
      </form>
    </Modal>
  );
};
