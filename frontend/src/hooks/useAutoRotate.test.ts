// frontend/src/hooks/useAutoRotate.test.ts
//
// The store behind the pause controls. Each case here is a behaviour the home
// page depends on: the OS preference is a default and not a cage, an explicit
// choice outlives the page, and one instance's click reaches the others.

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  resetAutoRotatePreference,
  setAutoRotate,
  useAutoRotate,
} from './useAutoRotate';

const STORAGE_KEY = 'auto-rotate-preference';

/** Replace `window.matchMedia` with one that answers a chosen reduced-motion state. */
function stubReducedMotion(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const query = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    addListener: (listener: (event: MediaQueryListEvent) => void) => { listeners.add(listener); },
    removeListener: (listener: (event: MediaQueryListEvent) => void) => { listeners.delete(listener); },
    dispatchEvent: () => false,
  };
  window.matchMedia = (() => query) as unknown as typeof window.matchMedia;
  return {
    /** Simulate the user changing the OS setting while the page is open. */
    emit(next: boolean) {
      query.matches = next;
      listeners.forEach((listener) => listener({ matches: next } as MediaQueryListEvent));
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  resetAutoRotatePreference();
  stubReducedMotion(false);
});

afterEach(() => {
  resetAutoRotatePreference();
  localStorage.clear();
});

describe('the auto-rotation preference', () => {
  it('rotates by default', () => {
    const { result } = renderHook(() => useAutoRotate());
    expect(result.current.playing).toBe(true);
  });

  it('starts stopped when the system asks for reduced motion', () => {
    stubReducedMotion(true);
    resetAutoRotatePreference();
    const { result } = renderHook(() => useAutoRotate());
    expect(result.current.playing).toBe(false);
  });

  it('lets an explicit choice override the system default', () => {
    stubReducedMotion(true);
    resetAutoRotatePreference();
    const { result } = renderHook(() => useAutoRotate());

    act(() => result.current.setPlaying(true));
    expect(result.current.playing).toBe(true);

    act(() => result.current.setPlaying(false));
    expect(result.current.playing).toBe(false);
  });

  it('follows the system setting live while no explicit choice exists', () => {
    const media = stubReducedMotion(false);
    resetAutoRotatePreference();
    const { result } = renderHook(() => useAutoRotate());
    expect(result.current.playing).toBe(true);

    // The old code read `matchMedia(...).matches` once at mount, so a change
    // made mid-session was ignored until the next full page load.
    act(() => media.emit(true));
    expect(result.current.playing).toBe(false);

    act(() => media.emit(false));
    expect(result.current.playing).toBe(true);
  });

  it('remembers the visitor’s decision for the next visit', () => {
    act(() => setAutoRotate(false));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('off');

    // A new module-level read is what a reload does; the stored value wins.
    resetAutoRotatePreference();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('off');
  });

  it('is one preference for every subscriber, not one per component', () => {
    const first = renderHook(() => useAutoRotate());
    const second = renderHook(() => useAutoRotate());

    act(() => first.result.current.toggle());

    expect(first.result.current.playing).toBe(false);
    // This is the part that makes the control usable: stopping the hero must
    // also stop the rails, on every page, without hunting for each one.
    expect(second.result.current.playing).toBe(false);
  });

  it('survives a browser that refuses to store anything', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const { result } = renderHook(() => useAutoRotate());

    expect(() => act(() => result.current.setPlaying(false))).not.toThrow();
    expect(result.current.playing).toBe(false);
    spy.mockRestore();
  });
});
