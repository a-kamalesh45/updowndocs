'use client';

import { useEffect, useRef } from 'react';

interface ShareModalProps {
  open: boolean;
  email: string;
  onEmailChange: (value: string) => void;
  role: 'editor' | 'viewer';
  onRoleChange: (value: 'editor' | 'viewer') => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export default function ShareModal({
  open,
  email,
  onEmailChange,
  role,
  onRoleChange,
  submitting,
  onSubmit,
  onClose,
}: ShareModalProps) {
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => emailRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-document-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/20 backdrop-blur-sm px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-[14px] border border-hairline bg-paper-raised p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 id="share-document-title" className="font-serif text-lg text-ink">
              Share document
            </h2>
            <p className="mt-1 text-[13px] text-taupe">Invite someone to collaborate.</p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="rounded-[6px] p-1 text-taupe transition-colors hover:text-ink disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="share-email" className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-taupe">
              Email address
            </label>
            <input
              ref={emailRef}
              id="share-email"
              type="email"
              required
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              className="w-full rounded-[7px] border border-hairline bg-paper px-3 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-[#c7bda6]"
              placeholder="colleague@company.com"
            />
          </div>

          <div>
            <label htmlFor="share-role" className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-taupe">
              Role
            </label>
            <select
              id="share-role"
              value={role}
              onChange={(e) => onRoleChange(e.target.value as 'editor' | 'viewer')}
              className="w-full cursor-pointer rounded-[7px] border border-hairline bg-paper px-3 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-[#c7bda6]"
            >
              <option value="editor">Editor — can edit the document</option>
              <option value="viewer">Viewer — can read only</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-[6px] bg-ink px-4 py-2.5 text-[13px] font-medium text-paper transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#33312e] disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {submitting ? 'Sending…' : 'Send invitation'}
          </button>
        </form>
      </div>
    </div>
  );
}
