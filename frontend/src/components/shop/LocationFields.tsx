// frontend/src/components/shop/LocationFields.tsx
//
// «استان» و «شهر» — as pickers, not as two free-text boxes.
//
// The province a stall, a land or an offer records is not decoration: listings
// are filtered with `storefront__province__iexact`, and `?province=` on the
// marketplace is an exact match. A farmer who types «فارس » with a trailing
// space, or «خراسان رضوى» with the wrong letter, ends up with a stall that no
// province filter can find — and nothing anywhere says so.
//
// `locationsApi` serves the list (`?kind=province`) and the cities of one
// province (`?province=<name>`). This component wires the two together: the
// city resets whenever the province changes, so a request can never carry a
// pair the server would disagree with.

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { locationsApi } from '../../api/services';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { SelectField, TextField } from '../ui/Field';

export function LocationFields({
  province,
  city,
  onChange,
  required = false,
  disabled = false,
}: {
  province: string;
  city: string;
  onChange: (next: { province: string; city: string }) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  // `locationsApi.search` matches provinces *and* cities by partial name. Iran
  // has 31 provinces and one of them holds dozens of cities, so scrolling is
  // the wrong tool — a farmer types «شیراز» and jumps straight there.
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim(), 400);

  const matches = useQuery({
    queryKey: ['locations', 'search', debouncedQuery],
    queryFn: async () => (await locationsApi.search(debouncedQuery)).data.results,
    enabled: debouncedQuery.length >= 2,
    staleTime: 60 * 60 * 1000,
  });

  const matchRows = useMemo(() => matches.data ?? [], [matches.data]);

  const provinces = useQuery({
    queryKey: ['locations', 'provinces'],
    queryFn: async () => (await locationsApi.provinces()).data.results,
    staleTime: 60 * 60 * 1000,
  });

  const cities = useQuery({
    queryKey: ['locations', 'cities', province],
    queryFn: async () => (await locationsApi.cities(province)).data.results,
    enabled: Boolean(province),
    staleTime: 60 * 60 * 1000,
  });

  // `?? []` inline in render trips exhaustive-deps; memoise both fallbacks.
  const provinceRows = useMemo(() => provinces.data ?? [], [provinces.data]);
  const cityRows = useMemo(() => cities.data ?? [], [cities.data]);

  return (
    <>
      <div className="sm:col-span-2">
        <TextField
          label="جست‌وجوی استان یا شهر"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="مثلاً شیراز"
          hint="نام شهر را بنویسید تا استان و شهر خودکار پر شود."
        />
        {debouncedQuery.length >= 2 && (
          <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="نتیجهٔ جست‌وجو">
            {matchRows.length === 0 ? (
              <li className="text-[11px] text-ink-mute dark:text-white/45">
                {matches.isLoading ? 'در حال جست‌وجو…' : 'جایی با این نام پیدا نشد.'}
              </li>
            ) : (
              matchRows.slice(0, 8).map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => {
                      // A city answer carries its province; a province answer
                      // has no city to pick, so the city stays empty.
                      if (entry.kind === 'city' && entry.province_name) {
                        onChange({ province: entry.province_name, city: entry.name });
                      } else {
                        onChange({ province: entry.name, city: '' });
                      }
                      setQuery('');
                    }}
                    className="inline-flex min-h-7 items-center gap-1 rounded-sm border border-line px-2 text-[11px] font-bold text-ink-soft hover:border-brand-400 dark:border-night-line dark:text-white/60"
                  >
                    {entry.name}
                    {entry.kind === 'city' && entry.province_name && (
                      <span className="text-ink-mute dark:text-white/35">· {entry.province_name}</span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <SelectField
        label="استان"
        required={required}
        value={province}
        disabled={disabled}
        onChange={(event) => onChange({ province: event.target.value, city: '' })}
      >
        <option value="">انتخاب کنید…</option>
        {provinceRows.map((entry) => (
          <option key={entry.id} value={entry.name}>
            {entry.name}
          </option>
        ))}
      </SelectField>

      <SelectField
        label="شهر"
        required={required}
        value={city}
        disabled={disabled || !province}
        onChange={(event) => onChange({ province, city: event.target.value })}
      >
        <option value="">{province ? 'انتخاب کنید…' : 'اول استان را انتخاب کنید'}</option>
        {cityRows.map((entry) => (
          <option key={entry.id} value={entry.name}>
            {entry.name}
          </option>
        ))}
      </SelectField>
    </>
  );
}
