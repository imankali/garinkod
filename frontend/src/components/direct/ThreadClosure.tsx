// frontend/src/components/direct/ThreadClosure.tsx
//
// «اتمام مکالمه» and the operator's «ارجاع به میز دیگر».
//
// Ending the conversation is offered to *both* sides on purpose. A farmer who
// got their answer should not have to wait for someone at the desk to declare it
// finished, and the desk needs the same button when the question was answered
// three messages ago. Closing is what opens the survey, so the button is also
// the moment the platform asks «راضی بودید؟».
//
// Closing never seals the thread: a new message reopens it (the API does that on
// its own), so nobody has to beg for a reopen to ask one more thing.

import { useState } from 'react';
import { ArrowLeftRight, PhoneOff, RotateCcw, Send } from 'lucide-react';
import toast from 'react-hot-toast';

import Modal from '../ui/Modal';
import { messagesApi } from '../../api/services';
import { parseApiError } from '../../api/errors';
import { cn } from '../../utils/cn';
import type { StorefrontConversation } from '../../types';

export function CloseThreadButton({
  conversation,
  onChanged,
  className,
}: {
  conversation: StorefrontConversation;
  onChanged: () => void;
  className?: string;
}) {
  const [sheet, setSheet] = useState<'idle' | 'closing' | 'reopen'>('idle');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const closed = conversation.status === 'closed';

  async function submit() {
    setBusy(true);
    try {
      if (closed) {
        await messagesApi.close(conversation.id, { reopen: true });
        toast.success('گفتگو دوباره باز شد.');
      } else {
        await messagesApi.close(conversation.id, { note: note.trim() || undefined });
        toast.success('گفتگو بسته شد و از شما نظرخواهی می‌شود.');
      }
      setSheet('idle');
      setNote('');
      onChanged();
    } catch (caught) {
      toast.error(parseApiError(caught).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setSheet(closed ? 'reopen' : 'closing')}
        className={cn(
          'flex min-h-9 items-center justify-center gap-1.5 rounded-xl px-2.5 text-fluid-2xs font-extrabold transition',
          closed
            ? 'text-emerald-700 hover:bg-emerald-50 dark:text-lime-300 dark:hover:bg-emerald-900'
            : 'text-slate-500 hover:bg-slate-100 hover:text-rose-600 dark:text-emerald-200 dark:hover:bg-emerald-900',
          className,
        )}
      >
        {closed ? <RotateCcw size={14} aria-hidden="true" /> : <PhoneOff size={14} aria-hidden="true" />}
        {closed ? 'بازکردن گفتگو' : 'اتمام مکالمه'}
      </button>

      <Modal
        open={sheet === 'closing'}
        onClose={() => setSheet('idle')}
        title="اتمام مکالمه"
        description="با بستن گفتگو، از شما دربارهٔ کیفیت پاسخ نظرخواهی می‌شود."
        variant="sheet"
        size="sm"
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSheet('idle')}
              className="min-h-11 flex-1 rounded-xl border border-slate-200 text-fluid-xs font-bold text-slate-600 dark:border-emerald-800 dark:text-emerald-100"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-fluid-xs font-extrabold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              <Send size={14} aria-hidden="true" />
              {busy ? 'در حال ثبت…' : 'بستن گفتگو'}
            </button>
          </div>
        }
      >
        <label className="block">
          <span className="text-fluid-2xs font-extrabold text-slate-500 dark:text-emerald-200">
            توضیح پایانی (اختیاری)
          </span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={400}
            placeholder="مثلاً: توصیه‌ها را انجام دهید؛ اگر باز هم سؤال داشتید همین‌جا بنویسید."
            className={cn(
              'mt-1.5 w-full resize-none rounded-xl border border-emerald-200 bg-white px-3 py-2 text-fluid-xs leading-6',
              'outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500',
              'dark:border-emerald-700 dark:bg-emerald-900 dark:text-white',
            )}
          />
        </label>
      </Modal>

      <Modal
        open={sheet === 'reopen'}
        onClose={() => setSheet('idle')}
        title="بازکردن گفتگو"
        description="اگر سؤال تازه‌ای دارید، گفتگو باز می‌شود و پیام شما به همان میز می‌رود."
        variant="sheet"
        size="sm"
        footer={
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="flex min-h-11 w-full items-center justify-center rounded-xl bg-emerald-600 text-fluid-xs font-extrabold text-white disabled:opacity-60"
          >
            {busy ? 'در حال ثبت…' : 'بازکردن'}
          </button>
        }
      >
        <p className="text-fluid-2xs leading-6 text-slate-500 dark:text-emerald-200">
          نیازی به نوشتن پیام نیست؛ می‌توانید همین‌جا گفتگو را باز کنید و بعد سؤال‌تان را بنویسید.
        </p>
      </Modal>
    </>
  );
}

/**
 * An operator's way of sending a question to the other desk.
 *
 * The alternative — telling the farmer «این به پشتیبانی ربطی ندارد، از مشاوره
 * بپرسید» — makes the farmer repeat themselves and lose the context the first
 * operator already gathered. So the sheet carries a ready sentence, and the
 * destination thread receives the last messages of this one.
 */
export function HandoffButton({
  conversation,
  target,
  targetLabel,
  onDone,
  className,
}: {
  conversation: StorefrontConversation;
  target: 'consulting' | 'support';
  targetLabel: string;
  onDone: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [withContext, setWithContext] = useState(true);
  const [busy, setBusy] = useState(false);

  /*
    The ready sentence is shown in the box rather than hidden in a placeholder:
    what the farmer reads is exactly what the operator saw before sending, and
    editing it is one keystroke instead of writing a message from scratch.
  */
  const readyNote =
    target === 'consulting'
      ? 'این مورد به بررسی تخصصی زمین و کشت نیاز دارد؛ از لینک پایین گفتگو را با کارشناس کشاورزی ادامه دهید تا همین جزئیات را هم ببیند.'
      : 'پاسخ این مورد از حیطه مشاوره خارج است؛ از لینک پایین آن را با پشتیبانی ادامه دهید تا سریع‌تر نتیجه شود.';

  async function submit() {
    setBusy(true);
    try {
      await messagesApi.handoff(conversation.id, {
        target,
        note: note.trim() || undefined,
        include_context: withContext,
      });
      toast.success(`گفتگو به ${targetLabel} فرستاده شد و لینک آن برای کاربر ارسال شد.`);
      setOpen(false);
      onDone();
    } catch (caught) {
      toast.error(parseApiError(caught).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setNote((current) => current.trim() || readyNote);
          setOpen(true);
        }}
        className={cn(
          'flex min-h-9 items-center justify-center gap-1.5 rounded-xl px-2.5 text-fluid-2xs font-extrabold text-slate-500',
          'transition hover:bg-sky-50 hover:text-sky-700 dark:text-emerald-200 dark:hover:bg-sky-950/40 dark:hover:text-sky-200',
          className,
        )}
      >
        <ArrowLeftRight size={14} aria-hidden="true" />
        ارجاع به {targetLabel}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`ارسال این مورد به ${targetLabel}`}
        description="یک پیام آماده با لینک گفتگوی جدید برای کاربر فرستاده می‌شود."
        variant="sheet"
        size="sm"
        footer={
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-sky-600 text-fluid-xs font-extrabold text-white transition hover:bg-sky-700 disabled:opacity-60"
          >
            <Send size={14} aria-hidden="true" />
            {busy ? 'در حال ارسال…' : `ارسال به ${targetLabel}`}
          </button>
        }
      >
        <label className="block">
          <span className="text-fluid-2xs font-extrabold text-slate-500 dark:text-emerald-200">
            پیامی که کاربر می‌بیند
          </span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder={readyNote}
            className={cn(
              'mt-1.5 w-full resize-none rounded-xl border border-emerald-200 bg-white px-3 py-2 text-fluid-xs leading-6',
              'outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500',
              'dark:border-emerald-700 dark:bg-emerald-900 dark:text-white',
            )}
          />
          {note.trim() !== readyNote && (
            <button
              type="button"
              onClick={() => setNote(readyNote)}
              className="mt-1 text-fluid-2xs font-bold text-sky-600 hover:underline dark:text-sky-300"
            >
              بازگردانی پیام آماده
            </button>
          )}
        </label>
        <label className="mt-3 flex min-h-11 items-center gap-2 rounded-xl bg-slate-50 px-3 text-fluid-2xs font-bold text-slate-600 dark:bg-emerald-900/40 dark:text-emerald-100">
          <input
            type="checkbox"
            checked={withContext}
            onChange={(event) => setWithContext(event.target.checked)}
            className="h-4 w-4 accent-emerald-600"
          />
          آخرین پیام‌های این گفتگو برای {targetLabel} هم فرستاده شود
        </label>
      </Modal>
    </>
  );
}
