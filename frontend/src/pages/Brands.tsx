// frontend/src/pages/Brands.tsx
//
// The shelf of makers this shop carries, at one address.
//
// Brand pages are reachable from a product page and from a category page, but a
// buyer who wants to start from the maker — «what else does رویال ship?» — had
// nothing to open. /brands is that starting point, and it is built from the same
// index the footer uses: only brands that currently have a published product are
// listed, with the count of that product set. A brand nobody sells any more is
// therefore absent rather than displayed with a zero, which is also what keeps this
// page from becoming a list of past relationships.

import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, Tags, Warehouse } from 'lucide-react';

import { catalogApi } from '../api/services';

const fa = (value: number) => value.toLocaleString('fa-IR');

export default function Brands() {
  const { data, isLoading } = useQuery({
    queryKey: ['catalog-index'],
    queryFn: async () => (await catalogApi.index()).data,
    staleTime: 5 * 60 * 1000,
  });

  const brands = data?.brands ?? [];
  const tags = data?.tags ?? [];
  const categories = data?.categories ?? [];

  return (
    <>
      <Helmet>
        <title>برندها و دسته‌های کالا | گرین کود</title>
        <meta
          name="description"
          content="فهرست تولیدکنندگان و برندهایی که در گرین کود کالا دارند، به‌همراه دسته‌ها و برچسب‌های فهرست."
        />
        <link rel="canonical" href="/brands" />
      </Helmet>

      <main className="mx-auto max-w-6xl px-[var(--page-gutter)] py-8 md:py-12">
        <header>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-fluid-2xs font-bold text-emerald-700 dark:bg-emerald-900/60 dark:text-lime-300">
            <Building2 size={13} aria-hidden="true" />
            فهرست گروه‌ها
          </p>
          <h1 className="mt-3 text-2xl font-extrabold leading-10 text-slate-800 md:text-3xl dark:text-white">
            برندها، دسته‌ها و برچسب‌های گرین کود
          </h1>
          <p className="mt-2 max-w-2xl text-fluid-sm leading-8 text-slate-600 dark:text-emerald-100">
            هر نام، صفحه‌ی خودش را با همان کالاها و قیمت‌های فهرست باز می‌کند. چیزی که اینجا نیست،
            امروز کالای منتشرشده‌ای ندارد.
          </p>
        </header>

        {isLoading && <div className="mt-8 h-40 animate-pulse rounded-3xl bg-slate-100 dark:bg-emerald-950" />}

        {!isLoading && !brands.length && (
          <p className="mt-8 rounded-2xl border border-dashed border-slate-200 p-6 text-fluid-sm leading-8 text-slate-500 dark:border-emerald-800 dark:text-emerald-200">
            هنوز کالایی با نام برند منتشر نشده است. به محض آنکه فروشندگان برند کالا را پر کنند،
            همین فهرست ساخته می‌شود.
          </p>
        )}

        {!!brands.length && (
          <section className="mt-8" aria-labelledby="brands-list">
            <h2 id="brands-list" className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">
              برندها ({fa(brands.length)})
            </h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {brands.map((brand) => (
                <li key={brand.slug}>
                  <Link
                    to={brand.url}
                    className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:shadow dark:border-emerald-900 dark:bg-emerald-950 dark:hover:border-emerald-700"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-fluid-sm font-extrabold text-slate-800 dark:text-white">
                        {brand.title}
                      </span>
                      <span className="mt-0.5 block text-fluid-2xs text-slate-400">
                        {fa(brand.count)} کالای منتشرشده
                      </span>
                    </span>
                    <Warehouse size={18} aria-hidden="true" className="shrink-0 text-emerald-600 dark:text-lime-300" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!!categories.length && (
          <section className="mt-8" aria-labelledby="categories-list">
            <h2 id="categories-list" className="text-fluid-lg font-extrabold text-slate-800 dark:text-white">
              دسته‌بندی اصلی ({fa(categories.length)})
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {categories.map((item) => (
                <li key={item.slug}>
                  <Link
                    to={item.url}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-50 px-3.5 text-fluid-sm font-bold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100 dark:hover:bg-emerald-900/70"
                  >
                    {item.title}
                    <span className="text-fluid-2xs text-slate-400">{fa(item.count)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!!tags.length && (
          <section className="mt-8" aria-labelledby="tags-list">
            <h2 id="tags-list" className="flex items-center gap-1.5 text-fluid-lg font-extrabold text-slate-800 dark:text-white">
              <Tags size={16} aria-hidden="true" />
              برچسب‌ها ({fa(tags.length)})
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {tags.map((item) => (
                <li key={item.slug}>
                  <Link
                    to={item.url}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald-100 px-3.5 text-fluid-2xs font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-800 dark:text-lime-300 dark:hover:bg-emerald-900/50"
                  >
                    #{item.title}
                    <span className="text-slate-400">{fa(item.count)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
