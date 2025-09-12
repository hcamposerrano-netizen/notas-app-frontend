// =================================================================
// 🚀 SERVICE WORKER PARA NOTAS APP - VERSIÓN 6.0 (SOLO PUSH REAL)
// =================================================================

// --- 1. CONFIGURACIÓN DE CACHÉ ---
const STATIC_CACHE_NAME = 'notas-app-static-cache-v11';
const DYNAMIC_CACHE_NAME = 'notas-app-dynamic-cache-v9';
const APP_SHELL_FILES = [
  '/', '/index.html', '/style.css', '/app.js', '/editor-modal.js',
  '/calendar-view.js', '/filter-type.js', '/Search-notes.js',
  '/ui-interactions.js', '/manifest.json', '/push-manager.js' // Añade push-manager al caché
];

// --- 2. CICLO DE VIDA DEL SERVICE WORKER ---
self.addEventListener('install', event => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then(cache => cache.addAll(APP_SHELL_FILES))
    .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activando...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys
        .filter(key => key !== STATIC_CACHE_NAME && key !== DYNAMIC_CACHE_NAME)
        .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// --- 3. MANEJO DE NOTIFICACIONES PUSH RECIBIDAS DEL SERVIDOR ---
self.addEventListener('push', event => {
  console.log('[SW] ¡Evento Push recibido!');

  let pushData = {
      title: 'Nuevo Recordatorio',
      body: 'Algo importante requiere tu atención.'
  };

  try {
    if (event.data) {
      pushData = event.data.json(); // Esperamos que el backend envíe un JSON
    }
  } catch (e) {
      console.error('[SW] Error al parsear los datos del push:', e);
  }

  const options = {
    body: pushData.body,
    icon: '/icons/android-chrome-192x192.png',
    badge: '/icons/android-chrome-192x192.png' // Icono para la barra de notificaciones en Android
  };

  event.waitUntil(
    self.registration.showNotification(pushData.title, options)
  );
});

// --- 4. MANEJO DEL CLICK EN LA NOTIFICACIÓN ---
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
        if (clientList.length > 0) {
            let client = clientList[0];
            for (let i = 0; i < clientList.length; i++) {
                if (clientList[i].focused) client = clientList[i];
            }
            return client.focus();
        }
        return clients.openWindow('/');
    }));
});

// --- 5. ESTRATEGIA DE CACHÉ (NETWORK FIRST PARA LA API) ---
self.addEventListener('fetch', event => {
    // Para las llamadas a la API, siempre intentamos ir a la red primero.
    if (event.request.url.includes('/api/')) {
        event.respondWith(
            fetch(event.request).catch(() => {
                // Podrías devolver una respuesta de error genérica en JSON si falla
                return new Response(JSON.stringify({ error: "Sin conexión" }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    // Para todo lo demás (el App Shell), usamos la estrategia Cache First.
    event.respondWith(
        caches.match(event.request).then(responseFromCache => {
            return responseFromCache || fetch(event.request).then(networkResponse => {
                // Solo cacheamos peticiones GET exitosas
                if (networkResponse.status === 200 && networkResponse.type === 'basic') {
                    return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                }
                return networkResponse;
            });
        })
    );
});