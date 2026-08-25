// frontend/src/components/AgriCalculator.tsx

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Leaf,
  Search,
  ShieldAlert,
  ShoppingCart,
  SprayCan,
} from 'lucide-react';

import { agriApi, productsApi } from '../api/services';
import { parseApiError } from '../api/errors';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type { AgriInput, AreaUnit, DoseCalculation, MockProduct, ProductList } from '../types';

interface AgriCalculatorProps {
  onAddToCart: (product: MockProduct, qty: number) => void;
}

const AREA_UNITS: { value: AreaUnit; label: string }[] = [
  { value: 'hectare', label: 'هکتار' },
  { value: 'jarib', label: 'جریب' },
  { value: 'square_meter', label: 'مترمربع' },
  { value: 'acre', label: 'ایکر' },
];

const KIND_FILTERS = [
  { value: '', label: 'همه نهاده‌ها' },
  { value: 'fertilizer', label: 'کود' },
  { value: 'pesticide', label: 'سم' },
] as const;

/** Adapt an API product to the shape the cart handler expects. */
function toMockProduct(apiProduct: ProductList, input: AgriInput): MockProduct {
  return {
    id: apiProduct.id,
    slug: apiProduct.slug,
    name: apiProduct.title,
    category: typeof apiProduct.category === 'string' ? apiProduct.category : input.kind_label,
    categoryId: input.kind,
    subCategoryId: '',
    brand: '',
    price: apiProduct.price,
    rating: 0,
    reviews: 0,
    image: apiProduct.image_url || '/images/hero-farm.jpg',
    inStock: apiProduct.is_in_stock,
    description: input.active_ingredient,
    features: [],
    cropTags: input.doses.map((dose) => dose.crop_name),
    pestTags: input.doses.map((dose) => dose.target).filter(Boolean),
    usage: {
      dosage: '',
      method: '',
      timing: '',
      preHarvestInterval: input.preharvest_interval_days
        ? `${input.preharvest_interval_days} روز`
        : undefined,
    },
    warnings: input.safety_notes ? [input.safety_notes] : [],
    compatibleWith: [],
    brochureAvailable: false,
  };
}

/**
 * Dose calculator backed by the registered `AgriInput`/`AgriInputDose` tables.
 *
 * Two rules make this safe rather than merely useful:
 * 1. Only crops that actually have a recorded dose for the selected input are
 *    offered, so an unsupported pair cannot be requested by accident.
 * 2. The total always comes from the server, which refuses to answer for an
 *    unregistered combination instead of extrapolating a rate.
 */
export default function AgriCalculator({ onAddToCart }: AgriCalculatorProps) {
  const [kind, setKind] = useState<string>('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);

  const [inputs, setInputs] = useState<AgriInput[]>([]);
  const [loadingInputs, setLoadingInputs] = useState(false);
  const [selected, setSelected] = useState<AgriInput | null>(null);

  const [crop, setCrop] = useState('');
  const [area, setArea] = useState('1');
  const [areaUnit, setAreaUnit] = useState<AreaUnit>('hectare');

  const [result, setResult] = useState<DoseCalculation | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [linkedProduct, setLinkedProduct] = useState<ProductList | null>(null);

  // Search the catalogue of registered inputs.
  useEffect(() => {
    let cancelled = false;
    setLoadingInputs(true);
    agriApi
      .inputs({
        search: debouncedSearch || undefined,
        kind: (kind || undefined) as 'fertilizer' | 'pesticide' | undefined,
      })
      .then((response) => {
        if (!cancelled) setInputs(response.data.results);
      })
      .catch((error) => {
        if (!cancelled) setFormError(parseApiError(error).message);
      })
      .finally(() => {
        if (!cancelled) setLoadingInputs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, kind]);

  // Only crops with a recorded dose for the selected input are selectable.
  const availableCrops = useMemo(() => {
    if (!selected) return [];
    return Array.from(new Set(selected.doses.map((dose) => dose.crop_name)));
  }, [selected]);

  useEffect(() => {
    if (crop && !availableCrops.includes(crop)) setCrop('');
    setResult(null);
  }, [availableCrops, crop]);

  async function handleCalculate() {
    const nextErrors: Record<string, string> = {};
    if (!selected) nextErrors.input = 'یک کود یا سم انتخاب کنید.';
    if (!crop) nextErrors.crop = 'محصول کشاورزی را انتخاب کنید.';
    const areaValue = Number(area);
    if (!area || Number.isNaN(areaValue) || areaValue <= 0) {
      nextErrors.area = 'سطح زمین باید عددی بزرگ‌تر از صفر باشد.';
    }
    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length > 0 || !selected) return;

    setCalculating(true);
    setResult(null);
    try {
      const response = await agriApi.calculate({
        input_id: selected.id,
        crop,
        area: areaValue,
        area_unit: areaUnit,
      });
      setResult(response.data);

      // If the input is linked to a catalogue product, offer to buy it.
      if (selected.product_slug) {
        try {
          const product = await productsApi.getBySlug(selected.product_slug);
          setLinkedProduct(product.data as unknown as ProductList);
        } catch {
          setLinkedProduct(null);
        }
      } else {
        setLinkedProduct(null);
      }
    } catch (error) {
      const parsed = parseApiError(error);
      setFormError(parsed.message);
      setErrors(parsed.fields);
    } finally {
      setCalculating(false);
    }
  }

  return (
    <section
      aria-labelledby="agri-calculator-heading"
      className="mx-auto mt-10 max-w-4xl rounded-3xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/50 p-5 shadow-sm dark:border-emerald-900 dark:from-emerald-950 dark:to-emerald-900/40 sm:p-6"
    >
      <header className="mb-5">
        <h2
          id="agri-calculator-heading"
          className="flex items-center gap-2 text-lg font-extrabold text-slate-800 dark:text-white sm:text-xl"
        >
          <Calculator size={20} className="text-emerald-600" />
          محاسبه‌گر مصرف کود و سم
        </h2>
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-emerald-200">
          مقدار مورد نیاز بر اساس دوزهای ثبت‌شده و سطح زمین شما محاسبه می‌شود.
        </p>
      </header>

      {/* Step 1: pick an input */}
      <div className="mb-4">
        <div className="mb-2 flex flex-wrap gap-2">
          {KIND_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setKind(option.value)}
              aria-pressed={kind === option.value}
              className={`min-h-11 rounded-xl px-3.5 text-xs font-bold transition ${
                kind === option.value
                  ? 'bg-emerald-600 text-white'
                  : 'border border-slate-200 text-slate-600 dark:border-emerald-800 dark:text-emerald-100'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label htmlFor="agri-search" className="mb-1 block text-xs font-bold text-slate-600 dark:text-emerald-100">
          جستجوی کود یا سم
        </label>
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="agri-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="مثلاً اوره، آبامکتین، مانکوزب…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 ps-9 pe-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
          />
        </div>

        <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-100 dark:border-emerald-900">
          {loadingInputs ? (
            <p className="p-3 text-xs text-slate-400">در حال جستجو…</p>
          ) : inputs.length === 0 ? (
            <p className="p-3 text-xs text-slate-400">نهاده‌ای با این نام پیدا نشد.</p>
          ) : (
            <ul>
              {inputs.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(item)}
                    aria-pressed={selected?.id === item.id}
                    className={`flex min-h-11 w-full items-center gap-2 border-b border-slate-50 px-3 text-start text-xs transition last:border-0 dark:border-emerald-900 ${
                      selected?.id === item.id
                        ? 'bg-emerald-50 font-bold text-emerald-800 dark:bg-emerald-900 dark:text-lime-200'
                        : 'hover:bg-slate-50 dark:hover:bg-emerald-900/50'
                    }`}
                  >
                    {item.kind === 'pesticide' ? (
                      <SprayCan size={14} className="shrink-0 text-rose-500" />
                    ) : (
                      <Leaf size={14} className="shrink-0 text-emerald-500" />
                    )}
                    <span className="flex-1 truncate text-slate-700 dark:text-emerald-50">{item.name}</span>
                    <span className="shrink-0 text-fluid-2xs text-slate-400">{item.active_ingredient}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {errors.input && (
          <p role="alert" className="mt-1 text-fluid-xs font-semibold text-rose-600">
            {errors.input}
          </p>
        )}
      </div>

      {/* Step 2: crop and area */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="agri-crop" className="mb-1 block text-xs font-bold text-slate-600 dark:text-emerald-100">
            محصول کشاورزی
          </label>
          <select
            id="agri-crop"
            value={crop}
            disabled={!selected}
            onChange={(event) => setCrop(event.target.value)}
            aria-invalid={Boolean(errors.crop)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
          >
            <option value="">{selected ? 'انتخاب محصول' : 'ابتدا نهاده را انتخاب کنید'}</option>
            {availableCrops.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          {errors.crop && (
            <p role="alert" className="mt-1 text-fluid-xs font-semibold text-rose-600">
              {errors.crop}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="agri-area" className="mb-1 block text-xs font-bold text-slate-600 dark:text-emerald-100">
            سطح زمین
          </label>
          <input
            id="agri-area"
            type="number"
            min="0"
            step="0.1"
            inputMode="decimal"
            value={area}
            onChange={(event) => setArea(event.target.value)}
            aria-invalid={Boolean(errors.area)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
          />
          {errors.area && (
            <p role="alert" className="mt-1 text-fluid-xs font-semibold text-rose-600">
              {errors.area}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="agri-unit" className="mb-1 block text-xs font-bold text-slate-600 dark:text-emerald-100">
            واحد سطح
          </label>
          <select
            id="agri-unit"
            value={areaUnit}
            onChange={(event) => setAreaUnit(event.target.value as AreaUnit)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-800 dark:bg-emerald-950 dark:text-white"
          >
            {AREA_UNITS.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={handleCalculate}
        disabled={calculating}
        className="mt-4 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-lime-500 py-3 text-sm font-extrabold text-white shadow transition hover:brightness-105 disabled:opacity-60"
      >
        {calculating ? 'در حال محاسبه…' : 'محاسبه مقدار مورد نیاز'}
      </button>

      {formError && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {formError}
        </p>
      )}

      {/* Result */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4 dark:border-emerald-800 dark:bg-emerald-950/60"
        >
          <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-emerald-700 dark:text-lime-300">
            <CheckCircle2 size={16} />
            مقدار مورد نیاز
          </h3>

          <p className="mt-2 text-2xl font-extrabold text-slate-800 dark:text-white">
            {result.total.min} تا {result.total.max}{' '}
            <span className="text-base font-bold">{result.total.unit}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-emerald-200">
            برای {result.area.value} {result.area.unit_label} ({result.area.hectares} هکتار) کشت{' '}
            {result.crop}
            {result.target && ` — ${result.target}`}
          </p>
          <p className="mt-1 text-fluid-xs text-slate-400">
            دوز پایه: {result.rate.min} تا {result.rate.max} {result.rate.unit} {result.rate.basis_label}
          </p>
          {result.notes && (
            <p className="mt-2 rounded-lg bg-slate-50 p-2 text-fluid-xs text-slate-600 dark:bg-emerald-900/50 dark:text-emerald-100">
              {result.notes}
            </p>
          )}

          {/* Safety warnings are never collapsed or hidden behind a toggle. */}
          <ul className="mt-3 space-y-1.5">
            {result.warnings.map((warning) => (
              <li
                key={warning}
                className="flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-fluid-xs font-semibold leading-5 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
              >
                <ShieldAlert size={13} className="mt-0.5 shrink-0" />
                <span>{warning}</span>
              </li>
            ))}
          </ul>

          {linkedProduct && (
            <button
              type="button"
              onClick={() =>
                selected &&
                onAddToCart(toMockProduct(linkedProduct, selected), Math.ceil(Number(result.total.min)))
              }
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
            >
              <ShoppingCart size={14} />
              افزودن {linkedProduct.title} به سبد خرید
            </button>
          )}
        </motion.div>
      )}
    </section>
  );
}
