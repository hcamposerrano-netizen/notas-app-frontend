// =================================================================
// 🚀 SERVICE WORKER PARA NOTAS APP - VERSIÓN PUSH
// =================================================================

// --- 1. CONFIGURACIÓN DE CACHÉ ---
const STATIC_CACHE_NAME = 'notas-app-static-cache-v13';
const DYNAMIC_CACHE_NAME = 'notas-app-dynamic-cache-v11';
// ✅ AÑADIDO: el nuevo script a la lista de caché
const APP_SHELL_FILES = [
  '/', '/index.html', '/style.css', '/app.js', '/push-manager.js',
  '/editor-modal.js', '/calendar-view.js', '/filter-type.js', 
  '/Search-notes.js', '/ui-interactions.js', '/manifest.json'
];

// ❌ ELIMINADO: Toda la configuración y funciones de IndexedDB (`openDb`, etc.)

// --- 3. CICLO DE VIDA DEL SERVICE WORKER (Simplificado) ---
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

// --- 4. 🔄 LÓGICA DE NOTIFICACIONES REEMPLAZADA ---
// ❌ ELIMINADO: `checkAndFireNotifications`, `scheduleNotifications`, `cancelScheduledNotifications`, y el listener de `message`.

// ✅ AÑADIDO: El nuevo listener para el evento 'push' que viene del servidor.
self.addEventListener('push', event => {
  console.log('[SW] Notificación Push recibida.');
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

// Se mantiene igual: abre la app al hacer clic en la notificación
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
        for (const client of clientList) {
            if (client.url === '/' && 'focus' in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow('/');
    }));
});

// --- 5. ESTRATEGIA DE CACHÉ (Sin cambios) ---
self.addEventListener('fetch', event => {
    if (!event.request.url.startsWith('http')) {
        return;
    }
    if (event.request.url.includes('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }
    event.respondWith(
        caches.match(event.request).then(responseFromCache => {
            return responseFromCache || fetch(event.request).then(networkResponse => {
                if (!event.request.url.startsWith('http')) {
                    return networkResponse;
                }
                return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            });
        }).catch(() => {
            // Fallback
        })
    );
});