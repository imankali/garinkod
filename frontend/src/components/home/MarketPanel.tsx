// frontend/src/components/home/MarketPanel.tsx

import { useQuery } from '@tanstack/react-query';

import { storefrontsApi } from '../../api/services';
import type { Storefront } from '@/types/storefront';
import SectionHead from './SectionHead';
import StorefrontCard from '../shop/StorefrontCard';
import { Skeleton } from '../ui/Skeleton';

/**
 * The marketplace — the thing that makes this a platform rather than a shop.
 *
 * It gets its own panel on the home page, with real stalls and their real
 * counts, because a directory that is only reachable from a menu is a
 * directory nobody visits. The section removes itself when the API has no
 * verified stalls: an empty marketplace should look absent, not broken.
 */
export default function MarketPanel() {
  // `/marketplace/storefronts/featured/` is the endpoint built for this band: a
  // bare array, capped by `limit`, and clamped server-side so it cannot be
  // turned into a full dump. It is not a curated flag — the view returns the
  // first N of the directory — so the heading says nothing about selection.
  const { data, isLoading } = useQuery({
    queryKey: ['home-storefronts'],
    queryFn: async () => (await storefrontsApi.featured(6)).data,
    staleTime: 5 * 60 * 1000,
  });

  const storefronts: Storefront[] = data ?? [];
  if (!isLoading && storefronts.length === 0) return null;

  return (
    <section aria-labelledby="market-title" className="section shell bg-paper/60 dark:bg-night-soft/30">
      <SectionHead
        id="market-title"
        title="مستقیم از غرفهٔ کشاورزان"
        hint="غرفه‌ها پیش از انتشار آگهی بررسی می‌شوند؛ می‌توانید بی‌واسطه با خود کشاورز گفتگو کنید."
        action={{ to: '/storefronts', label: 'همهٔ غرفه‌ها' }}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-[11.5rem] rounded-lg" />)
          : storefronts.map((storefront) => <StorefrontCard key={storefront.id} storefront={storefront} />)}
      </div>
    </section>
  );
}
