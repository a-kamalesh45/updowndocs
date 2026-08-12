'use client';

import { useEffect } from 'react';
import { Plus, X } from 'lucide-react';

export interface VersionItem {
  id: string;
  created_at: string;
  author_name?: string;
}

interface HistoryDrawerProps {
  open: boolean;
  versions: VersionItem[];
  canManage: boolean;
  onClose: () => void;
  onSaveSnapshot: () => void;
  onRequestRestore: (version: VersionItem) => void;
}

export default function HistoryDrawer({
  open,
  versions,
  canManage,
  onClose,
  onSaveSnapshot,
  onRequestRestore,
}: HistoryDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/10" onMouseDown={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[380px] flex-col border-l border-hairline bg-paper-raised shadow-2xl [animation:fade-in-slide_0.25s_ease-out]"
      >
        <div className="border-b border-hairline p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-serif text-lg text-ink">Version History</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-taupe">
                Restore previous versions of this document.
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-[6px] p-1 text-taupe transition-colors hover:text-ink"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        </div>

        {canManage && (
          <div className="border-b border-hairline p-5">
            <button
              onClick={onSaveSnapshot}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[6px] bg-ink px-4 py-2.5 text-[13px] font-medium text-paper transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#33312e]"
            >
              <Plus size={14} strokeWidth={2.25} />
              Save current version
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {versions.length === 0 ? (
            <p className="mt-10 text-center text-[13px] text-taupe">No saved versions yet.</p>
          ) : (
            <div className="space-y-5">
              {versions.map((v) => (
                <div key={v.id} className="relative border-l-2 border-hairline pl-4">
                  <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-rust" />
                  <div className="text-[13px] font-semibold text-rust">
                    {new Date(v.created_at).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                  <div className="mt-0.5 text-[12px] text-ink">
                    {new Date(v.created_at).toLocaleTimeString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[12px] text-taupe">Saved by {v.author_name || 'Owner'}</span>
                    {canManage && (
                      <button
                        onClick={() => onRequestRestore(v)}
                        className="text-[12px] font-medium text-rust transition-opacity hover:opacity-70"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
