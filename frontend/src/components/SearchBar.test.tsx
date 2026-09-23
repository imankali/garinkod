// frontend/src/components/SearchBar.test.tsx
//
// The scope selector inside the search box — «در کدام دسته دنبالش بگردم؟» — and
// the Enter key that finally does something with it.
//
// The field used to have no scope at all, and its submit button only opened the
// suggestions dropdown: you pressed a control labelled «جستجو» and no search
// happened. Both are pinned here, because both are the kind of thing that works
// by accident until someone changes the handler.

import { screen, within } from '@testing-library/react';
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

describe('SearchBar scope', () => {
  it('offers every category, and starts on all of them', () => {
    renderSearchBar();

    const scope = screen.getByLabelText('محدوده جستجو');
    expect(scope).toHaveValue('all');

    // The label the reader sees is short («همه»), so the full meaning has to
    // survive somewhere: the accessible name is the control's own aria-label and
    // every category is present and unclipped in the list itself.
    const labels = [...scope.querySelectorAll('option')].map((option) => option.textContent);
    expect(labels[0]).toBe('همه');
    expect(labels.slice(1)).toEqual(categories.map((category) => category.label));
  });

  it('searches inside the chosen category, not just on the site', async () => {
    const user = userEvent.setup();
    renderSearchBar();

    await user.selectOptions(screen.getByLabelText('محدوده جستجو'), 'fertilizer');
    await user.type(screen.getByLabelText('جستجوی محصولات'), 'اوره');
    await user.keyboard('{Enter}');
    await flush();

    const location = screen.getByTestId('location').textContent ?? '';
    const params = new URLSearchParams(location.split('?')[1] ?? '');
    expect(location.startsWith('/products')).toBe(true);
    expect(params.get('search')).toBe('اوره');
    expect(params.get('category')).toBe('fertilizer');
  });

  it('omits the scope when the reader has not narrowed it', async () => {
    const user = userEvent.setup();
    renderSearchBar();

    await user.type(screen.getByLabelText('جستجوی محصولات'), 'بذر');
    await user.keyboard('{Enter}');
    await flush();

    const location = screen.getByTestId('location').textContent ?? '';
    expect(location).toBe('/products?search=%D8%A8%D8%B0%D8%B1');
  });

  it('carries the scope selector in every variant', () => {
    // What each variant *hides* is a layout fact — `hidden sm:flex` is a class
    // name in jsdom, not a layout — so the browser sweep in navigation.spec.ts
    // checks what is visible at each width. This checks the field is wired the
    // same way wherever it is rendered, which is what a component test can say
    // truthfully.
    for (const variant of ['desktop', 'mobile', 'compact'] as const) {
      const { unmount } = renderSearchBar(variant);
      expect(within(document.body).getAllByLabelText('محدوده جستجو')).toHaveLength(1);
      expect(screen.getByLabelText('جستجوی محصولات')).toBeInTheDocument();
      unmount();
    }
  });
});
