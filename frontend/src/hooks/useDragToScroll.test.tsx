// frontend/src/hooks/useDragToScroll.test.tsx
//
// The shared drag-to-scroll hook now carries every rail on the site
// (storefront rails, the quick-view tab strip, the similar-products shelf),
// so the three behaviors a drag cannot get wrong are pinned here once:
// the 5px dead-zone, the click suppression after a drag, and scroll-snap
// staying disabled only for the duration of the gesture.

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useDragToScroll } from './useDragToScroll';

function Harness({ onActivate }: { onActivate: () => void }) {
  const { ref, handlers } = useDragToScroll<HTMLDivElement>();
  return (
    <div ref={ref} data-testid="rail" {...handlers} className="snap-x snap-mandatory">
      <button type="button" onClick={onActivate}>افزودن</button>
    </div>
  );
}

/** jsdom has no PointerEvent; a MouseEvent with the pointer fields grafted on
 *  is exactly what React's delegated listeners see. */
function firePointer(el: Element, type: string, clientX: number, pointerType = 'mouse') {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY: 0, button: 0 });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  Object.defineProperty(event, 'pointerId', { value: 7 });
  el.dispatchEvent(event);
}

const rail = () => screen.getByTestId('rail') as HTMLDivElement;

describe('useDragToScroll', () => {
  it('stays a click under the 5px dead-zone and pans past it', () => {
    render(<Harness onActivate={vi.fn()} />);
    const el = rail();
    const scrollBy = vi.fn();
    el.scrollBy = scrollBy;

    firePointer(el, 'pointerdown', 300);
    firePointer(el, 'pointermove', 302); // 2px — still a click
    expect(scrollBy).not.toHaveBeenCalled();
    expect(el.style.scrollSnapType).toBe('');

    firePointer(el, 'pointermove', 320); // 20px — a real drag
    expect(scrollBy).toHaveBeenCalledWith({ left: 18, behavior: 'instant' });
    expect(el.style.scrollSnapType).toBe('none');
    expect(el.style.cursor).toBe('grabbing');
    expect(el.style.userSelect).toBe('none');

    firePointer(el, 'pointerup', 320);
    expect(el.style.cursor).toBe('');
    expect(el.style.scrollSnapType).toBe('');
    expect(el.style.userSelect).toBe('');
  });

  it('suppresses the click that follows a drag', () => {
    const activate = vi.fn();
    render(<Harness onActivate={activate} />);
    const el = rail();
    el.scrollBy = vi.fn();

    firePointer(el, 'pointerdown', 300);
    firePointer(el, 'pointermove', 330);
    firePointer(el, 'pointerup', 330);
    fireEvent.click(screen.getByRole('button', { name: 'افزودن' }));

    expect(activate).not.toHaveBeenCalled();
  });

  it('lets a plain click through', () => {
    const activate = vi.fn();
    render(<Harness onActivate={activate} />);
    fireEvent.click(screen.getByRole('button', { name: 'افزودن' }));
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it('ignores non-mouse pointers — touch pans natively', () => {
    render(<Harness onActivate={vi.fn()} />);
    const el = rail();
    const scrollBy = vi.fn();
    el.scrollBy = scrollBy;

    firePointer(el, 'pointerdown', 300, 'touch');
    firePointer(el, 'pointermove', 340, 'touch');
    firePointer(el, 'pointerup', 340, 'touch');

    expect(scrollBy).not.toHaveBeenCalled();
    expect(el.style.cursor).toBe('');
  });
});
