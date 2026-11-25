// frontend/src/pages/Storefronts.tsx

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Store, UserCheck } from 'lucide-react';

import { storefrontsApi } from '../api/services';
import type { Storefront } from '@/types/storefront';
import type { FollowedStorefront } from '@/types/storefront';
import { cn } from '../lib/cn';
import { useAuthStore } from '../store/authStore';
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
  const user = useAuthStore((state) => state.user);
  const [tab, setTab] = useState<'all' | 'following'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['storefronts'],
    queryFn: async () => (await storefrontsApi.list({ page_size: 24 })).data,
    staleTime: 5 * 60 * 1000,
  });

  // `storefrontsApi.following` returns the stalls this buyer follows, each with
  // its live stories. It had no caller, so «دنبال کردن» was a button that
  // recorded a follow the buyer could never find again — the count on the
  // storefront page went up and nothing else happened.
  const following = useQuery({
    queryKey: ['following'],
    queryFn: async () =>
      (await storefrontsApi.following()).data as { count: number; results: FollowedStorefront[] },
    enabled: Boolean(user) && tab === 'following',
  });

  const items: Storefront[] = data?.results ?? [];
  const followed = following.data?.results ?? [];

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

      {user && (
        <div className="flex gap-1.5" role="tablist" aria-label="نمایش غرفه‌ها">
          {(
            [
              { value: 'all', label: 'همهٔ غرفه‌ها' },
              { value: 'following', label: 'دنبال‌شده‌ها' },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={tab === option.value}
              onClick={() => setTab(option.value)}
              className={cn(
                'inline-flex min-h-9 items-center gap-1 rounded-sm px-2.5 text-2xs font-bold transition-colors',
                tab === option.value
                  ? 'bg-brand-700 text-white'
                  : 'border border-line text-ink-soft hover:border-brand-400 dark:border-night-line dark:text-white/65',
              )}
            >
              {option.value === 'following' && <UserCheck size={12} aria-hidden="true" />}
              {option.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'following' ? (
        <FollowingGrid
          loading={following.isLoading}
          rows={followed}
          onBrowse={() => setTab('all')}
        />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}

/** What the buyer already follows, with each stall's live story count. */
function FollowingGrid({
  loading,
  rows,
  onBrowse,
}: {
  loading: boolean;
  rows: FollowedStorefront[];
  onBrowse: () => void;
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-[11.5rem] rounded-lg" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={UserCheck}
        title="هنوز غرفه‌ای را دنبال نمی‌کنید"
        description="با «دنبال کردن» در صفحهٔ هر غرفه، برداشت‌ها و استوری‌های تازه‌اش را اینجا می‌بینید."
        action={
          <Button size="sm" variant="secondary" onClick={onBrowse}>
            دیدن غرفه‌ها
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <div key={row.storefront.id} className="flex flex-col gap-1">
          <StorefrontCard storefront={row.storefront} />
          {row.stories.length > 0 && (
            <p className="text-[11px] text-ink-mute dark:text-white/45">
              {nums(row.stories.length)} استوری تازه
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
