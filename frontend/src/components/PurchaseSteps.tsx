import {
  Check,
  ClipboardCheck,
  MapPin,
  ShieldCheck,
  ShoppingBasket,
  type LucideIcon,
} from "lucide-react";

import { cn } from "../utils/cn";

export type PurchaseStep = "cart" | "delivery" | "confirmation";

interface StepDefinition {
  key: PurchaseStep;
  label: string;
  description: string;
  icon: LucideIcon;
}

interface PurchaseStepsProps {
  currentStep: PurchaseStep;
  /** Marks the final stage as finished after the order has been created. */
  completed?: boolean;
  /** A shorter version for narrow surfaces such as the cart drawer. */
  compact?: boolean;
  className?: string;
}

const STEPS: StepDefinition[] = [
  {
    key: "cart",
    label: "سبد خرید",
    description: "بررسی کالاها",
    icon: ShoppingBasket,
  },
  {
    key: "delivery",
    label: "اطلاعات تحویل",
    description: "نشانی و روش پرداخت",
    icon: MapPin,
  },
  {
    key: "confirmation",
    label: "ثبت و پیگیری",
    description: "دریافت کد سفارش",
    icon: ClipboardCheck,
  },
];

/**
 * Responsive, RTL-safe checkout progress indicator shared by the cart,
 * checkout form and order-success state.
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
  const connectorProgress = completed
    ? 100
    : (currentIndex / (STEPS.length - 1)) * 100;
  const current = STEPS[currentIndex] ?? STEPS[0]!;
  const progressText = completed
    ? "هر سه مرحله خرید تکمیل شده است"
    : `مرحله ${currentIndex + 1} از ${STEPS.length}: ${current.label}`;

  return (
    <nav
      aria-label="مراحل خرید"
      className={cn(
        "relative overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm dark:border-emerald-800 dark:bg-emerald-950",
        compact ? "px-3 py-3" : "px-4 py-4 sm:px-6 sm:py-5",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -end-10 -top-14 h-32 w-32 rounded-full bg-lime-200/30 blur-2xl dark:bg-lime-500/10"
      />

      <div
        className={cn(
          "relative flex items-center justify-between gap-3",
          compact && "mb-1",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "flex shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-900 dark:text-lime-300",
              compact ? "h-8 w-8" : "h-10 w-10",
            )}
          >
            <ShieldCheck size={compact ? 17 : 20} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p
              className={cn(
                "font-extrabold text-slate-800 dark:text-white",
                compact ? "text-xs" : "text-sm",
              )}
            >
              {completed ? "سفارش با موفقیت ثبت شد" : "خرید آسان و مطمئن"}
            </p>
            {!compact && (
              <p className="mt-0.5 text-fluid-xs text-slate-500 dark:text-emerald-200">
                تا ثبت سفارش همراه شما هستیم
              </p>
            )}
          </div>
        </div>
        <span
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={completed ? STEPS.length : currentIndex + 1}
          aria-valuetext={progressText}
          className={cn(
            "shrink-0 rounded-full bg-emerald-50 font-bold text-emerald-700 dark:bg-emerald-900 dark:text-lime-300",
            compact ? "px-2 py-1 text-fluid-2xs" : "px-3 py-1.5 text-fluid-xs",
          )}
        >
          {completed ? "تکمیل شد" : `${currentIndex + 1} از ${STEPS.length}`}
        </span>
      </div>

      <div className={cn("relative", compact ? "mt-3" : "mt-5")}>
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-x-[16.666%] rounded-full bg-slate-100 dark:bg-emerald-900",
            compact ? "top-[15px] h-0.5" : "top-[18px] h-1",
          )}
        >
          <span
            className="absolute inset-y-0 start-0 rounded-full bg-gradient-to-l from-emerald-600 to-lime-500 transition-[inline-size] duration-500 motion-reduce:transition-none"
            style={{ inlineSize: `${connectorProgress}%` }}
          />
        </div>

        <ol className="relative grid grid-cols-3">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isCurrent = index === currentIndex;
            const isDone =
              index < currentIndex || (completed && index <= currentIndex);
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
                  className={cn(
                    "relative z-10 flex items-center justify-center rounded-full border-2 transition-colors",
                    compact ? "h-8 w-8" : "h-10 w-10",
                    isDone &&
                      "border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-200 dark:shadow-none",
                    isCurrent &&
                      !isDone &&
                      "border-emerald-600 bg-white text-emerald-700 ring-4 ring-emerald-50 dark:bg-emerald-950 dark:text-lime-300 dark:ring-emerald-900",
                    !isCurrent &&
                      !isDone &&
                      "border-slate-200 bg-white text-slate-400 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-500",
                  )}
                >
                  {isDone ? (
                    <Check size={compact ? 15 : 18} strokeWidth={3} />
                  ) : (
                    <Icon size={compact ? 14 : 17} />
                  )}
                </span>
                <span
                  className={cn(
                    "mt-2 max-w-full px-1 font-extrabold leading-5",
                    compact ? "text-fluid-2xs" : "text-fluid-xs sm:text-sm",
                    isCurrent || isDone
                      ? "text-emerald-800 dark:text-lime-200"
                      : "text-slate-400 dark:text-emerald-500",
                  )}
                >
                  {step.label}
                </span>
                {!compact && (
                  <span className="mt-0.5 hidden text-fluid-xs text-slate-400 dark:text-emerald-400 sm:block">
                    {step.description}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
