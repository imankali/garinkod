// frontend/src/pages/ServiceDetail.tsx
//
// One خدمت from `/api/services/catalog/<slug>/`.
//
// `farmServicesApi.getBySlug` had no caller. The services page listed six
// services with a one-line summary and a few highlights, and that was all a
// visitor could ever see: every service already ships a 200–500 character body
// and a cover image, and no page showed either. Someone deciding whether to
// pay for «آزمایش و بهبود خاک» had a summary and nothing else.
//
// The body is written by the content studio with one convention: `## ` opens a
// section, and the rest is prose. That is the whole markup being produced (see
// the seeded article and service bodies), so this renders exactly that — no
// Markdown library, and no pretending to support what the data never contains.

import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, Sprout } from 'lucide-react';

import { farmServicesApi } from '../api/services';
import { ProseSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import { useTitle } from '../lib/useTitle';

/** Split a `## heading` / prose body into headed blocks. */
function sections(body: string): Array<{ heading: string | null; text: string }> {
  const blocks: Array<{ heading: string | null; text: string }> = [];
  for (const chunk of body.split(/\n{2,}/)) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('## ')) {
      const [first, ...rest] = trimmed.split('\n');
      blocks.push({ heading: (first ?? '').replace(/^##\s*/, ''), text: rest.join('\n').trim() });
    } else {
      blocks.push({ heading: null, text: trimmed });
    }
  }
  return blocks;
}

export default function ServiceDetail() {
  const { slug = '' } = useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['service', slug],
    queryFn: async () => (await farmServicesApi.getBySlug(slug)).data,
    staleTime: 10 * 60 * 1000,
  });

  useTitle(data?.title);

  if (isLoading) {
    return (
      <div className="shell max-w-3xl py-8">
        <ProseSkeleton />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="shell py-16">
        <EmptyState
          icon={Sprout}
          title="این خدمت پیدا نشد"
          description="ممکن است آدرس آن تغییر کرده باشد. فهرست خدمات را ببینید."
          action={
            <Button to="/services" variant="secondary" size="sm">
              همهٔ خدمات
            </Button>
          }
        />
      </div>
    );
  }

  const blocks = data.body ? sections(data.body) : [];

  return (
    <div className="shell max-w-3xl py-8">
      <Link
        to="/services"
        className="inline-flex min-h-9 items-center gap-1 text-2xs font-bold text-brand-700 transition-colors hover:text-brand-900 dark:text-brand-300"
      >
        <ArrowLeft size={13} aria-hidden="true" className="rotate-180" />
        خدمات
      </Link>

      <header className="mt-3 border-b border-line pb-5 dark:border-night-line">
        <h1 className="text-2xl font-extrabold leading-9 tracking-[-0.03em] text-ink dark:text-white">
          {data.title}
        </h1>
        {data.summary && (
          <p className="mt-2 text-sm leading-7 text-ink-soft dark:text-white/65">{data.summary}</p>
        )}
        {/* The price note is the studio's own wording — never turned into a
            number the page computed. */}
        {data.price_note && (
          <p className="dateline mt-3 text-2xs font-bold text-brand-800 dark:text-brand-300">
            {data.price_note}
          </p>
        )}
      </header>

      {data.image_url && (
        <img
          src={data.image_url}
          alt=""
          className="mt-5 aspect-[16/9] w-full rounded-lg object-cover"
        />
      )}

      {data.highlights.length > 0 && (
        <ul className="mt-5 grid gap-1.5 sm:grid-cols-2">
          {data.highlights.map((point) => (
            <li key={point} className="flex items-start gap-1.5 text-2xs leading-6 text-ink-soft dark:text-white/60">
              <Check size={12} aria-hidden="true" className="mt-1.5 shrink-0 text-brand-700 dark:text-brand-300" />
              {point}
            </li>
          ))}
        </ul>
      )}

      {blocks.length > 0 && (
        <div className="mt-6 max-w-[70ch]">
          {blocks.map((block, index) =>
            block.heading ? (
              <section key={`${block.heading}-${index}`} className="mt-6 first:mt-0">
                <h2 className="text-sm font-extrabold text-ink dark:text-white">{block.heading}</h2>
                {block.text && (
                  <p className="mt-1 whitespace-pre-line text-sm leading-8 text-ink-soft dark:text-white/70">
                    {block.text}
                  </p>
                )}
              </section>
            ) : (
              <p
                key={index}
                className="mt-3 whitespace-pre-line text-sm leading-8 text-ink-soft dark:text-white/70"
              >
                {block.text}
              </p>
            ),
          )}
        </div>
      )}

      {/* The list page owns the request form; this page sends people back to it
          rather than duplicating a second form with its own state. */}
      <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-line pt-5 dark:border-night-line">
        <Button to="/services" size="sm">
          درخواست این خدمت
        </Button>
        <p className="text-2xs text-ink-mute dark:text-white/45">
          درخواست با انتخاب همین خدمت در فرم ثبت می‌شود.
        </p>
      </div>
    </div>
  );
}
