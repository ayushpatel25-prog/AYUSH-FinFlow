import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Wallet, ArrowLeftRight, Landmark, Smartphone, Banknote, CreditCard, TrendingUp } from 'lucide-react';
import { api } from '../api/client.js';
import { formatINR, rupeesToPaise } from '../utils/money.js';
import { Button } from '../components/common/Button.js';
import { Card } from '../components/common/Card.js';
import { Modal } from '../components/common/Modal.js';
import { Input } from '../components/common/Input.js';
import { CurrencyInput } from '../components/common/CurrencyInput.js';
import { Select } from '../components/common/Select.js';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton.js';
import type { Account } from '../types/index.js';

export const AccountsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);

  // Add Account form
  const [name, setName] = useState('');
  const [type, setType] = useState('BANK');
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [color, setColor] = useState('#10b981');

  // Transfer form
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferNote, setTransferNote] = useState('');

  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [error, setError] = useState('');

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: api.accounts.getAll,
  });

  const totalBalancePaise = accounts.reduce((acc, a) => acc + a.currentBalancePaise, 0);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingSubmit(true);
    setError('');

    try {
      await api.accounts.create({
        name,
        type: type as any,
        openingBalancePaise: rupeesToPaise(openingBalance),
        color,
      });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsAddOpen(false);
      setName('');
      setOpeningBalance(0);
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setIsLoadingSubmit(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) {
      setError('Please choose two different accounts for transfer.');
      return;
    }
    if (transferAmount <= 0) {
      setError('Enter a valid transfer amount.');
      return;
    }

    setIsLoadingSubmit(true);
    setError('');

    try {
      await api.transactions.create({
        type: 'TRANSFER',
        amountPaise: rupeesToPaise(transferAmount),
        accountId: fromAccountId,
        toAccountId,
        date: new Date().toISOString(),
        description: transferNote || 'Account Transfer',
      });

      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsTransferOpen(false);
      setTransferAmount(0);
      setTransferNote('');
    } catch (err: any) {
      setError(err.message || 'Transfer failed');
    } finally {
      setIsLoadingSubmit(false);
    }
  };

  const getAccountIcon = (t: string) => {
    switch (t) {
      case 'BANK': return <Landmark className="w-5 h-5" />;
      case 'WALLET': return <Smartphone className="w-5 h-5" />;
      case 'CASH': return <Banknote className="w-5 h-5" />;
      case 'CREDIT_CARD': return <CreditCard className="w-5 h-5" />;
      default: return <Wallet className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Financial Accounts & Wallets</h1>
          <p className="text-xs text-slate-400 mt-1">
            Total Liquid Balance: <span className="text-emerald-400 font-bold">{formatINR(totalBalancePaise)}</span> across {accounts.length} active vaults.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setFromAccountId(accounts[0]?.id || '');
              setToAccountId(accounts[1]?.id || '');
              setIsTransferOpen(true);
            }}
            variant="outline"
            size="sm"
            leftIcon={<ArrowLeftRight className="w-4 h-4" />}
          >
            Transfer Money
          </Button>

          <Button
            onClick={() => setIsAddOpen(true)}
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Account
          </Button>
        </div>
      </div>

      {/* Account Cards Grid */}
      {isLoading ? (
        <LoadingSkeleton rows={4} height="h-36" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {accounts.map((acc: Account) => (
            <Card
              key={acc.id}
              className="relative overflow-hidden group hover:border-slate-700 transition-all duration-300"
            >
              <div className="flex items-center justify-between">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                  style={{ backgroundColor: acc.color || '#10b981' }}
                >
                  {getAccountIcon(acc.type)}
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  {acc.type}
                </span>
              </div>

              <div className="mt-4">
                <h3 className="text-sm font-bold text-white truncate">{acc.name}</h3>
                <p className="text-2xl font-black text-white mt-1">{formatINR(acc.currentBalancePaise)}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
                <span>Opening: {formatINR(acc.openingBalancePaise)}</span>
                <span className="text-indigo-400 font-medium">Active</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Account Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Financial Account" maxWidth="sm">
        <form onSubmit={handleCreateAccount} className="space-y-4">
          {error && <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 text-xs">{error}</div>}

          <Input
            label="Account Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. ICICI Bank, SBI Savings, Cash"
            required
            autoFocus
          />

          <Select
            label="Account Type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            options={[
              { value: 'BANK', label: 'Bank Account' },
              { value: 'WALLET', label: 'Digital Wallet / UPI' },
              { value: 'CASH', label: 'Cash in Hand' },
              { value: 'CREDIT_CARD', label: 'Credit Card' },
              { value: 'INVESTMENT', label: 'Investment Portfolio' },
            ]}
          />

          <CurrencyInput
            label="Opening Initial Balance"
            value={openingBalance || ''}
            onChange={setOpeningBalance}
            placeholder="0.00"
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isLoadingSubmit}>
              Create Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* Transfer Modal */}
      <Modal isOpen={isTransferOpen} onClose={() => setIsTransferOpen(false)} title="Transfer Between Accounts" maxWidth="sm">
        <form onSubmit={handleTransfer} className="space-y-4">
          {error && <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 text-xs">{error}</div>}

          <Select
            label="From Account"
            value={fromAccountId}
            onChange={(e) => setFromAccountId(e.target.value)}
            options={accounts.map(a => ({ value: a.id, label: `${a.name} (${formatINR(a.currentBalancePaise)})` }))}
          />

          <Select
            label="To Destination Account"
            value={toAccountId}
            onChange={(e) => setToAccountId(e.target.value)}
            options={accounts.map(a => ({ value: a.id, label: `${a.name} (${formatINR(a.currentBalancePaise)})` }))}
          />

          <CurrencyInput
            label="Transfer Amount"
            value={transferAmount || ''}
            onChange={setTransferAmount}
            placeholder="0.00"
            required
          />

          <Input
            label="Note (Optional)"
            value={transferNote}
            onChange={(e) => setTransferNote(e.target.value)}
            placeholder="e.g. ATM withdrawal or wallet top-up"
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsTransferOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isLoadingSubmit}>
              Execute Transfer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
