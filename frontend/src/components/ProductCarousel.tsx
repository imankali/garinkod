import { useRef, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ProductCarouselProps {
  children: ReactNode;
  label: string;
}

export default function ProductCarousel({ children, label }: ProductCarouselProps) {
  const railRef = useRef<HTMLDivElement>(null);

  const move = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * Math.max(rail.clientWidth * 0.8, 280), behavior: 'smooth' });
  };

  return (
    <div className="group/carousel relative" aria-label={label}>
      <div
        ref={railRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth px-1 pb-3 touch-pan-x sm:gap-4"
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => move(-1)}
        aria-label="محصولات قبلی"
        className="absolute left-2 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:scale-105 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 md:flex dark:bg-emerald-950 dark:text-white dark:ring-emerald-700"
      >
        <ChevronLeft size={22} />
      </button>
      <button
        type="button"
        onClick={() => move(1)}
        aria-label="محصولات بعدی"
        className="absolute right-2 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:scale-105 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 md:flex dark:bg-emerald-950 dark:text-white dark:ring-emerald-700"
      >
        <ChevronRight size={22} />
      </button>
    </div>
  );
}
