// frontend/src/components/MarketplaceListingCard.test.tsx
//
// What a card is allowed to claim. Every rule here was a complaint: a «نو» badge
// printed forever, «استوک» on a card with no stock, and a discount row wearing
// «پرتخفیف‌ترین» five times over. Restyling this card is exactly how those come
// back, so the rules are pinned rather than eyeballed.

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderApp } from '../test/render';

import MarketplaceListingCard from './MarketplaceListingCard';
import { useCartStore } from '../store/cartStore';
import { useDirectStore } from '../store/directStore';
import type { MarketplaceListing } from '@/types/storefront';

const faNumber = (value: number) => value.toLocaleString('fa-IR');

function listing(overrides: Partial<MarketplaceListing> = {}): MarketplaceListing {
  return {
    id: 7,
    storefront: { id: 3, name: 'غرفه باغ سبز', slug: 'bagh-sabz' },
    title: 'گوجه قرمز درجه یک',
    slug: 'gojeh-1',
    crop_name: 'گوجه فرنگی',
    description: 'برداشت امروز',
    price: 100_000,
    discounted_price: 70_000,
    unit: 'کیلوگرم',
    quantity_available: '500',
    min_order_quantity: '2',
    minimum_order: 2,
    harvest_date: null,
    image: null,
    image_url: '/media/gojeh.jpg',
    status: 'published',
    status_label: 'منتشر',
    is_purchasable: true,
    discount_percent: 30,
    sales_count: 12,
    rejection_reason: '',
    reviewed_at: null,
    category_label: 'محصولات گلخانه‌ای',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as MarketplaceListing;
}

function renderCard(
  item = listing(),
  options: { variant?: 'default' | 'discount'; isLoading?: boolean } = {},
) {
  return renderApp(
    <MarketplaceListingCard listing={item} variant={options.variant} isLoading={options.isLoading} />,
  );
}

describe('badges', () => {
  it('says پرفروش‌ترین only when a sale has actually been recorded', () => {
    renderCard(listing({ sales_count: 41 }));
    expect(screen.getByText('پرفروش‌ترین')).toBeInTheDocument();
  });

  it('says nothing about sales on a listing that has never sold', () => {
    renderCard(listing({ sales_count: 0 }));
    expect(screen.queryByText('پرفروش‌ترین')).not.toBeInTheDocument();
  });

  it('never prints a «نو» badge, which was true of every card forever', () => {
    const { container } = renderCard();
    expect(within(container as HTMLElement).queryByText('نو', { exact: true })).toBeNull();
  });

  it('reserves استوک for what the seller declared as stock', () => {
    const declared = renderCard(listing({ is_stock: true }));
    expect(within(declared.container as HTMLElement).getByText('استوک')).toBeInTheDocument();
    const without = renderCard(listing({ is_stock: false }));
    expect(within(without.container as HTMLElement).queryByText('استوک')).toBeNull();
  });
});

describe('the discounted row', () => {
  it('shows the percentage as a watermark and no competing chips', () => {
    renderCard(listing({ sales_count: 9 }), { variant: 'discount' });
    expect(screen.getByText(`٪${faNumber(30)}`)).toBeInTheDocument();
    expect(screen.getByText('تخفیف')).toBeInTheDocument();
    expect(screen.queryByText('پرفروش‌ترین')).not.toBeInTheDocument();
    expect(screen.queryByText('استوک')).not.toBeInTheDocument();
  });

  it('leaves the watermark out of the screen reader: the price already says it', () => {
    const { container } = renderCard(listing(), { variant: 'discount' });
    const overlay = container.querySelector('span[aria-hidden="true"]');
    expect(overlay).not.toBeNull();
    expect(overlay?.textContent).toContain('تخفیف');
  });

  it('keeps the struck-through list price only where the row explains the price', () => {
    const { container } = renderCard(listing(), { variant: 'default' });
    expect(within(container as HTMLElement).getByText(new RegExp(faNumber(100_000)))).toBeInTheDocument();
    const other = renderCard(listing(), { variant: 'discount' });
    expect(other.container.querySelector('del')).toBeNull();
  });

  it('shows no watermark at all when the discount is zero', () => {
    const { container } = renderCard(listing({ discount_percent: 0 }), { variant: 'discount' });
    expect(screen.queryByText('تخفیف')).not.toBeInTheDocument();
    expect(container.querySelector('del')).toBeNull();
  });
});

describe('buying', () => {
  it('adds the minimum order, not one, so the seller\'s rule is respected', async () => {
    const addListingToCart = vi.fn().mockResolvedValue(undefined);
    useCartStore.setState({ addListingToCart } as unknown as Partial<ReturnType<typeof useCartStore.getState>>);
    renderCard();
    await userEvent.click(screen.getByRole('button', { name: 'افزودن به سبد' }));
    expect(addListingToCart).toHaveBeenCalledWith(7, 2);
  });

  it('refuses a card that cannot be bought and says why on the image', () => {
    renderCard(listing({ is_purchasable: false }));
    expect(screen.getByText('ناموجود')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'افزودن به سبد' })).toBeDisabled();
  });

  it('sends the listing to the storefront chat without a click on the title', async () => {
    const openDirect = vi.fn();
    useDirectStore.setState({ openDirect } as unknown as Partial<ReturnType<typeof useDirectStore.getState>>);
    renderCard();
    const send = screen.getByRole('button', { name: /گفتگو|پیام|ارسال/ });
    await userEvent.click(send);
    expect(openDirect).toHaveBeenCalled();
    expect(send).toHaveAccessibleName();
  });
});

describe('the card as a picture of a product', () => {
  it('names the image after the listing', () => {
    renderCard();
    expect(screen.getByRole('img', { name: 'گوجه قرمز درجه یک' })).toHaveAttribute('width', '320');
  });

  it('prints the seller and the department under the title', () => {
    renderCard();
    expect(screen.getByText(/غرفه باغ سبز/)).toBeInTheDocument();
    expect(screen.getByText(/محصولات گلخانه‌ای/)).toBeInTheDocument();
  });

  it('has no unnamed button, which is how icon-only controls go missing', () => {
    const { container } = renderCard();
    const unnamed = Array.from(container.querySelectorAll('button')).filter(
      (button) => !button.textContent?.trim() && !button.getAttribute('aria-label'),
    );
    expect(unnamed).toEqual([]);
  });

  it('swaps itself for the skeleton while loading', () => {
    renderCard(listing(), { isLoading: true });
    expect(screen.queryByRole('button', { name: 'افزودن به سبد' })).not.toBeInTheDocument();
  });
});
