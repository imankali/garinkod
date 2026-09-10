// frontend/src/test/setup.ts
//
// The jsdom gaps that a React app notices immediately, filled once.
//
// Keep this file free of app imports: whatever it pulls into the module graph is
// loaded before a test file's `vi.mock` declarations exist, and those mocks then
// quietly stop applying to it. Session helpers live in ./auth, which tests import
// themselves.
//
// None of this is app behaviour: jsdom simply does not implement the layout and
// observation APIs the app (and framer-motion) reach for, and every test file
// would otherwise stub them again.

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';


class NoopObserver {
  observe() {}

  unobserve() {}

  disconnect() {}

  takeRecords() {
    return [];
  }
}

if (!('IntersectionObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'IntersectionObserver', { value: NoopObserver, writable: true });
}
if (!('ResizeObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'ResizeObserver', { value: NoopObserver, writable: true });
}

// framer-motion asks for the media query on mount; jsdom answers with nothing.
window.matchMedia =
  window.matchMedia ||
  ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList);

// Scrolling is a no-op but must exist, since lists call it after every load.
window.scrollTo = (() => {}) as typeof window.scrollTo;
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});

beforeEach(() => {
  // A toast from the previous test must not be mistaken for this one's message.
  document.body.innerHTML = '';
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
  vi.useRealTimers();
});
