'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

interface DeleteConfirmModalProps {
  open: boolean;
  title: string;
  deleting: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteConfirmModal({
  open,
  title,
  deleting,
  error,
  onCancel,
  onConfirm,
}: DeleteConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, deleting, onCancel]);

  if (!open) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-document-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/20 backdrop-blur-sm px-4"
    >
      <div className="w-full max-w-sm rounded-[14px] border border-hairline bg-paper-raised p-6 shadow-2xl">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#A33A3A]/10 text-[#A33A3A]">
          <AlertTriangle size={18} strokeWidth={1.75} />
        </div>

        <h2 id="delete-document-title" className="mt-4 font-serif text-lg text-ink">
          Delete &ldquo;{title}&rdquo;?
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-taupe">
          This action cannot be undone.
        </p>

        {error && (
          <p className="mt-3 rounded-[6px] border border-[#A33A3A]/25 bg-[#A33A3A]/8 px-3 py-2 text-[12px] text-[#A33A3A]">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="rounded-[6px] px-4 py-2 text-[13px] font-medium text-taupe transition-colors hover:text-ink disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            autoFocus
            className="inline-flex items-center gap-2 rounded-[6px] bg-[#A33A3A] px-4 py-2 text-[13px] font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#8f3232] disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {deleting ? 'Deleting…' : error ? 'Try Again' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
