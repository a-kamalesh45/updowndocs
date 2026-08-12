'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import HeroArtwork from './HeroArtwork';

export default function Hero() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(min-width: 1024px)').matches) return;

    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 16;
      const y = (e.clientY / window.innerHeight - 0.5) * 10;
      setOffset({ x, y });
    };

    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <section className="relative w-full overflow-hidden bg-paper lg:min-h-screen">
      <HeroArtwork variant="desktop" offsetX={offset.x} offsetY={offset.y} />

      <div className="relative z-10 mx-auto flex max-w-[1400px] flex-col px-6 pb-16 pt-28 sm:px-10 lg:min-h-screen lg:justify-center lg:px-16 lg:pt-24">
        <div className="max-w-xl lg:max-w-lg">
          <p className="opacity-0 text-[11px] font-medium uppercase tracking-[0.28em] text-rust [animation:fade-up_0.7s_ease_forwards]">
            Real-Time Collaborative Editor
          </p>

          <h1 className="mt-5 font-serif text-5xl leading-[0.95] tracking-[-0.02em] text-ink opacity-0 sm:text-6xl md:text-7xl lg:text-[80px] xl:text-[92px] [animation:fade-up_0.8s_ease_0.1s_forwards]">
            Write
            <br />
            together.
            <br />
            <span className="text-taupe">In sync.</span>
          </h1>

          <p className="mt-7 max-w-md text-[16px] leading-relaxed text-taupe opacity-0 sm:text-[17px] [animation:fade-up_0.8s_ease_0.25s_forwards]">
            Create, edit, and collaborate on documents in real time — with
            every change synchronized instantly.
          </p>

          <div className="mt-10 opacity-0 [animation:fade-up_0.8s_ease_0.4s_forwards]">
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2.5 rounded-[5px] bg-ink px-6 py-3.5 text-[14px] font-medium text-paper transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#33312e]"
            >
              Enter Workspace
              <ArrowRight
                size={16}
                strokeWidth={2.25}
                className="transition-transform duration-200 group-hover:translate-x-1"
              />
            </Link>
          </div>
        </div>

        <HeroArtwork variant="mobile" />
      </div>

      <div className="absolute inset-x-0 bottom-8 z-10 hidden justify-center lg:flex">
        <div className="flex flex-col items-center gap-2 opacity-0 [animation:fade-up_0.8s_ease_0.6s_forwards]">
          <span className="text-[10px] uppercase tracking-[0.2em] text-taupe">
            Scroll
          </span>
          <span className="h-8 w-px bg-hairline" />
        </div>
      </div>
    </section>
  );
}
