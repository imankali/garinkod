import {
  BadgeCheck,
  CreditCard,
  MapPin,
  ShoppingBasket,
  Store,
  type LucideIcon,
} from "lucide-react";

import { cn } from "../utils/cn";

export type PurchaseStep = "store" | "cart" | "details" | "payment" | "complete";

interface StepDefinition {
  key: PurchaseStep;
  label: string;
  icon: LucideIcon;
}

interface PurchaseStepsProps {
  currentStep: PurchaseStep;
  /** Marks the last stage as finished after the order has been created. */
  completed?: boolean;
  /** A shorter version for narrow surfaces such as the cart drawer. */
  compact?: boolean;
  className?: string;
}

const STEPS: StepDefinition[] = [
  { key: "store", label: "فروشگاه", icon: Store },
  { key: "cart", label: "سبد خرید", icon: ShoppingBasket },
  { key: "details", label: "اطلاعات", icon: MapPin },
  { key: "payment", label: "پرداخت", icon: CreditCard },
  { key: "complete", label: "تکمیل", icon: BadgeCheck },
];

/**
 * Five-stage purchase tracker based on the supplied visual reference. The
 * layout follows reading direction automatically, so the journey starts on
 * the right in Persian and on the left in LTR locales.
 */
export default function PurchaseSteps({
  currentStep,
  completed = false,
  compact = false,
  className,
}: PurchaseStepsProps) {
  const currentIndex = Math.max(
    0,
    STEPS.findIndex((step) => step.key === currentStep),
  );
  const current = STEPS[currentIndex] ?? STEPS[0]!;
  const connectorProgress = (currentIndex / (STEPS.length - 1)) * 100;
  const progressText = completed
    ? "تمام مراحل خرید تکمیل شده است"
    : `مرحله ${currentIndex + 1} از ${STEPS.length}: ${current.label}`;

  return (
    <nav
      aria-label="مراحل خرید"
      className={cn(
        "relative overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-emerald-800 dark:bg-emerald-950",
        compact ? "px-2 py-3" : "px-3 py-5 sm:px-8 sm:py-6",
        className,
      )}
    >
      <span
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={completed ? STEPS.length : currentIndex + 1}
        aria-valuetext={progressText}
        className="sr-only"
      >
        {progressText}
      </span>

      <div className="relative">
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-x-[10%] rounded-full bg-slate-100 dark:bg-emerald-900",
            compact ? "top-[19px] h-0.5" : "top-[23px] h-0.5 sm:top-[27px]",
          )}
        >
          <span
            className="absolute inset-y-0 start-0 rounded-full bg-gradient-to-l from-emerald-600 to-lime-500 transition-[inline-size] duration-500 motion-reduce:transition-none"
            style={{ inlineSize: `${connectorProgress}%` }}
          />
        </div>

        <ol className="relative grid grid-cols-5">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isCurrent = index === currentIndex;
            const isDone = index < currentIndex || (completed && isCurrent);
            const stateLabel = isDone
              ? "تکمیل‌شده"
              : isCurrent
                ? "مرحله فعلی"
                : "در انتظار";

            return (
              <li
                key={step.key}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`${step.label}، ${stateLabel}`}
                className="relative flex min-w-0 flex-col items-center text-center"
              >
                <span
                  aria-hidden="true"
                  className="relative z-10 rounded-2xl bg-white p-1 dark:bg-emerald-950"
                >
                  <span
                    className={cn(
                      "flex items-center justify-center rounded-xl border transition-all duration-300 motion-reduce:transition-none",
                      compact ? "h-8 w-8" : "h-10 w-10 sm:h-12 sm:w-12",
                      isCurrent &&
                        "border-emerald-600 bg-gradient-to-br from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-200 ring-4 ring-emerald-50 dark:shadow-none dark:ring-emerald-900",
                      isDone &&
                        !isCurrent &&
                        "border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-700 dark:bg-emerald-900 dark:text-lime-300",
                      !isCurrent &&
                        !isDone &&
                        "border-slate-100 bg-slate-50 text-slate-300 dark:border-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-700",
                    )}
                  >
                    <Icon size={compact ? 15 : 19} strokeWidth={isCurrent ? 2.5 : 2} />
                  </span>
                </span>

                <span
                  className={cn(
                    "mt-1.5 max-w-full px-0.5 font-bold leading-5 sm:mt-2",
                    compact ? "text-fluid-2xs" : "text-fluid-2xs sm:text-sm",
                    isCurrent
                      ? "text-emerald-700 dark:text-lime-300"
                      : isDone
                        ? "text-slate-700 dark:text-emerald-100"
                        : "text-slate-400 dark:text-emerald-500",
                  )}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
