// frontend/src/utils/listingHref.ts
//
// One place that knows where an آگهی "lives": its own detail page at
// /listing/<slug>. Used by the message attachment card, the marketplace
// cards and anywhere else that points at one listing — a click on the card
// itself is a full-page detail, while «نمای سریع» stays an in-place dialog
// that opens via the grid's own quick-view controls.

interface ListingLike {
  slug: string;
  storefront_slug?: string;
  storefront?: { slug: string };
}

export function listingHref(listing: ListingLike): string {
  return `/listing/${encodeURIComponent(listing.slug)}`;
}

/**
 * The deep link that opens the same listing as the in-place dialog on its
 * storefront page — the «محصول پیوست‌شده» contract in direct messages and
 * share links, where landing inside the shop context is the point.
 */
export function listingStorefrontHref(listing: ListingLike): string {
  const storefrontSlug = listing.storefront_slug ?? listing.storefront?.slug ?? '';
  return `/storefronts/${encodeURIComponent(storefrontSlug)}?listing=${encodeURIComponent(listing.slug)}`;
}
