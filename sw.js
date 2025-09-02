// =================================================================
// 🚀 SERVICE WORKER COMPLETO PARA NOTAS APP - VERSIÓN FINAL
// =================================================================

// --- 1. CONFIGURACIÓN DE CACHÉ ---

// Aumentamos la versión para forzar la actualización del Service Worker y la caché estática.
const STATIC_CACHE_NAME = 'notas-app-static-cache-v6';
const DYNAMIC_CACHE_NAME = 'notas-app-dynamic-cache-v4';

// Archivos esenciales para que la aplicación funcione offline (el "App Shell").
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
  // NOTA: Si añades más archivos JS/CSS/imágenes críticas, agrégalos aquí.
];


// --- 2. CICLO DE VIDA DEL SERVICE WORKER ---

// Evento 'install': Se dispara cuando el navegador instala el SW.
self.addEventListener('install', event => {
  console.log('[SW] Instalando...');
  // Esperamos a que la promesa de cacheo del App Shell se complete.
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then(cache => {
      console.log('[SW] Cache estático abierto. Guardando App Shell...');
      return cache.addAll(APP_SHELL_FILES);
    }).then(() => {
      console.log('[SW] App Shell cacheado con éxito. Forzando activación.');
      return self.skipWaiting(); // Activa este SW inmediatamente, sin esperar a que el viejo se cierre.
    })
  );
});

// Evento 'activate': Se dispara después de la instalación, cuando el SW toma el control.
self.addEventListener('activate', event => {
  console.log('[SW] Activando...');
  // Esperamos a que la limpieza de cachés antiguos termine.
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys
        // Filtramos para quedarnos solo con las cachés que no son las actuales.
        .filter(key => key !== STATIC_CACHE_NAME && key !== DYNAMIC_CACHE_NAME)
        // Borramos cada una de las cachés antiguas.
        .map(key => caches.delete(key))
      );
    }).then(() => {
        console.log('[SW] Cachés antiguos eliminados.');
        return self.clients.claim(); // Permite que el SW tome control de las páginas abiertas inmediatamente.
    })
  );
});


// --- 3. LÓGICA DE NOTIFICACIONES ---

// Objeto para almacenar los IDs de los timeouts y poder cancelarlos.
const scheduledTimeouts = {};

// Función para cancelar todas las notificaciones programadas para una nota específica.
function cancelScheduled(noteId) {
    if (scheduledTimeouts[noteId] && scheduledTimeouts[noteId].length) {
        console.log(`[SW] Cancelando ${scheduledTimeouts[noteId].length} notificaciones para la nota ${noteId}`);
        scheduledTimeouts[noteId].forEach(timeoutId => clearTimeout(timeoutId));
        delete scheduledTimeouts[noteId];
    }
}

// Función para construir y mostrar una notificación.
function mostrarNotificacion(note, tiempo) {
    const options = {
        body: `Tu nota "${note.nombre || '(Sin Título)'}" vence en ${tiempo}.`,
        icon: '/icons/android-chrome-192x192.png',
        badge: '/icons/android-chrome-192x192.png', // Icono para Android
        vibrate: [200, 100, 200], // Patrón de vibración
        tag: `nota-${note.id}` // Un tag único para que notificaciones nuevas sobre la misma nota reemplacen a las viejas.
    };
    self.registration.showNotification('Recordatorio de Nota', options);
}

// Evento 'message': Escucha los comandos enviados desde la aplicación principal (app.js).
self.addEventListener('message', event => {
    const data = event.data;
    if (!data) return;

    // Comando para programar notificaciones
    if (data.type === 'SCHEDULE_NOTIFICATION') {
        const note = data.payload;
        const dueDate = new Date(note.fecha_hora);

        console.log(`[SW] Comando 'SCHEDULE_NOTIFICATION' recibido para: "${note.nombre}"`);
        console.log(`[SW] Vence el: ${dueDate.toLocaleString()}`);

        // Primero, cancelamos cualquier notificación antigua para esta nota.
        cancelScheduled(note.id);
        
        // Intervalos de tiempo reales para los recordatorios.
        const intervals = {
            "2 días": 2 * 24 * 60 * 60 * 1000,
            "24 horas": 24 * 60 * 60 * 1000,
            "4 horas": 4 * 60 * 60 * 1000
        };
        
        scheduledTimeouts[note.id] = [];

        Object.entries(intervals).forEach(([label, interval]) => {
            const notificationTime = dueDate.getTime() - interval;
            const now = Date.now();
            const delay = notificationTime - now;

            // Solo programamos la notificación si el tiempo de aviso es en el futuro.
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

    // Comando para cancelar notificaciones
    if (data.type === 'CANCEL_NOTIFICATION') {
        const noteId = data.payload.id;
        console.log(`[SW] Comando 'CANCEL_NOTIFICATION' recibido para la nota ID: ${noteId}`);
        cancelScheduled(noteId);
    }
});


// --- 4. ESTRATEGIAS DE RED Y CACHÉ (FETCH) ---

// Evento 'fetch': Se dispara cada vez que la app realiza una petición de red.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // ESTRATEGIA 1: Network First (para la API)
  // Intenta ir a la red primero. Si falla, usa la caché como respaldo.
  // Ideal para datos que necesitan estar actualizados.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          // Si la petición a la red tiene éxito...
          return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
            // Guardamos una copia de la respuesta en la caché dinámica.
            cache.put(event.request, networkResponse.clone());
            // Y devolvemos la respuesta de la red a la aplicación.
            return networkResponse;
          });
        })
        .catch(() => {
          // Si la petición a la red falla (estamos offline)...
          // Intentamos encontrar una respuesta en la caché.
          console.log(`[SW] Sin conexión. Sirviendo desde caché para: ${event.request.url}`);
          return caches.match(event.request);
        })
    );
  } 
  
  // ESTRATEGIA 2: Cache First (para todo lo demás)
  // Intenta obtener el recurso de la caché primero. Si no está, va a la red.
  // Ideal para el App Shell (CSS, JS, imágenes) para velocidad y funcionamiento offline.
  else {
    event.respondWith(
      caches.match(event.request).then(responseFromCache => {
        // Si encontramos una respuesta en la caché, la devolvemos inmediatamente.
        // Si no (responseFromCache es null), entonces realizamos la petición a la red.
        return responseFromCache || fetch(event.request);
      })
    );
  }
});