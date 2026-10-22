// frontend/src/test/uxAudit.test.tsx
//
// The UX audit (touch targets ≥44px, image alt, accessible names) as tests
// that run with every `vitest run`. Two halves:
//
//  1. The auditor itself — a control that breaks the rules MUST be flagged,
//     otherwise a refactored auditor that finds nothing would still be green.
//  2. A gallery of real components — rendered through the app's own provider
//     wrapper, then audited. The gallery must be zero-violation; a new
//     icon-only control without a hit-area guarantee fails here before it
//     ever ships. The pixel truth over whole pages is e2e/ux-audit.spec.ts.

import { describe, expect, it, vi } from 'vitest';

import { render } from '@testing-library/react';
import { Check, Eye, X } from 'lucide-react';

import MarketplaceListingCard from '../components/MarketplaceListingCard';
import MobileBottomNav from '../components/MobileBottomNav';
import ProductCard from '../components/ProductCard';
import { renderApp } from './render';
import { auditUx, guarantees44px } from './uxAudit';
import { useCartStore } from '../store/cartStore';
import type { MarketplaceListing } from '@/types/storefront';
import type { MockProduct } from '@/types/shop';

const messages = (root: ParentNode) => auditUx(root).map((v) => `${v.rule}: ${v.detail}`);

/* ---------------------------------- 1. the auditor ---------------------------------- */

describe('the auditor', () => {
  it('flags a small icon-only button with no hit-area guarantee', () => {
    const { container } = render(
      <button type="button" aria-label="بستن" className="h-9 w-9">
        <X size={16} aria-hidden="true" />
      </button>,
    );
    expect(messages(container)).toEqual([
      expect.stringMatching(/^touch-target: .*بستن/),
    ]);
  });

  it('accepts every sanctioned 44×44 mechanism', () => {
    const { container } = render(
      <div>
        {/* tap-target: the pseudo-element is the hit area */}
        <button type="button" aria-label="الف" className="tap-target h-9 w-9">
          <Check size={16} aria-hidden="true" />
        </button>
        {/* min-h-11 without min-w-0: the CSS rule guarantees both axes */}
        <button type="button" aria-label="ب" className="min-h-11 rounded-full">
          <Check size={16} aria-hidden="true" />
        </button>
        {/* explicit size on both axes */}
        <button type="button" aria-label="پ" className="h-12 w-12">
          <Check size={16} aria-hidden="true" />
        </button>
        <button type="button" aria-label="ت" className="size-11">
          <Check size={16} aria-hidden="true" />
        </button>
      </div>,
    );
    expect(messages(container)).toEqual([]);
  });

  it('honours min-w-0 as the documented opt-out', () => {
    const { container } = render(
      <button type="button" aria-label="ج" className="min-h-11 min-w-0">
        <Check size={16} aria-hidden="true" />
      </button>,
    );
    expect(messages(container).filter((m) => m.startsWith('touch-target'))).toHaveLength(1);
  });

  it('ignores decoration and disabled controls, flags a missing alt and an unnamed icon-only button', () => {
    const { container } = render(
      <div>
        <div aria-hidden="true">
          <button type="button" className="h-9 w-9">
            <X size={16} />
          </button>
        </div>
        <button type="button" disabled className="h-9 w-9">
          <X size={16} />
        </button>
        <img src="/missing-alt.jpg" />
        <img src="/with-alt.jpg" alt="عکس محصول" />
        <button type="button" className="h-11 w-11">
          <Eye size={16} />
        </button>
      </div>,
    );
    expect(messages(container)).toEqual([
      expect.stringMatching(/^unnamed-control: /),
      expect.stringMatching(/^img-alt: \/missing-alt\.jpg/),
    ]);
  });

  it('treats a responsive size variant as no guarantee for phones', () => {
    const { container } = render(
      <button type="button" aria-label="چ" className="h-9 w-9 sm:h-11 sm:w-11">
        <Check size={16} aria-hidden="true" />
      </button>,
    );
    expect(messages(container).some((m) => m.startsWith('touch-target'))).toBe(true);
  });

  it('keeps guarantees44px honest about fractional and arbitrary tokens', () => {
    const build = (cls: string) => {
      const el = document.createElement('button');
      el.className = cls;
      return guarantees44px(el);
    };
    expect(build('h-[44px] w-[44px]')).toBe(true);
    expect(build('min-h-[3.5rem] w-full')).toBe(false); // w-full is not a guarantee
    expect(build('h-11 w-11')).toBe(true);
    expect(build('h-10 w-10')).toBe(false);
    expect(build('min-h-11 min-w-11')).toBe(true);
  });
});

/* ---------------------------------- 2. the gallery ---------------------------------- */

function product(overrides: Partial<MockProduct> = {}): MockProduct {
  return {
    id: 1,
    name: 'کود NPK کامل ۲۰-۲۰-۲۰',
    category: 'کود کشاورزی',
    categoryId: 'fertilizer',
    subCategoryId: 'npk',
    brand: 'گرین',
    price: 890_000,
    oldPrice: 1_000_000,
    rating: 5,
    reviews: 12,
    image: '/media/npk.jpg',
    inStock: true,
    description: 'کود کامل سه‌عنصره',
    features: [],
    cropTags: [],
    pestTags: [],
    usage: { dosage: '۲ کیلو در هکتار', method: 'محلول‌پاشی', timing: 'بهار' },
    warnings: [],
    compatibleWith: [],
    brochureAvailable: false,
    ...overrides,
  };
}

const cardProps = {
  index: 0,
  isWishlisted: false,
  isComparing: false,
  compareDisabled: false,
  onToggleWishlist: vi.fn(),
  onAddToCart: vi.fn(),
  onQuickView: vi.fn(),
  onToggleCompare: vi.fn(),
};

function listing(overrides: Partial<MarketplaceListing> = {}): MarketplaceListing {
  return {
    id: 7,
    storefront: { id: 3, name: 'غرفه باغ سبز', slug: 'bagh-sabz' },
    title: 'گوجه قرمز درجه یک',
    slug: 'gojeh-1',
    crop_name: 'گوجه فرنگی',
    description: 'برداشت امروز',
    price: 100_000,
    discounted_price: 70_000,
    unit: 'کیلوگرم',
    quantity_available: '500',
    min_order_quantity: '2',
    minimum_order: 2,
    harvest_date: null,
    production_date: null,
    expiry_date: null,
    image: null,
    image_url: '/media/gojeh.jpg',
    status: 'published',
    status_label: 'منتشر',
    is_purchasable: true,
    discount_percent: 30,
    sales_count: 12,
    rejection_reason: '',
    reviewed_at: null,
    category_label: 'محصولات گلخانه‌ای',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as MarketplaceListing;
}

describe('the component gallery passes the UX audit', () => {
  it('mobile bottom navigation', () => {
    const { container } = renderApp(<MobileBottomNav cartCount={2} onOpenCart={vi.fn()} />);
    expect(messages(container)).toEqual([]);
  });

  it('marketplace listing card', () => {
    useCartStore.setState({
      addListingToCart: vi.fn().mockResolvedValue(undefined),
    } as unknown as Partial<ReturnType<typeof useCartStore.getState>>);
    const { container } = renderApp(<MarketplaceListingCard listing={listing()} />);
    expect(messages(container)).toEqual([]);
  });

  it('product card', () => {
    const { container } = renderApp(<ProductCard product={product()} {...cardProps} />);
    expect(messages(container)).toEqual([]);
  });
});
