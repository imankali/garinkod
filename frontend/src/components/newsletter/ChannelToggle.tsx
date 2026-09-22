// frontend/src/components/newsletter/ChannelToggle.tsx

import { Mail, Smartphone } from 'lucide-react';

import { cn } from '../../utils/cn';

export type NewsletterChannel = 'email' | 'mobile';

const CHANNELS = [
  { id: 'mobile', label: 'موبایل', icon: Smartphone },
  { id: 'email', label: 'ایمیل', icon: Mail },
] as const;

interface ChannelToggleProps {
  channel: NewsletterChannel;
  onChange: (channel: NewsletterChannel) => void;
}

/** Shared channel selector for the compact footer form and full newsletter page. */
export default function ChannelToggle({ channel, onChange }: ChannelToggleProps) {
  return (
    <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-emerald-900/60">
      {CHANNELS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          aria-pressed={channel === option.id}
          className={cn(
            'flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg text-fluid-xs font-bold transition-colors',
            channel === option.id
              ? 'bg-white text-emerald-700 shadow-sm dark:bg-emerald-950 dark:text-lime-300'
              : 'text-slate-500 dark:text-emerald-300',
          )}
        >
          <option.icon size={15} aria-hidden="true" />
          {option.label}
        </button>
      ))}
    </div>
  );
}
