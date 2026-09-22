import { describe, expect, it } from 'vitest';

import { toAttachedListing } from './listingPayload';

const listing = {
  id: 42,
  title: 'کود آلی',
  slug: 'organic-fertilizer',
  price: 120_000,
  discounted_price: 100_000,
  unit: 'کیلوگرم',
  image_url: '/media/listing.jpg',
  storefront: { name: 'غرفه سبز', slug: 'green-booth' },
};

describe('toAttachedListing', () => {
  it('projects the shared DM attachment shape from a listing', () => {
    expect(toAttachedListing(listing)).toEqual({
      id: 42,
      title: 'کود آلی',
      slug: 'organic-fertilizer',
      price: 120_000,
      discounted_price: 100_000,
      unit: 'کیلوگرم',
      image_url: '/media/listing.jpg',
      storefront_name: 'غرفه سبز',
      storefront_slug: 'green-booth',
    });
  });
});
