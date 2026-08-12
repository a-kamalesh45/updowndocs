'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${
        scrolled ? 'bg-paper/85 backdrop-blur-md border-b border-hairline' : 'bg-transparent border-b border-transparent'
      }`}
    >
      <nav className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-5 sm:px-10 lg:px-16">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <span className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-ink text-[13px] font-semibold text-paper">
            F
          </span>
          <span className="text-[13px] font-semibold uppercase tracking-[0.18em] text-ink">
            Folio
          </span>
        </Link>

        <Link
          href="/dashboard"
          className="group inline-flex items-center gap-2 rounded-[4px] bg-ink px-4 py-2 text-[13px] font-medium text-paper transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#33312e]"
        >
          Enter Workspace
          <ArrowRight
            size={14}
            strokeWidth={2.25}
            className="transition-transform duration-200 group-hover:translate-x-1"
          />
        </Link>
      </nav>
    </header>
  );
}
