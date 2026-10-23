// frontend/src/hooks/useTabListKeys.test.tsx
//
// The tabs pattern is a promise about keys. These pin the three behaviours a
// tablist cannot get wrong: ← → move and activate, the direction follows the
// document (RTL), and Home/End reach the ends.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { useTabListKeys } from './useTabListKeys';

function Harness() {
  const [active, setActive] = useState('one');
  const tabs = useTabListKeys<HTMLDivElement>();
  const items = ['one', 'two', 'three'];
  return (
    <div ref={tabs.ref} onKeyDown={tabs.onKeyDown} role="tablist" aria-label="نمونه" dir="rtl">
      {items.map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active === id}
          onClick={() => setActive(id)}
        >
          {id}
        </button>
      ))}
      <output data-testid="active">{active}</output>
    </div>
  );
}

const active = () => screen.getByTestId('active').textContent;

describe('useTabListKeys', () => {
  it('moves and activates with the arrows, in reading direction order', async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'one' }));

    // RTL: ArrowLeft walks forward through the list.
    await user.keyboard('{ArrowLeft}');
    expect(active()).toBe('two');
    expect(screen.getByRole('tab', { name: 'two' })).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(active()).toBe('one');
  });

  it('jumps to the ends with Home and End and wraps at the edges', async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'one' }));

    await user.keyboard('{End}');
    expect(active()).toBe('three');
    await user.keyboard('{ArrowLeft}');
    expect(active()).toBe('one'); // wraps back to the first tab
    await user.keyboard('{Home}');
    expect(active()).toBe('one');
  });
});
