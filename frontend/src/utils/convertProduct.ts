// frontend/src/utils/convertProduct.ts
//
// Turns an API catalogue product into the UI's MockProduct shape, folding the
// server-side discount into `oldPrice` so every card can show the same badge.

import type { MockProduct, ProductList } from '../types';

export function convertToMockProduct(apiProduct: ProductList): MockProduct {
  const discount = apiProduct.discount_percent > 0 ? apiProduct.discount_percent : 0;
  const price = apiProduct.discounted_price ?? apiProduct.price;
  // Reconstruct the pre-discount price so cards can render the strike-through.
  const oldPrice =
    discount > 0 ? Math.round((price * 100) / (100 - discount)) : undefined;

  return {
    id: apiProduct.id,
    slug: apiProduct.slug,
    name: apiProduct.title,
    category: typeof apiProduct.category === 'string' ? apiProduct.category : 'کود کشاورزی',
    categoryId: 'fertilizer',
    subCategoryId: '',
    brand: 'گرین کود',
    price,
    oldPrice,
    rating: 0,
    reviews: 0,
    image: apiProduct.image_url || '/images/hero-farm.jpg',
    // No `badge` here: ProductCard derives the discount badge from oldPrice,
    // and a static badge would render a duplicate.
    inStock: apiProduct.is_in_stock,
    description: '',
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
