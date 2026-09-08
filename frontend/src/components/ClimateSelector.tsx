import { useEffect, useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';

import { locationsApi } from '../api/services';
import type { Location } from '@/types/farming';

const PROVINCE_KEY = 'garinkood.climate.province-slug';
const CITY_KEY = 'garinkood.climate.city-slug';

export interface ClimateSelection {
  provinceId: number | null;
  provinceSlug: string;
  provinceName: string;
  cityId: number | null;
  citySlug: string;
  cityName: string;
}

interface ClimateSelectorProps {
  onChange?: (value: ClimateSelection) => void;
}

export default function ClimateSelector({ onChange }: ClimateSelectorProps) {
  const [provinces, setProvinces] = useState<Location[]>([]);
  const [cities, setCities] = useState<Location[]>([]);
  const [provinceSlug, setProvinceSlug] = useState(
    () => localStorage.getItem(PROVINCE_KEY) || '',
  );
  const [citySlug, setCitySlug] = useState(
    () => localStorage.getItem(CITY_KEY) || '',
  );

  const selectedProvince = useMemo(
    () => provinces.find((item) => item.slug === provinceSlug) ?? null,
    [provinces, provinceSlug],
  );
  const selectedCity = useMemo(
    () => cities.find((item) => item.slug === citySlug) ?? null,
    [cities, citySlug],
  );

  useEffect(() => {
    let cancelled = false;
    locationsApi
      .provinces()
      .then((response) => {
        if (!cancelled) setProvinces(response.data.results);
      })
      .catch(() => {
        if (!cancelled) setProvinces([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedProvince) {
      setCities([]);
      return;
    }

    let cancelled = false;
    locationsApi
      .cities(selectedProvince.name)
      .then((response) => {
        if (cancelled) return;
        const nextCities = response.data.results;
        setCities(nextCities);
        setCitySlug((current) =>
          current && !nextCities.some((item) => item.slug === current) ? '' : current,
        );
      })
      .catch(() => {
        if (!cancelled) setCities([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProvince]);

  useEffect(() => {
    if (provinceSlug) localStorage.setItem(PROVINCE_KEY, provinceSlug);
    else localStorage.removeItem(PROVINCE_KEY);

    if (citySlug) localStorage.setItem(CITY_KEY, citySlug);
    else localStorage.removeItem(CITY_KEY);

    onChange?.({
      provinceId: selectedProvince?.id ?? null,
      provinceSlug: selectedProvince?.slug ?? '',
      provinceName: selectedProvince?.name ?? '',
      cityId: selectedCity?.id ?? null,
      citySlug: selectedCity?.slug ?? '',
      cityName: selectedCity?.name ?? '',
    });
  }, [provinceSlug, citySlug, selectedProvince, selectedCity, onChange]);

  const fieldClass =
    'min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:border-emerald-800 dark:bg-emerald-950 dark:text-white';

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center" aria-label="انتخاب منطقه اقلیمی">
      <MapPin size={17} className="hidden shrink-0 text-emerald-600 sm:block" aria-hidden="true" />

      <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-bold text-slate-600 dark:text-emerald-100">
        <span className="shrink-0">استان</span>
        <select
          value={provinceSlug}
          onChange={(event) => {
            setProvinceSlug(event.target.value);
            setCitySlug('');
          }}
          className={fieldClass}
        >
          <option value="">انتخاب استان</option>
          {provinces.map((item) => (
            <option key={item.id} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-bold text-slate-600 dark:text-emerald-100">
        <span className="shrink-0">شهرستان</span>
        <select
          value={citySlug}
          disabled={!selectedProvince}
          onChange={(event) => setCitySlug(event.target.value)}
          className={fieldClass}
        >
          <option value="">{selectedProvince ? 'انتخاب شهرستان' : 'ابتدا استان'}</option>
          {cities.map((item) => (
            <option key={item.id} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
