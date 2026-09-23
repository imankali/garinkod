// frontend/src/hooks/useTabKeyboard.test.tsx
//
// Every tab list in the app announced `role="tab"` and then ignored the keyboard
// model that role promises. axe cannot catch that — `role="tab"` has no required
// children and no rule checks for the keys — so the contract is pinned here, in
// the DOM, where it actually happens.

import { useState } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useTabKeyboard } from './useTabKeyboard';
import { renderAppSettled } from '../test/render';

const VALUES = ['description', 'specs', 'reviews'] as const;
type Value = (typeof VALUES)[number];

function TabStrip() {
  const [value, setValue] = useState<Value>('description');
  const keyboard = useTabKeyboard({ values: VALUES, current: value, onSelect: setValue });

  return (
    <div role="tablist" aria-label="بخش‌ها" {...keyboard.tabListProps}>
      {VALUES.map((item) => (
        <button
          key={item}
          type="button"
          role="tab"
          aria-selected={value === item}
          onClick={() => setValue(item)}
          {...keyboard.tabProps(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

const tabs = () => screen.getAllByRole('tab');

describe('the tabs keyboard model', () => {
  it('keeps exactly one tab in the tab order', async () => {
    await renderAppSettled(<TabStrip />, { route: '/' });
    const [first, second, third] = tabs();
    expect(first).toHaveAttribute('tabIndex', '0');
    expect(second).toHaveAttribute('tabIndex', '-1');
    expect(third).toHaveAttribute('tabIndex', '-1');
  });

  it('moves to the next tab with ArrowLeft in RTL and focuses it', async () => {
    await renderAppSettled(<TabStrip />, { route: '/' });
    fireEvent.keyDown(tabs()[0]!, { key: 'ArrowLeft' });
    expect(tabs()[1]).toHaveAttribute('aria-selected', 'true');
    expect(tabs()[1]).toHaveAttribute('tabIndex', '0');
    expect(document.activeElement).toBe(tabs()[1]);
  });

  it('moves backwards with ArrowRight and wraps around the ends', async () => {
    await renderAppSettled(<TabStrip />, { route: '/' });
    fireEvent.keyDown(tabs()[0]!, { key: 'ArrowRight' });
    expect(tabs()[2]).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(tabs()[2]);
  });

  it('jumps to the ends with Home and End', async () => {
    await renderAppSettled(<TabStrip />, { route: '/' });
    fireEvent.keyDown(tabs()[0]!, { key: 'End' });
    expect(tabs()[2]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(tabs()[2]!, { key: 'Home' });
    expect(tabs()[0]).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(tabs()[0]);
  });

  it('leaves other keys to the page', async () => {
    await renderAppSettled(<TabStrip />, { route: '/' });
    // Tab and Escape must keep doing what the browser and the surrounding
    // dialogs expect them to do: move on, or close. The strip is the first
    // thing they would break, and the failure would be invisible on screen.
    tabs()[0]!.focus();
    fireEvent.keyDown(tabs()[0]!, { key: 'Tab' });
    fireEvent.keyDown(tabs()[0]!, { key: 'Escape' });
    expect(tabs()[0]).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(tabs()[0]);
  });

  it('ignores key events that did not come from a tab', async () => {
    await renderAppSettled(<TabStrip />, { route: '/' });
    const list = screen.getByRole('tablist');
    fireEvent.keyDown(list, { key: 'ArrowLeft' });
    expect(tabs()[0]).toHaveAttribute('aria-selected', 'true');
  });
});
