// =================================================================
// 🚀 SERVICE WORKER PARA NOTAS APP - VERSIÓN PUSH
// =================================================================

const STATIC_CACHE_NAME = 'notas-app-static-cache-v13';
const DYNAMIC_CACHE_NAME = 'notas-app-dynamic-cache-v11';
const APP_SHELL_FILES = [
  '/', '/index.html', '/style.css', '/app.js', '/push-manager.js',
  '/editor-modal.js', '/calendar-view.js', '/filter-type.js', 
  '/Search-notes.js', '/ui-interactions.js', '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then(cache => cache.addAll(APP_SHELL_FILES))
    .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys
        .filter(key => key !== STATIC_CACHE_NAME && key !== DYNAMIC_CACHE_NAME)
        .map(key => caches.delete(key))
      ).then(() => self.clients.claim());
    })
  );
});

self.addEventListener('push', event => {
  console.log('[SW] ¡Notificación Push recibida del servidor!');
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icons/android-chrome-192x192.png',
    badge: '/icons/android-chrome-192x192.png'
  };
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
        for (const client of clientList) {
            if (client.url === '/' && 'focus' in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow('/');
    }));
});

self.addEventListener('fetch', event => {
    if (!event.request.url.startsWith('http')) {
        return;
    }
    if (event.request.url.includes('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request).then(fetchRes => {
                return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                    cache.put(event.request.url, fetchRes.clone());
                    return fetchRes;
                });
            });
        })
    );
});