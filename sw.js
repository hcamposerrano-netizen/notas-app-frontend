// =================================================================
// 🚀 SERVICE WORKER COMPLETO PARA NOTAS APP - VERSIÓN FINAL CORREGIDA
// =================================================================

// --- 1. CONFIGURACIÓN DE CACHÉ ---

// Se aumenta la versión para forzar la actualización del Service Worker.
const STATIC_CACHE_NAME = 'notas-app-static-cache-v7';
const DYNAMIC_CACHE_NAME = 'notas-app-dynamic-cache-v5';

// ✅ CORREGIDO: Lista de archivos esenciales que SÍ existen en el proyecto.
// Se han eliminado los archivos de íconos que daban error 404.
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
    }).then(() => {
      console.log('[SW] App Shell cacheado con éxito. Forzando activación.');
      return self.skipWaiting();
    })
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
    }).then(() => {
        console.log('[SW] Cachés antiguos eliminados.');
        return self.clients.claim();
    })
  );
});


// --- 3. LÓGICA DE NOTIFICACIONES ---

const scheduledTimeouts = {};

function cancelScheduled(noteId) {
    if (scheduledTimeouts[noteId] && scheduledTimeouts[noteId].length) {
        console.log(`[SW] Cancelando ${scheduledTimeouts[noteId].length} notificaciones para la nota ${noteId}`);
        scheduledTimeouts[noteId].forEach(timeoutId => clearTimeout(timeoutId));
        delete scheduledTimeouts[noteId];
    }
}

function mostrarNotificacion(note, tiempo) {
    const options = {
        body: `Tu nota "${note.nombre || '(Sin Título)'}" vence en ${tiempo}.`,
        icon: '/icons/android-chrome-192x192.png', // Nota: Este ícono debe existir para que se muestre.
        badge: '/icons/android-chrome-192x192.png',
        vibrate: [200, 100, 200],
        tag: `nota-${note.id}`
    };
    self.registration.showNotification('Recordatorio de Nota', options);
}

self.addEventListener('message', event => {
    const data = event.data;
    if (!data) return;

    if (data.type === 'SCHEDULE_NOTIFICATION') {
        const note = data.payload;
        const dueDate = new Date(note.fecha_hora);

        console.log(`[SW] Comando 'SCHEDULE_NOTIFICATION' recibido para: "${note.nombre}"`);
        console.log(`[SW] Vence el (UTC): ${dueDate.toISOString()}`);

        cancelScheduled(note.id);
        
        // --- INTERVALOS DE TIEMPO ---
        // Descomenta el bloque de PRUEBAS para verificar rápidamente.
        
        // Versión para PRODUCCIÓN (activa por defecto)
        const intervals = {
            "2 días": 2 * 24 * 60 * 60 * 1000,
            "24 horas": 24 * 60 * 60 * 1000,
            "4 horas": 4 * 60 * 60 * 1000
        };
        
        /*
        // Versión para PRUEBAS (comentada)
        const intervals = {
            "2 minutos antes": 2 * 60 * 1000,
            "1 minuto antes": 1 * 60 * 1000,
            "30 segundos antes": 30 * 1000
        };
        */
        
        scheduledTimeouts[note.id] = [];

        Object.entries(intervals).forEach(([label, interval]) => {
            const notificationTime = dueDate.getTime() - interval;
            const now = Date.now();
            const delay = notificationTime - now;

            if (delay > 0) {
                console.log(`[SW] ✅ PROGRAMANDO notificación de "${label}" en ${Math.round(delay / 1000 / 60)} minutos.`);
                const timeoutId = setTimeout(() => {
                    console.log(`[SW] 🔔 EJECUTANDO notificación de "${label}" para la nota "${note.nombre}".`);
                    mostrarNotificacion(note, label);
                }, delay);
                scheduledTimeouts[note.id].push(timeoutId);
            } else {
                console.log(`[SW] ❌ OMITIDO: La hora de notificación para "${label}" ya pasó.`);
            }
        });
    }

    if (data.type === 'CANCEL_NOTIFICATION') {
        const noteId = data.payload.id;
        console.log(`[SW] Comando 'CANCEL_NOTIFICATION' recibido para la nota ID: ${noteId}`);
        cancelScheduled(noteId);
    }
});


// --- 4. ESTRATEGIAS DE RED Y CACHÉ (FETCH) ---

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // ESTRATEGIA 1: Network First para la API
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
            // ✅ CORREGIDO: Solo guardamos en caché las peticiones GET para evitar errores.
            if (event.request.method === 'GET') {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
        })
        .catch(() => {
          console.log(`[SW] Sin conexión. Sirviendo desde caché para: ${event.request.url}`);
          return caches.match(event.request);
        })
    );
  } 
  
  // ESTRATEGIA 2: Cache First para todo lo demás
  else {
    event.respondWith(
      caches.match(event.request).then(responseFromCache => {
        return responseFromCache || fetch(event.request);
      })
    );
  }
});