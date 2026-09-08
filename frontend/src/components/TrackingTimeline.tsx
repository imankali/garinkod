import {
  AlertTriangle,
  BadgeCheck,
  Clock,
  MapPin,
  PackageCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";

import type { LogisticsShipmentStatus, ShipmentEvent } from "../types/logistics";
import { cn } from "../utils/cn";

interface StatusMeta {
  /** Local fallback when the API label is missing for any reason. */
  label: string;
  icon: LucideIcon;
  badgeClass: string;
  dotClass: string;
}

const STATUS_META: Record<LogisticsShipmentStatus, StatusMeta> = {
  pending: {
    label: "در انتظار پذیرش",
    icon: Clock,
    badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    dotClass: "border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-300",
  },
  picked_up: {
    label: "تحویل به حامل شد",
    icon: PackageCheck,
    badgeClass: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
    dotClass: "border-sky-300 text-sky-600 dark:border-sky-600 dark:text-sky-300",
  },
  in_transit: {
    label: "در مسیر",
    icon: Truck,
    badgeClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
    dotClass: "border-indigo-300 text-indigo-600 dark:border-indigo-600 dark:text-indigo-300",
  },
  out_for_delivery: {
    label: "در حال توزیع",
    icon: MapPin,
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    dotClass: "border-amber-300 text-amber-600 dark:border-amber-600 dark:text-amber-300",
  },
  delivered: {
    label: "تحویل داده شد",
    icon: BadgeCheck,
    badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    dotClass: "border-emerald-300 text-emerald-600 dark:border-emerald-600 dark:text-emerald-300",
  },
  failed: {
    label: "تحویل ناموفق",
    icon: AlertTriangle,
    badgeClass: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
    dotClass: "border-rose-300 text-rose-600 dark:border-rose-600 dark:text-rose-300",
  },
};

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" });
}

export interface TrackingTimelineProps {
  /** Tracking hops as served by the logistics API: newest event first. */
  events: ShipmentEvent[];
  /** Optional card heading, for example the shipment tracking code. */
  heading?: string;
  className?: string;
}

/**
 * Vertical shipment timeline for the logistics module. The API already
 * delivers events newest-first, so the first row renders as the current
 * state with an emphasized marker; older hops follow down the line. Logical
 * CSS properties (ps/start) keep the rail on the correct side in both RTL
 * and LTR contexts.
 */
export default function TrackingTimeline({
  events,
  heading,
  className,
}: TrackingTimelineProps) {
  return (
    <section
      aria-label="خط زمانی رهگیری مرسوله"
      className={cn(
        "rounded-3xl border border-slate-100 bg-white px-4 py-5 shadow-sm dark:border-emerald-800 dark:bg-emerald-950",
        className,
      )}
    >
      {heading ? (
        <h3 className="mb-4 text-base font-bold text-slate-900 dark:text-emerald-50">
          {heading}
        </h3>
      ) : null}

      {events.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-emerald-200/70">
          هنوز رویدادی برای این مرسوله ثبت نشده است.
        </p>
      ) : (
        <ol className="space-y-6">
          {events.map((event, index) => {
            const meta = STATUS_META[event.status] ?? STATUS_META.pending;
            const Icon = meta.icon;
            const isCurrent = index === 0;
            const hasNext = index < events.length - 1;
            return (
              <li key={event.id} className="relative ps-12">
                {hasNext ? (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-6 start-[15px] top-8 border-s-2 border-slate-200 dark:border-emerald-800"
                  />
                ) : null}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute start-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white dark:bg-emerald-950",
                    meta.dotClass,
                    isCurrent && "ring-4 ring-emerald-100 dark:ring-emerald-900",
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.2} />
                </span>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      meta.badgeClass,
                    )}
                  >
                    {event.status_label || meta.label}
                  </span>
                  {event.location ? (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-emerald-200/70">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      {event.location}
                    </span>
                  ) : null}
                  <time
                    dateTime={event.timestamp}
                    className="text-xs text-slate-400 dark:text-emerald-200/60"
                  >
                    {formatTimestamp(event.timestamp)}
                  </time>
                </div>

                <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-emerald-100">
                  {event.description}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
