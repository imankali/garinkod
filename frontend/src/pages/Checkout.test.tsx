// frontend/src/pages/Checkout.test.tsx
//
// The address fields on checkout, which are the one place the browser decides
// what the shipping quote is built from:
//   • the province is chosen from the country's published list, not typed,
//   • the city list follows the province and nothing else,
//   • changing the province drops a city that no longer belongs to it —
//     otherwise «نیشابور» survives a switch to «فارس» and the order ships to a
//     place that does not exist.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/services', () => ({
  locationsApi: { provinces: vi.fn(), cities: vi.fn() },
  ordersApi: { checkout: vi.fn() },
}));

import { locationsApi } from '../api/services';
import Checkout from './Checkout';
import { createQueryClient, Providers } from '../providers';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';

const province = (id: number, name: string) => ({
  id,
  name,
  slug: name,
  kind: 'province' as const,
  parent: null,
  province_name: name,
});

const city = (id: number, name: string, provinceName: string) => ({
  id,
  name,
  slug: `${provinceName}-${name}`,
  kind: 'city' as const,
  parent: 1,
  province_name: provinceName,
});

const renderCheckout = () =>
  render(
    <Providers client={createQueryClient()}>
      <MemoryRouter initialEntries={['/checkout']}>
        <Checkout />
      </MemoryRouter>
    </Providers>,
  );

beforeEach(() => {
  useCartStore.setState({
    isOpen: false,
    cart: {
      id: 1,
      items: [
        {
          id: 1,
          kind: 'product',
          product: null,
          listing: null,
          title: 'کود اوره',
          quantity: 1,
          unit_price: 100000,
          total_price: 100000,
          available_quantity: 10,
          min_order_quantity: 1,
          is_in_stock: true,
        },
      ],
      total_price: 100000,
      total_items: 1,
      created_at: '',
      updated_at: '',
    },
  });
  useAuthStore.setState({
    isAuthenticated: true,
    user: { id: 1, username: 'buyer', first_name: 'مریم', last_name: 'احمدی' },
    account: { phone: '09120000000', address: 'خیابان اول' },
  } as never);

  vi.mocked(locationsApi.provinces).mockResolvedValue({
    data: { count: 2, results: [province(1, 'خراسان رضوی'), province(2, 'فارس')] },
  } as never);
  vi.mocked(locationsApi.cities).mockImplementation((name) =>
    Promise.resolve({
      data: {
        count: 1,
        results: name === 'خراسان رضوی' ? [city(1, 'نیشابور', name)] : [city(2, 'شیراز', name)],
      },
    } as never),
  );
});

describe('Checkout address', () => {
  it('offers the provinces the API publishes', async () => {
    renderCheckout();

    await waitFor(() => expect(screen.getByRole('option', { name: 'خراسان رضوی' })).toBeDefined());
    expect(screen.getByRole('option', { name: 'فارس' })).toBeDefined();
  });

  it('does not ask for a city before a province is chosen', async () => {
    renderCheckout();

    const cityField = screen.getByLabelText('شهر');
    expect(cityField).toBeDisabled();
    expect(locationsApi.cities).not.toHaveBeenCalled();
  });

  it('loads the cities of the chosen province', async () => {
    renderCheckout();
    await waitFor(() => expect(screen.getByRole('option', { name: 'خراسان رضوی' })).toBeDefined());

    await userEvent.selectOptions(screen.getByLabelText('استان'), 'خراسان رضوی');

    await waitFor(() => expect(screen.getByRole('option', { name: 'نیشابور' })).toBeDefined());
    expect(locationsApi.cities).toHaveBeenCalledWith('خراسان رضوی');
    expect(screen.getByLabelText('شهر')).toBeEnabled();
  });

  it('clears the city when the province changes', async () => {
    renderCheckout();
    await waitFor(() => expect(screen.getByRole('option', { name: 'خراسان رضوی' })).toBeDefined());

    await userEvent.selectOptions(screen.getByLabelText('استان'), 'خراسان رضوی');
    await waitFor(() => expect(screen.getByRole('option', { name: 'نیشابور' })).toBeDefined());
    await userEvent.selectOptions(screen.getByLabelText('شهر'), 'نیشابور');
    expect(screen.getByLabelText('شهر')).toHaveValue('نیشابور');

    await userEvent.selectOptions(screen.getByLabelText('استان'), 'فارس');

    await waitFor(() => expect(screen.getByLabelText('شهر')).toHaveValue(''));
  });
});
