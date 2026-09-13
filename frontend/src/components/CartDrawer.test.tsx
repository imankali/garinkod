// frontend/src/components/CartDrawer.test.tsx
//
// The stall's minimum order, said out loud where the quantity changes.
//
// The drawer used to disable the decrease button at the minimum. The order stayed
// valid, so nothing looked broken — but the control greyed out with no reason
// attached, and the line that explains the rule was gated on `quantity < min`,
// which the clamp made unreachable. A browser test that pressed decrease and
// waited for the explanation could only ever time out, because the explanation
// was dead code.
//
// These tests hold the corrected behaviour: the control stays live, the quantity
// is still never sent below the floor, and the rule is announced.

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CartDrawer from './CartDrawer';
import { renderApp, flush } from '../test/render';
import { useCartStore } from '../store/cartStore';
import { productsApi } from '../api/services';
import type { CartItem } from '@/types/commerce';

vi.mock('../api/services', () => ({
  productsApi: { getAll: vi.fn() },
}));

const updateQuantity = vi.fn(async () => {});

/** A stall listing whose seller set a minimum of three. */
function listingItem(quantity: number, min = 3): CartItem {
  return {
    id: 77,
    kind: 'listing',
    product: null,
    listing: null,
    title: 'کود ورمی‌کمپوست غرفه',
    quantity,
    unit_price: 120000,
    total_price: 120000 * quantity,
    available_quantity: 20,
    min_order_quantity: min,
    is_in_stock: true,
  } as CartItem;
}

function openDrawerWith(item: CartItem) {
  useCartStore.setState({
    cart: { id: 1, items: [item], total_price: item.total_price } as never,
    itemErrors: {},
    updateQuantity: updateQuantity as never,
    fetchCart: vi.fn(async () => {}) as never,
    addToCart: vi.fn(async () => {}) as never,
    removeFromCart: vi.fn(async () => {}) as never,
  } as never);
  return renderApp(<CartDrawer isOpen onClose={() => {}} />, { route: '/products' });
}

beforeEach(() => {
  updateQuantity.mockClear();
  vi.mocked(productsApi.getAll).mockResolvedValue({
    data: { count: 0, results: [] },
  } as never);
});

describe('the stall’s minimum order', () => {
  it('says the rule when the buyer presses decrease at the floor', async () => {
    const user = userEvent.setup();
    openDrawerWith(listingItem(3));

    const decrease = screen.getByRole('button', { name: /کاهش تعداد/ });
    // The control is live: a greyed-out button is the quietest possible refusal.
    expect(decrease).toBeEnabled();

    await user.click(decrease);
    await flush();

    expect(screen.getByText(/حداقل سفارش این غرفه/)).toBeVisible();
    // And the order is still valid — nothing below the minimum was sent.
    expect(updateQuantity).not.toHaveBeenCalled();
  });

  it('still decreases while there is room, and says nothing about a minimum', async () => {
    const user = userEvent.setup();
    openDrawerWith(listingItem(5));

    await user.click(screen.getByRole('button', { name: /کاهش تعداد/ }));
    await flush();

    expect(updateQuantity).toHaveBeenCalledWith(77, 4);
    expect(screen.queryByText(/حداقل سفارش این غرفه/)).toBeNull();
  });

  it('points the control at its own explanation', async () => {
    // `aria-describedby` is what makes the reason reachable for a screen reader
    // rather than merely printed under the row.
    const user = userEvent.setup();
    openDrawerWith(listingItem(3));
    const decrease = screen.getByRole('button', { name: /کاهش تعداد/ });
    expect(decrease).toHaveAttribute('aria-describedby', 'min-order-77');

    await user.click(decrease);
    await flush();
    expect(screen.getByRole('status')).toHaveAttribute('id', 'min-order-77');
  });

  it('leaves a product row without a seller minimum alone', async () => {
    const user = userEvent.setup();
    const productItem = { ...listingItem(1), kind: 'product', min_order_quantity: 1 } as CartItem;
    openDrawerWith(productItem);

    const decrease = screen.getByRole('button', { name: /کاهش تعداد/ });
    expect(decrease).not.toHaveAttribute('aria-describedby');
    await user.click(decrease);
    await flush();
    expect(screen.queryByText(/حداقل سفارش این غرفه/)).toBeNull();
  });

  it('says nothing when the row starts above the floor', async () => {
    // The mirror image: the note is a consequence of hitting the floor, not a
    // permanent fixture of every listing that has a minimum.
    const user = userEvent.setup();
    openDrawerWith(listingItem(6));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /کاهش تعداد/ }));
    await flush();
    expect(updateQuantity).toHaveBeenCalledWith(77, 5);
    expect(screen.queryByText(/حداقل سفارش این غرفه/)).toBeNull();
  });
});
