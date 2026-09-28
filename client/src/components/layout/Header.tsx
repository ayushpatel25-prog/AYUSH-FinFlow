import React from 'react';
import { Search, Bell, Plus, Menu } from 'lucide-react';
import { Button } from '../common/Button.js';
import { useAuth } from '../../context/AuthContext.js';

interface HeaderProps {
  onOpenQuickAdd: () => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onOpenMobileMenu: () => void;
  unreadNotificationsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenQuickAdd,
  onOpenSearch,
  onOpenNotifications,
  onOpenMobileMenu,
  unreadNotificationsCount = 0,
}) => {
  const { user } = useAuth();

  // Dynamic greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
      {/* Left side: Mobile menu toggle + Greeting */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
            <span>{greeting}, {user?.name ? user.name.split(' ')[0] : 'there'}</span>
            <span className="text-sm">👋</span>
          </h2>
          <p className="text-[11px] text-slate-400 hidden sm:block">{todayFormatted}</p>
        </div>
      </div>

      {/* Right side: Global Search + Notifications + Quick Add */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Global Search trigger */}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-400 hover:text-slate-200 hover:border-slate-600 text-xs transition-colors"
          title="Search transactions, trips, loans, goals (Press /)"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Search anything...</span>
          <kbd className="hidden md:inline px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] text-slate-400 font-mono">
            /
          </kbd>
        </button>

        {/* Notifications Icon */}
        <button
          onClick={onOpenNotifications}
          className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          )}
        </button>

        {/* Global Quick Add Button */}
        <Button
          onClick={onOpenQuickAdd}
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          className="font-semibold shadow-indigo-500/20"
        >
          <span className="hidden sm:inline">Quick Add</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>
    </header>
  );
};
