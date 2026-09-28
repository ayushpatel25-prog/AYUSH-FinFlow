import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../api/client.js';
import { Card } from '../components/common/Card.js';
import { Button } from '../components/common/Button.js';
import { Input } from '../components/common/Input.js';
import { Select } from '../components/common/Select.js';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog.js';
import {
  Settings,
  Download,
  Trash2,
  Moon,
  Sun,
  Palette,
  ShieldAlert,
  Database,
  CheckCircle2,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user, updateUser, theme, setTheme, accentColor, setAccentColor } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [currency, setCurrency] = useState(user?.currency || 'INR');
  const [currencySymbol, setCurrencySymbol] = useState(user?.currencySymbol || '₹');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Reset dialog state
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSuccess(false);

    try {
      await updateUser({
        name,
        currency,
        currencySymbol,
      });
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleResetData = async (password?: string) => {
    setIsResetting(true);
    try {
      await api.exportReset.resetData({
        confirmationText: 'RESET',
        password: password || '',
      });
      setResetSuccess(true);
      setIsResetDialogOpen(false);
    } catch (err: any) {
      throw err;
    } finally {
      setIsResetting(false);
    }
  };

  const accentOptions = [
    { id: 'emerald', label: 'Emerald Green', class: 'bg-emerald-500' },
    { id: 'indigo', label: 'Indigo FinTech', class: 'bg-indigo-500' },
    { id: 'violet', label: 'Royal Violet', class: 'bg-violet-500' },
    { id: 'sky', label: 'Ocean Sky', class: 'bg-sky-500' },
    { id: 'amber', label: 'Warm Amber', class: 'bg-amber-500' },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">System Settings & Data Control</h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage your profile, visual themes, data backup archives, and security permissions.
        </p>
      </div>

      {resetSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>Your financial database has been completely and safely reset to zero.</span>
        </div>
      )}

      {/* Profile & Currency */}
      <Card className="p-6">
        <h3 className="text-sm font-bold text-white mb-4">Profile & Currency Standards</h3>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
            />
            <Input
              label="Registered Email"
              value={user?.email || ''}
              disabled
              helperText="Managed by authentication service"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Standard Currency"
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                if (e.target.value === 'INR') setCurrencySymbol('₹');
                else if (e.target.value === 'USD') setCurrencySymbol('$');
                else if (e.target.value === 'EUR') setCurrencySymbol('€');
                else if (e.target.value === 'GBP') setCurrencySymbol('£');
              }}
              options={[
                { value: 'INR', label: 'Indian Rupee (INR - ₹)' },
                { value: 'USD', label: 'US Dollar (USD - $)' },
                { value: 'EUR', label: 'Euro (EUR - €)' },
                { value: 'GBP', label: 'British Pound (GBP - £)' },
              ]}
            />
            <Input
              label="Currency Symbol"
              value={currencySymbol}
              onChange={(e) => setCurrencySymbol(e.target.value)}
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            {profileSuccess && (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Preferences saved!
              </span>
            )}
            <Button type="submit" variant="primary" size="sm" isLoading={isSavingProfile} className="ml-auto">
              Save Preferences
            </Button>
          </div>
        </form>
      </Card>

      {/* Theme & Accent Customization */}
      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-bold text-white">Appearance & Branding</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
          {/* Light/Dark Mode */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
              Color Mode
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all ${
                  theme === 'dark'
                    ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                <Moon className="w-4 h-4" /> Dark Mode
              </button>
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all ${
                  theme === 'light'
                    ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                <Sun className="w-4 h-4" /> Light Mode
              </button>
            </div>
          </div>

          {/* Accent Color */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
              Brand Accent Palette
            </label>
            <div className="flex items-center gap-3">
              {accentOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setAccentColor(opt.id)}
                  title={opt.label}
                  className={`w-9 h-9 rounded-xl ${opt.class} transition-transform ${
                    accentColor === opt.id ? 'ring-4 ring-white/20 scale-110 shadow-lg' : 'opacity-70 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Data Export & Backup */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Full Data Portability & Archive</h3>
            <p className="text-xs text-slate-400">
              Download your entire personal financial history as structured JSON or CSV.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <a
            href={api.exportReset.exportJSONUrl}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-colors"
          >
            <Download className="w-4 h-4 text-blue-400" />
            <span>Download Complete JSON Backup</span>
          </a>

          <a
            href={api.exportReset.exportCSVUrl}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Download Transactions CSV</span>
          </a>
        </div>
      </Card>

      {/* Danger Zone: Permanent Data Reset */}
      <Card className="p-6 border-rose-500/30 bg-rose-950/10 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-rose-400">Permanent Financial Data Reset</h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              This action will permanently delete all your transactions, trip budgets, loans, recurring bills, and savings goals.
              Your user account and password will be preserved, but all balances will return to zero.
            </p>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-rose-500/20">
          <a
            href={api.exportReset.exportJSONUrl}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
          >
            Backup your data first (Recommended)
          </a>

          <Button
            onClick={() => setIsResetDialogOpen(true)}
            variant="danger"
            size="sm"
            leftIcon={<Trash2 className="w-4 h-4" />}
          >
            Reset My Financial Data
          </Button>
        </div>
      </Card>

      {/* Strict Confirmation Dialog for Data Reset */}
      <ConfirmationDialog
        isOpen={isResetDialogOpen}
        onClose={() => setIsResetDialogOpen(false)}
        onConfirm={handleResetData}
        title="Permanently Reset All Financial Data"
        description="WARNING: This cannot be undone. All your accounts, debts, trip plans, and transactions will be wiped from the database. Please download a backup if you wish to retain a copy."
        confirmText="Permanently Erase Financial Data"
        requiredTypedConfirmation="RESET"
        requiresPassword={true}
        isLoading={isResetting}
      />
    </div>
  );
};
