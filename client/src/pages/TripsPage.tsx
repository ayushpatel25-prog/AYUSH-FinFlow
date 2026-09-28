import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Compass,
  Target,
  Plus,
  Calendar,
  MapPin,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Trash2,
  DollarSign,
  ArrowRight,
} from 'lucide-react';
import { api } from '../api/client.js';
import { formatINR, formatDate, rupeesToPaise } from '../utils/money.js';
import { Button } from '../components/common/Button.js';
import { Card } from '../components/common/Card.js';
import { ProgressBar } from '../components/common/ProgressBar.js';
import { Modal } from '../components/common/Modal.js';
import { Input } from '../components/common/Input.js';
import { CurrencyInput } from '../components/common/CurrencyInput.js';
import { Select } from '../components/common/Select.js';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton.js';
import type { Trip, Goal, Account } from '../types/index.js';

export const TripsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'TRIPS' | 'GOALS'>('TRIPS');

  // Modals state
  const [isAddTripOpen, setIsAddTripOpen] = useState(false);
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);
  const [isAddContributionOpen, setIsAddContributionOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  // Add Trip Form State
  const [tripName, setTripName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [travelers, setTravelers] = useState(1);
  const [targetBudget, setTargetBudget] = useState<number>(0);
  const [initialSaved, setInitialSaved] = useState<number>(0);

  // Add Goal Form State
  const [goalName, setGoalName] = useState('');
  const [goalCategory, setGoalCategory] = useState('Savings');
  const [goalTargetAmount, setGoalTargetAmount] = useState<number>(0);
  const [goalTargetDate, setGoalTargetDate] = useState('');
  const [goalPriority, setGoalPriority] = useState('MEDIUM');

  // Contribution Form State
  const [contribAmount, setContribAmount] = useState<number>(0);
  const [contribAccountId, setContribAccountId] = useState('');

  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [error, setError] = useState('');

  const { data: trips = [], isLoading: isLoadingTrips } = useQuery({
    queryKey: ['trips'],
    queryFn: api.trips.getAll,
  });

  const { data: goals = [], isLoading: isLoadingGoals } = useQuery({
    queryKey: ['goals'],
    queryFn: api.goals.getAll,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: api.accounts.getAll,
  });

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetBudget <= 0) {
      setError('Please enter a target budget greater than 0');
      return;
    }
    setIsLoadingSubmit(true);
    setError('');

    try {
      await api.trips.create({
        name: tripName,
        destination,
        startDate,
        endDate,
        travelers: Number(travelers),
        targetBudgetPaise: rupeesToPaise(targetBudget),
        initialSavedPaise: rupeesToPaise(initialSaved),
      });

      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsAddTripOpen(false);
      setTripName('');
      setDestination('');
      setTargetBudget(0);
      setInitialSaved(0);
    } catch (err: any) {
      setError(err.message || 'Failed to create trip');
    } finally {
      setIsLoadingSubmit(false);
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (goalTargetAmount <= 0) {
      setError('Please enter a target savings amount.');
      return;
    }
    setIsLoadingSubmit(true);
    setError('');

    try {
      await api.goals.create({
        name: goalName,
        category: goalCategory,
        targetAmountPaise: rupeesToPaise(goalTargetAmount),
        targetDate: goalTargetDate,
        priority: goalPriority,
      });

      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsAddGoalOpen(false);
      setGoalName('');
      setGoalTargetAmount(0);
    } catch (err: any) {
      setError(err.message || 'Failed to create goal');
    } finally {
      setIsLoadingSubmit(false);
    }
  };

  const handleAddContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrip || contribAmount <= 0) return;
    setIsLoadingSubmit(true);
    setError('');

    try {
      await api.trips.addContribution(selectedTrip.id, {
        amountPaise: rupeesToPaise(contribAmount),
        accountId: contribAccountId || accounts[0]?.id,
      });

      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsAddContributionOpen(false);
      setContribAmount(0);
      setSelectedTrip(null);
    } catch (err: any) {
      setError(err.message || 'Contribution failed');
    } finally {
      setIsLoadingSubmit(false);
    }
  };

  const handleDeleteTrip = async (id: string) => {
    if (!window.confirm('Delete this trip plan?')) return;
    try {
      await api.trips.delete(id);
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Trips & Savings Goals</h1>
          <p className="text-xs text-slate-400 mt-1">
            Plan travel budgets, calculate daily/monthly required pace, and reach life goals.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex p-1 rounded-xl bg-slate-800 border border-slate-700/80 text-xs">
            <button
              onClick={() => setActiveTab('TRIPS')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                activeTab === 'TRIPS' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Trips & Expeditions
            </button>
            <button
              onClick={() => setActiveTab('GOALS')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                activeTab === 'GOALS' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Savings Goals
            </button>
          </div>

          <Button
            onClick={() => (activeTab === 'TRIPS' ? setIsAddTripOpen(true) : setIsAddGoalOpen(true))}
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            {activeTab === 'TRIPS' ? 'Plan Trip' : 'New Goal'}
          </Button>
        </div>
      </div>

      {/* ========================================================
          TRIPS TAB
          ======================================================== */}
      {activeTab === 'TRIPS' && (
        <div className="space-y-6">
          {isLoadingTrips ? (
            <LoadingSkeleton rows={2} height="h-64" />
          ) : trips.length === 0 ? (
            <Card className="text-center py-16">
              <Compass className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">No trips planned yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                Create a savings goal for your next adventure with our daily pace calculator.
              </p>
              <Button onClick={() => setIsAddTripOpen(true)} variant="primary" size="sm">
                Plan Your First Adventure
              </Button>
            </Card>
          ) : (
            trips.map((trip: Trip) => (
              <Card key={trip.id} className="p-6 border-slate-800 bg-slate-900/90 relative">
                {/* Trip Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {trip.status}
                      </span>
                      <h2 className="text-xl font-bold text-white">{trip.name}</h2>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        {trip.destination}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        {trip.travelers} Traveler(s)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => {
                        setSelectedTrip(trip);
                        setContribAccountId(accounts[0]?.id || '');
                        setIsAddContributionOpen(true);
                      }}
                      variant="primary"
                      size="sm"
                    >
                      + Add Savings Deposit
                    </Button>
                    <button
                      onClick={() => handleDeleteTrip(trip.id)}
                      className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                      title="Delete Trip"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Savings Metrics Row */}
                {trip.calculation && (
                  <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Target Budget</span>
                      <p className="text-base sm:text-lg font-black text-white mt-0.5">
                        {formatINR(trip.targetBudgetPaise)}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Already Saved</span>
                      <p className="text-base sm:text-lg font-black text-emerald-400 mt-0.5">
                        {formatINR(trip.savedAmountPaise)}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Days Remaining</span>
                      <p className="text-base sm:text-lg font-black text-white mt-0.5">
                        {trip.calculation.daysRemaining} days
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Required Monthly</span>
                      <p className="text-base sm:text-lg font-black text-indigo-400 mt-0.5">
                        {formatINR(trip.calculation.requiredMonthlySavingPaise)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Progress Bar & Pace Message */}
                <div className="mt-4">
                  <ProgressBar
                    percentage={trip.calculation?.percentageSaved || 0}
                    color="bg-blue-500"
                    height="md"
                    showLabel={true}
                  />
                  {trip.calculation && (
                    <div className="mt-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-slate-300 leading-relaxed">
                      <p className="font-semibold text-blue-300 mb-0.5">{trip.calculation.statusMessage}</p>
                      <p>{trip.calculation.recommendation}</p>
                    </div>
                  )}
                </div>

                {/* Category Estimates vs Actuals */}
                <div className="mt-6 pt-5 border-t border-slate-800">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                    Trip Category Breakdown (Estimated vs Actual Expenses)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    {trip.categories.map((c) => (
                      <div key={c.id} className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-800 text-xs">
                        <span className="font-semibold text-slate-200 block truncate">{c.category}</span>
                        <div className="mt-1 flex justify-between text-[11px]">
                          <span className="text-slate-400">Est: {formatINR(c.estimatedPaise)}</span>
                          <span className="font-bold text-white">Act: {formatINR(c.actualPaise)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ========================================================
          GOALS TAB
          ======================================================== */}
      {activeTab === 'GOALS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {isLoadingGoals ? (
            <LoadingSkeleton rows={3} height="h-44" />
          ) : goals.length === 0 ? (
            <Card className="col-span-full text-center py-16">
              <Target className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">No savings goals created</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                Set milestones for a new laptop, emergency fund, or vehicle down payment.
              </p>
              <Button onClick={() => setIsAddGoalOpen(true)} variant="primary" size="sm">
                Create First Goal
              </Button>
            </Card>
          ) : (
            goals.map((goal: Goal) => (
              <Card key={goal.id} className="p-5 border-slate-800 bg-slate-900/80 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">{goal.name}</h3>
                    <span className="text-[10px] text-slate-400 font-medium">{goal.category}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                    goal.computedStatus === 'COMPLETED'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                  }`}>
                    {goal.computedStatus}
                  </span>
                </div>

                <div>
                  <div className="flex justify-between items-baseline text-xs mb-1">
                    <span className="text-xl font-black text-white">{formatINR(goal.currentAmountPaise)}</span>
                    <span className="text-slate-400 font-semibold">Target: {formatINR(goal.targetAmountPaise)}</span>
                  </div>
                  <ProgressBar percentage={goal.percentage} color="bg-indigo-500" height="sm" />
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
                  <span>Due {formatDate(goal.targetDate)}</span>
                  <span className="font-bold text-white">{formatINR(goal.requiredMonthlyPaise)}/mo required</span>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Plan Trip Modal */}
      <Modal isOpen={isAddTripOpen} onClose={() => setIsAddTripOpen(false)} title="Plan a New Trip" maxWidth="md">
        <form onSubmit={handleCreateTrip} className="space-y-4">
          {error && <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 text-xs">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Trip Name"
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              placeholder="e.g. Goa Beach Vacation"
              required
              autoFocus
            />
            <Input
              label="Destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. North Goa, India"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <Input
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
            <Input
              label="Travelers"
              type="number"
              min="1"
              value={travelers}
              onChange={(e) => setTravelers(parseInt(e.target.value, 10))}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CurrencyInput
              label="Target Budget Total"
              value={targetBudget || ''}
              onChange={setTargetBudget}
              placeholder="30000"
              required
            />
            <CurrencyInput
              label="Already Saved / Contributed"
              value={initialSaved || ''}
              onChange={setInitialSaved}
              placeholder="0.00"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsAddTripOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isLoadingSubmit}>
              Create Trip Plan
            </Button>
          </div>
        </form>
      </Modal>

      {/* New Goal Modal */}
      <Modal isOpen={isAddGoalOpen} onClose={() => setIsAddGoalOpen(false)} title="Create Savings Goal" maxWidth="sm">
        <form onSubmit={handleCreateGoal} className="space-y-4">
          {error && <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 text-xs">{error}</div>}

          <Input
            label="Goal Name"
            value={goalName}
            onChange={(e) => setGoalName(e.target.value)}
            placeholder="e.g. Emergency Fund, MacBook Pro"
            required
            autoFocus
          />

          <CurrencyInput
            label="Target Amount"
            value={goalTargetAmount || ''}
            onChange={setGoalTargetAmount}
            placeholder="50000"
            required
          />

          <Input
            label="Target Deadline"
            type="date"
            value={goalTargetDate}
            onChange={(e) => setGoalTargetDate(e.target.value)}
            required
          />

          <Select
            label="Priority"
            value={goalPriority}
            onChange={(e) => setGoalPriority(e.target.value)}
            options={[
              { value: 'HIGH', label: 'High Priority' },
              { value: 'MEDIUM', label: 'Medium Priority' },
              { value: 'LOW', label: 'Low Priority' },
            ]}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsAddGoalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isLoadingSubmit}>
              Save Goal
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Contribution to Trip Modal */}
      <Modal
        isOpen={isAddContributionOpen}
        onClose={() => setIsAddContributionOpen(false)}
        title={`Deposit Savings to ${selectedTrip?.name}`}
        maxWidth="sm"
      >
        <form onSubmit={handleAddContribution} className="space-y-4">
          <CurrencyInput
            label="Deposit Amount"
            value={contribAmount || ''}
            onChange={setContribAmount}
            placeholder="5000"
            required
            autoFocus
          />

          <Select
            label="Deduct From Account"
            value={contribAccountId}
            onChange={(e) => setContribAccountId(e.target.value)}
            options={accounts.map(a => ({ value: a.id, label: `${a.name} (${formatINR(a.currentBalancePaise)})` }))}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsAddContributionOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isLoadingSubmit}>
              Deposit to Trip
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
