import React from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

interface ProgressBarProps {
  percentage: number;
  color?: string;
  height?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  isOverLimit?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percentage,
  color = 'bg-indigo-500',
  height = 'md',
  showLabel = false,
  isOverLimit = false,
}) => {
  const clamped = Math.min(100, Math.max(0, percentage));

  const heightStyles = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-3.5',
  };

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between items-center text-xs mb-1.5 font-medium">
          <span className="text-slate-400">Progress</span>
          <span className={clsx(isOverLimit ? 'text-rose-400 font-bold' : 'text-slate-200')}>
            {percentage.toFixed(1)}% {isOverLimit && '(Over Budget)'}
          </span>
        </div>
      )}
      <div className={clsx('w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50', heightStyles[height])}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={clsx(
            'h-full rounded-full transition-all duration-300',
            isOverLimit ? 'bg-rose-500' : color
          )}
        />
      </div>
    </div>
  );
};
