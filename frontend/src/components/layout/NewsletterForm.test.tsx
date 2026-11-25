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
const unsubscribe = vi.fn();

vi.mock('../../api/services', () => ({
  newsletterApi: {
    subscribe: (...args: unknown[]) => subscribe(...args),
    unsubscribe: (...args: unknown[]) => unsubscribe(...args),
  },
}));

beforeEach(() => {
  subscribe.mockReset();
  unsubscribe.mockReset();
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

  it('lets a reader leave the list with the same field', async () => {
    unsubscribe.mockResolvedValue({ data: { unsubscribed: true, count: 1 } });
    render(<NewsletterForm />);

    await userEvent.type(screen.getByLabelText('خبرنامهٔ گرین‌کود'), 'farmer@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'حذف نشانی از خبرنامه' }));

    // Leaving takes the identifier the joining used — email or mobile, decided
    // the same way, so the button cannot act on a different row.
    await waitFor(() => expect(unsubscribe).toHaveBeenCalledWith({ email: 'farmer@example.com' }));
    expect(await screen.findByText(/از خبرنامه حذف شد/)).toBeInTheDocument();
  });

  it('does not claim it removed an address that was never on the list', async () => {
    unsubscribe.mockResolvedValue({ data: { unsubscribed: false, count: 0 } });
    render(<NewsletterForm />);

    await userEvent.type(screen.getByLabelText('خبرنامهٔ گرین‌کود'), '09120000000');
    await userEvent.click(screen.getByRole('button', { name: 'حذف نشانی از خبرنامه' }));

    await waitFor(() => expect(unsubscribe).toHaveBeenCalledWith({ mobile: '09120000000' }));
    // «حذف شد» for an address that was not there is a small lie the reader can
    // catch by subscribing again.
    expect(await screen.findByText(/در فهرست خبرنامه نبود/)).toBeInTheDocument();
  });
});
