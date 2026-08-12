'use client';

import { useEffect, useState } from 'react';

interface CreateDocumentModalProps {
  open: boolean;
  creating: boolean;
  onClose: () => void;
  onCreate: (title: string) => void;
}

export default function CreateDocumentModal({ open, creating, onClose, onCreate }: CreateDocumentModalProps) {
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (open) setTitle('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = () => {
    if (creating) return;
    onCreate(title.trim());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-document-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/20 backdrop-blur-sm px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-[14px] border border-hairline bg-paper-raised p-6 shadow-2xl">
        <h2 id="create-document-title" className="font-serif text-lg text-ink">
          Create new document
        </h2>

        <label htmlFor="doc-title" className="mt-5 block text-[11px] uppercase tracking-[0.12em] text-taupe">
          Document name
        </label>
        <input
          id="doc-title"
          type="text"
          autoFocus
          value={title}
          placeholder="Untitled Document"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          className="mt-1.5 w-full rounded-[7px] border border-hairline bg-paper px-3 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-[#c7bda6]"
        />

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="rounded-[6px] px-4 py-2 text-[13px] font-medium text-taupe transition-colors hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={creating}
            className="inline-flex items-center gap-2 rounded-[6px] bg-ink px-4 py-2 text-[13px] font-medium text-paper transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#33312e] disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {creating ? 'Creating…' : 'Create Document'}
          </button>
        </div>
      </div>
    </div>
  );
}
