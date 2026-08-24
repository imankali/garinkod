// frontend/src/components/LocationPicker.tsx

import { useEffect, useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';

import { locationsApi } from '../api/services';
import type { Location } from '../types';

interface LocationPickerProps {
  province: string;
  city: string;
  onProvinceChange: (province: string) => void;
  onCityChange: (city: string) => void;
  provinceError?: string;
  cityError?: string;
  required?: boolean;
  disabled?: boolean;
  idPrefix?: string;
}

/**
 * Province/city selects backed by the real Location table.
 *
 * Cities are fetched for the chosen province rather than hard-coded, and
 * choosing a new province clears a city that no longer belongs to it — which
 * is what stops an invalid pair such as "گیلان / شیراز" from ever being
 * submitted.
 */
export default function LocationPicker({
  province,
  city,
  onProvinceChange,
  onCityChange,
  provinceError,
  cityError,
  required = false,
  disabled = false,
  idPrefix = 'location',
}: LocationPickerProps) {
  const [provinces, setProvinces] = useState<Location[]>([]);
  const [cities, setCities] = useState<Location[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    locationsApi
      .provinces()
      .then((response) => {
        if (!cancelled) setProvinces(response.data.results);
      })
      .catch(() => {
        if (!cancelled) setLoadError('فهرست استان‌ها بارگذاری نشد. صفحه را دوباره باز کنید.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!province) {
      setCities([]);
      return undefined;
    }
    let cancelled = false;
    setLoadingCities(true);
    locationsApi
      .cities(province)
      .then((response) => {
        if (cancelled) return;
        setCities(response.data.results);
        // Drop a city that does not belong to the newly selected province.
        const stillValid = response.data.results.some((item) => item.name === city);
        if (city && !stillValid) onCityChange('');
      })
      .catch(() => {
        if (!cancelled) setCities([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCities(false);
      });
    return () => {
      cancelled = true;
    };
    // `city`/`onCityChange` are intentionally excluded: this effect reacts to a
    // province change, and including them would refetch on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [province]);

  const provinceOptions = useMemo(
    () => provinces.map((item) => item.name).sort((a, b) => a.localeCompare(b, 'fa')),
    [provinces],
  );

  const provinceId = `${idPrefix}-province`;
  const cityId = `${idPrefix}-city`;

  return (
    <>
      <div>
        <label
          htmlFor={provinceId}
          className="mb-1 block text-xs font-bold text-slate-600 dark:text-emerald-100"
        >
          <MapPin size={12} className="me-1 inline" />
          استان {required && <span className="text-rose-500">*</span>}
        </label>
        <select
          id={provinceId}
          value={province}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(provinceError)}
          aria-describedby={provinceError ? `${provinceId}-error` : undefined}
          onChange={(event) => onProvinceChange(event.target.value)}
          className={`w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60 dark:bg-emerald-950 dark:text-white ${
            provinceError
              ? 'border-rose-400 dark:border-rose-500'
              : 'border-slate-200 dark:border-emerald-800'
          }`}
        >
          <option value="">انتخاب استان</option>
          {provinceOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {(provinceError || loadError) && (
          <p id={`${provinceId}-error`} role="alert" className="mt-1 text-fluid-xs font-semibold text-rose-600">
            {provinceError || loadError}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor={cityId}
          className="mb-1 block text-xs font-bold text-slate-600 dark:text-emerald-100"
        >
          شهر {required && <span className="text-rose-500">*</span>}
        </label>
        <select
          id={cityId}
          value={city}
          disabled={disabled || !province || loadingCities}
          required={required}
          aria-invalid={Boolean(cityError)}
          aria-describedby={cityError ? `${cityId}-error` : undefined}
          onChange={(event) => onCityChange(event.target.value)}
          className={`w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60 dark:bg-emerald-950 dark:text-white ${
            cityError ? 'border-rose-400 dark:border-rose-500' : 'border-slate-200 dark:border-emerald-800'
          }`}
        >
          <option value="">
            {!province ? 'ابتدا استان را انتخاب کنید' : loadingCities ? 'در حال بارگذاری…' : 'انتخاب شهر'}
          </option>
          {cities.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
        {cityError && (
          <p id={`${cityId}-error`} role="alert" className="mt-1 text-fluid-xs font-semibold text-rose-600">
            {cityError}
          </p>
        )}
      </div>
    </>
  );
}
