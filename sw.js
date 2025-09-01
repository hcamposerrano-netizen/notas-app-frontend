// Aumentamos la versión del caché para forzar una actualización
const STATIC_CACHE_NAME = 'notas-app-static-cache-v5';
const DYNAMIC_CACHE_NAME = 'notas-app-dynamic-cache-v3';

const APP_SHELL_FILES = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/editor-modal.js',
  '/calendar-view.js',
  '/filter-type.js',
  '/search-notes.js',
  '/ui-interactions.js',
  '/manifest.json',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/icons/android-chrome-192x192.png',
  '/icons/android-chrome-512x512.png'
];

// 1. Evento 'install': Cacheamos el App Shell.
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then(cache => {
      console.log('Cache estático abierto, guardando App Shell.');
      return cache.addAll(APP_SHELL_FILES);
    }).then(() => self.skipWaiting()) // Forzar la activación del nuevo SW
  );
});

// 2. Evento 'activate': Limpiamos cachés antiguos.
self.addEventListener('activate', event => {
  console.log('Service Worker: Activando...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys
        .filter(key => key !== STATIC_CACHE_NAME && key !== DYNAMIC_CACHE_NAME)
        .map(key => caches.delete(key))
      );
    }).then(() => {
        console.log('Cachés antiguos eliminados.');
        return self.clients.claim(); // Tomar control inmediato de la página
    })
  );
});

// ==============================================================
// ✨ LÓGICA DE NOTIFICACIONES
// ==============================================================

// Almacenamos los IDs de los timeouts para poder cancelarlos
const scheduledTimeouts = {};

// Función para cancelar cualquier notificación programada para una nota
function cancelScheduled(noteId) {
    if (scheduledTimeouts[noteId] && scheduledTimeouts[noteId].length) {
        console.log(`Cancelando ${scheduledTimeouts[noteId].length} notificaciones para la nota ${noteId}`);
        scheduledTimeouts[noteId].forEach(timeoutId => clearTimeout(timeoutId));
        delete scheduledTimeouts[noteId];
    }
}

// Función para mostrar la notificación
function mostrarNotificacion(note, tiempo) {
    const options = {
        body: `Tu nota "${note.nombre || '(Sin Título)'}" vence en ${tiempo}.`,
        icon: '/icons/android-chrome-192x192.png',
        badge: '/icons/android-chrome-192x192.png',
        vibrate: [200, 100, 200],
        tag: `nota-${note.id}` // Usamos un tag para poder reemplazar notificaciones si es necesario
    };
    // self.registration es una promesa, así que la resolvemos para usar showNotification
    self.registration.showNotification('Recordatorio de Nota', options);
}

// ✅ PEGA ESTA VERSIÓN MEJORADA EN sw.js

// Escuchamos los mensajes de la aplicación principal (app.js)
self.addEventListener('message', event => {
    const data = event.data;

    if (!data) return;

    if (data.type === 'SCHEDULE_NOTIFICATION') {
        const note = data.payload;
        const dueDate = new Date(note.fecha_hora);

        // --- INICIO DE NUESTROS ESPÍAS ---
        console.log(`[SW] Mensaje 'SCHEDULE_NOTIFICATION' recibido para: "${note.nombre}"`);
        console.log(`[SW] La fecha/hora de la nota es: ${dueDate.toLocaleString()}`);
        // --- FIN DE NUESTROS ESPÍAS ---

        cancelScheduled(note.id);
        
        // (Si estás probando, usa los intervalos de segundos. Si no, los de horas/días)
        const intervals = {
            "15 segundos": 15 * 1000,
            "10 segundos": 10 * 1000,
            "5 segundos": 5 * 1000
        };
        
        scheduledTimeouts[note.id] = [];

        Object.entries(intervals).forEach(([label, interval]) => {
            const notificationTime = dueDate.getTime() - interval;
            const now = Date.now();
            const delay = notificationTime - now;

            // --- MÁS ESPÍAS PARA VER EL CÁLCULO ---
            console.log(`[SW] Verificando intervalo: "${label}"`);
            console.log(`   - Hora de notificación calculada: ${new Date(notificationTime).toLocaleString()}`);
            console.log(`   - Hora actual: ${new Date(now).toLocaleString()}`);
            console.log(`   - Retraso a programar (delay): ${delay} ms`);
            // --- FIN DE LOS ESPÍAS DE CÁLCULO ---

            if (delay > 0) {
                console.log(`   ✅ PROGRAMANDO notificación para "${label}" en ${delay} ms.`);
                const timeoutId = setTimeout(() => {
                    console.log(`[SW] ¡EJECUTANDO! Mostrando notificación para "${label}".`);
                    mostrarNotificacion(note, label);
                }, delay);
                scheduledTimeouts[note.id].push(timeoutId);
            } else {
                console.log(`   ❌ OMITIDO: La hora de notificación para "${label}" ya pasó.`);
            }
        });
    }

    if (data.type === 'CANCEL_NOTIFICATION') {
        const noteId = data.payload.id;
        console.log(`[SW] Mensaje 'CANCEL_NOTIFICATION' recibido para la nota ID: ${noteId}`);
        cancelScheduled(noteId);
    }
});


// 3. Evento 'fetch': Interceptamos peticiones de red para modo offline.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Estrategia para API: Network First, fallback to Cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).then(networkResponse => {
        return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      }).catch(() => {
        return caches.match(event.request);
      })
    );
  } 
  // Estrategia para el resto: Cache First, fallback to Network
  else {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
  }
});