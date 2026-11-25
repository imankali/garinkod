// frontend/src/pages/PhotoCheck.tsx
//
// «عکس برگ را بفرست» — the visual check.
//
// `trustApi.visualSearch` was the last buyer-facing endpoint with no caller.
// The backend reads a leaf photograph and returns a screening estimate: a
// condition title, a confidence, a symptom list, the inputs registered for it
// and the catalogue products that match, plus a disclaimer.
//
// How this page talks about it matters more than what it renders. The server's
// estimate is computed from the photograph's average colour — it is a triage
// hint, not a diagnosis, and a confident-looking percentage over a mean-green
// reading is exactly the kind of UI that gets someone to spray the wrong
// chemical. So:
//
//   • the heading says «برآورد» and the confidence is labelled as an estimate;
//   • the server's own `disclaimer` is printed on every result, not tucked in a
//     footer;
//   • the suggested inputs carry their safety note and pre-harvest interval,
//     because that is the part of the answer that can burn a crop;
//   • a consultant is offered right next to the estimate — the estimate is the
//     cheap first step, not the answer.

import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Aperture, Camera, Leaf, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router';

import { trustApi } from '../api/services';
import type { VisualDiagnosis } from '@/types/content';
import { parseApiError } from '../api/errors';
import { money } from '../lib/price';
import { useTitle } from '../lib/useTitle';
import PageHead from '../components/shop/PageHead';
import Button from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';

const MAX_BYTES = 5 * 1024 * 1024;

export default function PhotoCheck() {
  useTitle('بررسی عکس برگ');
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const analyse = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('اول یک عکس انتخاب کنید.');
      return (await trustApi.visualSearch(file, 'pest')).data;
    },
    onError: (caught) => setError(parseApiError(caught).message),
    onSuccess: () => setError(null),
  });

  const diagnosis: VisualDiagnosis | undefined = analyse.data?.diagnosis;

  const pick = (chosen: File | null) => {
    setError(null);
    analyse.reset();
    if (!chosen) {
      setFile(null);
      setPreview('');
      return;
    }
    // The server enforces this too; catching it here saves an upload on a
    // phone connection.
    if (chosen.size > MAX_BYTES) {
      setError('حجم عکس نباید بیشتر از ۵ مگابایت باشد.');
      setFile(null);
      setPreview('');
      return;
    }
    setFile(chosen);
    setPreview(URL.createObjectURL(chosen));
  };

  return (
    <div className="shell flex flex-col gap-6 py-8">
      <PageHead
        title="بررسی عکس برگ"
        lead="یک عکس واضح از برگ یا بوته بفرستید تا برآورد اولیهٔ مشکل و نهاده‌های مرتبط را ببینید. این یک غربالگری است، نه تشخیص قطعی."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <form
          noValidate
          className="flex flex-col gap-3 rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft"
          onSubmit={(event) => {
            event.preventDefault();
            if (!file || analyse.isPending) return;
            analyse.mutate();
          }}
        >
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-2xs font-extrabold text-ink dark:text-white">
              عکس برگ
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => pick(event.target.files?.[0] ?? null)}
                className="text-[11px] font-normal text-ink-mute file:me-2 file:rounded-sm file:border-0 file:bg-brand-50 file:px-2 file:py-1 file:text-2xs file:font-bold file:text-brand-800 dark:text-white/45 dark:file:bg-night dark:file:text-brand-300"
              />
            </label>
            <p className="text-[11px] leading-5 text-ink-mute dark:text-white/40">
              JPG، PNG یا WebP تا ۵ مگابایت. برگ را پر کنار هم نگذارید و از نور روز استفاده کنید.
            </p>
          </div>

          {preview && (
            <img
              src={preview}
              alt="پیش‌نمایش عکس انتخاب‌شده"
              className="h-40 w-full rounded-md border border-line object-cover dark:border-night-line"
            />
          )}

          <Button type="submit" loading={analyse.isPending} disabled={!file} icon={Aperture}>
            بررسی عکس
          </Button>

          {error && (
            <p role="alert" className="text-2xs font-bold text-danger-700">
              {error}
            </p>
          )}
        </form>

        <div className="min-w-0">
          {analyse.isPending ? (
            <Skeleton className="h-48 rounded-lg" />
          ) : !diagnosis ? (
            <div className="rounded-lg border border-dashed border-line p-6 text-center dark:border-night-line">
              <Camera size={22} aria-hidden="true" className="mx-auto text-ink-mute dark:text-white/35" />
              <p className="mt-2 text-xs font-bold text-ink-soft dark:text-white/60">
                نتیجهٔ برآورد اینجا نمایش داده می‌شود.
              </p>
              <p className="mt-1 text-2xs leading-6 text-ink-mute dark:text-white/45">
                اگر علائم جدی است، به‌جای تکیه بر عکس، از کارشناس بخواهید مزرعه را ببیند.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft">
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute dark:text-white/40">
                  برآورد — نه تشخیص
                </p>
                <h2 className="mt-1 text-sm font-extrabold text-ink dark:text-white">{diagnosis.title}</h2>
                <p className="mt-1 text-2xs text-ink-mute dark:text-white/50">
                  اطمینان برآوردی: {diagnosis.confidence_percent.toLocaleString('fa-IR')}٪
                  {diagnosis.image_meta?.dominant_hue && ` · رنگ غالب تصویر: ${diagnosis.image_meta.dominant_hue}`}
                </p>

                {diagnosis.symptoms.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1">
                    {diagnosis.symptoms.map((symptom) => (
                      <li key={symptom} className="flex items-start gap-1.5 text-2xs leading-6 text-ink-soft dark:text-white/65">
                        <Leaf size={11} aria-hidden="true" className="mt-1.5 shrink-0 text-brand-600 dark:text-brand-300" />
                        {symptom}
                      </li>
                    ))}
                  </ul>
                )}

                {diagnosis.treatment_advice && (
                  <p className="mt-3 border-t border-line pt-3 text-2xs leading-6 text-ink-soft dark:border-night-line dark:text-white/65">
                    {diagnosis.treatment_advice}
                  </p>
                )}
              </div>

              {/* The disclaimer is the server's sentence, printed in full on
                  every result rather than pushed to a footer. */}
              <p className="flex items-start gap-2 rounded-md border border-gold-200 bg-gold-50 p-3 text-2xs leading-6 text-gold-800 dark:border-night-line dark:bg-night-soft dark:text-gold-500">
                <ShieldAlert size={13} aria-hidden="true" className="mt-1 shrink-0" />
                {diagnosis.disclaimer}
              </p>

              {(diagnosis.suggested_inputs ?? []).length > 0 && (
                <section aria-labelledby="inputs-title">
                  <h3 id="inputs-title" className="text-xs font-extrabold text-ink dark:text-white">
                    نهاده‌های مرتبط
                  </h3>
                  <ul className="mt-2 divide-y divide-line dark:divide-night-line">
                    {(diagnosis.suggested_inputs ?? []).map((input) => (
                      <li key={input.id} className="py-2">
                        <p className="text-2xs font-bold text-ink dark:text-white">
                          {input.name}
                          {input.active_ingredient && (
                            <span className="ms-1 font-normal text-ink-mute dark:text-white/45">
                              ({input.active_ingredient})
                            </span>
                          )}
                        </p>
                        {input.safety_notes && (
                          <p className="mt-0.5 text-[11px] leading-5 text-ink-mute dark:text-white/45">
                            {input.safety_notes}
                          </p>
                        )}
                        {input.preharvest_interval_days != null && (
                          <p className="mt-0.5 text-[11px] text-ink-mute dark:text-white/40">
                            دورهٔ کارنس: {input.preharvest_interval_days.toLocaleString('fa-IR')} روز پیش از برداشت.
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {(diagnosis.suggested_products ?? []).length > 0 && (
                <section aria-labelledby="products-title">
                  <h3 id="products-title" className="text-xs font-extrabold text-ink dark:text-white">
                    از فروشگاه
                  </h3>
                  <ul className="mt-2 flex flex-col gap-2">
                    {(diagnosis.suggested_products ?? []).map((product) => (
                      <li key={product.id}>
                        <Link
                          to={`/product/${product.slug}`}
                          className="flex items-center justify-between gap-2 rounded-md border border-line px-3 py-2 text-2xs hover:border-brand-300 dark:border-night-line dark:hover:border-brand-600"
                        >
                          <span className="truncate font-bold text-ink dark:text-white">{product.title}</span>
                          <span className="dateline shrink-0 text-ink-mute dark:text-white/50">
                            {product.in_stock ? money(product.price) : 'ناموجود'}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <p className="text-2xs leading-6 text-ink-mute dark:text-white/45">
                برای تشخیص دقیق‌تر،{' '}
                <Link
                  to="/farm"
                  className="font-bold text-brand-700 hover:underline dark:text-brand-300"
                >
                  درخواست مشاوره
                </Link>{' '}
                بفرستید و عکس را هم ضمیمه کنید.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
