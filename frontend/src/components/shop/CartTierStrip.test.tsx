import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import CartTierStrip from './CartTierStrip';

/**
 * This strip makes promises about money, so the tests are about the promises
 * rather than the pixels. Each one below corresponds to a way it could lie.
 */

const nextTier = { min_quantity: 20, discount_percent: 15, unit_price: 850 };

describe('CartTierStrip', () => {
  it('renders nothing for a row with no ladder and nothing to reach', () => {
    const { container } = render(
      <CartTierStrip quantity={3} baseUnitPrice={1000} nextTier={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('states the next price, not just a percentage', () => {
    render(<CartTierStrip quantity={5} baseUnitPrice={1000} nextTier={nextTier} />);
    // The buyer must be able to decide without doing arithmetic.
    expect(screen.getByText('۸۵۰ تومان')).toBeInTheDocument();
    expect(screen.getByText('۱۵ عدد دیگر')).toBeInTheDocument();
    // The comparison is against the pre-ladder price, and it is stated as a
    // price rather than implied — asserted on the rendered sentence because the
    // phrase is split across inline nodes.
    const { container: c } = render(
      <CartTierStrip quantity={5} baseUnitPrice={1000} nextTier={nextTier} />,
    );
    expect(c.textContent).toContain('به‌جای ۱٬۰۰۰ تومان');
  });

  it('shows what the ladder already saved', () => {
    render(
      <CartTierStrip
        quantity={20}
        baseUnitPrice={1000}
        tierDiscountPercent={15}
        tierSaving={3000}
        nextTier={null}
      />,
    );
    expect(screen.getByText(/۱۵٪ تخفیف پلکانی/)).toBeInTheDocument();
    expect(screen.getByText(/۳٬۰۰۰ تومان سود/)).toBeInTheDocument();
  });

  it('does not nudge into stock that does not exist', () => {
    // Eleven left, next rung at 20. Offering "add 15" would be a promise the
    // site cannot keep, which is worse than saying nothing.
    render(
      <CartTierStrip
        quantity={9}
        baseUnitPrice={1000}
        nextTier={nextTier}
        availableQuantity={11}
      />,
    );
    expect(screen.queryByText('۱۵ عدد دیگر')).not.toBeInTheDocument();
  });

  it('does nudge when the stock can cover the rung', () => {
    render(
      <CartTierStrip
        quantity={9}
        baseUnitPrice={1000}
        nextTier={nextTier}
        availableQuantity={25}
      />,
    );
    expect(screen.getByText('۱۱ عدد دیگر')).toBeInTheDocument();
  });

  it('does not offer a rung the cart has already passed', () => {
    render(
      <CartTierStrip
        quantity={25}
        baseUnitPrice={1000}
        tierDiscountPercent={15}
        tierSaving={3750}
        nextTier={{ ...nextTier, min_quantity: 20 }}
      />,
    );
    // shortfall would be negative; the nudge must be gone, the saving kept.
    expect(screen.queryByText('۱۵ عدد دیگر')).not.toBeInTheDocument();
    expect(screen.getByText(/۱۵٪ تخفیف پلکانی/)).toBeInTheDocument();
  });

  it('sets the absolute quantity, not a delta', async () => {
    const user = userEvent.setup();
    const onSetQuantity = vi.fn();
    render(
      <CartTierStrip
        quantity={5}
        baseUnitPrice={1000}
        nextTier={nextTier}
        onSetQuantity={onSetQuantity}
      />,
    );

    await user.click(screen.getByRole('button', { name: /برو به ۲۰/ }));
    expect(onSetQuantity).toHaveBeenCalledWith(20);
  });
});
