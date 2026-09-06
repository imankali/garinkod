// frontend/src/components/product/ConsultCard.tsx
//
// The «مشاوره فوری» card a specialist nursery puts next to every product: a
// named agronomist, their photo, and three ways to reach them — in-app direct
// message, WhatsApp with the product already written into the draft, and a
// phone call. The copy makes no promise the platform cannot keep: it says the
// request is answered in the inbox, not "within 10 minutes".

import { Link } from 'react-router-dom';
import { MessageCircle, Phone, Send, Headset } from 'lucide-react';

import { useDirectStore } from '../../store/directStore';
import { useSiteContact, telHref, whatsappHref } from '../../hooks/useSiteContact';

const FALLBACK_AVATAR = '/images/hero-farm.jpg';

export default function ConsultCard({
  productTitle,
  productUrl,
  compact = false,
}: {
  productTitle: string;
  productUrl: string;
  /** Tighter padding for the modal, where the card sits under the price. */
  compact?: boolean;
}) {
  const { contact, whatsappDigits, primaryPhone } = useSiteContact();
  const openDirect = useDirectStore((state) => state.openDirect);
  const draft = `سلام، درباره «${productTitle}» سؤال دارم: ${productUrl}`;
  const expertName = contact.expert_name || 'کارشناس فروش گرین کود';
  const expertRole = contact.expert_role || 'پاسخ به سؤالات فنی و قیمت عمده';

  return (
    <aside
      className={`rounded-2xl border border-emerald-100 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-900/40 ${
        compact ? 'p-3.5' : 'p-5'
      }`}
      aria-label="مشاوره پیش از خرید"
    >
      <p className="flex items-center gap-1.5 text-fluid-xs font-extrabold text-emerald-800 dark:text-lime-300">
        <Headset size={15} />
        مشاوره فوری درباره این کالا
      </p>

      <div className="mt-3 flex items-center gap-3">
        <img
          src={contact.expert_photo_url || FALLBACK_AVATAR}
          alt={expertName}
          className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-emerald-200 dark:ring-emerald-700"
          onError={(event) => {
            event.currentTarget.src = FALLBACK_AVATAR;
          }}
        />
        <div className="min-w-0">
          <p className="truncate text-fluid-sm font-extrabold text-slate-800 dark:text-white">{expertName}</p>
          <p className="truncate text-fluid-2xs text-slate-500 dark:text-emerald-200">{expertRole}</p>
        </div>
      </div>

      {contact.expert_note && (
        <p className="mt-2.5 text-fluid-xs leading-6 text-slate-600 dark:text-emerald-100">{contact.expert_note}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => openDirect({ serviceChannel: 'consulting' })}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-fluid-xs font-bold text-white transition hover:bg-emerald-700"
        >
          <MessageCircle size={15} />
          گفتگو در پیام‌رسان سایت
        </button>
        {whatsappDigits && (
          <a
            href={whatsappHref(whatsappDigits, draft)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 text-fluid-xs font-bold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:text-lime-300"
          >
            <Send size={15} />
            واتساپ
          </a>
        )}
        {primaryPhone && (
          <a
            href={telHref(primaryPhone)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 text-fluid-xs font-bold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:text-lime-300"
            dir="ltr"
          >
            <Phone size={15} />
            {primaryPhone}
          </a>
        )}
      </div>

      <Link
        to="/contact"
        className="mt-2.5 inline-block text-fluid-2xs font-bold text-emerald-700 underline dark:text-lime-300"
      >
        نشانی، تلفن‌ها و ساعات کاری کامل
      </Link>
    </aside>
  );
}
