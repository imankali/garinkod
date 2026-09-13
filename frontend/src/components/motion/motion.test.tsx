import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import DragRail from './DragRail';
import Parallax from './Parallax';
import Reveal from './Reveal';
import SplitHeading from './SplitHeading';

/**
 * The one property that must hold in every one of these components, and the
 * reason they are written the way they are:
 *
 *   **the content is present and visible without GSAP.**
 *
 * jsdom cannot run the animation, which makes it exactly the right place to
 * prove this. If any of these components hid their children and waited for a
 * script, the assertions below would fail — and in production the same code
 * would leave a blank hero for every visitor whose network dropped one chunk.
 */

beforeEach(() => {
  // No ScrollTrigger in jsdom; the components must notice and stay out of the way.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the motion components', () => {
  it('SplitHeading renders a real heading with the whole sentence readable', () => {
    render(<SplitHeading id="hero-heading">نهاده‌های کشاورزی</SplitHeading>);

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent('نهاده‌های کشاورزی');
    expect(heading).toHaveAttribute('id', 'hero-heading');
  });

  it('SplitHeading honours the requested tag', () => {
    render(
      <SplitHeading as="h1">عنوان</SplitHeading>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('Reveal keeps its children in the document', () => {
    render(
      <Reveal>
        <p>محتوای قابل خواندن</p>
      </Reveal>,
    );
    expect(screen.getByText('محتوای قابل خواندن')).toBeVisible();
  });

  it('Parallax keeps its children in the document', () => {
    render(
      <Parallax distance={40}>
        <img src="/images/hero-farm.jpg" alt="" />
      </Parallax>,
    );
    expect(screen.getByRole('presentation', { hidden: true })).toBeInTheDocument();
  });

  it('DragRail stays a scrollable row, so the strip works with no JavaScript', () => {
    const { container } = render(
      <DragRail>
        <div>کود ۱</div>
        <div>کود ۲</div>
      </DragRail>,
    );

    expect(screen.getByText('کود ۱')).toBeInTheDocument();
    expect(screen.getByText('کود ۲')).toBeInTheDocument();
    // The enhancement is layered on a control that already works: if Draggable
    // never loads, this is still a horizontally scrollable row rather than a
    // strip of cards the visitor cannot move.
    expect(container.querySelector('.overflow-x-auto')).toBeInTheDocument();
  });
});
