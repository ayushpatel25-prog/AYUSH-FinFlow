import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../common/Modal.js';
import { api } from '../../api/client.js';
import { formatINR } from '../../utils/money.js';
import {
  Search,
  ArrowLeftRight,
  Compass,
  Target,
  HandCoins,
  Receipt,
  Tag,
  Loader2,
} from 'lucide-react';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>({
    transactions: [],
    trips: [],
    goals: [],
    loans: [],
    bills: [],
    categories: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!query.trim()) {
      setResults({ transactions: [], trips: [], goals: [], loans: [], bills: [], categories: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const data = await api.search.query(query);
        setResults(data);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
  };

  const hasAnyResults =
    results.transactions?.length > 0 ||
    results.trips?.length > 0 ||
    results.goals?.length > 0 ||
    results.loans?.length > 0 ||
    results.bills?.length > 0 ||
    results.categories?.length > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="xl" className="p-4 sm:p-5">
      {/* Search Input Box */}
      <div className="relative flex items-center border-b border-slate-800 pb-3">
        <Search className="w-5 h-5 text-indigo-400 absolute left-2 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by keyword, person, category, amount, trip (e.g. Rahul, 500, Manali)..."
          className="w-full bg-transparent pl-10 pr-10 text-base text-white placeholder:text-slate-500 focus:outline-none"
          autoFocus
        />
        {isLoading && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin absolute right-2" />}
      </div>

      {/* Results Listing */}
      <div className="mt-4 max-h-[60vh] overflow-y-auto space-y-4 pr-1">
        {!query && (
          <div className="py-8 text-center text-slate-500 text-xs">
            Start typing to search transactions, trips, loans, goals, and bills...
          </div>
        )}

        {query && !isLoading && !hasAnyResults && (
          <div className="py-8 text-center text-slate-400 text-sm">
            No financial records found matching &ldquo;<span className="text-white font-medium">{query}</span>&rdquo;
          </div>
        )}

        {/* Transactions Group */}
        {results.transactions?.length > 0 && (
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-400" />
              <span>Transactions ({results.transactions.length})</span>
            </div>
            <div className="space-y-1">
              {results.transactions.map((tx: any) => (
                <div
                  key={tx.id}
                  onClick={() => handleSelect('/transactions')}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 transition-colors cursor-pointer border border-slate-800/60"
                >
                  <div>
                    <p className="text-xs font-semibold text-white">{tx.description}</p>
                    <p className="text-[10px] text-slate-400">
                      {tx.category?.name || 'General'} • {tx.account?.name || 'Account'} • {new Date(tx.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className={`text-xs font-bold ${tx.type === 'INCOME' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {tx.type === 'INCOME' ? '+' : '-'}{formatINR(tx.amountPaise)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trips Group */}
        {results.trips?.length > 0 && (
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-blue-400" />
              <span>Trips ({results.trips.length})</span>
            </div>
            <div className="space-y-1">
              {results.trips.map((trip: any) => (
                <div
                  key={trip.id}
                  onClick={() => handleSelect('/trips')}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 transition-colors cursor-pointer border border-slate-800/60"
                >
                  <div>
                    <p className="text-xs font-semibold text-white">{trip.name}</p>
                    <p className="text-[10px] text-slate-400">{trip.destination}</p>
                  </div>
                  <span className="text-xs text-indigo-400 font-semibold">{formatINR(trip.targetBudgetPaise)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loans Group */}
        {results.loans?.length > 0 && (
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <HandCoins className="w-3.5 h-3.5 text-amber-400" />
              <span>Udhaar / Loans ({results.loans.length})</span>
            </div>
            <div className="space-y-1">
              {results.loans.map((loan: any) => (
                <div
                  key={loan.id}
                  onClick={() => handleSelect('/loans')}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 transition-colors cursor-pointer border border-slate-800/60"
                >
                  <div>
                    <p className="text-xs font-semibold text-white">{loan.person}</p>
                    <p className="text-[10px] text-slate-400">{loan.type === 'LENT' ? 'You lent' : 'You borrowed'} • {loan.purpose}</p>
                  </div>
                  <span className="text-xs text-amber-400 font-bold">{formatINR(loan.remainingPaise)} left</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Goals & Bills Group */}
        {results.goals?.length > 0 && (
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-teal-400" />
              <span>Goals</span>
            </div>
            <div className="space-y-1">
              {results.goals.map((g: any) => (
                <div
                  key={g.id}
                  onClick={() => handleSelect('/trips')}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 cursor-pointer border border-slate-800/60 text-xs"
                >
                  <span className="text-white font-medium">{g.name}</span>
                  <span className="text-teal-400 font-bold">{formatINR(g.targetAmountPaise)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
