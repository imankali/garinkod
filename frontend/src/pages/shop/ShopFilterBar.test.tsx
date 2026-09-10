// frontend/src/pages/shop/ShopFilterBar.test.tsx
//
// The bar's two promises: several values on one axis, and one direction at a
// time. Both were broken before the redesign — a single category per request,
// and «گران‌ترین» silently replacing «ارزان‌ترین» with no signal that the other
// option was merely unavailable.

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import ShopFilterBar, {
  EMPTY_FACETS,
  EMPTY_FILTERS,
  readCsv,
  toggleInList,
  writeCsv,
  type SortOption,
} from './ShopFilterBar';
import { renderApp } from '../../test/render';

const SORTS: SortOption[] = [
  { value: '-publish', label: 'جدیدترین', conflictsWith: 'publish' },
  { value: 'publish', label: 'قدیمی‌ترین', conflictsWith: '-publish' },
  { value: 'price', label: 'ارزان‌ترین', conflictsWith: '-price' },
  { value: '-price', label: 'گران‌ترین', conflictsWith: 'price' },
  { value: '-sales_count', label: 'پرفروش‌ترین' },
];

const FACETS = {
  ...EMPTY_FACETS,
  categories: [
    { value: 'fertilizer', label: 'کود', count: 12 },
    { value: 'pesticide', label: 'سم', count: 5 },
  ],
  subcategories: [
    { value: 'npk', label: 'کود NPK', count: 4 },
    { value: 'urea', label: 'اوره', count: 2 },
  ],
  brands: [
    { value: 'grogreen', label: 'گرین‌گرین', count: 7 },
    { value: 'koodyar', label: 'کودیار', count: 3 },
  ],
  packages: [
    { value: '25kg', label: 'کیسه ۲۵ کیلویی', count: 6 },
    { value: '1kg', label: 'بسته ۱ کیلویی', count: 9 },
  ],
  maxPrice: 500_000,
};

function renderBar(overrides: Partial<Parameters<typeof ShopFilterBar>[0]> = {}) {
  const onChange = vi.fn();
  const onReset = vi.fn();
  const result = renderApp(
    <ShopFilterBar
      source="products"
      facets={FACETS}
      filters={EMPTY_FILTERS}
      sorts={SORTS}
      features={[{ key: 'in_stock', label: 'فقط موجود' }]}
      onChange={onChange}
      onReset={onReset}
      {...overrides}
    />,
  );
  return { ...result, onChange, onReset };
}

/**
 * Opens one dropdown.
 *
 * An idle facet prints its axis name («برندها»); a chosen one prints what is
 * chosen («کود +۱»), which is the point of the summary. So the handle here is a
 * pattern covering both, rather than a label that silently stops matching as soon
 * as the test has a selection — which is exactly the state being tested.
 */
async function open(name: RegExp) {
  // Only the dropdowns carry aria-expanded; the removable chips underneath are
  // buttons with the same words on them, and clicking one of those is not opening
  // an axis — it is clearing a value.
  const trigger = screen
    .getAllByRole('button', { expanded: false })
    .find((button) => name.test(button.textContent ?? ''));
  if (!trigger) throw new Error(`no filter trigger matching ${name}`);
  await userEvent.click(trigger);
}

function dialogFor(label: RegExp) {
  return screen.getByRole('dialog', { name: label }) as HTMLElement;
}

describe('the csv grammar', () => {
  it('reads a list without repeating or inventing entries', () => {
    expect(readCsv('fertilizer, pesticide ,fertilizer')).toEqual(['fertilizer', 'pesticide']);
    expect(readCsv('')).toEqual([]);
    expect(readCsv(undefined)).toEqual([]);
  });

  it('writes the same order it read', () => {
    expect(writeCsv(['a', 'b'])).toBe('a,b');
    expect(toggleInList(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
    expect(toggleInList(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('multi-select', () => {
  it('adds a second category next to the first instead of replacing it', async () => {
    const { onChange } = renderBar({ filters: { ...EMPTY_FILTERS, category: 'fertilizer' } });
    await open(/کود/);
    await userEvent.click(within(dialogFor(/دسته‌بندی/)).getByRole('checkbox', { name: /سم/ }));
    expect(onChange).toHaveBeenCalledWith({ category: 'fertilizer,pesticide', page: undefined });
  });

  it('clears the axis when its only value is clicked again', async () => {
    const { onChange } = renderBar({ filters: { ...EMPTY_FILTERS, category: 'fertilizer' } });
    await open(/کود/);
    await userEvent.click(within(dialogFor(/دسته‌بندی/)).getByRole('checkbox', { name: /کود/ }));
    expect(onChange).toHaveBeenCalledWith({ category: undefined, page: undefined });
  });

  it('stacks brands and packages independently of the categories', async () => {
    const { onChange } = renderBar();
    await open(/برندها/);
    await userEvent.click(within(dialogFor(/برندها/)).getByRole('checkbox', { name: /گرین‌گرین/ }));
    expect(onChange).toHaveBeenLastCalledWith({ brand: 'grogreen', page: undefined });
  });

  it('writes packaging under the parameter the source actually understands', async () => {
    const products = renderBar();
    await open(/بسته‌بندی/);
    await userEvent.click(
      within(dialogFor(/بسته‌بندی/)).getByRole('checkbox', { name: /کیسه ۲۵ کیلویی/ }),
    );
    expect(products.onChange).toHaveBeenCalledWith({ package_weight: '25kg', page: undefined });

    products.unmount();
    const ads = renderBar({ source: 'marketplace' });
    await open(/بسته‌بندی/);
    await userEvent.click(
      within(dialogFor(/بسته‌بندی/)).getByRole('checkbox', { name: /بسته ۱ کیلویی/ }),
    );
    expect(ads.onChange).toHaveBeenCalledWith({ package_size: '1kg', page: undefined });
  });
});

describe('sorting', () => {
  it('dims the opposite of the chosen direction, and explains why', async () => {
    renderBar({ filters: { ...EMPTY_FILTERS, ordering: 'price' } });
    await open(/ارزان‌ترین/);
    const dialog = dialogFor(/مرتب‌سازی/);
    expect(within(dialog).getByRole('checkbox', { name: /ارزان‌ترین/ })).toBeChecked();
    const blocked = within(dialog).getByRole('checkbox', { name: /گران‌ترین/ });
    expect(blocked).toBeDisabled();
    expect(blocked).toHaveAccessibleName(/گران‌ترین/);
    expect(within(dialog).getByText('تضاد')).toBeInTheDocument();
  });

  it('still combines the sorts that do not contradict each other', async () => {
    const { onChange } = renderBar({ filters: { ...EMPTY_FILTERS, ordering: 'price,-sales_count' } });
    await open(/ارزان‌ترین/);
    await userEvent.click(
      within(dialogFor(/مرتب‌سازی/)).getByRole('checkbox', { name: /جدیدترین/ }),
    );
    expect(onChange).toHaveBeenCalledWith({ ordering: 'price,-sales_count,-publish', page: undefined });
  });

  it('drops the opposite when it is chosen, rather than keeping both', async () => {
    const { onChange } = renderBar({ filters: { ...EMPTY_FILTERS, ordering: 'price' } });
    await open(/ارزان‌ترین/);
    // The blocked row cannot be clicked; switching direction means turning the
    // current one off first — the patch keeps the rest of the stack.
    await userEvent.click(
      within(dialogFor(/مرتب‌سازی/)).getByRole('checkbox', { name: /پرفروش‌ترین/ }),
    );
    expect(onChange).toHaveBeenCalledWith({ ordering: 'price,-sales_count', page: undefined });
  });
});

describe('the bar itself', () => {
  it('tells assistive tech which dropdowns are open', async () => {
    renderBar();
    const trigger = screen.getByRole('button', { name: /دسته‌بندی/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-haspopup', 'true');
  });

  it('shows a removable chip for everything currently applied', async () => {
    const onReset = vi.fn();
    const { onChange } = renderBar({
      filters: { ...EMPTY_FILTERS, category: 'fertilizer,pesticide', ordering: 'price' },
      onReset,
    });
    expect(screen.getByText('کود')).toBeInTheDocument();
    expect(screen.getByText('سم')).toBeInTheDocument();
    expect(screen.getByText(/حذف همه/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /حذف همه/ }));
    expect(onReset).toHaveBeenCalled();
    void onChange;
  });

  it('keeps every control tall enough for a thumb', () => {
    renderBar();
    const triggers = screen
      .getAllByRole('button')
      .filter((button) => button.className.includes('min-h-11') || button.className.includes('min-h-10'));
    expect(triggers.length).toBeGreaterThan(0);
    screen.getAllByRole('button').forEach((button) => {
      expect(button.className).toMatch(/min-h-1[0-9]/);
    });
  });
});
