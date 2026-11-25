// frontend/src/pages/Farm.test.tsx
//
// The farm book had no screen at all: lands, the spraying calendar and
// consultation replies were served by the API and unreadable by the farmer who
// owns them. These tests pin the two things the page must get right — the
// calendar sorts what is still due above what is done, and a line that came
// from a consultant is not presented as the farmer's own note (or as something
// they can tick off).

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const lands = vi.fn();
const calendar = vi.fn();
const consultations = vi.fn();

vi.mock('../api/services', () => ({
  farmApi: {
    lands: (...a: unknown[]) => lands(...a),
    calendar: (...a: unknown[]) => calendar(...a),
    consultations: (...a: unknown[]) => consultations(...a),
    createLand: vi.fn(),
    addEvent: vi.fn(),
    updateEvent: vi.fn(),
  },
}));

import Farm from './Farm';
import { useAuthStore } from '../store/authStore';

const land = (over: Record<string, unknown> = {}) => ({
  id: 2,
  owner: 9,
  owner_name: 'کشاورز تستی',
  name: 'گلخانه خیار ورامین',
  land_type: 'greenhouse',
  land_type_label: 'گلخانه',
  area: '2000.00',
  area_unit: 'square_meter',
  area_unit_label: 'مترمربع',
  area_label: '۲۰۰۰ مترمربع',
  crop_type: 'خیار',
  crop_variety: 'هیبرید F1',
  province: 'تهران',
  city: 'ورامین',
  soil_type: 'loam',
  soil_type_label: 'لومی',
  irrigation_type: 'drip',
  irrigation_type_label: 'قطره‌ای',
  planting_date: null,
  notes: '',
  is_active: true,
  event_count: 3,
  created_at: '2026-11-01T00:00:00Z',
  updated_at: '2026-11-01T00:00:00Z',
  ...over,
});

const event = (over: Record<string, unknown> = {}) => ({
  id: 2,
  land: 1,
  land_name: 'باغ سیب کرج',
  kind: 'fertilizing',
  kind_label: 'کوددهی',
  title: 'کودآبیاری NPK',
  date: '2026-11-20',
  notes: '',
  status: 'done',
  status_label: 'انجام شد',
  created_by: 9,
  created_by_name: 'کشاورز تستی',
  is_consultant_note: false,
  created_at: '2026-11-01T00:00:00Z',
  updated_at: '2026-11-01T00:00:00Z',
  ...over,
});

function renderFarm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Farm />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  lands.mockReset();
  calendar.mockReset();
  consultations.mockReset();
  lands.mockResolvedValue({ data: [land()] });
  calendar.mockResolvedValue({ data: [] });
  consultations.mockResolvedValue({ data: [] });
  useAuthStore.setState({
    user: { id: 9, username: 'demo-farmer', full_name: 'کشاورز تستی' } as never,
  });
});

describe('Farm', () => {
  it('lists each land with the area and crop the server formatted', async () => {
    renderFarm();

    expect(await screen.findByText('گلخانه خیار ورامین')).toBeDefined();
    // area_label comes from the server; the page must not re-parse «2000.00».
    expect(screen.getByText(/۲۰۰۰ مترمربع/)).toBeDefined();
    // «خیار» is both part of the land's name and its crop.
    expect(screen.getAllByText(/خیار/).length).toBeGreaterThan(0);
    expect(screen.getByText(/۳ عملیات/)).toBeDefined();
  });

  it('puts what is still due above what is already done', async () => {
    calendar.mockResolvedValue({
      data: [
        event({ id: 2, date: '2026-11-20', status: 'done', status_label: 'انجام شد', title: 'کودآبیاری NPK' }),
        event({ id: 3, date: '2026-12-02', status: 'planned', status_label: 'برنامه‌ریزی‌شده', title: 'سمپاشی کنه‌کش' }),
      ],
    });
    renderFarm();

    await screen.findByText('سمپاشی کنه‌کش');
    const titles = screen.getAllByText(/کودآبیاری NPK|سمپاشی کنه‌کش/).map((node) => node.textContent);
    expect(titles[0]).toContain('سمپاشی کنه‌کش');
  });

  it('marks a consultant note and does not let the farmer tick it off', async () => {
    calendar.mockResolvedValue({
      data: [
        event({
          id: 5,
          title: 'تنظیم دور آبیاری تابستانه',
          status: 'planned',
          status_label: 'برنامه‌ریزی‌شده',
          is_consultant_note: true,
        }),
      ],
    });
    renderFarm();

    await screen.findByText('تنظیم دور آبیاری تابستانه');
    expect(screen.getByText('از مشاور')).toBeDefined();
    // The operation is planned, but the note is the consultant's to change.
    expect(screen.queryByRole('button', { name: 'انجام شد' })).toBeNull();
  });

  it('offers «انجام شد» on the farmer’s own planned operation', async () => {
    calendar.mockResolvedValue({
      data: [event({ id: 4, status: 'planned', status_label: 'برنامه‌ریزی‌شده', is_consultant_note: false })],
    });
    renderFarm();

    await screen.findByText('کودآبیاری NPK');
    expect(screen.getByRole('button', { name: 'انجام شد' })).toBeDefined();
  });

  it('shows a consultation by its Persian label and prints the consultant’s reply', async () => {
    consultations.mockResolvedValue({
      data: [
        {
          id: 2,
          farmer: 9,
          farmer_name: 'کشاورز تستی',
          farmer_username: 'demo-farmer',
          land: land(),
          subject: 'fertilizing',
          subject_label: 'مشاوره کوددهی',
          message: 'در گلدهی چه کودی بدهم؟',
          reply: 'پتاسیم را بالا ببرید.',
          status: 'answered',
          status_label: 'پاسخ داده شد',
          replied_by: 4,
          conversation_id: null,
          thread_message_count: 0,
          created_at: '2026-11-25T06:18:30+03:30',
          updated_at: '2026-11-25T06:18:30+03:30',
        },
      ],
    });
    renderFarm();

    // `subject` is a code; the page must print `subject_label`.
    expect(await screen.findByText('مشاوره کوددهی')).toBeDefined();
    expect(screen.queryByText('fertilizing')).toBeNull();
    expect(screen.getByText('پتاسیم را بالا ببرید.')).toBeDefined();
    expect(screen.getByText('پاسخ داده شد')).toBeDefined();
  });

  it('asks a signed-out visitor to sign in instead of showing an empty book', async () => {
    useAuthStore.setState({ user: null });
    renderFarm();

    expect(await screen.findByText(/برای دیدن زمین‌ها و تقویم کشت وارد شوید/)).toBeDefined();
    // No request is made without a session.
    await waitFor(() => expect(lands).not.toHaveBeenCalled());
  });
});
