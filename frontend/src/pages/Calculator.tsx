// frontend/src/pages/Calculator.tsx
//
// «چقدر کود بدهم؟» — the dose calculator.
//
// The API had three endpoints with no caller: the input catalogue (fertilisers
// and pesticides with their registered doses per crop), the crop list, and the
// calculation itself. The arithmetic lives on the server on purpose — the rates
// are agronomic data with a legal basis, and a browser that divides hectares by
// a rate it fetched could quietly disagree with the label.
//
// Two rules the page follows:
//   • Every number shown is the server's string (`total.min`, `rate.max`). No
//     rounding, no unit conversion in the browser beyond choosing one of the
//     units the API already accepts.
//   • `warnings` are printed in full and above the numbers. The last one is
//     always «این محاسبه راهنماست و جایگزین توصیه کارشناس … نیست» — a
//     calculator that buries its own caveat is the kind of UI that gets someone
//     to double a urea dose.

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, FlaskConical } from 'lucide-react';
import { Link } from 'react-router';

import { agriApi } from '../api/services';
import type { AreaUnit, DoseCalculation } from '@/types/farming';
import { parseApiError } from '../api/errors';
import { cn } from '../lib/cn';
import { nums } from '../lib/price';
import { useTitle } from '../lib/useTitle';
import PageHead from '../components/shop/PageHead';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { SelectField, TextField } from '../components/ui/Field';
import { Skeleton } from '../components/ui/Skeleton';

const AREA_UNITS: Array<{ value: AreaUnit; label: string }> = [
  { value: 'hectare', label: 'هکتار' },
  { value: 'jarib', label: 'جریب' },
  { value: 'square_meter', label: 'مترمربع' },
  { value: 'acre', label: 'ایکر' },
];

export default function Calculator() {
  useTitle('ماشین‌حساب کود و سم');
  const [kind, setKind] = useState<'fertilizer' | 'pesticide'>('fertilizer');
  const [inputId, setInputId] = useState<number | null>(null);
  const [crop, setCrop] = useState('');
  const [area, setArea] = useState('');
  const [areaUnit, setAreaUnit] = useState<AreaUnit>('hectare');

  const inputs = useQuery({
    queryKey: ['agri-inputs', kind],
    queryFn: async () => (await agriApi.inputs({ kind })).data,
  });

  const crops = useQuery({
    queryKey: ['agri-crops'],
    queryFn: async () => (await agriApi.crops()).data,
  });

  const catalogue = useMemo(() => inputs.data?.results ?? [], [inputs.data]);
  const selected = useMemo(
    () => catalogue.find((row) => row.id === inputId) ?? null,
    [catalogue, inputId],
  );

  // Only the crops this input is actually registered for: offering a crop with
  // no dose would end in an error the farmer cannot act on.
  const doseableCrops = useMemo(() => {
    if (!selected) return [];
    const registered = new Set(selected.doses.map((dose) => dose.crop_name));
    return (crops.data?.results ?? []).filter((name) => registered.has(name));
  }, [selected, crops.data]);

  const calculate = useMutation<DoseCalculation, unknown, void>({
    mutationFn: async () => {
      if (!selected || !crop || !area) throw new Error('ورودی ناقص است.');
      return (
        await agriApi.calculate({
          input_id: selected.id,
          crop,
          area: Number(area),
          area_unit: areaUnit,
        })
      ).data;
    },
  });

  const result = calculate.data;

  return (
    <div className="shell flex flex-col gap-6 py-8">
      <PageHead
        title="ماشین‌حساب کود و سم"
        lead="نهاده، محصول و مساحت را انتخاب کنید تا مقدار لازم بر اساس جدول دوز ثبت‌شده محاسبه شود."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <form
          noValidate
          className="flex flex-col gap-3 rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft"
          onSubmit={(event) => {
            event.preventDefault();
            if (selected && crop && area && !calculate.isPending) calculate.mutate();
          }}
        >
          <SelectField
            label="نوع نهاده"
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as typeof kind);
              setInputId(null);
              setCrop('');
            }}
          >
            <option value="fertilizer">کود</option>
            <option value="pesticide">سم</option>
          </SelectField>

          <SelectField
            label="نهاده"
            required
            value={inputId ?? ''}
            onChange={(event) => {
              const next = Number(event.target.value);
              setInputId(next || null);
              setCrop('');
            }}
            hint={selected ? `${selected.active_ingredient} · ${selected.formulation}` : undefined}
          >
            <option value="">— انتخاب کنید —</option>
            {catalogue.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="محصول"
            required
            value={crop}
            disabled={!selected}
            onChange={(event) => setCrop(event.target.value)}
          >
            <option value="">— انتخاب کنید —</option>
            {doseableCrops.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </SelectField>

          <div className="grid grid-cols-2 gap-2">
            <TextField
              label="مساحت"
              required
              dir="ltr"
              inputMode="decimal"
              value={area}
              onChange={(event) => setArea(event.target.value)}
            />
            <SelectField
              label="واحد"
              value={areaUnit}
              onChange={(event) => setAreaUnit(event.target.value as AreaUnit)}
            >
              {AREA_UNITS.map((unit) => (
                <option key={unit.value} value={unit.value}>
                  {unit.label}
                </option>
              ))}
            </SelectField>
          </div>

          <Button type="submit" loading={calculate.isPending} disabled={!selected || !crop || !area}>
            محاسبه
          </Button>

          {calculate.isError && (
            <p role="alert" className="text-2xs font-bold text-danger-700">
              {parseApiError(calculate.error).message}
            </p>
          )}
        </form>

        <div className="min-w-0">
          {inputs.isLoading ? (
            <Skeleton className="h-40 rounded-lg" />
          ) : catalogue.length === 0 ? (
            <EmptyState
              icon={FlaskConical}
              title="جدول نهاده‌ها خالی است"
              description="هنوز کود یا سمی با دوز ثبت‌شده در سامانه نیست؛ محاسبه‌ای هم در کار نیست."
            />
          ) : !result ? (
            <div className="rounded-lg border border-dashed border-line p-6 text-center dark:border-night-line">
              <p className="text-xs font-bold text-ink-soft dark:text-white/60">
                نتیجهٔ محاسبه اینجا نمایش داده می‌شود.
              </p>
              <p className="mt-1 text-2xs leading-6 text-ink-mute dark:text-white/45">
                مقدار بر اساس جدول دوز ثبت‌شده برای همان محصول و مساحت محاسبه می‌شود.
              </p>
            </div>
          ) : (
            <div aria-live="polite" className="flex flex-col gap-4">
              {/* Caveats first: they change how the numbers should be read. */}
              {result.warnings.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {result.warnings.map((warning) => (
                    <li
                      key={warning}
                      className="flex items-start gap-2 rounded-md border border-gold-200 bg-gold-50 p-3 text-2xs leading-6 text-gold-800 dark:border-night-line dark:bg-night-soft dark:text-gold-500"
                    >
                      <AlertTriangle size={13} aria-hidden="true" className="mt-1 shrink-0" />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft">
                <p className="text-2xs text-ink-mute dark:text-white/50">
                  {result.input.name} برای {result.crop} · {result.target}
                </p>

                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] text-ink-mute dark:text-white/45">
                      مقدار برای {nums(Number(result.area.value))} {result.area.unit_label}
                    </p>
                    <p className="dateline mt-1 text-xl font-extrabold text-ink dark:text-white">
                      {result.total.min} – {result.total.max}
                      <span className="ms-1 text-xs font-bold text-ink-mute dark:text-white/50">
                        {result.total.unit}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-ink-mute dark:text-white/45">
                      دوز {result.rate.basis_label}
                    </p>
                    <p className="dateline mt-1 text-sm font-bold text-ink-soft dark:text-white/75">
                      {result.rate.min} – {result.rate.max} {result.rate.unit}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-mute dark:text-white/40">
                      معادل {nums(Number(result.area.hectares))} هکتار
                    </p>
                  </div>
                </div>

                {result.notes && (
                  <p className="mt-3 border-t border-line pt-3 text-2xs leading-6 text-ink-soft dark:border-night-line dark:text-white/60">
                    {result.notes}
                  </p>
                )}

                {selected?.product_slug && (
                  <Link
                    to={`/product/${selected.product_slug}`}
                    className={cn(
                      'mt-3 inline-flex text-2xs font-bold text-brand-700',
                      'hover:underline dark:text-brand-300',
                    )}
                  >
                    دیدن این نهاده در فروشگاه
                  </Link>
                )}

                {selected && selected.preharvest_interval_days != null && (
                  <p className="mt-2 text-[11px] text-ink-mute dark:text-white/45">
                    دورهٔ کارنس: {nums(selected.preharvest_interval_days)} روز پیش از برداشت.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
