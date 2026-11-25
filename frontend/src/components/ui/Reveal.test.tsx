// frontend/src/components/ui/Reveal.test.tsx
//
// The one entrance animation on the site, and the two ways it must never hide
// content: an observer that never reports an intersection, and a visitor who
// asked for reduced motion.

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import Reveal from './Reveal';

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe('Reveal', () => {
  it('reveals its children even when the observer never reports an intersection', async () => {
    // The setup file stubs IntersectionObserver with a no-op, which is exactly the
    // case that used to leave a section invisible for good. The fallback timer must
    // hand the content back.
    render(
      <Reveal>
        <p>محتوا</p>
      </Reveal>,
    );

    const wrapper = screen.getByText('محتوا').parentElement!;
    expect(wrapper.className).toContain('opacity-0');

    await waitFor(() => expect(wrapper.className).toContain('opacity-100'), { timeout: 2500 });
    expect(wrapper.className).not.toContain('opacity-0');
  });

  it('paints immediately for a visitor who asked for reduced motion', () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    render(
      <Reveal>
        <p>محتوا</p>
      </Reveal>,
    );

    const wrapper = screen.getByText('محتوا').parentElement!;
    expect(wrapper.className).toContain('opacity-100');
    expect(wrapper.className).toContain('motion-reduce:transition-none');
  });
});
