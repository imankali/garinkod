// frontend/src/components/SharePanel.tsx
//
// «اشتراک‌گذاری کالا» as a small panel instead of a single blind share button.
// A buyer usually wants to paste the link into a farmer group, so the panel
// offers copy + the messengers Iranians actually use (تلگرام، واتساپ، ایتا،
// بله) plus the native sheet where the browser has one.
//
// Every link is an outbound URL — nothing is tracked and no third-party script
// is loaded, in line with the project's "external integrations stay off" rule.

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, MessageCircle, Send, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { copyText } from '../utils/copyText';
import { cn } from '../utils/cn';

interface SharePanelProps {
  url: string;
  title: string;
  /** Optional one-line description appended to the messenger drafts. */
  text?: string;
  /** Renders the compact icon-only row used on cards. */
  variant?: 'button' | 'icons';
  className?: string;
}

type Channel = {
  id: string;
  label: string;
  icon: typeof Send;
  /** null means "only when the browser supports navigator.share". */
  href: ((target: { url: string; title: string; text: string }) => string) | null;
};

const CHANNELS: Channel[] = [
  {
    id: 'telegram',
    label: 'تلگرام',
    icon: Send,
    href: ({ url, text }) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: 'whatsapp',
    label: 'واتساپ',
    icon: MessageCircle,
    href: ({ url, text }) => `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
  {
    id: 'eitaa',
    label: 'ایتا',
    icon: Share2,
    href: ({ url, text }) => `https://eitaa.com/share/url?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
  {
    id: 'ble',
    label: 'بله',
    icon: MessageCircle,
    href: ({ url, text }) => `https://ble.ir/share?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
];

export default function SharePanel({ url, title, text, variant = 'button', className }: SharePanelProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const draft = text?.trim() ? `${title} — ${text.trim()}` : title;
  // Presence-check the API rather than calling it: older Safari and in-app
  // browsers on Android expose no share sheet at all.
  const canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  // Close on outside click and Escape: the panel floats above product content
  // and a popover that traps the user is worse than no popover.
  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  async function copyLink() {
    try {
      await copyText(url);
      setCopied(true);
      toast.success('لینک کپی شد.');
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error('کپی کردن در این مرورگر مجاز نیست؛ لینک را دستی بردارید.');
    }
  }

  async function nativeShare() {
    if (!navigator.share) {
      void copyLink();
      return;
    }
    try {
      await navigator.share({ title, text: draft, url });
    } catch {
      // A cancelled system sheet is not an error.
    }
  }

  if (variant === 'icons') {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <button
          type="button"
          onClick={() => void copyLink()}
          className="tap-target flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/60"
          aria-label="کپی لینک کالا"
        >
          {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
        </button>
        {CHANNELS.slice(0, 2).map((channel) => (
          <a
            key={channel.id}
            href={channel.href?.({ url, title, text: draft }) ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="tap-target flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/60"
            aria-label={`اشتراک در ${channel.label}`}
          >
            <channel.icon size={15} />
          </a>
        ))}
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={cn(
          'inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-fluid-xs font-bold transition-colors',
          open
            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-lime-400 dark:bg-emerald-900 dark:text-lime-300'
            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-lime-300 dark:hover:bg-emerald-900/60',
        )}
      >
        <Share2 size={16} />
        اشتراک‌گذاری
      </button>

      {open && (
        <div className="absolute end-0 top-full z-30 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-100 bg-white p-1.5 shadow-xl dark:border-emerald-800 dark:bg-emerald-950">
          <button
            type="button"
            onClick={() => void copyLink()}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-start text-fluid-sm font-bold text-slate-700 transition-colors hover:bg-emerald-50 dark:text-emerald-100 dark:hover:bg-emerald-900"
          >
            {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
            {copied ? 'کپی شد' : 'کپی لینک کالا'}
          </button>
          {CHANNELS.map((channel) => (
            <a
              key={channel.id}
              href={channel.href?.({ url, title, text: draft })}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-start text-fluid-sm font-semibold text-slate-600 transition-colors hover:bg-emerald-50 dark:text-emerald-200 dark:hover:bg-emerald-900"
            >
              <channel.icon size={16} className="text-emerald-600 dark:text-lime-300" />
              ارسال در {channel.label}
            </a>
          ))}
          {canNativeShare && (
            <button
              type="button"
              onClick={() => void nativeShare()}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-start text-fluid-sm font-semibold text-slate-600 transition-colors hover:bg-emerald-50 dark:text-emerald-200 dark:hover:bg-emerald-900"
            >
              <Share2 size={16} className="text-emerald-600 dark:text-lime-300" />
              گزینه‌های مرورگر
            </button>
          )}
        </div>
      )}
    </div>
  );
}
