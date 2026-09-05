// frontend/src/hooks/useSiteContact.ts
//
// One cached read of the company's contact channels for every widget that needs
// them (product consult card, floating button, footer, contact page). Keeping it
// here means the phone number is read from the admin record rather than being
// duplicated in five components, with the public VITE_* values as the fallback
// for a deployment that has not filled the record in yet.

import { useQuery } from '@tanstack/react-query';

import { siteInfoApi } from '../api/services';
import type { SiteContactInfo } from '../types';

const EMPTY: SiteContactInfo = {
  address: '',
  provinces_note: '',
  phones: [],
  emails: [],
  working_hours: '',
  whatsapp_number: '',
  telegram_url: '',
  instagram_url: '',
  eitaa_url: '',
  map_lat: null,
  map_lng: null,
  map_note: '',
  expert_name: '',
  expert_role: '',
  expert_photo: null,
  expert_photo_url: '',
  expert_note: '',
  updated_at: '',
};

export function useSiteContact() {
  const { data, isLoading } = useQuery({
    queryKey: ['site-contact'],
    queryFn: async () => (await siteInfoApi.getContact()).data,
    staleTime: 10 * 60 * 1000,
  });

  const envPhone = import.meta.env.VITE_PHONE_NUMBER?.trim() || '';
  const envWhatsapp = import.meta.env.VITE_WHATSAPP_NUMBER?.replace(/\D/g, '') || '';
  const contact = { ...EMPTY, ...(data || {}) };

  return {
    contact,
    isLoading,
    /** First landline/mobile the company publishes, env fallback included. */
    primaryPhone: contact.phones[0] || envPhone,
    whatsappDigits: contact.whatsapp_number?.replace(/\D/g, '') || envWhatsapp,
    supportEmail: contact.emails[0] || (import.meta.env.VITE_SUPPORT_EMAIL?.trim() || ''),
  };
}

/** tel: href with every non-dial character removed. */
export function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** wa.me deep link, optionally pre-filling the draft text. */
export function whatsappHref(digits: string, text?: string) {
  if (!digits) return '';
  const clean = digits.replace(/\D/g, '').replace(/^0/, '');
  return `https://wa.me/${clean}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
