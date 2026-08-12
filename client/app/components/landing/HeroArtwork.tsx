'use client';

import Image from 'next/image';

interface HeroArtworkProps {
  variant: 'desktop' | 'mobile';
  offsetX?: number;
  offsetY?: number;
}

export default function HeroArtwork({ variant, offsetX = 0, offsetY = 0 }: HeroArtworkProps) {
  if (variant === 'desktop') {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[6%] top-0 hidden h-full w-[68%] opacity-0 [animation:fade-in-slide_0.9s_cubic-bezier(0.16,1,0.3,1)_0.15s_forwards] lg:block"
      >
        <div
          className="relative h-full w-full"
          style={{ transform: `translate3d(${offsetX}px, ${offsetY}px, 0)`, transition: 'transform 0.5s cubic-bezier(0.16,1,0.3,1)' }}
        >
          <Image
            src="/assets/bg1.png"
            alt=""
            fill
            priority
            sizes="70vw"
            className="select-none object-cover object-[right_center]"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden
      className="relative mt-10 h-[38vh] min-h-[260px] w-full opacity-0 [animation:fade-in-slide_0.9s_cubic-bezier(0.16,1,0.3,1)_0.15s_forwards] lg:hidden"
    >
      <Image
        src="/assets/bg1.png"
        alt=""
        fill
        sizes="100vw"
        className="select-none object-cover object-[62%_35%]"
      />
    </div>
  );
}
