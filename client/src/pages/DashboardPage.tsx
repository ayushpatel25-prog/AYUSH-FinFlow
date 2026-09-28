import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  PiggyBank,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  Compass,
  HandCoins,
  Receipt,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Calendar,
  X,
  CreditCard,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
} from 'recharts';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { formatINR, formatRelativeTime } from '../utils/money.js';
import { StatCard } from '../components/common/StatCard.js';
import { Card } from '../components/common/Card.js';
import { ProgressBar } from '../components/common/ProgressBar.js';
import { Button } from '../components/common/Button.js';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton.js';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { onOpenQuickAdd, onRefresh } = useOutletContext<{ onOpenQuickAdd: () => void; onRefresh: () => void }>();
  const [cashFlowRange, setCashFlowRange] = useState<'30d' | '6m'>('30d');

  const { data: dashboard, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: api.dashboard.get,
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton rows={1} height="h-28" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <LoadingSkeleton rows={1} height="h-32" />
          <LoadingSkeleton rows={1} height="h-32" />
          <LoadingSkeleton rows={1} height="h-32" />
          <LoadingSkeleton rows={1} height="h-32" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <LoadingSkeleton rows={1} height="h-80" />
          <LoadingSkeleton rows={1} height="h-80" />
          <LoadingSkeleton rows={1} height="h-80" />
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="p-8 text-center rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
        <AlertCircle className="w-10 h-10 mx-auto mb-2 text-rose-500" />
        <h3 className="text-lg font-bold text-white">Failed to load financial dashboard</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
          {error instanceof Error ? error.message : 'Please check your connection or restart server.'}
        </p>
        <Button onClick={onRefresh} variant="secondary" size="sm" className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  const { summary, health, cashFlow, spendingBreakdown, budgets, tripWidget, lendBorrow, upcomingPayments, recentTransactions, aiInsights } = dashboard;

  const currentMonthName = new Date().toLocaleString('en-IN', { month: 'long' });
  const cashFlowData = cashFlowRange === '30d' ? cashFlow.days30 : cashFlow.months6;

  const handleDismissInsight = async (id: string) => {
    try {
      await api.ai.dismissInsight(id);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn">
      {/* ========================================================
          SECTION 1: WELCOME CARD & FINANCIAL OVERVIEW
          ======================================================== */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Command Center
              </span>
              <span className="text-xs text-slate-400">• Persistent Relational Database</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Good day, {user?.name || 'Investor'} 👋
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-xl leading-relaxed">
              Here is your financial overview for <span className="text-indigo-400 font-semibold">{currentMonthName}</span>. Your net savings rate is{' '}
              <span className="text-emerald-400 font-bold">
                {summary.monthlyIncomePaise > 0
                  ? `${(((summary.monthlyIncomePaise - summary.monthlyExpensesPaise) / summary.monthlyIncomePaise) * 100).toFixed(0)}%`
                  : '0%'}
              </span>
              .
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => navigate('/transactions')}
              variant="outline"
              size="sm"
              className="text-xs border-slate-700"
            >
              Transactions
            </Button>
            <Button
              onClick={onOpenQuickAdd}
              variant="primary"
              size="sm"
              className="text-xs font-semibold"
            >
              + Quick Add
            </Button>
          </div>
        </div>
      </div>

      {/* ========================================================
          SECTION 2: FOUR PREMIUM SUMMARY CARDS
          ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Balance */}
        <StatCard
          title="Total Balance"
          value={formatINR(summary.totalBalancePaise)}
          trendPct={summary.incomeChangePct}
          trendLabel="cashflow trend"
          icon={<Wallet className="w-5 h-5" />}
          iconColor="text-indigo-400"
          iconBg="bg-indigo-500/10 border-indigo-500/20"
          subtext="across all active accounts"
        />

        {/* Monthly Income */}
        <StatCard
          title="Monthly Income"
          value={formatINR(summary.monthlyIncomePaise)}
          trendPct={summary.incomeChangePct}
          trendLabel="vs last month"
          icon={<ArrowUpRight className="w-5 h-5" />}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10 border-emerald-500/20"
          isPositiveGood={true}
        />

        {/* Monthly Expenses */}
        <StatCard
          title="Monthly Expenses"
          value={formatINR(summary.monthlyExpensesPaise)}
          trendPct={summary.expenseChangePct}
          trendLabel="vs last month"
          icon={<ArrowDownRight className="w-5 h-5" />}
          iconColor="text-rose-400"
          iconBg="bg-rose-500/10 border-rose-500/20"
          isPositiveGood={false}
        />

        {/* Available to Spend */}
        <StatCard
          title="Available to Spend"
          value={formatINR(summary.availableToSpendPaise)}
          icon={<PiggyBank className="w-5 h-5" />}
          iconColor="text-teal-400"
          iconBg="bg-teal-500/10 border-teal-500/20"
          subtext="Net buffer for month"
        />
      </div>

      {/* ========================================================
          SECTION 3: FINANCIAL HEALTH SCORE & BREAKDOWN
          ======================================================== */}
      <Card className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900/90 to-indigo-950/30 border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Score Pillar */}
          <div className="flex items-center gap-5">
            <div className="relative w-20 h-20 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex flex-col items-center justify-center shrink-0 shadow-lg shadow-indigo-500/10">
              <span className="text-2xl font-black text-white">{health.score}</span>
              <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">/ 100</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Financial Health Score</h3>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-md leading-relaxed">{health.explanation}</p>
              <p className="text-[10px] text-slate-500 mt-1 italic">{health.disclaimer}</p>
            </div>
          </div>

          {/* 4 Pillars Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:w-1/2">
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-400 font-medium">Savings</span>
                <span className="text-white font-bold">{health.breakdown.savings}/25</span>
              </div>
              <ProgressBar percentage={(health.breakdown.savings / 25) * 100} color="bg-emerald-500" height="sm" />
            </div>

            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-400 font-medium">Budget</span>
                <span className="text-white font-bold">{health.breakdown.budgetControl}/25</span>
              </div>
              <ProgressBar percentage={(health.breakdown.budgetControl / 25) * 100} color="bg-indigo-500" height="sm" />
            </div>

            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-400 font-medium">Debt Health</span>
                <span className="text-white font-bold">{health.breakdown.debt}/25</span>
              </div>
              <ProgressBar percentage={(health.breakdown.debt / 25) * 100} color="bg-teal-500" height="sm" />
            </div>

            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-400 font-medium">Consistency</span>
                <span className="text-white font-bold">{health.breakdown.consistency}/25</span>
              </div>
              <ProgressBar percentage={(health.breakdown.consistency / 25) * 100} color="bg-purple-500" height="sm" />
            </div>
          </div>
        </div>
      </Card>

      {/* ========================================================
          CHARTS ROW: CASH FLOW CHART + SPENDING BREAKDOWN
          ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Section 4: Cash Flow Chart */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                <span>Cash Flow Analytics</span>
              </h3>
              <p className="text-[11px] text-slate-400">Income vs Expenses vs Net Savings</p>
            </div>
            {/* Toggle Range */}
            <div className="flex items-center p-1 rounded-xl bg-slate-800 border border-slate-700/80 text-xs">
              <button
                onClick={() => setCashFlowRange('30d')}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  cashFlowRange === '30d' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                30 Days
              </button>
              <button
                onClick={() => setCashFlowRange('6m')}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  cashFlowRange === '6m' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                6 Months
              </button>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis dataKey={cashFlowRange === '30d' ? 'date' : 'month'} stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                  formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="net" name="Net Savings" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Section 5: Spending Breakdown Donut */}
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-white">Spending Breakdown</h3>
              <span className="text-[11px] text-slate-400">By Category</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-4">Click any slice to view filtered transactions</p>

            <div className="h-48 w-full flex items-center justify-center">
              {spendingBreakdown.length === 0 ? (
                <div className="text-xs text-slate-500 text-center">No expenses recorded this month</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={spendingBreakdown}
                      dataKey="valueRupees"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      onClick={(entry) => navigate(`/transactions?categoryId=${entry.categoryId}`)}
                      cursor="pointer"
                    >
                      {spendingBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || '#6366f1'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                      formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Amount']}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Donut Legend */}
          <div className="space-y-1.5 mt-2 max-h-36 overflow-y-auto pr-1">
            {spendingBreakdown.map((cat) => (
              <div
                key={cat.categoryId}
                onClick={() => navigate(`/transactions?categoryId=${cat.categoryId}`)}
                className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="text-slate-300 font-medium truncate max-w-[120px]">{cat.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold">₹{cat.valueRupees.toLocaleString('en-IN')}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({cat.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ========================================================
          ROW: BUDGET PROGRESS + TRIP WIDGET
          ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 6: Budget Progress */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Budget Progress</h3>
              <p className="text-[11px] text-slate-400">Current monthly allowance tracking</p>
            </div>
            <Link to="/budgets" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1">
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3.5">
            {budgets.length === 0 ? (
              <div className="text-xs text-slate-500 py-6 text-center">No budgets set. Create your first budget in the Budgets tab.</div>
            ) : (
              budgets.slice(0, 3).map((b) => (
                <div
                  key={b.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    b.isOver ? 'bg-rose-500/10 border-rose-500/30' : 'bg-slate-800/40 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white">{b.categoryName}</span>
                    <div className="text-xs font-bold">
                      <span className={b.isOver ? 'text-rose-400' : 'text-slate-200'}>
                        {formatINR(b.spentPaise)}
                      </span>
                      <span className="text-slate-500"> / {formatINR(b.allocatedPaise)}</span>
                    </div>
                  </div>
                  <ProgressBar
                    percentage={b.percent}
                    color={b.isOver ? 'bg-rose-500' : 'bg-indigo-500'}
                    height="sm"
                    isOverLimit={b.isOver}
                  />
                  <div className="flex justify-between items-center text-[10px] mt-1.5 text-slate-400">
                    <span>{b.percent}% consumed</span>
                    {b.isOver ? (
                      <span className="text-rose-400 font-bold">Over budget by {formatINR(b.spentPaise - b.allocatedPaise)}</span>
                    ) : (
                      <span>{formatINR(b.allocatedPaise - b.spentPaise)} remaining</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Section 7: Trip Savings Widget */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-blue-950/20 border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-blue-400" />
                <span>Trip Savings Planner</span>
              </h3>
              <p className="text-[11px] text-slate-400">Target milestones & pace calculator</p>
            </div>
            <Link to="/trips" className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1">
              <span>Trip details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {tripWidget ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-extrabold text-white">{tripWidget.name}</h4>
                  <p className="text-xs text-slate-400">{tripWidget.destination}</p>
                </div>
                <div className="text-right">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    tripWidget.calculation.isOnTrack
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {tripWidget.calculation.statusMessage}
                  </span>
                </div>
              </div>

              {/* Progress */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1.5 font-semibold">
                  <span className="text-white">{formatINR(tripWidget.savedAmountPaise)} saved</span>
                  <span className="text-slate-400">Target: {formatINR(tripWidget.targetBudgetPaise)} ({tripWidget.calculation.percentageSaved}%)</span>
                </div>
                <ProgressBar percentage={tripWidget.calculation.percentageSaved} color="bg-blue-500" height="md" />
              </div>

              {/* Stat breakdown */}
              <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-xl bg-slate-800/40 border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-medium">Days Left</span>
                  <p className="text-sm font-bold text-white mt-0.5">{tripWidget.calculation.daysRemaining} days</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-medium">Remaining</span>
                  <p className="text-sm font-bold text-white mt-0.5">{formatINR(tripWidget.calculation.remainingPaise)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-medium">Monthly Req.</span>
                  <p className="text-sm font-bold text-indigo-400 mt-0.5">{formatINR(tripWidget.calculation.requiredMonthlySavingPaise)}</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed italic bg-slate-800/20 p-2.5 rounded-lg border border-slate-800">
                💡 {tripWidget.calculation.recommendation}
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <Compass className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No active trips planned yet.</p>
              <Button onClick={() => navigate('/trips')} size="sm" variant="primary" className="mt-3">
                Plan a Trip
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* ========================================================
          ROW: UPCOMING PAYMENTS + LEND/BORROW SUMMARY
          ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 8: Upcoming Payments */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-cyan-400" />
                <span>Upcoming Recurring Payments</span>
              </h3>
              <p className="text-[11px] text-slate-400">Rent, subscriptions, utilities, and dues</p>
            </div>
            <Link to="/bills" className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1">
              <span>Manage</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {upcomingPayments.length === 0 ? (
              <div className="text-xs text-slate-500 py-6 text-center">No upcoming bills due.</div>
            ) : (
              upcomingPayments.map((bill) => (
                <div
                  key={bill.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{bill.name}</h4>
                      <p className="text-[10px] text-slate-400">
                        Due {formatRelativeTime(bill.nextDueDate)} • {bill.frequency}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-white">{formatINR(bill.amountPaise)}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Section 9: Lend & Borrow Summary (Udhaar) */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <HandCoins className="w-4 h-4 text-amber-400" />
                <span>Lend & Borrow (Udhaar)</span>
              </h3>
              <p className="text-[11px] text-slate-400">Peer lending and borrowing balances</p>
            </div>
            <Link to="/loans" className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1">
              <span>View ledger</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* You will receive */}
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block mb-1">
                You will receive
              </span>
              <p className="text-xl sm:text-2xl font-black text-white">{formatINR(lendBorrow.totalReceivablePaise)}</p>
              <span className="text-[10px] text-slate-400 mt-1 block">Money lent to others</span>
            </div>

            {/* You need to pay */}
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider block mb-1">
                You need to pay
              </span>
              <p className="text-xl sm:text-2xl font-black text-white">{formatINR(lendBorrow.totalPayablePaise)}</p>
              <span className="text-[10px] text-slate-400 mt-1 block">Money borrowed from others</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-slate-800/40 border border-slate-800">
            <span className="text-slate-400">Active Udhaar records:</span>
            <span className="text-white font-bold">{lendBorrow.activeLoansCount} pending</span>
          </div>
        </Card>
      </div>

      {/* ========================================================
          ROW: RECENT TRANSACTIONS + AI INSIGHTS
          ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Section 10: Recent Transactions */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Recent Transactions</h3>
              <p className="text-[11px] text-slate-400">Latest income, expenses, and transfers</p>
            </div>
            <Link to="/transactions" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1">
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2">
            {recentTransactions.length === 0 ? (
              <div className="text-xs text-slate-500 py-8 text-center">No transactions recorded yet.</div>
            ) : (
              recentTransactions.map((tx) => {
                const isIncome = tx.type === 'INCOME' || tx.type === 'LOAN_REPAYMENT';
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-800/30 hover:bg-slate-800/70 border border-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold"
                        style={{ backgroundColor: `${tx.categoryColor}20`, color: tx.categoryColor }}
                      >
                        {tx.categoryName.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">{tx.description}</h4>
                        <p className="text-[10px] text-slate-400">
                          {tx.categoryName} • {tx.accountName} • {new Date(tx.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`text-xs font-bold ${isIncome ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isIncome ? '+' : '-'}{formatINR(tx.amountPaise)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Section 11: AI Insights */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-950/20 to-slate-900 border-purple-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">AI Financial Insights</h3>
            </div>
            <Link to="/ai-insights" className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1">
              <span>Assistant</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {aiInsights.length === 0 ? (
              <div className="text-xs text-slate-500 py-8 text-center">All caught up! No active financial alerts.</div>
            ) : (
              aiInsights.map((insight) => (
                <div
                  key={insight.id}
                  className="p-3.5 rounded-xl bg-slate-800/60 border border-purple-500/20 shadow-sm relative group"
                >
                  <button
                    onClick={() => handleDismissInsight(insight.id)}
                    className="absolute top-2.5 right-2.5 text-slate-500 hover:text-slate-300 p-1 rounded-md transition-colors"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>

                  <h4 className="text-xs font-bold text-purple-300 pr-5">{insight.title}</h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">{insight.explanation}</p>

                  <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 italic">Action: {insight.suggestedAction}</span>
                    <span className="text-[10px] font-mono text-purple-400 font-semibold">{Math.round(insight.confidence * 100)}% conf.</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
