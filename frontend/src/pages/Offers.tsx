// frontend/src/pages/Offers.tsx

import { useQuery } from '@tanstack/react-query';
import { BadgePercent } from 'lucide-react';

import { productsApi } from '../api/services';
import type { ProductList } from '@/types/shop';
import PageHead from '../components/shop/PageHead';
import ProductCard from '../components/shop/ProductCard';
import { CardGridSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import { nums } from '../lib/price';

/** Every live discount, deepest first — the same list the home panel previews. */
export default function Offers() {
  const { data, isLoading } = useQuery({
    queryKey: ['offers'],
    queryFn: async () => (await productsApi.getAll({ has_discount: true, ordering: '-discount_percent', page_size: 48 })).data,
    staleTime: 2 * 60 * 1000,
  });

  const items = (data?.results ?? []).filter((item) => (item.discount_percent ?? 0) > 0);

  return (
    <div className="shell flex flex-col gap-5 py-8">
      <PageHead
        title="تخفیف‌های فعال"
        lead="هر کالایی که همین حالا تخفیف دارد، از بیشترین درصد به کمترین. قیمت پیش از تخفیف هم روی هر کارت می‌ماند تا تفاوت را خودتان ببینید."
        actions={
          <p className="dateline inline-flex items-center gap-1.5 text-2xs font-bold text-gold-700 dark:text-gold-600">
            <BadgePercent size={15} aria-hidden="true" />
            {nums(items.length)} کالا
          </p>
        }
      />

      {isLoading ? (
        <CardGridSkeleton count={8} label="در حال بارگذاری تخفیف‌ها" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={BadgePercent}
          title="این هفته تخفیفی ثبت نشده"
          description="تخفیف‌ها فصلی‌اند و در ابتدای هر دوره به‌روز می‌شوند. تا آن موقع می‌توانید کاتالوگ کامل یا پرفروش‌ها را ببینید."
          action={<Button to="/products" variant="secondary" size="sm">دیدن کاتالوگ</Button>}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((product: ProductList, index) => (
            <ProductCard key={product.id} product={product} priority={index < 4} />
          ))}
        </div>
      )}
    </div>
  );
}
