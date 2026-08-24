// frontend/src/components/farm/ConsultationsPanel.tsx
//
// The farmer's consultation requests: file a new one by choosing which land
// (case file) it is about, and read the consultant's replies.

import { FormEvent, useEffect, useState } from 'react';
import { MessageCircleQuestion, Send, Stethoscope } from 'lucide-react';
import toast from 'react-hot-toast';

import { farmApi } from '../../api/services';
import { parseApiError } from '../../api/errors';
import { useTranslation } from '../../i18n';
import { cn } from '../../utils/cn';
import type { FarmConsultationRequest, FarmLand } from '../../types';
import { CONSULTATION_SUBJECTS, formatFaDate } from './farmOptions';

export default function ConsultationsPanel({
  lands,
  onRequested,
}: {
  lands: FarmLand[];
  onRequested: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<FarmConsultationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [landId, setLandId] = useState('');
  const [subject, setSubject] = useState('general');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    try {
      const response = await farmApi.consultations();
      setRequests(response.data);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!landId && lands.length === 1) setLandId(String(lands[0]!.id));
  }, [lands, landId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!landId || !message.trim()) return;
    setSending(true);
    try {
      await farmApi.createConsultation({
        land_id: Number(landId),
        subject,
        message: message.trim(),
      });
      setMessage('');
      toast.success('درخواست مشاوره ثبت شد؛ کارشناس به زودی پاسخ می‌دهد.');
      await load();
      onRequested();
    } catch (error) {
      toast.error(parseApiError(error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* New request */}
      <form
        onSubmit={submit}
        className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-900 dark:bg-emerald-950 sm:p-5"
      >
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-800 dark:text-white">
          <Stethoscope size={16} className="text-emerald-600 dark:text-lime-300" />
          درخواست مشاوره جدید
        </h3>
        <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-emerald-200">
          پرونده (زمین) موردنظر را انتخاب کنید تا کارشناس شناسنامه، تقویم و تاریخچه آن را همان لحظه ببیند.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-bold text-slate-600 dark:text-emerald-100">
            انتخاب پرونده (زمین/باغ/گلخانه)
            <select
              value={landId}
              onChange={(event) => setLandId(event.target.value)}
              required
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-normal dark:border-emerald-700 dark:bg-emerald-900 dark:text-white"
            >
              <option value="">انتخاب کنید…</option>
              {lands.map((land) => (
                <option key={land.id} value={land.id}>
                  {land.name} — {land.land_type_label} ({land.crop_type})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-bold text-slate-600 dark:text-emerald-100">
            موضوع
            <select
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-normal dark:border-emerald-700 dark:bg-emerald-900 dark:text-white"
            >
              {CONSULTATION_SUBJECTS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-3 block text-xs font-bold text-slate-600 dark:text-emerald-100">
          شرح درخواست
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
            rows={3}
            maxLength={3000}
            placeholder="مشکل یا سؤال خود را کامل توضیح دهید…"
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-normal dark:border-emerald-700 dark:bg-emerald-900 dark:text-white"
          />
        </label>

        <button
          type="submit"
          disabled={sending || !landId}
          className="mt-3 flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          <Send size={15} className="-scale-x-100" />
          {sending ? t('common.loading') : 'ثبت درخواست مشاوره'}
        </button>
      </form>

      {/* Requests history */}
      <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-900 dark:bg-emerald-950 sm:p-5">
        <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">درخواست‌های قبلی</h3>
        {loading ? (
          <p className="py-6 text-center text-xs text-slate-400">{t('common.loading')}</p>
        ) : requests.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-center text-xs text-slate-400 dark:bg-emerald-900/40 dark:text-emerald-300">
            هنوز درخواستی ثبت نکرده‌اید.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {requests.map((request) => (
              <li key={request.id} className="rounded-2xl border border-slate-100 p-3 dark:border-emerald-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-white">
                    <MessageCircleQuestion size={14} className="text-emerald-600 dark:text-lime-300" />
                    {request.subject_label}
                    <span className="font-normal text-slate-400">· {request.land.name}</span>
                  </p>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-fluid-2xs font-bold',
                      request.status === 'pending' && 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200',
                      request.status === 'answered' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300',
                      request.status === 'closed' && 'bg-slate-100 text-slate-500 dark:bg-emerald-900 dark:text-emerald-200',
                    )}
                  >
                    {request.status_label}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-emerald-200">{request.message}</p>
                {request.reply && (
                  <div className="mt-2 rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-100">
                    <p className="mb-1 font-extrabold text-emerald-700 dark:text-lime-300">پاسخ مشاور:</p>
                    {request.reply}
                  </div>
                )}
                <p className="mt-1.5 text-fluid-2xs text-slate-400">{formatFaDate(request.created_at.slice(0, 10))}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
