import React, { useState } from 'react';
import { Modal } from './Modal.js';
import { Button } from './Button.js';
import { Input } from './Input.js';
import { AlertTriangle } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password?: string) => Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  requiredTypedConfirmation?: string;
  requiresPassword?: boolean;
  isLoading?: boolean;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  requiredTypedConfirmation,
  requiresPassword = false,
  isLoading = false,
}) => {
  const [typedValue, setTypedValue] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const isTypedMatch = !requiredTypedConfirmation || typedValue === requiredTypedConfirmation;
  const isPasswordReady = !requiresPassword || password.length > 0;
  const canConfirm = isTypedMatch && isPasswordReady;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    try {
      setError('');
      await onConfirm(password);
      setTypedValue('');
      setPassword('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="md">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <p className="text-sm text-slate-300 mt-1 leading-relaxed">{description}</p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {requiredTypedConfirmation && (
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1.5">
              Please type <span className="font-mono text-rose-400 font-bold">{requiredTypedConfirmation}</span> to confirm:
            </label>
            <Input
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              placeholder={requiredTypedConfirmation}
              className="font-mono"
            />
          </div>
        )}

        {requiresPassword && (
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1.5">
              Verify Account Password:
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
        <Button variant="ghost" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={handleConfirm}
          disabled={!canConfirm}
          isLoading={isLoading}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
};
