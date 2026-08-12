'use client';

import { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';

interface UserMenuProps {
  name?: string;
  email?: string;
  onLogout: () => void;
}

function getInitials(name?: string, email?: string) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}

export default function UserMenu({ name, email, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-paper transition-opacity hover:opacity-85"
      >
        {getInitials(name, email)}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-10 z-30 w-56 overflow-hidden rounded-[10px] border border-hairline bg-paper-raised py-1.5 shadow-lg"
        >
          <div className="px-3.5 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.12em] text-taupe">Account</p>
            <p className="mt-1 truncate text-[13px] text-ink">{name || email || 'Signed in'}</p>
            {name && email && <p className="truncate text-[12px] text-taupe">{email}</p>}
          </div>
          <div className="my-1 h-px bg-hairline" />
          <button
            role="menuitem"
            onClick={onLogout}
            className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] text-ink transition-colors hover:bg-paper"
          >
            <LogOut size={14} strokeWidth={2} />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
