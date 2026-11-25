// frontend/src/pages/Article.tsx

import { useParams, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen } from 'lucide-react';

import { articlesApi } from '../api/services';
import ProductCard from '../components/shop/ProductCard';
import { ProseSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import { useTitle } from '../lib/useTitle';

/**
 * One article.
 *
 * Reading, so the page is a single measured column (65–75 characters), a
 * table of contents when the piece is long enough to have one, and the products
 * the piece refers to at the end — which is the only commercial element on the
 * page, and it is *after* the text, not wrapped around it.
 */
export default function Article() {
  const { slug = '' } = useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['article', slug],
    queryFn: async () => (await articlesApi.getBySlug(slug)).data,
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
          icon={BookOpen}
          title="این مقاله پیدا نشد"
          description="ممکن است آدرس آن تغییر کرده باشد. فهرست مقاله‌ها را ببینید."
          action={<Button to="/magazine" variant="secondary" size="sm">همهٔ مقاله‌ها</Button>}
        />
      </div>
    );
  }

  return (
    <article className="shell max-w-3xl py-8">
      <Link
        to="/magazine"
        className="inline-flex min-h-9 items-center gap-1 text-2xs font-bold text-brand-700 transition-colors hover:text-brand-900 dark:text-brand-300"
      >
        <ArrowLeft size={13} aria-hidden="true" className="rotate-180" />
        مجله
      </Link>

      <header className="mt-3 border-b border-line pb-5 dark:border-night-line">
        <p className="text-2xs font-bold text-brand-700 dark:text-brand-300">
          {data.kind_label}
          {data.crop ? ` · ${data.crop}` : ''}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold leading-9 tracking-[-0.03em] text-ink dark:text-white">{data.title}</h1>
        {data.excerpt && <p className="mt-2 text-sm leading-7 text-ink-soft dark:text-white/65">{data.excerpt}</p>}
        <p className="dateline mt-3 text-2xs text-ink-mute dark:text-white/45">
          {data.author_name} · {data.reading_minutes.toLocaleString('fa-IR')} دقیقه مطالعه
        </p>
      </header>

      {data.headings.length > 2 && (
        <nav aria-label="فهرست مطالب" className="my-5 rounded-md border border-line bg-brand-50/60 p-4 dark:border-night-line dark:bg-night-soft">
          <h2 className="text-2xs font-extrabold text-ink dark:text-white">در این مقاله</h2>
          <ol className="mt-2 space-y-1">
            {data.headings.map((heading) => (
              <li key={heading.anchor}>
                <a href={`#${heading.anchor}`} className="text-2xs text-ink-soft transition-colors hover:text-brand-700 dark:text-white/65">
                  {heading.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/*
        Body copy is HTML produced by the studio. It is rendered as-is, which is
        the contract the CMS was built on; typographic rules are applied by the
        wrapper (measure, leading, heading scale) rather than by rewriting the
        markup.
      */}
      <div
        className="mt-5 max-w-[70ch] text-sm leading-8 text-ink-soft [&_a]:text-brand-700 [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:my-5 [&_blockquote]:border-s-2 [&_blockquote]:border-brand-300 [&_blockquote]:ps-4 [&_blockquote]:text-ink-mute [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-extrabold [&_h2]:text-ink [&_h3]:mb-1 [&_h3]:mt-6 [&_h3]:text-sm [&_h3]:font-extrabold [&_h3]:text-ink [&_img]:my-5 [&_img]:rounded-lg [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:my-3 [&_strong]:font-bold [&_strong]:text-ink [&_ul]:my-3 [&_ul]:list-disc [&_ul]:ps-5 dark:text-white/70 dark:[&_h2]:text-white dark:[&_h3]:text-white dark:[&_strong]:text-white"
        dangerouslySetInnerHTML={{ __html: data.body }}
      />

      {data.products.length > 0 && (
        <section className="mt-10 border-t border-line pt-6 dark:border-night-line" aria-labelledby="article-products">
          <h2 id="article-products" className="text-base font-extrabold text-ink dark:text-white">
            کالاهای مرتبط با این نوشته
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data.products.slice(0, 3).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
