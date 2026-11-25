// frontend/src/components/layout/Footer.test.tsx
//
// The footer is on every page and is where most visitors look for a phone
// number. Those numbers used to be build-time environment variables, which meant
// a change in the admin reached /contact and never reached the footer. One test
// holds the new source of truth, and one holds the fallback for a deployment
// whose API has not answered yet.

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/services', () => ({
  siteInfoApi: { getContact: vi.fn() },
  newsletterApi: { subscribe: vi.fn() },
}));

import { siteInfoApi } from '../../api/services';
import Footer from './Footer';
import { createQueryClient, Providers } from '../../providers';

const renderFooter = () =>
  render(
    <Providers client={createQueryClient()}>
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    </Providers>,
  );

beforeEach(() => {
  vi.mocked(siteInfoApi.getContact).mockReset();
});

describe('Footer', () => {
  it('prints the phone, email and address the server publishes', async () => {
    vi.mocked(siteInfoApi.getContact).mockResolvedValue({
      data: {
        address: 'تهران، جاده مخصوص کرج، بازار بزرگ کشاورزی',
        phones: ['۰۲۱-۴۴۵۵۶۶۷۷'],
        emails: ['salam@example.com'],
        provinces_note: '',
        working_hours: '',
        whatsapp_number: '',
        telegram_url: '',
        instagram_url: '',
        eitaa_url: '',
        map_lat: null,
        map_lng: null,
        map_note: '',
      },
    } as never);

    renderFooter();

    await waitFor(() =>
      expect(screen.getByText('تهران، جاده مخصوص کرج، بازار بزرگ کشاورزی')).toBeDefined(),
    );
    expect(screen.getByRole('link', { name: /۴۴۵۵۶۶۷۷/ })).toHaveAttribute('href', expect.stringContaining('tel:'));
    expect(screen.getByRole('link', { name: /salam@example\.com/ })).toHaveAttribute(
      'href',
      'mailto:salam@example.com',
    );
  });

  it('still renders the sitemap when the contact endpoint fails', async () => {
    vi.mocked(siteInfoApi.getContact).mockRejectedValue(new Error('offline'));

    renderFooter();

    await waitFor(() => expect(siteInfoApi.getContact).toHaveBeenCalled());
    expect(screen.getByRole('navigation', { name: 'خرید' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'دربارهٔ ما' })).toHaveAttribute('href', '/about');
  });

  it('dials a Persian-digit number instead of building an empty tel: link', async () => {
    vi.mocked(siteInfoApi.getContact).mockResolvedValue({
      data: {
        address: 'تهران',
        phones: ['۰۲۱-۴۴۵۵۶۶۷۷'],
        emails: ['salam@example.com'],
        provinces_note: '',
        working_hours: '',
        whatsapp_number: '',
        telegram_url: '',
        instagram_url: '',
        eitaa_url: '',
        map_lat: null,
        map_lng: null,
        map_note: '',
      },
    } as never);

    renderFooter();

    const link = await screen.findByRole('link', { name: /۴۴۵۵۶۶۷۷/ });
    expect(link).toHaveAttribute('href', 'tel:02144556677');
  });

  it('prints a number it cannot dial rather than linking nowhere', async () => {
    vi.mocked(siteInfoApi.getContact).mockResolvedValue({
      data: {
        address: 'تهران',
        phones: ['تلفن ندارد'],
        emails: ['not-an-address'],
        provinces_note: '',
        working_hours: '',
        whatsapp_number: '',
        telegram_url: '',
        instagram_url: '',
        eitea_url: '',
        eitaa_url: '',
        map_lat: null,
        map_lng: null,
        map_note: '',
      },
    } as never);

    renderFooter();

    await waitFor(() => expect(screen.getByText('تلفن ندارد')).toBeDefined());
    expect(screen.queryByText('not-an-address')).toBeNull();
  });
});
