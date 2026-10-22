// frontend/src/components/ProductDetailModal.test.tsx
//
// The quick-view's tab strip overflows at every width the modal opens at —
// five tabs inside a half-modal column — and hides its scrollbar, so before
// the strip could be dragged the far tabs were unreachable with a mouse.
// These tests pin the drag: the storefront rails' pointer pattern, with the
// 5px dead-zone that keeps grabbing the strip from clicking a tab.

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProductDetailModal from './ProductDetailModal';
import { renderAppSettled } from '../test/render';
import { productsApi } from '../api/services';
import type { MockProduct } from '../types/shop';

vi.mock('../api/services', () => ({
  productsApi: { getBySlug: vi.fn() },
}));

const product: MockProduct = {
  id: 1,
  slug: 'test-product',
  name: 'کود آزمایشی',
  category: 'کود',
  categoryId: 'fertilizer',
  subCategoryId: 'soluble',
  brand: 'سبزگستر',
  price: 480000,
  rating: 4.5,
  reviews: 120,
  image: '/images/hero-farm.jpg',
  inStock: true,
  description: 'توضیح آزمایشی محصول برای تب توضیحات',
  features: ['حلالیت بالا'],
  cropTags: [],
  pestTags: [],
  usage: { dosage: '۲ لیتر در هکتار', method: 'محلول‌پاشی', timing: 'صبح زود' },
  warnings: [],
  compatibleWith: [],
  brochureAvailable: false,
};

/** jsdom has no PointerEvent; a MouseEvent with the pointer fields grafted on
 *  is exactly what React's delegated listeners see. */
function firePointer(el: Element, type: string, clientX: number, pointerType = 'mouse') {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY: 0, button: 0 });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  Object.defineProperty(event, 'pointerId', { value: 7 });
  el.dispatchEvent(event);
}

const renderModal = () =>
  renderAppSettled(
    <ProductDetailModal
      product={product}
      onClose={vi.fn()}
      onAddToCart={vi.fn()}
      isWishlisted={false}
      onToggleWishlist={vi.fn()}
    />,
  );

/** The strip is the tab buttons' shared parent. */
const tabStrip = () => screen.getByRole('button', { name: 'توضیحات' }).parentElement as HTMLDivElement;

beforeEach(() => {
  vi.mocked(productsApi.getBySlug).mockResolvedValue({ data: {} } as never);
});

describe('the quick-view tab strip drag', () => {
  it('pans the strip once the gesture passes the 5px dead-zone', async () => {
    await renderModal();
    const strip = tabStrip();
    const scrollBy = vi.fn();
    strip.scrollBy = scrollBy;

    firePointer(strip, 'pointerdown', 300);
    firePointer(strip, 'pointermove', 302); // 2px — still a click
    expect(scrollBy).not.toHaveBeenCalled();

    firePointer(strip, 'pointermove', 320); // 20px — a real drag
    expect(scrollBy).toHaveBeenCalledWith({ left: 18, behavior: 'instant' });
    expect(strip.style.cursor).toBe('grabbing');
    expect(strip.style.userSelect).toBe('none');

    firePointer(strip, 'pointerup', 320);
    expect(strip.style.cursor).toBe('');
    expect(strip.style.userSelect).toBe('');
  });

  it('does not switch tabs when the mouse releases after a drag', async () => {
    await renderModal();
    const strip = tabStrip();
    strip.scrollBy = vi.fn();

    firePointer(strip, 'pointerdown', 300);
    firePointer(strip, 'pointermove', 330);
    firePointer(strip, 'pointerup', 330);
    fireEvent.click(screen.getByRole('button', { name: 'ویژگی‌ها' }));

    // The description is still the open tab — the drag swallowed the click.
    expect(screen.getByText(product.description)).toBeInTheDocument();
  });

  it('still switches tabs on a plain click', async () => {
    vi.mocked(productsApi.getBySlug).mockResolvedValue({
      data: { attributes: [{ label: 'فرم', value: 'پودر حل‌شونده' }] },
    } as never);
    await renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'ویژگی‌ها' }));
    await waitFor(() => expect(screen.getByText('پودر حل‌شونده')).toBeInTheDocument());
    expect(screen.queryByText(product.description)).not.toBeInTheDocument();
  });

  it('leaves touch gestures alone — touch pans natively', async () => {
    await renderModal();
    const strip = tabStrip();
    const scrollBy = vi.fn();
    strip.scrollBy = scrollBy;

    firePointer(strip, 'pointerdown', 300, 'touch');
    firePointer(strip, 'pointermove', 340, 'touch');
    firePointer(strip, 'pointerup', 340, 'touch');

    expect(scrollBy).not.toHaveBeenCalled();
    expect(strip.style.cursor).toBe('');
  });
});
