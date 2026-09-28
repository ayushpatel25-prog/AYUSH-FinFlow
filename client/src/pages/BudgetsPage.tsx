import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, PieChart, AlertTriangle, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { api } from '../api/client.js';
import { formatINR, rupeesToPaise } from '../utils/money.js';
import { Button } from '../components/common/Button.js';
import { Card } from '../components/common/Card.js';
import { ProgressBar } from '../components/common/ProgressBar.js';
import { Modal } from '../components/common/Modal.js';
import { CurrencyInput } from '../components/common/CurrencyInput.js';
import { Select } from '../components/common/Select.js';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton.js';
import type { Budget } from '../types/index.js';

export const BudgetsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [amountRupees, setAmountRupees] = useState<number>(0);
  const [categoryId, setCategoryId] = useState('');
  const [period, setPeriod] = useState('MONTHLY');
  const [alertThreshold, setAlertThreshold] = useState(80);
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [error, setError] = useState('');

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ['budgets'],
    queryFn: api.budgets.getAll,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: api.transactions.getCategories,
  });

  const expenseCategories = categories.filter(c => c.type === 'EXPENSE');

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountRupees <= 0) {
      setError('Please enter a budget amount greater than 0.');
      return;
    }
    setIsLoadingSubmit(true);
    setError('');

    try {
      await api.budgets.create({
        categoryId: categoryId || undefined,
        period,
        amountPaise: rupeesToPaise(amountRupees),
        alertThresholdPercent: alertThreshold,
      });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsAddOpen(false);
      setAmountRupees(0);
    } catch (err: any) {
      setError(err.message || 'Failed to create budget');
    } finally {
      setIsLoadingSubmit(false);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    if (!window.confirm('Delete this budget?')) return;
    try {
      await api.budgets.delete(id);
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
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
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Budgets & Limits</h1>
          <p className="text-xs text-slate-400 mt-1">
            Plan monthly limits, monitor threshold alerts, and track historical spending changes.
          </p>
        </div>

        <Button
          onClick={() => setIsAddOpen(true)}
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Create Budget
        </Button>
      </div>

      {/* Budgets Grid */}
      {isLoading ? (
        <LoadingSkeleton rows={3} height="h-40" />
      ) : budgets.length === 0 ? (
        <Card className="text-center py-16">
          <PieChart className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No budgets configured yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            Setting category budgets helps prevent overspending and gives you early threshold alerts.
          </p>
          <Button onClick={() => setIsAddOpen(true)} variant="primary" size="sm">
            Set Your First Budget
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {budgets.map((b: Budget) => (
            <Card
              key={b.id}
              className={`relative overflow-hidden transition-all duration-300 ${
                b.isOverBudget
                  ? 'bg-rose-950/20 border-rose-500/40 shadow-rose-950/10'
                  : 'bg-slate-900/80 border-slate-800'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{b.category?.name || 'Overall Monthly Budget'}</span>
                  </h3>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
                    {b.period} Cycle
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      b.isOverBudget
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse'
                        : b.percentage >= b.alertThresholdPercent
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    {b.percentage}%
                  </span>
                  <button
                    onClick={() => handleDeleteBudget(b.id)}
                    className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Delete Budget"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Amount Breakdown */}
              <div className="mt-4 flex items-baseline justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block">Spent this month</span>
                  <p className={`text-xl font-black ${b.isOverBudget ? 'text-rose-400' : 'text-white'}`}>
                    {formatINR(b.currentSpentPaise)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 block">Allocated Limit</span>
                  <p className="text-base font-bold text-slate-300">{formatINR(b.amountPaise)}</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-3">
                <ProgressBar
                  percentage={b.percentage}
                  color={b.isOverBudget ? 'bg-rose-500' : 'bg-indigo-500'}
                  height="md"
                  isOverLimit={b.isOverBudget}
                />
              </div>

              {/* Recommendation & Historical Comparison */}
              <div className="mt-4 pt-3 border-t border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Daily safe to spend:</span>
                  <span className="font-bold text-slate-200">
                    {b.remainingPaise > 0 ? `${formatINR(b.dailyRecommendedPaise)}/day` : '₹0.00'}
                  </span>
                </div>

                {b.prevSpentPaise > 0 && (
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">vs Previous month:</span>
                    <span
                      className={`flex items-center gap-0.5 font-semibold ${
                        b.historicalChangePct > 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {b.historicalChangePct > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {b.historicalChangePct > 0 ? '+' : ''}
                      {b.historicalChangePct}% ({formatINR(b.prevSpentPaise)})
                    </span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Budget Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Create New Budget" maxWidth="sm">
        <form onSubmit={handleCreateBudget} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          <CurrencyInput
            label="Monthly Limit Amount"
            value={amountRupees || ''}
            onChange={setAmountRupees}
            placeholder="10000"
            required
            autoFocus
          />

          <Select
            label="Category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={[
              { value: '', label: 'Overall Monthly Spending (All Categories)' },
              ...expenseCategories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />

          <Select
            label="Period Frequency"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            options={[
              { value: 'MONTHLY', label: 'Monthly' },
              { value: 'WEEKLY', label: 'Weekly' },
            ]}
          />

          <Select
            label="Alert Threshold"
            value={alertThreshold.toString()}
            onChange={(e) => setAlertThreshold(parseInt(e.target.value, 10))}
            options={[
              { value: '50', label: '50% of budget reached' },
              { value: '75', label: '75% of budget reached' },
              { value: '80', label: '80% of budget reached (Recommended)' },
              { value: '90', label: '90% of budget reached' },
              { value: '100', label: '100% (Strict limit)' },
            ]}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isLoadingSubmit}>
              Save Budget
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
