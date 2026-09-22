// frontend/src/api/services/messaging.ts
// Messaging and service desk endpoints.
//
// Keeping one bounded API surface per domain prevents the client layer
// from becoming a second monolith as new capabilities are added.

import apiClient from '../client';
import type { PaginatedResponse } from '@/types/common';
import type { DeskState, DeskRatingReport, ServiceConversationResponse, StorefrontConversation, StorefrontMessage, MessageChannel, InboxResponse } from '@/types/messaging';

export interface ThreadMessagesResponse extends PaginatedResponse<StorefrontMessage> {
  conversation: StorefrontConversation;
  /** Present in tail mode: there are messages before the first row returned. */
  older_available?: boolean;
}

export const messagesApi = {
  /** The caller's whole inbox, optionally narrowed to one channel. */
  conversations: (channel?: MessageChannel) =>
    apiClient.get<InboxResponse>('/marketplace/conversations/', {
      params: channel ? { channel } : undefined,
    }),

  /**
   * Open (or fetch) the caller's thread with a service desk. The response also
   * carries the desk's state (hours, who is online, canned replies), because a
   * chat window without that context is just a void you type into.
   */
  openServiceConversation: (channel: Exclude<MessageChannel, 'storefront'>) =>
    apiClient.post<ServiceConversationResponse>(`/marketplace/conversations/service/${channel}/`),

  /** A consultant starts the consulting thread with one farmer. */
  openFarmerConversation: (userId: number) =>
    apiClient.post<StorefrontConversation>(`/marketplace/conversations/farmer/${userId}/`),

  /** Get or create the caller's private thread with one storefront. */
  openStorefrontConversation: (storefrontSlug: string) =>
    apiClient.post<StorefrontConversation>(
      `/marketplace/storefronts/${storefrontSlug}/conversation/`,
    ),

  getStorefrontConversation: (storefrontSlug: string) =>
    apiClient.get<StorefrontConversation | null>(
      `/marketplace/storefronts/${storefrontSlug}/conversation/`,
    ),

  /**
   * Messages of one conversation, oldest first. Reading marks them as seen.
   *
   * `pageSize` without `page` asks the server for the newest `pageSize` rows —
   * what a chat window needs. Paging by number counts from the beginning of the
   * thread, so a long conversation would otherwise open on its oldest messages
   * with the recent ones unreachable.
   */
  messages: (
    conversationId: number,
    options?: { page?: number; pageSize?: number; beforeId?: number },
  ) =>
    apiClient.get<ThreadMessagesResponse>(
      `/marketplace/conversations/${conversationId}/messages/`,
      {
        params: {
          ...(options?.page ? { page: options.page } : {}),
          ...(options?.pageSize ? { page_size: options.pageSize } : {}),
          // Walk further back from one specific message. A chat has no stable
          // page numbers — the newest end keeps moving — so history is paged by
          // cursor instead.
          ...(options?.beforeId ? { before_id: options.beforeId } : {}),
        },
      },
    ),

  /** Send a message: text, a listing or land card, and/or one media attachment. */
  send: (
    conversationId: number,
    data: {
      body?: string;
      listing?: number;
      /** A land case file, shared with the desk that is advising on it. */
      land?: number | null;
      attachment?: Blob | null;
      attachmentName?: string;
      attachmentDuration?: number;
      /** Quote another message in this thread. */
      replyTo?: number | null;
    },
  ) => {
    const url = `/marketplace/conversations/${conversationId}/messages/`;
    if (!data.attachment) {
      return apiClient.post<StorefrontMessage>(url, {
        body: data.body,
        listing: data.listing,
        land: data.land ?? undefined,
        reply_to: data.replyTo ?? undefined,
      });
    }
    // A media message goes as multipart; the request interceptor drops the
    // JSON content-type so the browser can add the multipart boundary.
    const formData = new FormData();
    if (data.body) formData.append('body', data.body);
    if (data.listing) formData.append('listing', String(data.listing));
    if (data.land) formData.append('land', String(data.land));
    if (data.replyTo) formData.append('reply_to', String(data.replyTo));
    formData.append('attachment', data.attachment, data.attachmentName || 'attachment');
    if (data.attachmentDuration !== undefined) {
      formData.append('attachment_duration', String(Math.round(data.attachmentDuration)));
    }
    return apiClient.post<StorefrontMessage>(url, formData);
  },

  /** End a thread (or reopen it). Either side may do it; closing opens the survey. */
  close: (
    conversationId: number,
    data: { note?: string; reopen?: boolean } = {},
  ) =>
    apiClient.post<StorefrontConversation>(`/desk/conversations/${conversationId}/close/`, data),

  /** The satisfaction survey, once per closed thread, from the customer only. */
  rate: (
    conversationId: number,
    data: { score: number; solved?: boolean | null; comment?: string },
  ) => apiClient.post(`/desk/conversations/${conversationId}/rate/`, data),

  /** An operator moving a question to the other desk, with the context attached. */
  handoff: (
    conversationId: number,
    data: { target: 'consulting' | 'support'; note?: string; include_context?: boolean },
  ) =>
    apiClient.post<{ message: StorefrontMessage; target_conversation_id: number }>(
      `/desk/conversations/${conversationId}/handoff/`,
      data,
    ),

  /** Change the text of one of the caller's own messages. */
  edit: (conversationId: number, messageId: number, body: string) =>
    apiClient.patch<StorefrontMessage>(
      `/marketplace/conversations/${conversationId}/messages/${messageId}/`,
      { body },
    ),

  /** Soft-delete one of the caller's own messages (a placeholder remains). */
  remove: (conversationId: number, messageId: number) =>
    apiClient.delete<StorefrontMessage>(
      `/marketplace/conversations/${conversationId}/messages/${messageId}/`,
    ),
};

export const deskApi = {
  /**
   * Who is on duty, when the desk answers and which canned lines to offer.
   * Public, because the hours are the first thing a farmer checks before
   * writing — the roster of names and the replies need a session.
   */
  state: (channel: DeskState['channel']) =>
    apiClient.get<DeskState>('/desk/state/', { params: { channel } }),

  /** The staff view of one desk: open, unassigned, or assigned to me. */
  queue: (params: { channel?: string; assigned_to?: 'me' | 'unassigned' } = {}) =>
    apiClient.get<{
      count: number;
      results: StorefrontConversation[];
      unassigned: number;
      open: number;
    }>('/desk/queue/', { params }),

  /** Satisfaction numbers, for the desk's managers only. */
  ratings: (params: { channel?: string; agent?: number; days?: number } = {}) =>
    apiClient.get<DeskRatingReport>('/desk/ratings/', { params }),

  /**
   * The profile card of the customer behind one thread. Operators tap the
   * counterpart's name in the chat header and get contact details, level,
   * their مزرعه من lands and the service requests they filed.
   */
  customerCard: (conversationId: number) =>
    apiClient.get<CustomerCardResponse>(`/desk/conversations/${conversationId}/customer-card/`),
};

export interface CustomerCardResponse {
  customer: {
    id: number;
    username: string;
    full_name: string;
    email: string;
    phone: string;
    phone_verified: boolean;
    address: string;
    avatar_url: string;
    level_label: string;
    created: string | null;
    lands: {
      id: number;
      name: string;
      land_type_label: string;
      area_label: string;
      crop_type: string;
      province: string;
      city: string;
    }[];
    service_requests: {
      id: number;
      code: string;
      service_label: string;
      status: string;
      status_label: string;
      created_at: string;
    }[];
  };
  is_staff_view: boolean;
}
