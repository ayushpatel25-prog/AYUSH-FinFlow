import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Compass,
  HandCoins,
  MoreHorizontal,
} from 'lucide-react';
import { clsx } from 'clsx';

interface BottomNavProps {
  onOpenMore: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onOpenMore }) => {
  const links = [
    { name: 'Home', path: '/', icon: LayoutDashboard },
    { name: 'Transactions', path: '/transactions', icon: ArrowLeftRight },
    { name: 'Trips & Goals', path: '/trips', icon: Compass },
    { name: 'Udhaar', path: '/loans', icon: HandCoins },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 px-3 py-2 flex items-center justify-around">
      {links.map((link) => (
        <NavLink
          key={link.path}
          to={link.path}
          className={({ isActive }) =>
            clsx(
              'flex flex-col items-center gap-1 text-[10px] font-medium py-1 px-2.5 rounded-lg transition-colors',
              isActive ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            )
          }
        >
          <link.icon className="w-5 h-5" />
          <span>{link.name}</span>
        </NavLink>
      ))}

      <button
        onClick={onOpenMore}
        className="flex flex-col items-center gap-1 text-[10px] font-medium py-1 px-2.5 rounded-lg text-slate-400 hover:text-slate-200"
      >
        <MoreHorizontal className="w-5 h-5" />
        <span>More</span>
      </button>
    </nav>
  );
};
