// frontend/src/components/farm/ConsultationsPanel.test.tsx
//
// مزرعه من and the messenger are one conversation, and this panel is where the
// farmer can see it: a question filed here opens a thread, and once a thread exists
// the panel must hand over to it rather than keep a parallel inbox. So the deep
// link is the behaviour worth pinning — plus the rule that a question with no
// thread does not offer one.

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ConsultationsPanel from './ConsultationsPanel';
import { renderAppSettled } from '../../test/render';
import { farmApi } from '../../api/services';

vi.mock('../../api/services', () => ({
  farmApi: { consultations: vi.fn(), createConsultation: vi.fn() },
}));

const request = (extra: Record<string, unknown> = {}) => ({
  id: 1,
  message: 'برگ گوجه لکه‌های قهوه‌ای دارد',
  subject: 'general',
  subject_label: 'عمومی',
  status: 'pending',
  status_label: 'در انتظار پاسخ',
  reply: '',
  land: { id: 3, name: 'باغ شمالی' },
  created_at: '2026-01-01T00:00:00Z',
  ...extra,
});

beforeEach(() => {
  vi.mocked(farmApi.consultations).mockResolvedValue({ data: [request()] } as never);
  vi.mocked(farmApi.createConsultation).mockResolvedValue({ data: request() } as never);
});

describe('the link to the thread', () => {
  it('offers ادامه گفتگو when the question has a thread', async () => {
    vi.mocked(farmApi.consultations).mockResolvedValue({
      data: [request({ conversation_id: 55, thread_message_count: 3 })],
    } as never);
    await renderAppSettled(<ConsultationsPanel lands={[]} onRequested={vi.fn()} />, {
      route: '/profile?tab=farm',
    });
    const back = await screen.findByRole('link', { name: /ادامه گفتگو/ });
    expect(back).toHaveAttribute('href', '/messages?c=55');
    // The count of what is already in the thread, so the farmer knows whether
    // there is anything to read before leaving the farm page.
    expect(back.textContent).toContain('۳');
  });

  it('does not invent a thread for a question that has none yet', async () => {
    await renderAppSettled(<ConsultationsPanel lands={[]} onRequested={vi.fn()} />, {
      route: '/profile?tab=farm',
    });
    await screen.findByText('برگ گوجه لکه‌های قهوه‌ای دارد');
    expect(screen.queryByRole('link', { name: /ادامه گفتگو/ })).not.toBeInTheDocument();
  });
});

describe('filing a question', () => {
  it('sends what was typed and refreshes the list', async () => {
    const onRequested = vi.fn();
    // A consultation is always about a piece of land, and with one land on the
    // account the panel picks it — which is what makes this a one-field form.
    const lands = [{ id: 3, name: 'باغ شمالی' }] as never;
    await renderAppSettled(<ConsultationsPanel lands={lands} onRequested={onRequested} />, {
      route: '/profile?tab=farm',
    });
    const box = await screen.findByPlaceholderText(/مشکل یا سؤال خود را کامل توضیح دهید/);
    await userEvent.type(box, 'کیهون‌دهی را چه زمانی شروع کنم؟');
    await userEvent.click(screen.getByRole('button', { name: /ثبت درخواست مشاوره/ }));

    await vi.waitFor(() => expect(farmApi.createConsultation).toHaveBeenCalled());
    expect(vi.mocked(farmApi.createConsultation).mock.calls[0]?.[0]).toMatchObject({
      land_id: 3,
      message: 'کیهون‌دهی را چه زمانی شروع کنم؟',
    });
    expect(onRequested).toHaveBeenCalled();
    expect(vi.mocked(farmApi.consultations).mock.calls.length).toBeGreaterThan(1);
  });
});
