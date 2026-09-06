// frontend/src/components/direct/MessageStatusTicks.tsx
//
// The sender's mark on their own message. Green while the desk has not opened
// it, plain double-tick once they have.
//
// The state is not a client-side guess: reading a thread is what marks its
// messages as seen on the server, so the tick changes when the other side
// actually opens the conversation — not when the message was delivered to a
// device that nobody looked at.

import { Check, CheckCheck } from 'lucide-react';

import { cn } from '../../utils/cn';

export default function MessageStatusTicks({
  isRead,
  isSystem = false,
  className,
}: {
  isRead: boolean;
  /** A platform notice has nobody to read it; showing a tick would lie. */
  isSystem?: boolean;
  className?: string;
}) {
  if (isSystem) return null;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5',
        isRead ? 'text-slate-400 dark:text-emerald-300/70' : 'text-lime-300',
        className,
      )}
      title={isRead ? 'باز شده' : 'هنوز باز نشده'}
      aria-label={isRead ? 'طرف مقابل پیام را باز کرده است' : 'پیام ارسال شده و هنوز باز نشده'}
    >
      {isRead ? <CheckCheck size={13} aria-hidden="true" /> : <Check size={12} aria-hidden="true" />}
    </span>
  );
}
