// frontend/src/components/direct/MessageLink.tsx
//
// A button inside a message bubble that goes somewhere else in the site.
//
// Two real cases, both of which otherwise make the reader hunt:
//
// * a comment got an answer → «مشاهده پاسخ» opens the post (or the product
//   page) scrolled to that comment, so «کامنت ریپلای‌شده» in the inbox is a
//   route, not just a notification;
// * the support desk found the question is a consulting one → «ادامه گفتگو در
//   مشاوره کشاورزی» moves them to the right thread without retyping anything.
//
// Only operators can attach a link (the API refuses it from anyone else), so the
// target is a page the platform itself owns.

import { Link } from 'react-router-dom';
import { ArrowUpLeft, Headphones, MessageSquareText, Sprout } from 'lucide-react';

import { cn } from '../../utils/cn';
import { useDirectStore } from '../../store/directStore';
import type { MessageLink as MessageLinkData } from '../../types';

/**
 * A hand-off is the moment a farmer is most likely to give up, so it must not
 * look like a bare URL in a sentence. Kinds in this set render as a card with an
 * emblem; anything else (an attached product, a link to a post) stays a chip.
 */
const EMBLEM = {
  consulting: { icon: Sprout, caption: 'کارشناس کشاورزی در انتظار شماست' },
  support: { icon: Headphones, caption: 'میز پشتیبانی' },
  handoff: { icon: MessageSquareText, caption: 'گفتگو از همین‌جا ادامه پیدا می‌کند' },
} as const;

export default function MessageLink({
  link,
  tone = 'light',
}: {
  link: MessageLinkData;
  tone?: 'light' | 'dark';
}) {
  const closeDirect = useDirectStore((state) => state.closeDirect);
  const internal = link.url.startsWith('/');
  const card =
    link.kind === 'handoff' || link.kind === 'consulting' || link.kind === 'support'
      ? EMBLEM[link.kind]
      : null;
  const Icon = card ? card.icon : ArrowUpLeft;

  const inner = card ? (
    <span className="flex w-full min-w-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          tone === 'dark' ? 'bg-white/25 text-white' : 'bg-emerald-700/15 text-emerald-700 dark:bg-emerald-950/60 dark:text-lime-300',
        )}
      >
        <Icon size={19} />
      </span>
      <span className="min-w-0 flex-1 text-start">
        <span className="block truncate text-fluid-xs font-extrabold">{link.label}</span>
        <span
          className={cn(
            'mt-0.5 block truncate text-fluid-2xs font-bold',
            tone === 'dark' ? 'text-white/80' : 'text-emerald-100/90 dark:text-emerald-200/80',
          )}
        >
          {card.caption}
        </span>
      </span>
      <ArrowUpLeft size={15} className={cn('shrink-0 rotate-45', tone === 'dark' ? 'text-white/80' : 'text-emerald-100')} aria-hidden="true" />
    </span>
  ) : (
    <>
      <Icon size={13} aria-hidden="true" />
      <span className="min-w-0 truncate">{link.label}</span>
    </>
  );

  const classes = cn(
    'mt-2 flex w-full min-w-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-fluid-2xs font-extrabold transition',
    card && 'gap-2.5 px-2 py-2',
    tone === 'dark'
      ? 'bg-white/20 text-white hover:bg-white/30'
      : 'bg-emerald-600 text-white hover:bg-emerald-700',
  );

  if (!internal) {
    return (
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(classes, !card && 'justify-center')}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link
      to={link.url}
      // A thread is usually open inside the drawer; navigating without closing it
      // leaves the new page behind an overlay that looks like nothing happened.
      onClick={() => closeDirect()}
      className={cn(classes, !card && 'justify-center')}
    >
      {inner}
    </Link>
  );
}
