import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import PriceLadder from './PriceLadder';
import type { PriceTier } from '../../types/shop';

/**
 * The ladder is a promise about money, so these test the two ways it could
 * break a promise rather than that it renders.
 */

const tiers: PriceTier[] = [
  // Deliberately out of order: the component must sort, because the published
  // `minValue` in structured data has to be the *lowest* threshold.
  { id: 3, min_quantity: 100, discount_percent: 20, unit_price: 800 },
  { id: 1, min_quantity: 20, discount_percent: 5, unit_price: 950 },
  { id: 2, min_quantity: 50, discount_percent: 10, unit_price: 900 },
];

describe('PriceLadder', () => {
  it('renders nothing at all for a product with no ladder', () => {
    const { container } = render(<PriceLadder tiers={[]} basePrice={1000} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists the rungs cheapest-entry-point first', () => {
    render(<PriceLadder tiers={tiers} basePrice={1000} />);
    const rows = screen.getAllByRole('row').slice(1); // skip the header row
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('۲۰');
    expect(rows[1]).toHaveTextContent('۵۰');
    expect(rows[2]).toHaveTextContent('۱۰۰');
  });

  it('shows a price at each rung, never a bare percentage', () => {
    render(<PriceLadder tiers={tiers} basePrice={1000} />);
    // The buyer should not have to work out 1000 − 5%.
    expect(screen.getByText('۹۵۰ تومان')).toBeInTheDocument();
    expect(screen.getByText('۹۰۰ تومان')).toBeInTheDocument();
    expect(screen.getByText('۸۰۰ تومان')).toBeInTheDocument();
  });

  it('marks only the rung actually in force', () => {
    const { container } = render(<PriceLadder tiers={tiers} basePrice={1000} quantity={60} />);
    // 60 reaches the 20 and the 50 rung; the highest reached is 50, and the
    // rungs never stack, so exactly one row carries the tick.
    expect(container.querySelectorAll('.lucide-check')).toHaveLength(1);
  });

  it('marks nothing when the cart is below every rung', () => {
    const { container } = render(<PriceLadder tiers={tiers} basePrice={1000} quantity={5} />);
    expect(container.querySelectorAll('.lucide-check')).toHaveLength(0);
  });

  it('is a real table, so the numbers are reachable without a screen reader guessing', () => {
    render(<PriceLadder tiers={tiers} basePrice={1000} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'قیمت هر واحد' })).toBeInTheDocument();
    // Each rung is a row header, not a bare cell.
    expect(screen.getAllByRole('rowheader')).toHaveLength(3);
  });
});
