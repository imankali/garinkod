import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

import { featureFlagsApi } from '../api/services';

const CONSENT_KEY = 'garinkood.analytics-consent.v1';
const SCRIPT_ID = 'garinkood-privacy-analytics';

type Consent = 'granted' | 'denied' | null;
type PlausibleOptions = { u?: string };
type PlausibleFunction = ((event: string, options?: PlausibleOptions) => void) & {
  q?: Array<[string, PlausibleOptions?]>;
};

declare global {
  interface Window {
    plausible?: PlausibleFunction;
  }
}

function storedConsent(): Consent {
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

/** Loads optional, cookieless aggregate analytics only after explicit consent. */
export default function PrivacyAnalytics() {
  const location = useLocation();
  const [consent, setConsent] = useState<Consent>(storedConsent);
  const [scriptReady, setScriptReady] = useState(false);
  const domain = import.meta.env.VITE_ANALYTICS_DOMAIN?.trim();
  const configuredSource = import.meta.env.VITE_ANALYTICS_SCRIPT_URL?.trim();
  const source = useMemo(() => {
    if (!configuredSource) return null;
    try {
      const parsed = new URL(configuredSource);
      return parsed.protocol === 'https:' ? parsed.toString() : null;
    } catch {
      return null;
    }
  }, [configuredSource]);

  const { data: decision } = useQuery({
    queryKey: ['feature-flag', 'privacy_analytics'],
    queryFn: async () => (await featureFlagsApi.get()).data.flags.privacy_analytics ?? false,
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: Boolean(domain && source),
  });
  const enabled = Boolean(domain && source && decision);

  useEffect(() => {
    const reopen = () => setConsent(null);
    window.addEventListener('garinkood:privacy-settings', reopen);
    return () => window.removeEventListener('garinkood:privacy-settings', reopen);
  }, []);

  useEffect(() => {
    if (!enabled || consent !== 'granted' || !source || !domain) {
      document.getElementById(SCRIPT_ID)?.remove();
      setScriptReady(false);
      return;
    }

    // Queue calls made while the provider script is loading.
    if (!window.plausible) {
      const queue: PlausibleFunction = (event, options) => {
        queue.q = queue.q || [];
        queue.q.push([event, options]);
      };
      window.plausible = queue;
    }
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.defer = true;
      script.src = source;
      script.dataset.domain = domain;
      script.addEventListener('load', () => setScriptReady(true), { once: true });
      document.head.appendChild(script);
    } else {
      setScriptReady(true);
    }
  }, [consent, domain, enabled, source]);

  useEffect(() => {
    if (!enabled || consent !== 'granted' || !scriptReady) return;
    // Never send search terms, order codes or other query/hash values.
    const pageUrl = new URL(location.pathname, window.location.origin).href;
    window.plausible?.('pageview', { u: pageUrl });
  }, [consent, enabled, location.pathname, scriptReady]);

  const choose = (value: Exclude<Consent, null>) => {
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
    } catch {
      // The in-memory choice still applies when storage is blocked.
    }
    setConsent(value);
  };

  if (!enabled || consent !== null) return null;

  return (
    <aside
      role="region"
      aria-labelledby="privacy-consent-title"
      className="fixed inset-x-3 bottom-[calc(var(--mobile-nav-clearance)+0.75rem)] z-[90] mx-auto max-w-3xl rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xl dark:border-emerald-800 dark:bg-emerald-950 sm:bottom-5 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id="privacy-consent-title" className="font-extrabold text-slate-800 dark:text-white">آمار بازدید با انتخاب شما</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-emerald-100">
            با اجازه شما، آمار کلی و بدون تبلیغات را برای بهبود سایت ثبت می‌کنیم. رد کردن این گزینه هیچ بخشی از خدمات را محدود نمی‌کند.{' '}
            <Link to="/privacy" className="font-bold text-emerald-700 underline dark:text-lime-300">جزئیات حریم خصوصی</Link>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => choose('granted')} className="min-h-11 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-700">اجازه می‌دهم</button>
            <button type="button" onClick={() => choose('denied')} className="min-h-11 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-emerald-700 dark:text-white dark:hover:bg-emerald-900">فعلاً نه</button>
          </div>
        </div>
      </div>
    </aside>
  );
}
