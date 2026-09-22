// frontend/src/utils/listingPayload.ts
//
// The DM attachment contract is intentionally smaller than a marketplace
// listing. Keep the projection in one place so cards, modals and storefront
// pages cannot drift apart when the listing API gains a field.

import type { AttachedListing, MarketplaceListing } from '@/types/storefront';

type ListingForAttachment = Pick<
  MarketplaceListing,
  'id' | 'title' | 'slug' | 'price' | 'discounted_price' | 'unit' | 'image_url'
> & {
  storefront: Pick<MarketplaceListing['storefront'], 'name' | 'slug'>;
};

export function toAttachedListing(listing: ListingForAttachment): AttachedListing {
  return {
    id: listing.id,
    title: listing.title,
    slug: listing.slug,
    price: listing.price,
    discounted_price: listing.discounted_price,
    unit: listing.unit,
    image_url: listing.image_url,
    storefront_name: listing.storefront.name,
    storefront_slug: listing.storefront.slug,
  };
}
