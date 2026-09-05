// frontend/src/utils/listingHref.ts
//
// One place that knows where an آگهی "lives": its storefront page, with the
// listing's own detail open. Used by the message attachment card, the
// marketplace cards and anywhere else that points at one listing.

interface ListingLike {
  slug: string;
  storefront_slug?: string;
  storefront?: { slug: string };
}

export function listingHref(listing: ListingLike): string {
  const storefrontSlug = listing.storefront_slug ?? listing.storefront?.slug ?? '';
  return `/storefronts/${encodeURIComponent(storefrontSlug)}?listing=${encodeURIComponent(listing.slug)}`;
}
