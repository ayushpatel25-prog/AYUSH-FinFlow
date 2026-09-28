import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../../context/AuthContext.js';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  error?: string;
  value?: number | string;
  onChange?: (val: number) => void;
  helperText?: string;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  label,
  error,
  value,
  onChange,
  helperText,
  className,
  id,
  placeholder = '0.00',
  ...props
}) => {
  const { user } = useAuth();
  const symbol = user?.currencySymbol || '₹';
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    const num = parseFloat(raw);
    if (onChange) {
      onChange(isNaN(num) ? 0 : num);
    }
  };

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <div className="absolute left-3.5 text-indigo-400 font-bold text-base pointer-events-none select-none">
          {symbol}
        </div>
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          value={value !== undefined ? value : ''}
          onChange={handleChange}
          placeholder={placeholder}
          className={twMerge(
            clsx(
              'w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2.5 text-base font-semibold text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all',
              error && 'border-rose-500 focus:ring-rose-500',
              className
            )
          )}
          {...props}
        />
      </div>
      {error && <span className="text-xs text-rose-400 font-medium">{error}</span>}
      {helperText && !error && <span className="text-xs text-slate-500">{helperText}</span>}
    </div>
  );
};
