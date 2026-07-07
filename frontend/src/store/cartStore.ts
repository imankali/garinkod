// frontend/src/store/cartStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Cart } from '../types';
import { cartApi } from '../api/services';
import toast from 'react-hot-toast';

// ========================================
// Cart State Interface
// ========================================
interface CartState {
  // State
  cart: Cart | null;
  isOpen: boolean;
  isLoading: boolean;
  lastAddedProduct: { id: number; name: string } | null;

  // Actions
  fetchCart: () => Promise<void>;
  addToCart: (productId: number, quantity?: number) => Promise<void>;
  removeFromCart: (itemId: number) => Promise<void>;
  updateQuantity: (itemId: number, quantity: number) => Promise<void>;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  clearCart: () => void;
  clearLastAdded: () => void;
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
      // Add to Cart Action
      // ✅ پشتیبانی از Guest Cart
      // ✅ نمایش انیمیشن FlyToCart
      // ========================================
      addToCart: async (productId: number, quantity: number = 1) => {
        try {
          const response = await cartApi.add(productId, quantity);

          set({
            cart: response.data,
            isOpen: true, // ✅ باز کردن خودکار سبد بعد از افزودن
          });

          // ✅ ذخیره محصول اضافه شده برای انیمیشن FlyToCart
          const addedItem = response.data.items.find(
            (item) => item.product.id === productId
          );
          if (addedItem) {
            set({
              lastAddedProduct: {
                id: addedItem.product.id,
                name: addedItem.product.title,
              },
            });
          }

          toast.success('محصول به سبد خرید اضافه شد');
        } catch (error: any) {
          console.error('Failed to add to cart:', error);
          const errorMsg = error.response?.data?.error || 'خطا در افزودن به سبد خرید';
          toast.error(errorMsg);
          throw error;
        }
      },

      // ========================================
      // Remove from Cart Action
      // ========================================
      removeFromCart: async (itemId: number) => {
        try {
          const response = await cartApi.remove(itemId);
          set({ cart: response.data });
          toast.success('محصول از سبد خرید حذف شد');
        } catch (error) {
          console.error('Failed to remove from cart:', error);
          toast.error('خطا در حذف محصول');
        }
      },

      // ========================================
      // Update Quantity Action
      // ========================================
      updateQuantity: async (itemId: number, quantity: number) => {
        try {
          const response = await cartApi.updateQuantity(itemId, quantity);
          set({ cart: response.data });
        } catch (error) {
          console.error('Failed to update quantity:', error);
          toast.error('خطا در به‌روزرسانی تعداد');
        }
      },

      // ========================================
      // Cart UI Actions
      // ========================================
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      clearCart: () => set({ cart: null }),
      clearLastAdded: () => set({ lastAddedProduct: null }),
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({
        cart: state.cart
      }),
    }
  )
);