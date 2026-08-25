// frontend/src/hooks/useUrlFilters.ts

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Keep a filter set in the URL query string.
 *
 * Filters living in the URL means a filtered result page can be shared,
 * bookmarked and restored by the back button — and it removes the class of bug
 * where component state and the visible address disagree.
 */
export function useUrlFilters<T extends Record<string, string>>(defaults: T) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    const current = { ...defaults };
    (Object.keys(defaults) as (keyof T)[]).forEach((key) => {
      const value = searchParams.get(String(key));
      if (value !== null) current[key] = value as T[keyof T];
    });
    return current;
  }, [searchParams, defaults]);

  const setFilter = useCallback(
    (key: keyof T, value: string) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          // A value equal to the default is dropped so the URL stays short and
          // two equivalent filter states produce the same address.
          if (!value || value === defaults[key]) {
            next.delete(String(key));
          } else {
            next.set(String(key), value);
          }
          // Any filter change invalidates the current page number.
          if (key !== 'page') next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, defaults],
  );

  const setFilters = useCallback(
    (values: Partial<T>) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          Object.entries(values).forEach(([key, value]) => {
            if (!value || value === defaults[key as keyof T]) {
              next.delete(key);
            } else {
              next.set(key, String(value));
            }
          });
          if (!('page' in values)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, defaults],
  );

  /**
   * Clear every filter this hook owns.
   *
   * Only the declared keys are removed: wiping the whole query string also
   * dropped unrelated parameters (the open tab, a referral code, a deep link
   * target), which made "clear all filters" silently reset the rest of the
   * page too — the surprising behaviour this now avoids.
   */
  const resetFilters = useCallback(() => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        Object.keys(defaults).forEach((key) => next.delete(key));
        next.delete('page');
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams, defaults]);

  /** Only the non-default entries, ready to pass straight to the API. */
  const activeFilters = useMemo(() => {
    return Object.entries(filters).reduce<Record<string, string>>((accumulator, [key, value]) => {
      if (value && value !== defaults[key as keyof T]) accumulator[key] = value as string;
      return accumulator;
    }, {});
  }, [filters, defaults]);

  const activeCount = Object.keys(activeFilters).filter((key) => key !== 'page').length;

  return { filters, setFilter, setFilters, resetFilters, activeFilters, activeCount };
}

export default useUrlFilters;
