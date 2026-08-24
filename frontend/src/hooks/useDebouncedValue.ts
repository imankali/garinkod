// frontend/src/hooks/useDebouncedValue.ts

import { useEffect, useState } from 'react';

/**
 * The single debounce used by every search box and live-validation field.
 *
 * Having one implementation means every input in the app waits the same amount
 * of time before hitting the API, instead of each screen inventing its own
 * timer (and its own inconsistent delay).
 */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default useDebouncedValue;
