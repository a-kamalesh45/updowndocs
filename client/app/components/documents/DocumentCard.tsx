'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, MoreHorizontal, Pencil, Trash2, ExternalLink } from 'lucide-react';

export interface DocumentItem {
  id: string;
  title: string;
  updated_at: string;
  role?: 'owner' | 'editor' | 'viewer';
}

interface DocumentCardProps {
  doc: DocumentItem;
  view: 'grid' | 'list';
  isEditing: boolean;
  editValue: string;
  onEditValueChange: (value: string) => void;
  onStartRename: () => void;
  onSubmitRename: () => void;
  onCancelRename: () => void;
  onRequestDelete: () => void;
}

const PREVIEW_LINES = ['w-3/4', 'w-full', 'w-1/2', 'w-2/3'];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function DocumentCard({
  doc,
  view,
  isEditing,
  editValue,
  onEditValueChange,
  onStartRename,
  onSubmitRename,
  onCancelRename,
  onRequestDelete,
}: DocumentCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!menuOpen) return;

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  const openDocument = () => router.push(`/documents/${doc.id}`);

  const handleCardClick = () => {
    if (isEditing || menuOpen) return;
    openDocument();
  };

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (isEditing || menuOpen) return;
    if (e.key === 'Enter') openDocument();
  };

  const titleField = isEditing ? (
    <input
      type="text"
      autoFocus
      value={editValue}
      aria-label="Document title"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onEditValueChange(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={onSubmitRename}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') onSubmitRename();
        if (e.key === 'Escape') onCancelRename();
      }}
      className="w-full border-b border-ink bg-transparent pb-1 text-[15px] font-semibold text-ink outline-none"
    />
  ) : (
    <span
      onDoubleClick={(e) => {
        e.stopPropagation();
        onStartRename();
      }}
      className="block truncate text-[15px] font-semibold text-ink"
      title={doc.title}
    >
      {doc.title}
    </span>
  );

  const menu = menuOpen && (
    <div
      ref={menuRef}
      role="menu"
      onClick={(e) => e.stopPropagation()}
      className="absolute right-0 top-9 z-20 w-40 overflow-hidden rounded-[8px] border border-hairline bg-paper-raised py-1 shadow-lg"
    >
      <button
        role="menuitem"
        onClick={() => {
          setMenuOpen(false);
          openDocument();
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink transition-colors hover:bg-paper"
      >
        <ExternalLink size={14} strokeWidth={2} />
        Open
      </button>
      <button
        role="menuitem"
        onClick={() => {
          setMenuOpen(false);
          onStartRename();
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink transition-colors hover:bg-paper"
      >
        <Pencil size={14} strokeWidth={2} />
        Rename
      </button>
      <button
        role="menuitem"
        onClick={() => {
          setMenuOpen(false);
          onRequestDelete();
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#A33A3A] transition-colors hover:bg-[#A33A3A]/10"
      >
        <Trash2 size={14} strokeWidth={2} />
        Delete
      </button>
    </div>
  );

  const kebabButton = (
    <div className="relative shrink-0">
      <button
        aria-label="Document actions"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((v) => !v);
        }}
        className={`rounded-[6px] p-1.5 text-taupe transition-all duration-150 hover:bg-paper hover:text-ink ${
          menuOpen ? 'opacity-100 bg-paper' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus:opacity-100'
        }`}
      >
        <MoreHorizontal size={16} strokeWidth={2} />
      </button>
      {menu}
    </div>
  );

  if (view === 'list') {
    return (
      <div
        role="link"
        tabIndex={0}
        aria-label={`Open ${doc.title}`}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        className="group relative flex cursor-pointer items-center gap-4 rounded-[10px] border border-hairline bg-paper-raised px-4 py-3.5 transition-all duration-200 hover:-translate-y-[1px] hover:border-[#d5cdbb] hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-rust/40"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] bg-paper text-taupe">
          <FileText size={16} strokeWidth={1.75} />
        </div>

        <div className="min-w-0 flex-1">{titleField}</div>

        {doc.role && (
          <span className="hidden shrink-0 text-[11px] uppercase tracking-[0.1em] text-taupe sm:inline">
            {doc.role}
          </span>
        )}

        <span className="hidden shrink-0 text-[12px] text-taupe sm:inline">
          {formatDate(doc.updated_at)}
        </span>

        {kebabButton}
      </div>
    );
  }

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`Open ${doc.title}`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      className="group relative flex cursor-pointer flex-col rounded-[12px] border border-hairline bg-paper-raised p-5 transition-all duration-200 hover:-translate-y-[3px] hover:border-[#d5cdbb] hover:shadow-[0_10px_30px_-12px_rgba(28,27,26,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-rust/40"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-paper text-taupe">
          <FileText size={15} strokeWidth={1.75} />
        </div>
        {kebabButton}
      </div>

      <div className="mb-4 flex h-16 flex-col justify-center gap-1.5 rounded-[8px] border border-hairline/70 bg-paper px-3">
        {PREVIEW_LINES.map((w, i) => (
          <div key={i} className={`h-1.5 ${w} rounded-full bg-hairline`} />
        ))}
      </div>

      <div className="mb-3 min-w-0">{titleField}</div>

      <div className="mt-auto flex items-center justify-between pt-3 border-t border-hairline/70">
        <span className="text-[12px] text-taupe">Updated {formatDate(doc.updated_at)}</span>
        {doc.role && (
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-taupe">
            <span className="h-1.5 w-1.5 rounded-full bg-rust" />
            {doc.role}
          </span>
        )}
      </div>
    </div>
  );
}
