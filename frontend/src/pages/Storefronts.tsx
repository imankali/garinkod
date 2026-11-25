// frontend/src/pages/Storefronts.tsx

import { useQuery } from '@tanstack/react-query';
import { Store } from 'lucide-react';

import { storefrontsApi } from '../api/services';
import type { Storefront } from '@/types/storefront';
import PageHead from '../components/shop/PageHead';
import StorefrontCard from '../components/shop/StorefrontCard';
import { Skeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import { nums } from '../lib/price';

/**
 * The marketplace directory.
 *
 * The lead paragraph is doing real work here: it tells a first-time visitor
 * that these are independent producers whose listings the platform reviews,
 * and that buying from them is a conversation, not a checkout button. Without
 * that sentence the page looks like a second product grid.
 */
export default function Storefronts() {
  const { data, isLoading } = useQuery({
    queryKey: ['storefronts'],
    queryFn: async () => (await storefrontsApi.list({ page_size: 24 })).data,
    staleTime: 5 * 60 * 1000,
  });

  const items: Storefront[] = data?.results ?? [];

  return (
    <div className="shell flex flex-col gap-5 py-8">
      <PageHead
        title="بازار کشاورزان"
        lead="غرفه‌های کشاورزان، تعاونی‌ها و تولیدکنندگان — هر آگهی پیش از انتشار بررسی می‌شود. می‌توانید مستقیم با غرفه گفتگو کنید و موجودی را پیش از پرداخت تأیید کنید."
        actions={
          <Button to="/farmers" variant="secondary" size="sm">
            من هم غرفه می‌خواهم
          </Button>
        }
      />

      {!isLoading && items.length > 0 && (
        <p className="dateline text-2xs font-bold text-ink-mute dark:text-white/45">
          {nums(items.length)} غرفهٔ فعال
        </p>
      )}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-busy="true" aria-label="در حال بارگذاری غرفه‌ها">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-[11.5rem] rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Store}
          title="هنوز غرفهٔ تأییدشده‌ای نیست"
          description="غرفه‌ها پس از بررسی مدارک منتشر می‌شوند. اگر کشاورز یا تعاونی هستید، همین حالا ثبت‌نام کنید تا غرفه‌تان در این فهرست بیاید."
          action={<Button to="/farmers" size="sm">شروع غرفه‌داری</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((storefront) => (
            <StorefrontCard key={storefront.id} storefront={storefront} />
          ))}
        </div>
      )}
    </div>
  );
}
