// frontend/src/store/cartStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import toast from 'react-hot-toast';

import type { Cart } from '../types';
import { cartApi } from '../api/services';
import { parseApiError } from '../api/errors';

/** Return a copy of `errors` without the entry for `itemId`. */
function withoutKey(errors: Record<number, string>, itemId: number): Record<number, string> {
  const next = { ...errors };
  delete next[itemId];
  return next;
}

// ========================================
// Cart State Interface
// ========================================
interface CartState {
  // State
  cart: Cart | null;
  isOpen: boolean;
  isLoading: boolean;
  lastAddedProduct: { id: number; name: string } | null;
  /**
   * Per-row error messages keyed by cart item id, so a stock problem is shown
   * inside the cart next to the affected line instead of only as a toast that
   * disappears.
   */
  itemErrors: Record<number, string>;
  /** Error for an add attempt that never became a row (e.g. below minimum). */
  lastError: string | null;

  // Actions
  fetchCart: () => Promise<void>;
  /** `packageId` picks one of the product's declared packagings. */
  addToCart: (productId: number, quantity?: number, packageId?: number | null) => Promise<void>;
  addListingToCart: (listingId: number, quantity?: number) => Promise<void>;
  removeFromCart: (itemId: number) => Promise<void>;
  updateQuantity: (itemId: number, quantity: number) => Promise<void>;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  clearCart: () => void;
  clearLastAdded: () => void;
  clearItemError: (itemId: number) => void;
  clearErrors: () => void;
}

// ========================================
// Cart Store
// ========================================
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      // Initial State
      cart: null,
      isOpen: false,
      isLoading: false,
      lastAddedProduct: null,
      itemErrors: {},
      lastError: null,

      // ========================================
      // Fetch Cart Action
      // ✅ پشتیبانی از Guest Cart (بدون نیاز به لاگین)
      // ========================================
      fetchCart: async () => {
        set({ isLoading: true });
        try {
          const response = await cartApi.get();
          set({ cart: response.data, isLoading: false });
        } catch (error) {
          console.error('Failed to fetch cart:', error);
          set({ isLoading: false });
        }
      },

      // ========================================
      // Add catalogue product to cart
      // ========================================
      addToCart: async (productId: number, quantity: number = 1, packageId?: number | null) => {
        try {
          const response = await cartApi.add(productId, quantity, packageId);

          set({ cart: response.data, isOpen: true, lastError: null });

          // Remember what was added so FlyToCart can animate it.
          const addedItem = response.data.items.find(
            (item) => item.kind === 'product' && item.product?.id === productId,
          );
          if (addedItem?.product) {
            set({
              lastAddedProduct: {
                id: addedItem.product.id,
                name: addedItem.product.title,
              },
            });
          }

          toast.success('محصول به سبد خرید اضافه شد');
        } catch (error) {
          const parsed = parseApiError(error);
          set({ lastError: parsed.message });
          if (!parsed.handled) toast.error(parsed.message);
          throw error;
        }
      },

      // ========================================
      // Add storefront listing to cart
      // Quantity is optional: the server falls back to the listing's minimum.
      // ========================================
      addListingToCart: async (listingId: number, quantity?: number) => {
        try {
          const response = await cartApi.addListing(listingId, quantity);

          set({ cart: response.data, isOpen: true, lastError: null });

          const addedItem = response.data.items.find(
            (item) => item.kind === 'listing' && item.listing?.id === listingId,
          );
          if (addedItem?.listing) {
            set({
              lastAddedProduct: {
                id: addedItem.listing.id,
                name: addedItem.listing.title,
              },
            });
          }

          toast.success('آگهی به سبد خرید اضافه شد');
        } catch (error) {
          const parsed = parseApiError(error);
          set({ lastError: parsed.message });
          if (!parsed.handled) toast.error(parsed.message);
          throw error;
        }
      },

      // ========================================
      // Remove from Cart Action
      // ========================================
      removeFromCart: async (itemId: number) => {
        try {
          const response = await cartApi.remove(itemId);
          set({ cart: response.data, itemErrors: withoutKey(get().itemErrors, itemId) });
          toast.success('مورد از سبد خرید حذف شد');
        } catch (error) {
          const parsed = parseApiError(error);
          if (!parsed.handled) toast.error(parsed.message);
        }
      },

      // ========================================
      // Update Quantity Action
      // A rejected change is recorded against the row so the cart can explain
      // *why* the quantity did not move.
      // ========================================
      updateQuantity: async (itemId: number, quantity: number) => {
        try {
          const response = await cartApi.updateQuantity(itemId, quantity);
          set({ cart: response.data, itemErrors: withoutKey(get().itemErrors, itemId) });
        } catch (error) {
          const parsed = parseApiError(error);
          const fieldMessage = parsed.fields.quantity ?? parsed.message;
          set({ itemErrors: { ...get().itemErrors, [itemId]: fieldMessage } });
          // The message is already visible in the cart row; a toast would
          // duplicate it.
        }
      },

      // ========================================
      // Cart UI Actions
      // ========================================
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      clearCart: () => set({ cart: null, itemErrors: {}, lastError: null }),
      clearLastAdded: () => set({ lastAddedProduct: null }),
      clearItemError: (itemId: number) => {
        set({ itemErrors: withoutKey(get().itemErrors, itemId) });
      },
      clearErrors: () => set({ itemErrors: {}, lastError: null }),
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({
        cart: state.cart,
      }),
    },
  ),
);
