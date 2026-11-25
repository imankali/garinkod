// frontend/src/pages/Legal.tsx

import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';

import { legalApi } from '../api/services';
import PageHead from '../components/shop/PageHead';
import { ProseSkeleton, Skeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import { nums } from '../lib/price';
import { date } from '../lib/date';

/**
 * Legal documents — both the hub (`/legal`) and one document (`/legal/:slug`).
 *
 * The text is the operator's own wording served by the API, rendered as blocks.
 * This page's job is to make it *readable* and to sit the list next to the
 * document so a reader can move between «شرایط بازگشت» and «حریم خصوصی» without
 * going back. No accordion: a legal text folded behind a click is a legal text
 * nobody read.
 */
export default function Legal() {
  const { slug } = useParams();

  if (slug) return <Document slug={slug} />;
  return <Index />;
}

function Index() {
  const { data, isLoading } = useQuery({
    queryKey: ['legal', 'index'],
    queryFn: async () => (await legalApi.index()).data,
    staleTime: 30 * 60 * 1000,
  });

  return (
    <div className="shell flex flex-col gap-6 py-8">
      <PageHead
        title="اسناد و شرایط"
        lead="شرایط خرید، بازگشت کالا و حریم خصوصی — همان متنی که هنگام ثبت سفارش معتبر است، نه خلاصه‌ای از آن."
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {(data?.groups ?? []).map((group) => (
            <section key={group.id} aria-labelledby={`group-${group.id}`}>
              <h2 id={`group-${group.id}`} className="text-xs font-extrabold text-ink-mute dark:text-white/45">
                {group.label}
              </h2>
              <ul className="mt-2 divide-y divide-line border-y border-line dark:divide-night-line dark:border-night-line">
                {group.items.map((document) => (
                  <li key={document.slug}>
                    <Link to={`/legal/${document.slug}`} className="group flex items-start gap-3 py-3.5">
                      <FileText size={15} aria-hidden="true" className="mt-1 shrink-0 text-brand-700 dark:text-brand-300" />
                      <span className="min-w-0">
                        <span className="block text-xs font-extrabold text-ink transition-colors group-hover:text-brand-800 dark:text-white dark:group-hover:text-brand-300">
                          {document.title}
                        </span>
                        <span className="mt-0.5 block text-2xs leading-6 text-ink-mute dark:text-white/50">{document.summary}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {data?.policy?.return_window_days != null && (
            <p className="rounded-md border border-line bg-brand-50/60 p-3 text-2xs leading-6 text-ink-soft dark:border-night-line dark:bg-night-soft dark:text-white/60">
              مهلت بازگشت کالا در حال حاضر{' '}
              <strong className="font-extrabold text-ink dark:text-white">{nums(data.policy.return_window_days)} روز</strong> است.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Document({ slug }: { slug: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['legal', slug],
    queryFn: async () => (await legalApi.document(slug)).data,
    staleTime: 30 * 60 * 1000,
  });

  const index = useQuery({
    queryKey: ['legal', 'index'],
    queryFn: async () => (await legalApi.index()).data,
    staleTime: 30 * 60 * 1000,
  });

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
          icon={FileText}
          title="این سند پیدا نشد"
          description="فهرست اسناد و شرایط را ببینید."
          action={<Button to="/legal" variant="secondary" size="sm">همهٔ اسناد</Button>}
        />
      </div>
    );
  }

  return (
    <div className="shell grid gap-8 py-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <nav aria-label="اسناد" className="lg:sticky lg:top-[calc(var(--header-h)+1rem)] lg:self-start">
        <p className="text-2xs font-extrabold text-ink-mute dark:text-white/45">اسناد و شرایط</p>
        <ul className="mt-2 flex flex-wrap gap-1 lg:flex-col">
          {(index.data?.documents ?? []).map((document) => (
            <li key={document.slug}>
              <Link
                to={`/legal/${document.slug}`}
                aria-current={document.slug === slug ? 'page' : undefined}
                className="inline-flex min-h-9 items-center rounded-sm px-2 text-2xs font-bold text-ink-soft transition-colors hover:bg-brand-50 hover:text-brand-800 aria-[current=page]:bg-brand-100 aria-[current=page]:text-brand-900 dark:text-white/60 dark:hover:bg-night-soft dark:aria-[current=page]:bg-night-soft dark:aria-[current=page]:text-brand-300"
              >
                {document.short_title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <article className="min-w-0 max-w-[70ch]">
        <h1 className="text-2xl font-extrabold leading-9 tracking-[-0.03em] text-ink dark:text-white">{data.title}</h1>
        <p className="mt-1 text-2xs text-ink-mute dark:text-white/45">
          {data.group_label}
          {data.updated_at ? ` · آخرین به‌روزرسانی ${date(data.updated_at)}` : ''}
        </p>
        {data.summary && <p className="mt-3 text-sm leading-7 text-ink-soft dark:text-white/65">{data.summary}</p>}

        {data.policy?.return_window_days != null && data.policy.return_conditions && (
          <p className="mt-4 rounded-md border border-brand-200 bg-brand-50 p-3 text-2xs leading-6 text-brand-900 dark:border-brand-800 dark:bg-night-soft dark:text-brand-100">
            {data.policy.return_conditions}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-6">
          {data.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-sm font-extrabold text-ink dark:text-white">{section.title}</h2>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-8 text-ink-soft dark:text-white/70">{section.body}</p>
            </section>
          ))}

          {data.blocks.map((block) => (
            <section key={block.id}>
              {block.title && <h2 className="text-sm font-extrabold text-ink dark:text-white">{block.title}</h2>}
              <p className="mt-1.5 whitespace-pre-line text-sm leading-8 text-ink-soft dark:text-white/70">{block.text}</p>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
