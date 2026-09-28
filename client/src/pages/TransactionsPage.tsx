import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  ArrowUpDown,
  Plus,
  Trash2,
  Copy,
  Receipt,
  Tag,
  Calendar,
  Split,
  Download,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api } from '../api/client.js';
import { formatINR, formatDate } from '../utils/money.js';
import { Button } from '../components/common/Button.js';
import { Card } from '../components/common/Card.js';
import { Modal } from '../components/common/Modal.js';
import { Input } from '../components/common/Input.js';
import { Select } from '../components/common/Select.js';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog.js';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton.js';
import type { Transaction } from '../types/index.js';

export const TransactionsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Filters state
  const [search, setSearch] = useState('');
  const [type, setType] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('categoryId') || '');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');

  // Deletion state
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Selected for details modal
  const [viewingTx, setViewingTx] = useState<Transaction | null>(null);

  // Fetch transactions with pagination and filters
  const { data, isLoading } = useQuery({
    queryKey: ['transactions', page, type, selectedCategory, selectedAccount, search, sortBy],
    queryFn: () =>
      api.transactions.getAll({
        page: page.toString(),
        limit: '20',
        type: type !== 'ALL' ? type : undefined,
        categoryId: selectedCategory || undefined,
        accountId: selectedAccount || undefined,
        search: search || undefined,
        sort: sortBy,
      }),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: api.accounts.getAll,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: api.transactions.getCategories,
  });

  const handleDelete = async () => {
    if (!deletingTx) return;
    setIsDeleting(true);
    try {
      await api.transactions.delete(deletingTx.id);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setDeletingTx(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDuplicate = async (tx: Transaction) => {
    try {
      await api.transactions.duplicate(tx.id);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    } catch (err) {
      console.error(err);
    }
  };

  const transactions = (data as any)?.items || [];
  const pagination = (data as any)?.pagination || { page: 1, totalPages: 1, total: 0 };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Transactions Ledger</h1>
          <p className="text-xs text-slate-400 mt-1">
            Complete real-time records. Persisted permanently in relational database.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={api.exportReset.exportCSVUrl}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative flex items-center lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search description, notes, tags..."
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Type Filter */}
          <Select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'All Types' },
              { value: 'EXPENSE', label: 'Expenses' },
              { value: 'INCOME', label: 'Income' },
              { value: 'TRANSFER', label: 'Transfers' },
              { value: 'LEND', label: 'Money Lent' },
              { value: 'BORROW', label: 'Money Borrowed' },
              { value: 'LOAN_REPAYMENT', label: 'Repayments' },
            ]}
          />

          {/* Category Filter */}
          <Select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All Categories' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />

          {/* Account Filter */}
          <Select
            value={selectedAccount}
            onChange={(e) => {
              setSelectedAccount(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All Accounts' },
              ...accounts.map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
        </div>
      </Card>

      {/* Transactions Table */}
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <LoadingSkeleton rows={6} height="h-12" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No transactions found matching your selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Account</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs">
                {transactions.map((tx: Transaction) => {
                  const isIncome = tx.type === 'INCOME' || tx.type === 'LOAN_REPAYMENT';
                  const isTransfer = tx.type === 'TRANSFER';

                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                      onClick={() => setViewingTx(tx)}
                    >
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap font-mono">
                        {formatDate(tx.date)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <span>{tx.description}</span>
                          {tx.splits && tx.splits.length > 0 && (
                            <span className="p-1 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-bold" title="Split Transaction">
                              <Split className="w-3 h-3 inline mr-0.5" /> Split
                            </span>
                          )}
                          {tx.tags && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              {tx.tags.split(',')[0]}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{
                            backgroundColor: `${tx.category?.color || '#64748b'}20`,
                            color: tx.category?.color || '#94a3b8',
                          }}
                        >
                          {tx.category?.name || 'General'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {isTransfer ? (
                          <span>{tx.account?.name} → {tx.toAccount?.name}</span>
                        ) : (
                          tx.account?.name || 'Account'
                        )}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold whitespace-nowrap font-mono ${
                        isIncome ? 'text-emerald-400' : isTransfer ? 'text-blue-400' : 'text-rose-400'
                      }`}>
                        {isIncome ? '+' : isTransfer ? '⇄ ' : '-'}{formatINR(tx.amountPaise)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleDuplicate(tx)}
                            title="Duplicate"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingTx(tx)}
                            title="Delete"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Showing Page {pagination.page} of {pagination.totalPages} ({pagination.total} records)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Transaction Details Modal */}
      {viewingTx && (
        <Modal
          isOpen={!!viewingTx}
          onClose={() => setViewingTx(null)}
          title="Transaction Details"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <span className="text-slate-400">Amount</span>
              <span className="text-xl font-bold text-white">{formatINR(viewingTx.amountPaise)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Description</span>
              <span className="font-semibold text-white">{viewingTx.description}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Date</span>
              <span className="text-slate-200">{formatDate(viewingTx.date)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Account</span>
              <span className="text-slate-200">{viewingTx.account?.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Category</span>
              <span className="text-slate-200">{viewingTx.category?.name || 'Uncategorized'}</span>
            </div>
            {viewingTx.notes && (
              <div className="pt-2 border-t border-slate-800">
                <span className="text-slate-400 block mb-1">Notes:</span>
                <p className="p-2.5 rounded-lg bg-slate-800 text-slate-300">{viewingTx.notes}</p>
              </div>
            )}
            {viewingTx.splits && viewingTx.splits.length > 0 && (
              <div className="pt-2 border-t border-slate-800">
                <span className="text-slate-400 block mb-1">Split Breakdown:</span>
                <div className="space-y-1.5">
                  {viewingTx.splits.map((s) => (
                    <div key={s.id} className="flex justify-between p-2 rounded bg-slate-800/60">
                      <span>{s.category?.name || 'Sub-category'} {s.notes ? `(${s.notes})` : ''}</span>
                      <span className="font-bold text-white">{formatINR(s.amountPaise)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Confirmation Dialog for Permanent Deletion */}
      <ConfirmationDialog
        isOpen={!!deletingTx}
        onClose={() => setDeletingTx(null)}
        onConfirm={handleDelete}
        title="Delete Transaction"
        description={`Are you sure you want to permanently delete "${deletingTx?.description}"? Your account balance will be automatically recalculated.`}
        confirmText="Delete Permanently"
        isLoading={isDeleting}
      />
    </div>
  );
};
