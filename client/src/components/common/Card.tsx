import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
  glass?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  hoverEffect = false,
  glass = true,
  ...props
}) => {
  return (
    <div
      className={twMerge(
        clsx(
          'rounded-2xl p-5 border transition-all duration-200',
          glass
            ? 'bg-slate-900/70 border-slate-800/80 backdrop-blur-md shadow-sm'
            : 'bg-slate-900 border-slate-800 shadow-sm',
          hoverEffect && 'hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
};
