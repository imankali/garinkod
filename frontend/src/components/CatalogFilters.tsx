import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SlidersHorizontal, X } from 'lucide-react';

export interface CatalogFilterValues {
  search: string;
  minPrice: string;
  maxPrice: string;
  inStock: boolean;
  attributes: Record<string, string>;
}

interface FacetDefinition {
  key: string;
  label: string;
  placeholder: string;
}

const SHARED_FACETS: FacetDefinition[] = [
  { key: 'brand', label: 'برند', placeholder: 'نام برند' },
];

type InternalCategory = 'fertilizer' | 'pesticide' | 'seed' | 'equipment';

/** Explicit API-slug aliases; no category is inferred from its display name. */
const CATEGORY_SLUG_MAP: Record<string, InternalCategory> = {
  fertilizer: 'fertilizer',
  fertilizers: 'fertilizer',
  kood: 'fertilizer',
  کود: 'fertilizer',
  pesticide: 'pesticide',
  pesticides: 'pesticide',
  sam: 'pesticide',
  سم: 'pesticide',
  seed: 'seed',
  seeds: 'seed',
  bazr: 'seed',
  بذر: 'seed',
  equipment: 'equipment',
  equipments: 'equipment',
  tools: 'equipment',
  abzar: 'equipment',
  advat: 'equipment',
  ادوات: 'equipment',
};

const CATEGORY_FACETS: Record<InternalCategory, FacetDefinition[]> = {
  fertilizer: [
    { key: 'npk', label: 'فرمول NPK', placeholder: 'مثلاً 20-20-20' },
    { key: 'organic_matter', label: 'ماده آلی', placeholder: 'درصد ماده آلی' },
  ],
  pesticide: [
    { key: 'active_ingredient', label: 'ماده مؤثره', placeholder: 'نام ماده مؤثره' },
    { key: 'formulation', label: 'فرمولاسیون', placeholder: 'مثلاً EC یا WP' },
  ],
  seed: [
    { key: 'variety', label: 'رقم بذر', placeholder: 'نام رقم' },
    { key: 'germination', label: 'درصد جوانه‌زنی', placeholder: 'مثلاً ۹۵' },
  ],
  equipment: [
    { key: 'power', label: 'توان/ظرفیت', placeholder: 'توان مورد نیاز' },
    { key: 'usage', label: 'نوع کاربرد', placeholder: 'کاربرد دستگاه' },
  ],
};

interface CatalogFiltersProps {
  category: string;
  values: CatalogFilterValues;
  onChange: (values: CatalogFilterValues) => void;
  onClear: () => void;
}

export default function CatalogFilters({ category, values, onChange, onClear }: CatalogFiltersProps) {
  const [open, setOpen] = useState(false);
  const facets = useMemo(() => {
    const internalCategory = CATEGORY_SLUG_MAP[category.trim().toLowerCase()];
    return [
      ...SHARED_FACETS,
      ...(internalCategory ? CATEGORY_FACETS[internalCategory] : []),
    ];
  }, [category]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const panel = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-extrabold text-slate-800 dark:text-white">فیلترهای کاتالوگ</h2>
        <button type="button" onClick={onClear} className="min-h-11 px-2 text-xs font-bold text-rose-600 dark:text-rose-300">
          پاک‌کردن همه
        </button>
      </div>

      <FilterField label="جست‌وجو" value={values.search} placeholder="نام، برند یا کد محصول" onChange={(search) => onChange({ ...values, search })} />
      <div className="grid grid-cols-2 gap-2">
        <FilterField label="حداقل قیمت" type="number" value={values.minPrice} placeholder="از" onChange={(minPrice) => onChange({ ...values, minPrice })} />
        <FilterField label="حداکثر قیمت" type="number" value={values.maxPrice} placeholder="تا" onChange={(maxPrice) => onChange({ ...values, maxPrice })} />
      </div>
      <label className="flex min-h-11 cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 dark:border-emerald-800 dark:text-emerald-100">
        فقط کالاهای موجود
        <input type="checkbox" checked={values.inStock} onChange={(event) => onChange({ ...values, inStock: event.target.checked })} className="h-5 w-5 accent-emerald-600" />
      </label>

      {facets.length > 0 && (
        <fieldset className="space-y-3 border-t border-slate-100 pt-4 dark:border-emerald-800">
          <legend className="mb-2 text-sm font-extrabold text-slate-700 dark:text-white">ویژگی‌های مرتبط</legend>
          {facets.map((facet) => (
            <FilterField
              key={facet.key}
              label={facet.label}
              value={values.attributes[facet.key] ?? ''}
              placeholder={facet.placeholder}
              onChange={(value) => onChange({
                ...values,
                attributes: { ...values.attributes, [facet.key]: value },
              })}
            />
          ))}
        </fieldset>
      )}
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white lg:hidden"
        aria-expanded={open}
      >
        <SlidersHorizontal size={17} /> فیلترها
      </button>

      <aside className="sticky top-[calc(var(--header-height,72px)+1rem)] hidden max-h-[calc(100dvh-var(--header-height,72px)-2rem)] overflow-y-auto rounded-2xl border border-slate-100 bg-white p-4 shadow-sm lg:block dark:border-emerald-900 dark:bg-emerald-950/60">
        {panel}
      </aside>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="بستن فیلترها"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[85] bg-slate-950/55 lg:hidden"
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="فیلترهای کاتالوگ"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed inset-y-0 end-0 z-[90] w-[min(88vw,360px)] overflow-y-auto bg-white p-4 shadow-2xl lg:hidden dark:bg-emerald-950"
            >
              <button type="button" onClick={() => setOpen(false)} aria-label="بستن" className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 dark:bg-emerald-900">
                <X size={20} />
              </button>
              {panel}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function FilterField({ label, value, placeholder, onChange, type = 'text' }: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number';
}) {
  return (
    <label className="block text-xs font-bold text-slate-500 dark:text-emerald-200">
      {label}
      <input
        type={type}
        min={type === 'number' ? 0 : undefined}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:border-emerald-800 dark:bg-emerald-900 dark:text-white"
      />
    </label>
  );
}
