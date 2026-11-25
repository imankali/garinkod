// frontend/src/components/ui/Button.test.tsx
//
// The control's contract: it is a button, it says when it is busy, it refuses a
// second press while busy, and `to` turns it into a link with the same skin.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import Button from './Button';

const renderInRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Button', () => {
  it('renders a real <button type="button"> by default, so it never submits a form by accident', () => {
    render(<Button>افزودن به سبد</Button>);
    const button = screen.getByRole('button', { name: 'افزودن به سبد' });
    expect(button).toHaveAttribute('type', 'button');
  });

  it('keeps type="submit" when a form asks for it', () => {
    render(<Button type="submit">ثبت سفارش</Button>);
    expect(screen.getByRole('button', { name: 'ثبت سفارش' })).toHaveAttribute('type', 'submit');
  });

  it('marks itself busy and blocks clicks while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        ثبت سفارش
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'ثبت سفارش' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders a router link when given a destination', () => {
    renderInRouter(<Button to="/products">فروشگاه</Button>);
    const link = screen.getByRole('link', { name: 'فروشگاه' });
    expect(link).toHaveAttribute('href', '/products');
  });

  it('is disabled when the caller says so', () => {
    render(<Button disabled>ناموجود</Button>);
    expect(screen.getByRole('button', { name: 'ناموجود' })).toBeDisabled();
  });
});
