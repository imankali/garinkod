// frontend/src/components/home/HeroSlider.test.tsx
//
// The hero is now a real carousel (Digikala parity): slides, arrows, dots,
// keyboard. These tests pin the contract the page and the e2e suite rely on:
// #hero-heading always exists, navigation works by button and dot, and hidden
// slides are hidden from assistive technology.

import { screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HeroSlider from './HeroSlider';
import { renderAppSettled } from '../../test/render';

describe('the home hero slider', () => {
  it('keeps #hero-heading on the first slide', async () => {
    await renderAppSettled(<HeroSlider />, { route: '/' });
    const heading = document.getElementById('hero-heading');
    expect(heading).not.toBeNull();
    expect(heading?.textContent?.length).toBeGreaterThan(5);
  });

  it('advances to the next slide via the next button', async () => {
    await renderAppSettled(<HeroSlider />, { route: '/' });
    const slides = document.querySelectorAll('[aria-roledescription="carousel"] > div > div');
    expect(slides.length).toBeGreaterThanOrEqual(2);
    expect(slides[1]).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'اسلاید بعدی' }));
    expect(slides[1]).toHaveAttribute('aria-hidden', 'false');
    expect(slides[0]).toHaveAttribute('aria-hidden', 'true');
  });

  it('selects a slide via its dot', async () => {
    await renderAppSettled(<HeroSlider />, { route: '/' });
    const dots = screen.getAllByRole('tab');
    fireEvent.click(dots[2]!);
    expect(dots[2]).toHaveAttribute('aria-selected', 'true');
    expect(dots[0]).toHaveAttribute('aria-selected', 'false');
  });

  it('wraps around backwards from the first slide', async () => {
    await renderAppSettled(<HeroSlider />, { route: '/' });
    fireEvent.click(screen.getByRole('button', { name: 'اسلاید قبلی' }));
    const dots = screen.getAllByRole('tab');
    expect(dots[dots.length - 1]).toHaveAttribute('aria-selected', 'true');
  });
});
