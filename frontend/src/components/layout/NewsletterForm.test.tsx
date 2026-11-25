// frontend/src/components/layout/NewsletterForm.test.tsx
//
// One field serves two kinds of address. The test pins the branch: something with
// an «@» goes as `email`, everything else as `mobile`, and a failure keeps what
// was typed so a farmer on a bad connection does not retype their number.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import NewsletterForm from './NewsletterForm';

const subscribe = vi.fn();

vi.mock('../../api/services', () => ({
  newsletterApi: { subscribe: (...args: unknown[]) => subscribe(...args) },
}));

beforeEach(() => {
  subscribe.mockReset();
});

describe('NewsletterForm', () => {
  it('sends an email address as an email', async () => {
    subscribe.mockResolvedValue({ data: {} });
    render(<NewsletterForm />);

    await userEvent.type(screen.getByLabelText('خبرنامهٔ گرین‌کود'), 'farmer@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'عضویت' }));

    await waitFor(() => expect(subscribe).toHaveBeenCalledWith({ email: 'farmer@example.com', source: 'footer' }));
    expect(await screen.findByText(/ثبت شد\./)).toBeInTheDocument();
  });

  it('sends a bare number as a mobile', async () => {
    subscribe.mockResolvedValue({ data: {} });
    render(<NewsletterForm />);

    await userEvent.type(screen.getByLabelText('خبرنامهٔ گرین‌کود'), '09121234567');
    await userEvent.click(screen.getByRole('button', { name: 'عضویت' }));

    await waitFor(() => expect(subscribe).toHaveBeenCalledWith({ mobile: '09121234567', source: 'footer' }));
  });

  it('keeps the value and explains the failure', async () => {
    subscribe.mockRejectedValue(new Error('500'));
    render(<NewsletterForm />);

    const input = screen.getByLabelText('خبرنامهٔ گرین‌کود');
    await userEvent.type(input, 'farmer@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'عضویت' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/بررسی کنید و دوباره بزنید/);
    expect(input).toHaveValue('farmer@example.com');
  });

  it('will not submit an empty field', () => {
    render(<NewsletterForm />);
    expect(screen.getByRole('button', { name: 'عضویت' })).toBeDisabled();
    expect(subscribe).not.toHaveBeenCalled();
  });
});
