import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download, Calendar, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { api } from '../api/client.js';
import { formatINR } from '../utils/money.js';
import { Button } from '../components/common/Button.js';
import { Card } from '../components/common/Card.js';
import { Select } from '../components/common/Select.js';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton.js';

export const ReportsPage: React.FC = () => {
  const now = new Date();
  const [reportType, setReportType] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);

  const { data: monthlyData, isLoading: isLoadingMonthly } = useQuery({
    queryKey: ['report-monthly', selectedYear, selectedMonth],
    queryFn: () => api.reports.getMonthly(selectedYear, selectedMonth),
    enabled: reportType === 'MONTHLY',
  });

  const { data: yearlyData, isLoading: isLoadingYearly } = useQuery({
    queryKey: ['report-yearly', selectedYear],
    queryFn: () => api.reports.getYearly(selectedYear),
    enabled: reportType === 'YEARLY',
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Financial Reports & Statements</h1>
          <p className="text-xs text-slate-400 mt-1">
            Deep analytical view into cash flow statements, savings velocity, and expenditure patterns.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex p-1 rounded-xl bg-slate-800 border border-slate-700/80 text-xs">
            <button
              onClick={() => setReportType('MONTHLY')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                reportType === 'MONTHLY' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Monthly Statement
            </button>
            <button
              onClick={() => setReportType('YEARLY')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                reportType === 'YEARLY' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Yearly Overview
            </button>
          </div>

          <a
            href={api.exportReset.exportCSVUrl}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Date Selectors */}
      <Card className="p-4 flex flex-wrap items-center gap-4">
        <div className="w-36">
          <Select
            label="Year"
            value={selectedYear.toString()}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            options={[
              { value: '2026', label: '2026' },
              { value: '2025', label: '2025' },
              { value: '2024', label: '2024' },
            ]}
          />
        </div>

        {reportType === 'MONTHLY' && (
          <div className="w-44">
            <Select
              label="Month"
              value={selectedMonth.toString()}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
              options={[
                { value: '1', label: 'January' },
                { value: '2', label: 'February' },
                { value: '3', label: 'March' },
                { value: '4', label: 'April' },
                { value: '5', label: 'May' },
                { value: '6', label: 'June' },
                { value: '7', label: 'July' },
                { value: '8', label: 'August' },
                { value: '9', label: 'September' },
                { value: '10', label: 'October' },
                { value: '11', label: 'November' },
                { value: '12', label: 'December' },
              ]}
            />
          </div>
        )}
      </Card>

      {/* ========================================================
          MONTHLY STATEMENT
          ======================================================== */}
      {reportType === 'MONTHLY' && (
        <div className="space-y-6">
          {isLoadingMonthly ? (
            <LoadingSkeleton rows={3} height="h-32" />
          ) : !monthlyData ? (
            <div className="text-center py-12 text-slate-400 text-xs">No data for this statement period.</div>
          ) : (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4 bg-emerald-500/10 border-emerald-500/20">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                    Total Income
                  </span>
                  <p className="text-2xl font-black text-white mt-1">{formatINR(monthlyData.totalIncomePaise)}</p>
                </Card>

                <Card className="p-4 bg-rose-500/10 border-rose-500/20">
                  <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block">
                    Total Expenses
                  </span>
                  <p className="text-2xl font-black text-white mt-1">{formatINR(monthlyData.totalExpensePaise)}</p>
                </Card>

                <Card className="p-4 bg-indigo-500/10 border-indigo-500/20">
                  <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block">
                    Net Savings
                  </span>
                  <p className="text-2xl font-black text-white mt-1">{formatINR(monthlyData.netSavingsPaise)}</p>
                </Card>

                <Card className="p-4 bg-slate-900 border-slate-800">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Savings Rate
                  </span>
                  <p className="text-2xl font-black text-teal-400 mt-1">{monthlyData.savingsRate}%</p>
                </Card>
              </div>

              {/* Top Categories Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <h3 className="text-sm font-bold text-white mb-3">Top Spending Categories</h3>
                  <div className="space-y-3">
                    {monthlyData.topCategories.map((cat: any) => (
                      <div key={cat.name} className="flex justify-between items-center text-xs p-2 rounded-lg bg-slate-800/40">
                        <span className="font-semibold text-white">{cat.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-rose-400 font-bold">{formatINR(cat.amountPaise)}</span>
                          <span className="text-slate-400 font-mono">({cat.percentage}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Largest Transactions */}
                <Card>
                  <h3 className="text-sm font-bold text-white mb-3">Largest Transactions</h3>
                  <div className="space-y-2">
                    {monthlyData.largestTransactions.map((tx: any) => (
                      <div key={tx.id} className="flex justify-between items-center text-xs p-2 rounded-lg bg-slate-800/40">
                        <div>
                          <p className="font-semibold text-white">{tx.description}</p>
                          <p className="text-[10px] text-slate-400">{tx.category?.name} • {new Date(tx.date).toLocaleDateString()}</p>
                        </div>
                        <span className="text-rose-400 font-bold">{formatINR(tx.amountPaise)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================
          YEARLY OVERVIEW
          ======================================================== */}
      {reportType === 'YEARLY' && (
        <Card className="p-6">
          <h3 className="text-base font-bold text-white mb-4">
            Annual Cash Flow Statement ({selectedYear})
          </h3>
          {isLoadingYearly ? (
            <LoadingSkeleton rows={1} height="h-72" />
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearlyData?.monthsData || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                    formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="net" name="Net Savings" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
