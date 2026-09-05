// frontend/src/utils/convertProduct.ts
//
// Turns an API catalogue product into the UI's MockProduct shape, folding the
// server-side discount into `oldPrice` so every card can show the same badge.

import type { MockProduct, Product, ProductList } from '../types';

export function convertToMockProduct(apiProduct: ProductList | Product): MockProduct {
  const discount = apiProduct.discount_percent > 0 ? apiProduct.discount_percent : 0;
  const price = apiProduct.discounted_price ?? apiProduct.price;
  // Reconstruct the pre-discount price so cards can render the strike-through.
  const oldPrice =
    discount > 0 ? Math.round((price * 100) / (100 - discount)) : undefined;
  // Rating lives on the list payload as a plain average and on the detail
  // payload as `rating_summary`; either way the card shows what the database has.
  const summary = 'rating_summary' in apiProduct ? apiProduct.rating_summary : undefined;
  const rating = summary
    ? summary.average
    : 'avg_rating' in apiProduct
      ? apiProduct.avg_rating ?? 0
      : 0;
  const reviews = summary
    ? summary.reviews_count
    : 'reviews_count' in apiProduct
      ? apiProduct.reviews_count ?? 0
      : 0;
  const priceOnRequest = Boolean(apiProduct.price_on_request);

  return {
    id: apiProduct.id,
    slug: apiProduct.slug,
    name: apiProduct.title,
    category: typeof apiProduct.category === 'string' ? apiProduct.category : 'کود کشاورزی',
    categoryId: 'fertilizer',
    subCategoryId: '',
    // The supplier's brand, not the shop's name — brand chips filter on it.
    brand: apiProduct.brand || 'گرین کود',
    price,
    oldPrice,
    rating,
    reviews,
    priceOnRequest,
    packageWeight: apiProduct.package_weight || undefined,
    attributes: 'attributes' in apiProduct ? apiProduct.attributes : undefined,
    image: apiProduct.image_url || '/images/hero-farm.jpg',
    // No `badge` here: ProductCard derives the discount badge from oldPrice,
    // and a static badge would render a duplicate.
    inStock: apiProduct.is_in_stock,
    description: 'description' in apiProduct ? apiProduct.description : '',
    features: [],
    cropTags: [],
    pestTags: [],
    usage: {
      dosage: '',
      method: '',
      timing: '',
    },
    warnings: [],
    compatibleWith: [],
    brochureAvailable: false,
  };
}
