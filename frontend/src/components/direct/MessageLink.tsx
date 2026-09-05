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
import { ArrowUpLeft, MessageSquareText } from 'lucide-react';

import { cn } from '../../utils/cn';
import { useDirectStore } from '../../store/directStore';
import type { MessageLink as MessageLinkData } from '../../types';

export default function MessageLink({
  link,
  tone = 'light',
}: {
  link: MessageLinkData;
  tone?: 'light' | 'dark';
}) {
  const closeDirect = useDirectStore((state) => state.closeDirect);
  const internal = link.url.startsWith('/');
  const Icon = link.kind === 'handoff' ? MessageSquareText : ArrowUpLeft;

  const inner = (
    <>
      <Icon size={13} aria-hidden="true" />
      <span className="min-w-0 truncate">{link.label}</span>
    </>
  );

  const classes = cn(
    'mt-2 flex w-full min-w-0 items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-fluid-2xs font-extrabold transition',
    tone === 'dark'
      ? 'bg-white/20 text-white hover:bg-white/30'
      : 'bg-emerald-600 text-white hover:bg-emerald-700',
  );

  if (!internal) {
    return (
      <a href={link.url} target="_blank" rel="noopener noreferrer" className={classes}>
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
      className={classes}
    >
      {inner}
    </Link>
  );
}
