/* Web Push event handlers imported by the Workbox-generated service worker. */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_error) {
    payload = { body: event.data ? event.data.text() : '' };
  }
  const title = String(payload.title || 'گرین کود').slice(0, 120);
  let target = '/orders';
  try {
    const candidate = new URL(String(payload.url || '/orders'), self.location.origin);
    if (candidate.origin === self.location.origin) target = `${candidate.pathname}${candidate.search}`;
  } catch (_error) {
    // Keep the same-origin fallback.
  }
  event.waitUntil(self.registration.showNotification(title, {
    body: String(payload.body || '').slice(0, 500),
    icon: '/images/icon-192.png',
    badge: '/images/icon-192.png',
    tag: String(payload.tag || 'garinkood-update').slice(0, 120),
    renotify: true,
    data: { url: target },
    dir: 'rtl',
    lang: 'fa-IR',
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/orders', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
    for (const client of clients) {
      if ('navigate' in client) await client.navigate(target);
      if ('focus' in client) return client.focus();
    }
    return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
  }));
});
