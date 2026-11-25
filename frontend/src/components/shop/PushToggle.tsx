// frontend/src/components/shop/PushToggle.tsx
//
// Browser push, offered only when the server can actually deliver it.
//
// `webPushApi` was wired to /notifications/webpush/ from the first commit and no
// component ever called it, so a signed-in buyer could not turn notifications on
// from anywhere in the app.
//
// The rule that shapes this file: the endpoint answers `enabled: false` with an
// empty `public_key` when VAPID is not configured (that is the current state of
// this install). A switch that asks for the browser permission and then has
// nowhere to register is worse than no switch — the visitor grants a permission,
// nothing happens, and the prompt is gone for good. So the banner does not
// render at all unless `enabled` is true *and* a key was published.
//
// When it is enabled, the flow is the real one: register the service worker
// (vite-plugin-pwa produces it), subscribe with the VAPID key, and post the
// subscription. Unsubscribing removes the row on the server *and* drops the
// browser subscription, because leaving one without the other means the browser
// keeps a dead endpoint that the server will keep trying.

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff } from 'lucide-react';

import { webPushApi } from '../../api/services';
import { parseApiError } from '../../api/errors';
import Button from '../ui/Button';

/** VAPID keys are base64url; the Push API wants raw bytes. */
function keyToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = window.atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function supported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export default function PushToggle() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ['webpush'],
    queryFn: async () => (await webPushApi.status()).data,
    staleTime: 5 * 60 * 1000,
    // Nothing to ask the server if the browser cannot do it at all.
    enabled: supported(),
  });

  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification === 'undefined' ? 'denied' : Notification.permission,
  );

  // A subscription that exists on the server and in the browser is the only
  // state that delivers anything; if the browser dropped it, say so.
  const subscribed = (status.data?.subscriptions?.length ?? 0) > 0;

  useEffect(() => {
    if (!supported()) return;
    setPermission(Notification.permission);
  }, []);

  const enable = useMutation({
    mutationFn: async () => {
      const key = status.data?.public_key ?? '';
      const granted = await Notification.requestPermission();
      setPermission(granted);
      if (granted !== 'granted') throw new Error('اجازهٔ اعلان داده نشد.');
      if (!key) throw new Error('کلید اعلان از سرور دریافت نشد.');

      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyToUint8Array(key) as BufferSource,
        }));

      return (await webPushApi.subscribe(subscription.toJSON())).data;
    },
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['webpush'] });
    },
    onError: (caught) => setError(parseApiError(caught).message),
  });

  const disable = useMutation({
    mutationFn: async () => {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const id = status.data?.subscriptions?.[0]?.id;
        // Drop the server row first: if unsubscribing in the browser succeeded
        // and the request then failed, the server would keep pushing to a dead
        // endpoint with no way for the user to stop it.
        if (id) await webPushApi.remove(id);
        await subscription.unsubscribe();
      }
    },
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['webpush'] });
    },
    onError: (caught) => setError(parseApiError(caught).message),
  });

  // Not configured on the server, or not possible in this browser: render
  // nothing rather than a switch that cannot work.
  if (!supported() || !status.data?.enabled || !status.data.public_key) return null;

  if (permission === 'denied') {
    return (
      <p className="rounded-md border border-line p-3 text-2xs leading-6 text-ink-mute dark:border-night-line dark:text-white/50">
        <BellOff size={13} aria-hidden="true" className="me-1 inline" />
        اعلان مرورگر برای این سایت مسدود شده است. برای تغییر، از تنظیمات مرورگر خود اجازهٔ اعلان را
        فعال کنید.
      </p>
    );
  }

  return (
    <div className="rounded-md border border-line p-3 dark:border-night-line">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-2xs font-extrabold text-ink dark:text-white">
            <Bell size={13} aria-hidden="true" />
            اعلان وضعیت سفارش
          </p>
          <p className="mt-0.5 text-[11px] leading-5 text-ink-mute dark:text-white/45">
            {subscribed
              ? 'فعال است؛ تغییر وضعیت سفارش و پاسخ گفتگوها را همین‌جا می‌بینید.'
              : 'با روشن‌کردن آن، تغییر وضعیت سفارش را بدون باز کردن سایت ببینید.'}
          </p>
        </div>
        {subscribed ? (
          <Button variant="secondary" size="sm" onClick={() => disable.mutate()} loading={disable.isPending}>
            خاموش کردن
          </Button>
        ) : (
          <Button size="sm" onClick={() => enable.mutate()} loading={enable.isPending}>
            روشن کردن
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-2xs font-bold text-danger-700">
          {error}
        </p>
      )}
    </div>
  );
}
