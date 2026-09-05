// frontend/src/components/direct/SurveyCard.tsx
//
// The satisfaction box a farmer sees after a desk thread is closed.
//
// It is a card in the conversation rather than a modal over the page, because
// that is what «یک باکس نظرسنجی ارسال شود» means to the person who just finished
// talking: it arrives where the conversation was, and it can be ignored without
// fighting an overlay.
//
// The result is read by the desk's managers only (the staff panel and the admin),
// never printed next to an operator's name for strangers — a number that is
// visible to everyone gets gamed, and a farmer's complaint is not public content.

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, ThumbsDown, ThumbsUp } from 'lucide-react';
import toast from 'react-hot-toast';

import { messagesApi } from '../../api/services';
import { parseApiError } from '../../api/errors';
import { StarPicker } from '../StarRating';
import { cn } from '../../utils/cn';
import type { ConversationSurvey } from '../../types';

const SCORE_HINT = ['', 'خیلی کم', 'کم', 'متوسط', 'خوب', 'عالی'];

export default function SurveyCard({
  conversationId,
  survey,
  agentName,
  onSubmitted,
}: {
  conversationId: number;
  survey: ConversationSurvey;
  agentName: string;
  onSubmitted: () => void;
}) {
  const [score, setScore] = useState(0);
  const [solved, setSolved] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  // Already answered, or the thread is still open: nothing to ask.
  if (!survey.can_rate) {
    if (!survey.has_rating) return null;
    return (
      <p className="mx-auto max-w-sm rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-fluid-2xs leading-6 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-lime-200">
        نظر شما دربارهٔ {agentName || 'این میز'} ثبت شد. ممنون که وقت گذاشتید.
      </p>
    );
  }

  async function submit() {
    if (score === 0) {
      toast.error('اول از امتیاز ستاره را انتخاب کنید.');
      return;
    }
    setSending(true);
    try {
      await messagesApi.rate(conversationId, {
        score,
        solved,
        comment: comment.trim() || undefined,
      });
      toast.success('نظر شما برای میز ثبت شد.');
      onSubmitted();
    } catch (caught) {
      toast.error(parseApiError(caught).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-sm rounded-2xl border border-emerald-200 bg-white p-3.5 shadow-sm dark:border-emerald-800 dark:bg-emerald-950"
    >
      <p className="text-fluid-xs font-extrabold text-slate-800 dark:text-white">
        از پاسخ {agentName || 'میز'} راضی بودید؟
      </p>
      <p className="mt-1 text-fluid-2xs leading-6 text-slate-500 dark:text-emerald-200">
        این نظر فقط به مدیران میز نشان داده می‌شود و به بهتر شدن پاسخ‌گویی کمک می‌کند.
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <StarPicker value={score} onChange={setScore} label="امتیاز شما به این میز" />
        {score > 0 && (
          <span className="text-fluid-2xs font-bold text-amber-600 dark:text-amber-300">
            {SCORE_HINT[score]}
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        {[
          { value: true, label: 'مشکلم حل شد', icon: ThumbsUp },
          { value: false, label: 'حل نشد', icon: ThumbsDown },
        ].map((option) => (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => setSolved(option.value)}
            aria-pressed={solved === option.value}
            className={cn(
              'flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border text-fluid-2xs font-bold transition',
              solved === option.value
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-900',
            )}
          >
            <option.icon size={14} aria-hidden="true" />
            {option.label}
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        rows={2}
        maxLength={600}
        placeholder="اگر چیزی اذیتتان کرد یا کسی خوب جواب داد، همین‌جا بنویسید (اختیاری)"
        className={cn(
          'mt-2.5 w-full resize-none rounded-xl border border-emerald-200 bg-white px-3 py-2 text-fluid-xs leading-6 outline-none',
          'transition focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-900 dark:text-white',
        )}
      />

      <button
        type="button"
        onClick={() => void submit()}
        disabled={sending}
        className={cn(
          'mt-2.5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient-accent text-fluid-xs font-extrabold text-white',
          'shadow-md transition disabled:opacity-60',
        )}
      >
        <Send size={15} aria-hidden="true" />
        {sending ? 'در حال ثبت…' : 'ثبت نظر'}
      </button>

      {score === 0 && (
        <p className="mt-1.5 text-center text-fluid-2xs text-slate-400 dark:text-emerald-300/70">
          برای ثبت نظر، اول امتیاز را انتخاب کنید
        </p>
      )}
    </motion.div>
  );
}
