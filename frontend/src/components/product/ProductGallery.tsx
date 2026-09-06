// frontend/src/components/product/ProductGallery.tsx
//
// The product photo, with the rest of the gallery underneath it.
//
// Two things a single image cannot do, both of which a buyer of bulk agricultural
// input actually uses: the second photo appears on hover (bag front vs. the label
// with the analysis on it), and every shot is clickable, because «محل درز کیسه»
// matters more than a pretty render. A product with one photo renders exactly one
// image and no strip — no empty thumb row, no fake count.

import { useState } from 'react';

import { ImageOff } from 'lucide-react';

import { cn } from '../../utils/cn';
import type { GalleryShot } from '../../types';

const FALLBACK = '/images/hero-farm.jpg';

export default function ProductGallery({
  shots,
  title,
  cover,
}: {
  shots: GalleryShot[];
  title: string;
  /** The product's own cover, used when no gallery was uploaded. */
  cover: string;
}) {
  const list = shots.length ? shots : [{ url: cover || FALLBACK, caption: '' }];
  const [active, setActive] = useState(0);
  const [peeking, setPeeking] = useState(false);
  const multiple = list.length > 1;

  // On a hover device the second photo is a free preview; on touch, the thumbs
  // below are the whole interaction.
  const first = list[0] ?? { url: cover || FALLBACK, caption: '' };
  const second = list[1];
  const shown = (peeking && second ? second : list[active]) ?? first;

  return (
    <div>
      <div
        className="relative overflow-hidden rounded-2xl bg-emerald-50 dark:bg-emerald-900/30"
        onMouseEnter={() => setPeeking(true)}
        onMouseLeave={() => setPeeking(false)}
      >
        <img
          src={shown.url}
          alt={shown.caption ? `${title} — ${shown.caption}` : title}
          className="aspect-square h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.src = FALLBACK;
          }}
        />
        {multiple && (
          <span className="pointer-events-none absolute bottom-3 start-3 rounded-full bg-black/45 px-2.5 py-1 text-fluid-2xs font-bold text-white backdrop-blur">
            {(active + 1).toLocaleString('fa-IR')} از {list.length.toLocaleString('fa-IR')}
          </span>
        )}
      </div>

      {multiple ? (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="گالری تصاویر">
          {list.map((shot, index) => (
            <button
              key={`${shot.url}-${index}`}
              type="button"
              onClick={() => setActive(index)}
              aria-label={shot.caption || `تصویر ${(index + 1).toLocaleString('fa-IR')}`}
              aria-current={index === active}
              className={cn(
                'h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-emerald-50 transition dark:bg-emerald-900/40',
                index === active
                  ? 'border-emerald-600 shadow-sm dark:border-lime-400'
                  : 'border-transparent opacity-75 hover:opacity-100',
              )}
            >
              <img src={shot.url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-1.5 text-fluid-2xs text-slate-400">
          <ImageOff size={13} aria-hidden="true" />
          برای این کالا تصویر دیگری ثبت نشده است.
        </p>
      )}

      {shown.caption && (
        <p className="mt-2 text-fluid-2xs leading-6 text-slate-500 dark:text-emerald-200">{shown.caption}</p>
      )}
    </div>
  );
}
