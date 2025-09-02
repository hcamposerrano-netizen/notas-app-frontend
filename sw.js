// =================================================================
// 🚀 SERVICE WORKER PARA NOTAS APP - VERSIÓN 3 (PERSISTENTE CON IndexedDB)
// =================================================================

// --- 1. CONFIGURACIÓN DE CACHÉ ---
const STATIC_CACHE_NAME = 'notas-app-static-cache-v9';
const DYNAMIC_CACHE_NAME = 'notas-app-dynamic-cache-v7';
const APP_SHELL_FILES = [
  '/', '/index.html', '/style.css', '/app.js', '/editor-modal.js',
  '/calendar-view.js', '/filter-type.js', '/Search-notes.js',
  '/ui-interactions.js', '/manifest.json'
];

// --- 2. CONFIGURACIÓN DE INDEXEDDB ---
const DB_NAME = 'ScheduledNotificationsDB';
const DB_VERSION = 1;
const STORE_NAME = 'notifications';
let db;

function openDb() {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (event) => reject('Error opening IndexedDB');
    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };
    request.onupgradeneeded = (event) => {
      const store = event.target.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      store.createIndex('timestamp', 'timestamp', { unique: false });
    };
  });
}

// --- 3. CICLO DE VIDA DEL SERVICE WORKER ---
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
    }).then(() => {
        console.log('[SW] Activación completa. Comprobando notificaciones pendientes...');
        return self.clients.claim().then(() => checkAndFireNotifications()); // Comprobar al activar
    })
  );
});

// --- 4. LÓGICA DE NOTIFICACIONES CON INDEXEDDB ---

async function checkAndFireNotifications() {
    await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    const range = IDBKeyRange.upperBound(Date.now());
    
    const request = index.getAll(range);
    request.onsuccess = () => {
        const notificationsToFire = request.result;
        if (notificationsToFire.length > 0) {
            console.log(`[SW] Se encontraron ${notificationsToFire.length} notificaciones vencidas.`);
            notificationsToFire.forEach(notif => {
                self.registration.showNotification(notif.title, notif.options);
                store.delete(notif.id);
            });
        } else {
            console.log('[SW] No hay notificaciones vencidas para mostrar.');
        }
    };
}

async function scheduleNotifications(note) {
    console.log(`[SW] Recibida orden para programar notificaciones para: "${note.nombre}"`);
    await openDb();
    await cancelScheduledNotifications(note.id); // Cancelar las viejas primero

    const dueDate = new Date(note.fecha_hora);
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

    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    Object.entries(intervals).forEach(([label, interval]) => {
        const timestamp = dueDate.getTime() - interval;
        if (timestamp > Date.now()) {
            const notificationData = {
                noteId: note.id,
                timestamp: timestamp,
                title: 'Recordatorio de Nota',
                options: {
                    body: `Tu nota "${note.nombre || '(Sin Título)'}" vence en ${label}.`,
                    icon: '/icons/android-chrome-192x192.png',
                    tag: `nota-${note.id}-${timestamp}`
                }
            };
            store.add(notificationData);
            console.log(`[SW] ✅ Guardada notificación de "${label}" en la base de datos.`);
        }
    });
}

async function cancelScheduledNotifications(noteId) {
    await openDb();
    return new Promise(resolve => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.openCursor();
        request.onsuccess = event => {
            const cursor = event.target.result;
            if (cursor) {
                if (cursor.value.noteId === noteId) {
                    cursor.delete();
                }
                cursor.continue();
            } else {
                console.log(`[SW] Se eliminaron las notificaciones pendientes para la nota ${noteId}.`);
                resolve();
            }
        };
    });
}

self.addEventListener('message', event => {
    if (event.data.type === 'SCHEDULE_NOTIFICATION') {
        scheduleNotifications(event.data.payload);
    } else if (event.data.type === 'CANCEL_NOTIFICATION') {
        cancelScheduledNotifications(event.data.payload.id);
    }
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
        if (clientList.length > 0) {
            let client = clientList[0];
            for (let i = 0; i < clientList.length; i++) {
                if (clientList[i].focused) {
                    client = clientList[i];
                }
            }
            return client.focus();
        }
        return clients.openWindow('/');
    }));
});

// --- 5. ESTRATEGIA DE CACHÉ ---
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(responseFromCache => {
            return responseFromCache || fetch(event.request).then(networkResponse => {
                // Para peticiones de API, las guardamos en el caché dinámico
                if (event.request.url.includes('/api/')) {
                    return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                        cache.put(event.request.url, networkResponse.clone());
                        return networkResponse;
                    });
                }
                return networkResponse;
            });
        }).catch(() => {
            // Si todo falla (offline y no está en caché)
            // podrías devolver una página de fallback si la tuvieras.
        })
    );
});