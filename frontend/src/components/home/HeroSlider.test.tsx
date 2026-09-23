// frontend/src/components/home/HeroSlider.test.tsx
//
// The hero is now a real carousel (Digikala parity): slides, arrows, dots,
// keyboard. These tests pin the contract the page and the e2e suite rely on:
// #hero-heading always exists, navigation works by button and dot, hidden
// slides are hidden from assistive technology — plus the two accessibility
// contracts that were missing before: a control that stops the rotation
// (WCAG 2.2.2) and a slide picker that behaves like the widget it claims to be.

import { screen, fireEvent, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import HeroSlider from './HeroSlider';
import AutoRotateToggle from '../ui/AutoRotateToggle';
import { renderAppSettled } from '../../test/render';
import { resetAutoRotatePreference } from '../../hooks/useAutoRotate';

beforeEach(() => {
  // The preference is module state shared by every rail in the page; without
  // this a test that pauses motion would pause it for the next test too.
  resetAutoRotatePreference();
});

const slideElements = () =>
  document.querySelectorAll('[aria-roledescription="carousel"] > div > div');

describe('the home hero slider', () => {
  it('keeps #hero-heading on the first slide', async () => {
    await renderAppSettled(<HeroSlider />, { route: '/' });
    const heading = document.getElementById('hero-heading');
    expect(heading).not.toBeNull();
    expect(heading?.textContent?.length).toBeGreaterThan(5);
  });

  it('advances to the next slide via the next button', async () => {
    await renderAppSettled(<HeroSlider />, { route: '/' });
    const slides = slideElements();
    expect(slides.length).toBeGreaterThanOrEqual(2);
    expect(slides[1]).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'اسلاید بعدی' }));
    expect(slides[1]).toHaveAttribute('aria-hidden', 'false');
    expect(slides[0]).toHaveAttribute('aria-hidden', 'true');
  });

  it('selects a slide via its dot', async () => {
    await renderAppSettled(<HeroSlider />, { route: '/' });
    const dots = screen.getAllByRole('button', { name: /^اسلاید \d+ از \d+$/ });
    fireEvent.click(dots[2]!);
    expect(dots[2]).toHaveAttribute('aria-current', 'true');
    expect(dots[0]).toHaveAttribute('aria-current', 'false');
  });

  it('wraps around backwards from the first slide', async () => {
    await renderAppSettled(<HeroSlider />, { route: '/' });
    fireEvent.click(screen.getByRole('button', { name: 'اسلاید قبلی' }));
    const dots = screen.getAllByRole('button', { name: /^اسلاید \d+ از \d+$/ });
    expect(dots[dots.length - 1]).toHaveAttribute('aria-current', 'true');
  });

  it('offers the picker as a labelled group, not as a tablist it does not implement', async () => {
    // `role="tab"` promises arrow-key navigation between tabs and a tabpanel
    // behind each one. Neither existed here, so the role was a false promise
    // announced to every screen reader.
    await renderAppSettled(<HeroSlider />, { route: '/' });
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    const picker = screen.getByRole('group', { name: 'انتخاب اسلاید' });
    expect(within(picker).getAllByRole('button')).toHaveLength(slideElements().length);
  });

  it('moves between slides with the arrow keys once focus is in the picker', async () => {
    await renderAppSettled(<HeroSlider />, { route: '/' });
    const picker = screen.getByRole('group', { name: 'انتخاب اسلاید' });
    const dots = within(picker).getAllByRole('button');

    expect(dots[0]).toHaveAttribute('tabIndex', '0');
    expect(dots[1]).toHaveAttribute('tabIndex', '-1');

    fireEvent.keyDown(dots[0]!, { key: 'ArrowLeft' }); // RTL: next slide
    expect(dots[1]).toHaveAttribute('aria-current', 'true');
    expect(document.activeElement).toBe(dots[1]);

    fireEvent.keyDown(dots[1]!, { key: 'End' });
    expect(dots[dots.length - 1]).toHaveAttribute('aria-current', 'true');
    expect(document.activeElement).toBe(dots[dots.length - 1]);

    fireEvent.keyDown(dots[dots.length - 1]!, { key: 'Home' });
    expect(dots[0]).toHaveAttribute('aria-current', 'true');
  });

  it('lets the picker own the arrow keys instead of also advancing the slide', async () => {
    await renderAppSettled(<HeroSlider />, { route: '/' });
    const picker = screen.getByRole('group', { name: 'انتخاب اسلاید' });
    const dots = within(picker).getAllByRole('button');
    const slides = slideElements();

    // Start on the second slide, then press the key the *section* handler also
    // listens for. One press must move one step backwards — if both handlers
    // ran, the picker would land on dot 0 and the section would then wrap the
    // carousel to the last slide, so the mismatch is visible here.
    fireEvent.click(dots[1]!);
    expect(slides[1]).toHaveAttribute('aria-hidden', 'false');

    fireEvent.keyDown(dots[1]!, { key: 'ArrowRight' });
    expect(dots[0]).toHaveAttribute('aria-current', 'true');
    expect(dots[1]).toHaveAttribute('aria-current', 'false');
    expect(slides[0]).toHaveAttribute('aria-hidden', 'false');
    expect(slides[slides.length - 1]).toHaveAttribute('aria-hidden', 'true');
  });

  it('stops the rotation when the visitor asks it to (WCAG 2.2.2)', async () => {
    await renderAppSettled(<HeroSlider />, { route: '/' });
    const pause = screen.getByRole('button', { name: 'توقف پخش خودکار' });
    fireEvent.click(pause);

    // The control renames itself to the opposite action, so the state is
    // readable without a tooltip and without interpreting aria-pressed.
    expect(screen.getByRole('button', { name: 'پخش خودکار را روشن کن' })).toBeInTheDocument();
    expect(screen.getByText('پخش خودکار متوقف شد')).toBeInTheDocument();
  });

  it('shares one preference with every other auto-rotating region', async () => {
    await renderAppSettled(
      <>
        <HeroSlider />
        <AutoRotateToggle />
      </>,
      { route: '/' },
    );
    // The second toggle belongs to another region (a rail, in production).
    fireEvent.click(screen.getAllByRole('button', { name: 'توقف پخش خودکار' })[1]!);
    expect(screen.queryAllByRole('button', { name: 'توقف پخش خودکار' })).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: 'پخش خودکار را روشن کن' })).toHaveLength(2);
  });
});
