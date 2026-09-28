import React from 'react';
import { Card } from './Card.js';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { clsx } from 'clsx';

interface StatCardProps {
  title: string;
  value: string;
  trendPct?: number;
  trendLabel?: string;
  icon: React.ReactNode;
  iconColor?: string;
  iconBg?: string;
  isPositiveGood?: boolean; // For expenses, negative trend is good!
  subtext?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  trendPct,
  trendLabel = 'from last month',
  icon,
  iconColor = 'text-indigo-400',
  iconBg = 'bg-indigo-500/10 border-indigo-500/20',
  isPositiveGood = true,
  subtext,
}) => {
  const hasTrend = trendPct !== undefined && trendPct !== null;
  const isPositive = (trendPct ?? 0) > 0;
  const isNeutral = trendPct === 0;

  // For expenses, an increase is bad (red) and a decrease is good (green)
  const isGood = isPositiveGood ? isPositive : !isPositive;

  return (
    <Card className="relative overflow-hidden group hover:border-slate-700/80 transition-all duration-300">
      {/* Top row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</span>
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center border transition-transform duration-300 group-hover:scale-105', iconBg, iconColor)}>
          {icon}
        </div>
      </div>

      {/* Main value */}
      <div className="mt-3">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{value}</h2>
      </div>

      {/* Footer / Trend */}
      <div className="mt-3 flex items-center gap-2 text-xs">
        {hasTrend && (
          <div
            className={clsx(
              'flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full border',
              isNeutral
                ? 'text-slate-400 bg-slate-800/60 border-slate-700'
                : isGood
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
            )}
          >
            {isNeutral ? (
              <Minus className="w-3 h-3" />
            ) : isPositive ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            <span>
              {isPositive ? '+' : ''}
              {trendPct}%
            </span>
          </div>
        )}
        <span className="text-slate-400">{subtext || trendLabel}</span>
      </div>
    </Card>
  );
};
