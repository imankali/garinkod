// frontend/src/store/authModalStore.ts
//
// A single "sign in" dialog for the whole app.
//
// Royal Kesh asks for a login *in place*: a visitor tapping «ثبت دیدگاه» or
// «مشاوره» on a product page is not thrown away to a /login route and left to
// find their way back. This store is how any component asks for that, and the
// `reason` line tells the visitor why the dialog appeared.

import { create } from 'zustand';

interface AuthModalState {
  open: boolean;
  /** Why the dialog appeared; shown as a one-line hint. */
  reason: string;
  /** Where to send the user after a successful sign-in. */
  next: string;
  openAuthModal: (options?: { reason?: string; next?: string }) => void;
  close: () => void;
}

export const useAuthModalStore = create<AuthModalState>((set) => ({
  open: false,
  reason: '',
  next: '',
  openAuthModal: (options) =>
    set({
      open: true,
      reason: options?.reason || '',
      next: options?.next || (typeof window === 'undefined' ? '' : window.location.pathname + window.location.search),
    }),
  close: () => set({ open: false }),
}));
