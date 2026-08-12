'use client';

import { useEffect } from 'react';
import { History } from 'lucide-react';

interface RestoreConfirmModalProps {
  open: boolean;
  restoring: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function RestoreConfirmModal({ open, restoring, onCancel, onConfirm }: RestoreConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !restoring) onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, restoring, onCancel]);

  if (!open) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="restore-version-title"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-ink/20 backdrop-blur-sm px-4"
    >
      <div className="w-full max-w-sm rounded-[14px] border border-hairline bg-paper-raised p-6 shadow-2xl">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rust/10 text-rust">
          <History size={18} strokeWidth={1.75} />
        </div>

        <h2 id="restore-version-title" className="mt-4 font-serif text-lg text-ink">
          Restore this version?
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-taupe">
          Your current document will be replaced with this version for all active collaborators.
        </p>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            onClick={onCancel}
            disabled={restoring}
            className="rounded-[6px] px-4 py-2 text-[13px] font-medium text-taupe transition-colors hover:text-ink disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={restoring}
            autoFocus
            className="inline-flex items-center gap-2 rounded-[6px] bg-rust px-4 py-2 text-[13px] font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#a8431f] disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {restoring ? 'Restoring…' : 'Restore version'}
          </button>
        </div>
      </div>
    </div>
  );
}
