// frontend/src/components/SearchBar.test.tsx
//
// The search box, after the scope selector and the funnel button were removed:
// a field, a microphone, and one button that runs the search.
//
// The field used to carry a scope («همه» / a category) and a button that opened a
// panel of filter chips. Both are gone by request, so what has to hold now is
// simpler and stricter: whatever is in the box is what gets searched, the submit
// button really submits, and the popular categories are ordinary links into the
// shop's own filter rather than internal state that only this component could see.

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useLocation } from 'react-router';

import SearchBar from './SearchBar';
import { renderApp, flush } from '../test/render';
import { categories } from '../data/shopData';

vi.mock('../api/services', () => ({
  productsApi: { getAll: vi.fn(async () => ({ data: { results: [] } })) },
}));

/** Shows where the router ended up, so a submit can be asserted without a page. */
function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
}

function renderSearchBar(variant?: 'desktop' | 'mobile' | 'compact') {
  return renderApp(
    <>
      <SearchBar variant={variant} />
      <LocationProbe />
    </>,
    { route: '/' },
  );
}

describe('SearchBar', () => {
  it('no longer offers a scope to choose from, and no filter panel to open', () => {
    renderSearchBar();

    expect(screen.queryByLabelText('محدوده جستجو')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('فیلترهای پیشرفته')).not.toBeInTheDocument();
    // The chips that panel held are gone with it.
    expect(screen.queryByText('فقط کالای موجود')).not.toBeInTheDocument();
  });

  it('searches for exactly what was typed', async () => {
    const user = userEvent.setup();
    renderSearchBar();

    await user.type(screen.getByLabelText('جستجوی محصولات'), 'اوره');
    await user.click(screen.getByLabelText('جستجو'));
    await flush();

    const location = screen.getByTestId('location').textContent ?? '';
    const params = new URLSearchParams(location.split('?')[1] ?? '');
    expect(location.startsWith('/products')).toBe(true);
    expect(params.get('search')).toBe('اوره');
    // …and nothing else: with no scope in the box there is no category to carry.
    expect(params.get('category')).toBeNull();
  });

  it('runs the same search when the reader just presses Enter', async () => {
    const user = userEvent.setup();
    renderSearchBar();

    await user.type(screen.getByLabelText('جستجوی محصولات'), 'بذر{Enter}');
    await flush();

    expect(screen.getByTestId('location').textContent).toBe(
      `/products?search=${encodeURIComponent('بذر')}`,
    );
  });

  it('sends an empty box to the whole catalogue instead of nowhere', async () => {
    const user = userEvent.setup();
    renderSearchBar();

    await user.click(screen.getByLabelText('جستجو'));
    await flush();

    expect(screen.getByTestId('location').textContent).toBe('/products');
  });

  it('offers the popular categories as links into the shop filter', async () => {
    const user = userEvent.setup();
    renderSearchBar();

    // Focusing the field is what opens the suggestions.
    await user.click(screen.getByLabelText('جستجوی محصولات'));

    for (const category of categories) {
      const link = screen.getByRole('link', { name: new RegExp(category.label) });
      expect(link).toHaveAttribute('href', `/products?category=${category.id}`);
    }
  });

  it('renders the field and the submit button in every variant', () => {
    // What each variant *hides* is a layout fact — `hidden sm:flex` is a class
    // name in jsdom, not a layout — so the browser sweep in navigation.spec.ts
    // checks what is visible at each width. This checks the parts that must
    // exist wherever the field is rendered.
    for (const variant of ['desktop', 'mobile', 'compact'] as const) {
      const { unmount } = renderSearchBar(variant);
      expect(screen.getByLabelText('جستجوی محصولات')).toBeInTheDocument();
      expect(screen.getByLabelText('جستجو')).toBeInTheDocument();
      unmount();
    }
  });
});
