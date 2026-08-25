// frontend/src/store/directStore.ts
//
// UI state for the direct-message (DM) drawer. Anywhere in the app can open
// the drawer — a storefront page's "گفتگو" button, a listing card's "ارسال به
// دایرکت", or the header's messages shortcut — through one small store.

import { create } from 'zustand';

import type { AttachedListing, MessageChannel } from '../types';

interface OpenDirectOptions {
  /** Open an existing conversation's thread. */
  conversationId?: number | null;
  /** Open (or create) the thread with a storefront. */
  storefrontSlug?: string | null;
  /**
   * Open (or create) the caller's thread with a service desk — this is how
   * the floating help button lands in support instead of a dead-end form.
   */
  serviceChannel?: Exclude<MessageChannel, 'storefront'> | null;
  /** A listing to attach to the next message (send-product-to-DM). */
  listing?: AttachedListing | null;
}

interface DirectState {
  open: boolean;
  conversationId: number | null;
  storefrontSlug: string | null;
  serviceChannel: Exclude<MessageChannel, 'storefront'> | null;
  attachedListing: AttachedListing | null;
  /** The drawer can start on the conversation list instead of a thread. */
  view: 'list' | 'thread';
  unreadTotal: number;

  openDirect: (options?: OpenDirectOptions) => void;
  /** Back to the conversation list, keeping the drawer open. */
  openList: () => void;
  closeDirect: () => void;
  setConversationId: (id: number | null) => void;
  attachListing: (listing: AttachedListing | null) => void;
  setUnreadTotal: (count: number) => void;
}

export const useDirectStore = create<DirectState>((set) => ({
  open: false,
  conversationId: null,
  storefrontSlug: null,
  serviceChannel: null,
  attachedListing: null,
  view: 'list',
  unreadTotal: 0,

  openDirect: (options = {}) =>
    set({
      open: true,
      conversationId: options.conversationId ?? null,
      storefrontSlug: options.storefrontSlug ?? null,
      serviceChannel: options.serviceChannel ?? null,
      attachedListing: options.listing ?? null,
      view:
        options.conversationId || options.storefrontSlug || options.serviceChannel
          ? 'thread'
          : 'list',
    }),

  closeDirect: () =>
    set({
      open: false,
      conversationId: null,
      storefrontSlug: null,
      serviceChannel: null,
      attachedListing: null,
    }),

  openList: () =>
    set({
      conversationId: null,
      storefrontSlug: null,
      serviceChannel: null,
      attachedListing: null,
      view: 'list',
    }),

  setConversationId: (id) =>
    set({ conversationId: id, storefrontSlug: null, serviceChannel: null }),

  attachListing: (listing) => set({ attachedListing: listing }),

  setUnreadTotal: (count) => set({ unreadTotal: count }),
}));
