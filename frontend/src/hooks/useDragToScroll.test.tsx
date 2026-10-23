// frontend/src/hooks/useDragToScroll.test.tsx
//
// The shared drag-to-scroll hook drives every horizontal rail on the site
// (home panels, storefront shelves, chip rows, product tabs and guides), so
// the behaviors a drag cannot get wrong are pinned here once:
//  - the 5px dead-zone that keeps a shaky click a click,
//  - grab direction (content follows the pointer),
//  - the click suppression after a drag,
//  - momentum after release,
//  - the overflow/edge flags the edge fade and grab cursor hang off,
//  - scroll snapping disabled only for the duration of the gesture.

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
function firePointer(
  el: Element,
  type: string,
  clientX: number,
  { pointerType = 'mouse', timeStamp }: { pointerType?: string; timeStamp?: number } = {},
) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY: 0, button: 0 });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  Object.defineProperty(event, 'pointerId', { value: 7 });
  if (timeStamp !== undefined) Object.defineProperty(event, 'timeStamp', { value: timeStamp });
  el.dispatchEvent(event);
}

const rail = () => screen.getByTestId('rail') as HTMLDivElement;
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

describe('useDragToScroll', () => {
  it('stays a click under the 5px dead-zone and pans past it', async () => {
    render(<Harness onActivate={vi.fn()} />);
    const el = rail();
    const scrollBy = vi.fn();
    el.scrollBy = scrollBy;

    firePointer(el, 'pointerdown', 300);
    firePointer(el, 'pointermove', 302); // 2px — still a click
    expect(scrollBy).not.toHaveBeenCalled();
    expect(el.style.scrollSnapType).toBe('');

    firePointer(el, 'pointermove', 320); // 20px — a real drag
    expect(scrollBy).toHaveBeenCalledWith({ left: -18, behavior: 'instant' });
    expect(el.style.scrollSnapType).toBe('none');
    expect(el.style.cursor).toBe('grabbing');
    expect(el.style.userSelect).toBe('none');

    firePointer(el, 'pointerup', 320);
    expect(el.style.cursor).toBe('');
    expect(el.style.userSelect).toBe('');
    // jsdom's stubbed scrollBy never moves the rail, so the glide parks on its
    // first frame and snap comes straight back.
    await nextFrame();
    await nextFrame();
    expect(el.style.scrollSnapType).toBe('');
  });

  it('feels like grabbing paper: dragging right walks the content right', () => {
    render(<Harness onActivate={vi.fn()} />);
    const el = rail();
    let position = 0;
    Object.defineProperty(el, 'scrollLeft', {
      configurable: true,
      get: () => position,
      set: (next: number) => { position = next; },
    });
    el.scrollBy = ((options: ScrollToOptions) => { position += options.left ?? 0; }) as never;

    // Start mid-rail so the glide is not clamped against an edge.
    position = -200;
    firePointer(el, 'pointerdown', 200);
    firePointer(el, 'pointermove', 260, { timeStamp: 100 });
    firePointer(el, 'pointerup', 260, { timeStamp: 110 });

    expect(position).toBe(-260);
  });

  it('keeps gliding after the mouse is released', async () => {
    render(<Harness onActivate={vi.fn()} />);
    const el = rail();
    let position = -500;
    Object.defineProperty(el, 'scrollLeft', {
      configurable: true,
      get: () => position,
      set: (next: number) => { position = next; },
    });
    el.scrollBy = ((options: ScrollToOptions) => { position += options.left ?? 0; }) as never;

    firePointer(el, 'pointerdown', 200, { timeStamp: 0 });
    firePointer(el, 'pointermove', 210, { timeStamp: 10 });
    firePointer(el, 'pointermove', 260, { timeStamp: 20 });
    firePointer(el, 'pointerup', 260, { timeStamp: 30 });
    const atRelease = position;

    await nextFrame();
    await nextFrame();

    // Momentum carries the rail further in the same direction after release.
    expect(position).toBeLessThan(atRelease);
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

    firePointer(el, 'pointerdown', 300, { pointerType: 'touch' });
    firePointer(el, 'pointermove', 340, { pointerType: 'touch' });
    firePointer(el, 'pointerup', 340, { pointerType: 'touch' });

    expect(scrollBy).not.toHaveBeenCalled();
    expect(el.style.cursor).toBe('');
  });

  it('cancels the native link/image drag that would hijack the pan', () => {
    render(<Harness onActivate={vi.fn()} />);
    const el = rail();

    const event = new MouseEvent('dragstart', { bubbles: true, cancelable: true });
    el.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('marks the cut-off edge so the rail can fade it', () => {
    render(<Harness onActivate={vi.fn()} />);
    const el = rail();
    el.style.direction = 'rtl';
    Object.defineProperty(el, 'scrollWidth', { configurable: true, value: 600 });
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: 200 });
    Object.defineProperty(el, 'scrollLeft', { configurable: true, value: -150 });

    // The hook listens for resizes and scrolls; either is enough to re-measure.
    fireEvent(window, new Event('resize'));

    expect(el.dataset.dragScroll).toBe('');
    expect(el.dataset.overflow).toBe('1');
    // Scrolled halfway: content is hidden on both physical sides.
    expect(el.dataset.edgeLeft).toBe('1');
    expect(el.dataset.edgeRight).toBe('1');
  });

  it('shows no fade or grab cursor when the row fits', () => {
    render(<Harness onActivate={vi.fn()} />);
    const el = rail();
    Object.defineProperty(el, 'scrollWidth', { configurable: true, value: 200 });
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: 200 });

    fireEvent(window, new Event('resize'));

    expect(el.dataset.overflow).toBe('0');
    expect(el.dataset.edgeLeft).toBe('0');
    expect(el.dataset.edgeRight).toBe('0');
  });
});
