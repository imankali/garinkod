// frontend/src/pages/Storefronts.test.tsx
//
// The merged غرفه‌داران page, in the order the merge was asked for and with the
// rules each block brought along:
//
//   غرفه‌های پیشنهادی → پست‌های غرفه‌داران → three product rows → the directory.
//
// What the tests hold onto is the parts that are invisible in a screenshot: the
// query each block sends (in-stock only, discount flag, likes ranked server-side),
// that a row with nothing in it removes itself, and that the ساخت غرفه dialog
// opens for a signed-out visitor instead of bouncing them.

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Storefronts from './Storefronts';
import { flush, renderAppSettled } from '../test/render';
import { signIn, signOut } from '../test/auth';
import { agricultureApi, locationsApi, storefrontPostsApi, storefrontsApi } from '../api/services';

vi.mock('../api/services', () => ({
  agricultureApi: { getStorefront: vi.fn(), listMarketplace: vi.fn() },
  locationsApi: { provinces: vi.fn(), cities: vi.fn() },
  storefrontPostsApi: { list: vi.fn() },
  storefrontsApi: { list: vi.fn(), featured: vi.fn() },
}));

vi.mock('../components/StorefrontCard', () => ({
  default: ({ storefront }: { storefront: { name: string; slug: string } }) => (
    <a href={`/storefronts/${storefront.slug}`}>{storefront.name}</a>
  ),
}));

vi.mock('../components/social/PostCard', () => ({
  default: ({ post }: { post: { id: number } }) => <div data-testid={`post-${post.id}`}>پست</div>,
}));

vi.mock('../components/MarketplaceListingCard', () => ({
  default: ({ listing, variant }: { listing: { title: string }; variant?: string }) => (
    <div data-testid={`listing-${variant ?? 'default'}`}>{listing.title}</div>
  ),
}));

vi.mock('../components/storefront/StorefrontForm', () => ({
  default: () => <div data-testid="storefront-form">فرم ساخت غرفه</div>,
}));

const storefront = (id: number, name: string) => ({
  id,
  name,
  slug: `slug-${id}`,
  city: 'شیراز',
  province: 'فارس',
  followers_count: 4,
  listing_count: 2,
});

const listing = (title: string) => ({ id: title, title });

function emptyPage() {
  return { data: { results: [], count: 0 } };
}

beforeEach(() => {
  signOut();
  vi.mocked(storefrontsApi.list).mockResolvedValue({
    data: { results: [storefront(1, 'باغ سبز شیراز'), storefront(2, 'مزرعه آفتاب')], count: 41 },
  } as never);
  vi.mocked(storefrontsApi.featured).mockResolvedValue({
    data: [storefront(1, 'باغ سبز شیراز')],
  } as never);
  vi.mocked(storefrontPostsApi.list).mockResolvedValue({
    data: { results: [{ id: 11 }, { id: 12 }], count: 2 },
  } as never);
  vi.mocked(agricultureApi.getStorefront).mockResolvedValue({ data: null } as never);
  vi.mocked(locationsApi.provinces).mockResolvedValue({
    data: { results: [{ id: 1, name: 'فارس' }] },
  } as never);
  vi.mocked(locationsApi.cities).mockResolvedValue({ data: { results: [] } } as never);
  // By default every product row is empty, so the tests below opt into the one
  // they are about instead of fighting three identical lists.
  vi.mocked(agricultureApi.listMarketplace).mockResolvedValue(emptyPage() as never);
});

function renderPage(route = '/storefronts') {
  return renderAppSettled(<Storefronts />, { route });
}

describe('the order of the page', () => {
  it('puts the suggested stalls, then the posts, then the products, then the directory', async () => {
    vi.mocked(agricultureApi.listMarketplace).mockResolvedValue({
      data: { results: [listing('کود NPK')], count: 1 },
    } as never);
    await renderPage();

    await screen.findByTestId('post-11');
    const headings = await screen.findAllByRole('heading');
    const titles = headings.map((heading) => heading.textContent);
    const at = (needle: string) => titles.findIndex((title) => (title ?? '').includes(needle));
    expect(at('غرفه‌های پیشنهادی')).toBeLessThan(at('پست‌های غرفه‌داران'));
    expect(at('پست‌های غرفه‌داران')).toBeLessThan(at('پرفروش‌ترین محصولات'));
    expect(at('پرفروش‌ترین محصولات')).toBeLessThan(at('پرتخفیف‌ترین محصولات'));
    expect(at('پرتخفیف‌ترین محصولات')).toBeLessThan(at('جدیدترین‌ها'));
    expect(at('جدیدترین‌ها')).toBeLessThan(at('همه غرفه‌داران'));
  });
});

describe('the product rows', () => {
  it('asks for in-stock ads only, in the three orders', async () => {
    vi.mocked(agricultureApi.listMarketplace).mockResolvedValue({
      data: { results: [listing('کود NPK')], count: 1 },
    } as never);
    await renderPage();
    await screen.findAllByTestId('listing-default');
    const calls = vi.mocked(agricultureApi.listMarketplace).mock.calls.map((call) => call[0]);
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ordering: '-sales_count', in_stock: '1' }),
        expect.objectContaining({ ordering: '-discount_percent', in_stock: '1', has_discount: '1' }),
        expect.objectContaining({ ordering: '-created_at', in_stock: '1' }),
      ]),
    );
  });

  it('marks only the discounted row with the watermark variant', async () => {
    vi.mocked(agricultureApi.listMarketplace).mockResolvedValue({
      data: { results: [listing('کود NPK')], count: 1 },
    } as never);
    await renderPage();
    await screen.findByTestId('listing-discount');
    expect(screen.getAllByTestId('listing-default').length).toBe(2);
    expect(screen.getAllByTestId('listing-discount').length).toBe(1);
  });

  it('removes a row that has nothing in it, heading and all', async () => {
    await renderPage();
    await screen.findByText('همه غرفه‌داران');
    expect(screen.queryByText('پرفروش‌ترین محصولات')).not.toBeInTheDocument();
    expect(screen.queryByText('جدیدترین‌ها')).not.toBeInTheDocument();
  });
});

describe('the posts block', () => {
  it('ranks by likes on the server, not by what the first page happened to hold', async () => {
    await renderPage();
    await screen.findByTestId('post-11');
    expect(storefrontPostsApi.list).toHaveBeenCalledWith({
      post_type: 'post',
      ordering: '-likes_total',
      page_size: 5,
    });
  });

  it('points at explore for everything beyond the five', async () => {
    await renderPage();
    const more = await screen.findByRole('link', { name: /مشاهده پست‌های بیشتر/ });
    expect(more).toHaveAttribute('href', '/explore');
  });
});

describe('the directory', () => {
  it('reports how many stalls matched, and lists them', async () => {
    await renderPage();
    expect(await screen.findByText(/۴۱ غرفه پیدا شد/)).toBeInTheDocument();
    const directory = (await screen.findByText('همه غرفه‌داران')).parentElement as HTMLElement;
    expect(within(directory).getByRole('link', { name: 'باغ سبز شیراز' })).toHaveAttribute(
      'href',
      '/storefronts/slug-1',
    );
  });

  it('sends the filters it is shown, and clears the page number with them', async () => {
    await renderPage();
    await screen.findByText('همه غرفه‌داران');
    await userEvent.click(screen.getByRole('button', { name: /فیلتر/ }));
    await userEvent.click(screen.getByLabelText('فقط غرفه‌های تأییدشده'));

    await vi.waitFor(() => {
      expect(storefrontsApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ verified: '1', page: 1 }),
      );
    });
    await flush();
  });

  it('narrows the city list to the chosen province', async () => {
    await renderPage();
    await screen.findByText('همه غرفه‌داران');
    await userEvent.click(screen.getByRole('button', { name: /فیلتر/ }));
    await userEvent.selectOptions(screen.getByLabelText('استان'), 'فارس');
    await vi.waitFor(() => expect(locationsApi.cities).toHaveBeenCalledWith('فارس'));
  });

  it('admits when nothing matches, instead of showing an empty box', async () => {
    vi.mocked(storefrontsApi.list).mockResolvedValue(emptyPage() as never);
    await renderPage();
    expect(await screen.findByText('غرفه‌ای با این مشخصات پیدا نشد.')).toBeInTheDocument();
  });
});

describe('the hero', () => {
  it('opens the create dialog for a signed-out visitor, since the name check is public', async () => {
    await renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'ساخت غرفه' }));
    expect(screen.getByTestId('storefront-form')).toBeInTheDocument();
    // …and does not throw them at the login page mid-thought.
    expect(agricultureApi.getStorefront).not.toHaveBeenCalled();
  });

  it('hands an owner to their own stall instead of a second form', async () => {
    signIn();
    vi.mocked(agricultureApi.getStorefront).mockResolvedValue({
      data: { id: 9, name: 'غرفه من', slug: 'my-store' },
    } as never);
    await renderPage();
    const mine = await screen.findByRole('link', { name: /غرفه من/ });
    expect(mine).toHaveAttribute('href', '/storefronts/my-store');
    expect(screen.queryByRole('button', { name: 'ساخت غرفه' })).not.toBeInTheDocument();
  });

  it('keeps the address of the open dialog in the URL, so it survives a reload', async () => {
    renderPage('/storefronts?create=1');
    expect(await screen.findByTestId('storefront-form')).toBeInTheDocument();
    const close = await screen.findByRole('button', { name: 'بستن' });
    await userEvent.click(close);
    await vi.waitFor(() => expect(screen.queryByTestId('storefront-form')).not.toBeInTheDocument());
    // The panel leaves through an exit animation; let it finish before the test
    // does, or the update lands after React has stopped pretending it is in one.
    await flush();
  });
});

describe('the filter panel', () => {
  // Regression: each select used to sit *inside* its <label>, which folds the
  // control's own value into its accessible name — «شهر» read as «شهرابتدا استان»,
  // and «استان» matched both selects at once. Nothing can pick a field by name if
  // the name moves when the value does, so the panel is now wired with id + htmlFor
  // and these two tests are the difference.
  async function openPanel() {
    await renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'فیلتر', exact: true }));
    return within(await screen.findByRole('group', { name: 'فیلترهای غرفه‌ها' }));
  }

  it('names every select by its field alone', async () => {
    const panel = await openPanel();
    expect(panel.getAllByLabelText('استان')).toHaveLength(1);
    expect(panel.getAllByLabelText('شهر')).toHaveLength(1);
    expect(panel.getAllByLabelText('نوع فروشنده')).toHaveLength(1);
  });

  it('associates each label with its own control', async () => {
    const panel = await openPanel();
    const province = panel.getByLabelText('استان');
    const city = panel.getByLabelText('شهر');
    expect(province).toHaveAttribute('id');
    expect(city).toHaveAttribute('id');
    expect(province.getAttribute('id')).not.toEqual(city.getAttribute('id'));
  });

  it('keeps the city field out of the way until a province is chosen', async () => {
    const panel = await openPanel();
    expect(panel.getByLabelText('شهر')).toBeDisabled();
    await userEvent.selectOptions(panel.getByLabelText('استان'), 'فارس');
    expect(panel.getByLabelText('شهر')).toBeEnabled();
  });
});
