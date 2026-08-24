// frontend/src/store/wishlistStore.ts
//
// A single, localStorage-backed wishlist shared by every page, so toggling a
// heart on the home page or the new shop page always reads the same list.

import { create } from 'zustand';

import type { MockProduct } from '../types';

function load(): MockProduct[] {
  try {
    const stored = localStorage.getItem('wishlist');
    return stored ? (JSON.parse(stored) as MockProduct[]) : [];
  } catch {
    return [];
  }
}

interface WishlistState {
  wishlist: MockProduct[];
  toggle: (product: MockProduct) => void;
  remove: (id: number) => void;
}

export const useWishlistStore = create<WishlistState>((set) => ({
  wishlist: load(),

  toggle: (product) =>
    set((state) => {
      const exists = state.wishlist.some((p) => p.id === product.id);
      const next = exists
        ? state.wishlist.filter((p) => p.id !== product.id)
        : [...state.wishlist, product];
      try {
        localStorage.setItem('wishlist', JSON.stringify(next));
      } catch {
        // Storage can be unavailable in private mode; the in-memory list still works.
      }
      return { wishlist: next };
    }),

  remove: (id) =>
    set((state) => {
      const next = state.wishlist.filter((p) => p.id !== id);
      try {
        localStorage.setItem('wishlist', JSON.stringify(next));
      } catch {
        // See above.
      }
      return { wishlist: next };
    }),
}));
