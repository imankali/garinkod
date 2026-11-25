// frontend/src/pages/SitePage.tsx
//
// An operator-authored information page, at its own address.
//
// `sitePagesApi` was wired to /pages/ and /pages/:slug and nothing called it,
// so the two pages the operator had published — «شماره حسابهای گرین‌کود» and
// «محیط زیست و مصرف بهینه نهادهها» — existed in the admin and nowhere else.
// The first one matters commercially as well as editorially: it is the page
// that tells a buyer which card numbers are legitimate before they pay, and
// there was no way to send them to it.
//
// Routing: `/page/:slug` is the address `SitePage.get_absolute_url` returns, so
// the sitemap, the studio's «view» link and this route all agree.

import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { FileQuestion } from 'lucide-react';

import { sitePagesApi } from '../api/services';
import PageHead from '../components/shop/PageHead';
import SitePageBlocks from '../components/shop/SitePageBlocks';
import EmptyState from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { useTitle } from '../lib/useTitle';
import { date } from '../lib/date';

export default function SitePage() {
  const { slug = '' } = useParams();

  const page = useQuery({
    queryKey: ['site-page', slug],
    queryFn: async () => (await sitePagesApi.getBySlug(slug)).data,
    staleTime: 10 * 60 * 1000,
    enabled: Boolean(slug),
  });

  useTitle(page.data?.title);

  if (page.isLoading) {
    return (
      <div className="shell flex flex-col gap-4 py-8">
        <Skeleton className="h-10 w-1/2 rounded-md" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }

  if (page.isError || !page.data) {
    return (
      <div className="shell py-16">
        <EmptyState
          icon={FileQuestion}
          title="این صفحه پیدا نشد"
          description="ممکن است نشانی تغییر کرده باشد یا صفحه هنوز منتشر نشده باشد."
        />
      </div>
    );
  }

  const data = page.data;

  return (
    <div className="shell flex flex-col gap-6 py-8">
      <PageHead title={data.title} lead={data.hero_text || undefined} />

      {data.badge && (
        <p className="w-fit rounded-sm bg-brand-50 px-2.5 py-1 text-2xs font-bold text-brand-900 dark:bg-night-soft dark:text-brand-200">
          {data.badge}
        </p>
      )}

      {data.hero_image_url && (
        <img
          src={data.hero_image_url}
          alt=""
          className="max-h-72 w-full rounded-lg object-cover"
        />
      )}

      <SitePageBlocks blocks={data.blocks ?? []} />

      {data.updated_at && (
        <p className="border-t border-line pt-3 text-2xs text-ink-mute dark:border-night-line dark:text-white/40">
          آخرین به‌روزرسانی: {date(data.updated_at)}
          {data.updated_by && ` · ${data.updated_by}`}
        </p>
      )}
    </div>
  );
}
