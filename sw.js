// ══════════════════════════════════════════════════════
//  ÖDEME TAKİP SİSTEMİ — Service Worker v1.0
//  PWA offline desteği + Push bildirimleri
// ══════════════════════════════════════════════════════

const CACHE_NAME = 'ots-cache-v1';
const CACHE_URLS = ['./'];

// ── INSTALL: Temel dosyaları önbelleğe al ──
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHE_URLS))
      .catch(() => {}) // Offline install'da hata olabilir, ignore
  );
});

// ── ACTIVATE: Eski önbellekleri temizle ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: Network-first, fallback cache ──
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // Supabase / CDN isteklerini cache'leme
  const url = new URL(event.request.url);
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('jsdelivr.net') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('emailjs.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => cache.put(event.request, responseClone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── PUSH: Arka planda bildirim göster ──
self.addEventListener('push', event => {
  let data = { title: 'Ödeme Takip', body: 'Yeni bildirim var.', url: './' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {}

  const options = {
    body: data.body,
    icon: './icon.svg',
    badge: './icon.svg',
    vibrate: [200, 100, 200],
    tag: 'ots-push',
    renotify: true,
    requireInteraction: false,
    data: { url: data.url },
    actions: [
      { action: 'open', title: '👁 Görüntüle' },
      { action: 'dismiss', title: 'Kapat' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── NOTIFICATION CLICK: Uygulamayı aç ──
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Zaten açık pencere varsa focus ver
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            return;
          }
        }
        // Yoksa yeni pencere aç
        return clients.openWindow(targetUrl);
      })
  );
});

// ── MESSAGE: Ana sayfadan mesaj al ──
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
