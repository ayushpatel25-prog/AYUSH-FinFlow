import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from './Sidebar.js';
import { Header } from './Header.js';
import { BottomNav } from './BottomNav.js';
import { QuickAddModal } from './QuickAddModal.js';
import { GlobalSearchModal } from './GlobalSearchModal.js';
import { NotificationsDrawer } from './NotificationsDrawer.js';
import { api } from '../../api/client.js';
import { Modal } from '../common/Modal.js';
import { NavLink } from 'react-router-dom';
import {
  PieChart,
  Wallet,
  Receipt,
  BarChart3,
  Sparkles,
  Settings,
  X,
} from 'lucide-react';

export const AppLayout: React.FC = () => {
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);

  const queryClient = useQueryClient();

  // Keyboard shortcut '/' for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch accounts and categories for Quick Add
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: api.accounts.getAll,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: api.transactions.getCategories,
  });

  const { data: trips = [] } = useQuery({
    queryKey: ['trips'],
    queryFn: api.trips.getAll,
  });

  const { data: loansData } = useQuery({
    queryKey: ['loans'],
    queryFn: api.loans.getSummary,
  });

  const { data: notifications = [], refetch: refetchNotifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: api.notifications.getAll,
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleDataRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['budgets'] });
    queryClient.invalidateQueries({ queryKey: ['trips'] });
    queryClient.invalidateQueries({ queryKey: ['goals'] });
    queryClient.invalidateQueries({ queryKey: ['loans'] });
    queryClient.invalidateQueries({ queryKey: ['bills'] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
    queryClient.invalidateQueries({ queryKey: ['ai-insights'] });
    refetchNotifications();
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col lg:flex-row text-slate-100">
      {/* Desktop Sidebar */}
      <Sidebar className="hidden lg:flex" />

      {/* Mobile Drawer Navigation */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-72 bg-slate-900 h-full z-10 border-r border-slate-800">
            <div className="flex justify-end p-4 border-b border-slate-800">
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <Sidebar onNavigate={() => setIsMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0">
        <Header
          onOpenQuickAdd={() => setIsQuickAddOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          unreadNotificationsCount={unreadCount}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet context={{ onOpenQuickAdd: () => setIsQuickAddOpen(true), onRefresh: handleDataRefresh }} />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav onOpenMore={() => setIsMobileMoreOpen(true)} />

      {/* Mobile "More" Menu Modal */}
      <Modal
        isOpen={isMobileMoreOpen}
        onClose={() => setIsMobileMoreOpen(false)}
        title="More Features"
        maxWidth="sm"
      >
        <div className="grid grid-cols-2 gap-3 py-2">
          <NavLink
            to="/budgets"
            onClick={() => setIsMobileMoreOpen(false)}
            className="flex flex-col items-center p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-300"
          >
            <PieChart className="w-6 h-6 text-indigo-400 mb-1.5" />
            <span className="text-xs font-semibold">Budgets</span>
          </NavLink>
          <NavLink
            to="/accounts"
            onClick={() => setIsMobileMoreOpen(false)}
            className="flex flex-col items-center p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-300"
          >
            <Wallet className="w-6 h-6 text-emerald-400 mb-1.5" />
            <span className="text-xs font-semibold">Accounts</span>
          </NavLink>
          <NavLink
            to="/bills"
            onClick={() => setIsMobileMoreOpen(false)}
            className="flex flex-col items-center p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-300"
          >
            <Receipt className="w-6 h-6 text-cyan-400 mb-1.5" />
            <span className="text-xs font-semibold">Bills</span>
          </NavLink>
          <NavLink
            to="/reports"
            onClick={() => setIsMobileMoreOpen(false)}
            className="flex flex-col items-center p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-300"
          >
            <BarChart3 className="w-6 h-6 text-amber-400 mb-1.5" />
            <span className="text-xs font-semibold">Reports</span>
          </NavLink>
          <NavLink
            to="/ai-insights"
            onClick={() => setIsMobileMoreOpen(false)}
            className="flex flex-col items-center p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-300"
          >
            <Sparkles className="w-6 h-6 text-purple-400 mb-1.5" />
            <span className="text-xs font-semibold">AI Insights</span>
          </NavLink>
          <NavLink
            to="/settings"
            onClick={() => setIsMobileMoreOpen(false)}
            className="flex flex-col items-center p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-300"
          >
            <Settings className="w-6 h-6 text-slate-400 mb-1.5" />
            <span className="text-xs font-semibold">Settings</span>
          </NavLink>
        </div>
      </Modal>

      {/* Global Quick Add Modal */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        accounts={accounts}
        categories={categories}
        trips={trips}
        loans={loansData?.loans}
        onSuccess={handleDataRefresh}
      />

      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />

      {/* Notifications Drawer */}
      <NotificationsDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onRefresh={handleDataRefresh}
      />
    </div>
  );
};
