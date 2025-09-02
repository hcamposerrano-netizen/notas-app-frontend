// =================================================================
// 🚀 SERVICE WORKER PARA NOTAS APP - VERSIÓN CON NOTIFICACIONES ROBUSTAS
// =================================================================

// --- 1. CONFIGURACIÓN DE CACHÉ ---
const STATIC_CACHE_NAME = 'notas-app-static-cache-v8'; // Incrementa la versión para forzar actualización
const DYNAMIC_CACHE_NAME = 'notas-app-dynamic-cache-v6';
const APP_SHELL_FILES = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/editor-modal.js',
  '/calendar-view.js',
  '/filter-type.js',
  '/Search-notes.js',
  '/ui-interactions.js',
  '/manifest.json'
];

// --- 2. CICLO DE VIDA DEL SERVICE WORKER ---
self.addEventListener('install', event => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then(cache => {
      console.log('[SW] Cache estático abierto. Guardando App Shell...');
      return cache.addAll(APP_SHELL_FILES);
    }).then(() => self.skipWaiting())
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

// --- 3. LÓGICA DE NOTIFICACIONES (MÉTODO ROBUSTO) ---

// Función para cancelar todas las notificaciones programadas para una nota
async function cancelScheduledNotifications(noteId) {
    const notifications = await self.registration.getNotifications({ tag: `nota-${noteId}` });
    notifications.forEach(notification => notification.close());
    console.log(`[SW] Notificaciones existentes para la nota ${noteId} han sido canceladas.`);
}

// Función para programar las notificaciones usando el despertador del sistema
async function scheduleNotifications(note) {
    const dueDate = new Date(note.fecha_hora);
    console.log(`[SW] Comando 'SCHEDULE_NOTIFICATION' recibido para: "${note.nombre}"`);
    console.log(`[SW] Vence el (UTC): ${dueDate.toISOString()}`);
    
    // Primero, cancelamos cualquier notificación vieja para esta nota
    await cancelScheduledNotifications(note.id);

    // --- INTERVALOS DE TIEMPO ---
    // Puedes cambiar entre estos bloques para probar
    const intervals = {
        "2 días": 2 * 24 * 60 * 60 * 1000,
        "24 horas": 24 * 60 * 60 * 1000,
        "4 horas": 4 * 60 * 60 * 1000
    };
    /*
    const intervals = {
        "2 minutos antes": 2 * 60 * 1000,
        "1 minuto antes": 1 * 60 * 1000,
        "30 segundos antes": 30 * 1000
    };
    */

    Object.entries(intervals).forEach(([label, interval]) => {
        const notificationTime = dueDate.getTime() - interval;
        const now = Date.now();
        
        if (notificationTime > now) {
            console.log(`[SW] ✅ PROGRAMANDO notificación de "${label}" para la nota ${note.id}`);
            
            // Este es el "despertador". Le decimos al sistema:
            // "Cuando llegue el momento 'notificationTime', muéstrame esta notificación".
            // El sistema operativo se encarga de todo.
            self.registration.showNotification('Recordatorio de Nota', {
                tag: `nota-${note.id}`, // ¡MUY IMPORTANTE! Agrupa todas las notificaciones de esta nota.
                body: `Tu nota "${note.nombre || '(Sin Título)'}" vence en ${label}.`,
                icon: '/icons/android-chrome-192x192.png',
                badge: '/icons/android-chrome-192x192.png',
                vibrate: [200, 100, 200],
                showTrigger: new TimestampTrigger(notificationTime), // El despertador oficial
                data: { // Datos extra por si el usuario hace clic
                    noteId: note.id
                }
            });
        } else {
            console.log(`[SW] ❌ OMITIDO: La hora de notificación para "${label}" ya pasó.`);
        }
    });
}

self.addEventListener('message', event => {
    const data = event.data;
    if (!data) return;

    if (data.type === 'SCHEDULE_NOTIFICATION') {
        scheduleNotifications(data.payload);
    }

    if (data.type === 'CANCEL_NOTIFICATION') {
        cancelScheduledNotifications(data.payload.id);
    }
});

// Evento que se dispara cuando el usuario hace clic en una notificación
self.addEventListener('notificationclick', event => {
    event.notification.close(); // Cierra la notificación
    
    // Intenta abrir la ventana de la aplicación
    event.waitUntil(clients.matchAll({ type: 'window' }).then(clientList => {
        // Si ya hay una ventana abierta, la enfoca
        for (const client of clientList) {
            if (client.url === '/' && 'focus' in client) {
                return client.focus();
            }
        }
        // Si no hay ninguna ventana abierta, abre una nueva
        if (clients.openWindow) {
            return clients.openWindow('/');
        }
    }));
});

// --- 4. ESTRATEGIAS DE RED Y CACHÉ (FETCH) ---
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).then(networkResponse => {
        return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
          if (event.request.method === 'GET') {
            cache.put(event.request.url, networkResponse.clone());
          }
          return networkResponse;
        });
      }).catch(() => {
        return caches.match(event.request.url);
      })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(responseFromCache => {
        return responseFromCache || fetch(event.request);
      })
    );
  }
});