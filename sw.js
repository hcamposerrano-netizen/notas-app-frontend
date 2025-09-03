// =================================================================
// 🚀 SERVICE WORKER PARA NOTAS APP - VERSIÓN 5.4 (CON PUSH LISTENER)
// =================================================================

// --- 1. CONFIGURACIÓN DE CACHÉ ---
const STATIC_CACHE_NAME = 'notas-app-static-cache-v11'; // Incrementamos para forzar actualización
const DYNAMIC_CACHE_NAME = 'notas-app-dynamic-cache-v9';
const APP_SHELL_FILES = [
  '/', '/index.html', '/style.css', '/app.js', '/editor-modal.js',
  '/calendar-view.js', '/filter-type.js', '/Search-notes.js',
  '/ui-interactions.js', '/manifest.json'
];

// --- 2. CONFIGURACIÓN DE INDEXEDDB ---
const DB_NAME = 'ScheduledNotificationsDB';
const DB_VERSION = 1; // Lo reseteamos a 1, ya que la base nunca se creó
const STORE_NAME = 'notifications';
let db;
let notificationInterval;

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
      console.log('[SW] Creando o actualizando la base de datos IndexedDB...');
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
        console.log('[SW] Activación completa. Iniciando comprobador de notificaciones...');
        return self.clients.claim().then(() => {
          if (!notificationInterval) {
            notificationInterval = setInterval(checkAndFireNotifications, 60000);
          }
          checkAndFireNotifications();
        });
    })
  );
});

// --- 4. LÓGICA DE NOTIFICACIONES CON INDEXEDDB ---
async function checkAndFireNotifications() {
    try {
        await openDb();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('timestamp');
        const range = IDBKeyRange.upperBound(Date.now());
        const request = index.getAll(range);
        request.onsuccess = () => {
            const notificationsToFire = request.result;
            if (notificationsToFire.length > 0) {
                notificationsToFire.forEach(notif => {
                    self.registration.showNotification(notif.title, notif.options);
                    store.delete(notif.id);
                });
            }
        };
    } catch (error) {
        console.error('[SW] Error en checkAndFireNotifications:', error);
    }
}

async function scheduleNotifications(note) {
    try {
        await openDb();
        await cancelScheduledNotifications(note.id);
        const dueDate = new Date(note.fecha_hora);
        const intervals = {
            "2 días": 2 * 24 * 60 * 60 * 1000,
            "24 horas": 24 * 60 * 60 * 1000,
            "4 horas": 4 * 60 * 60 * 1000
        };
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        Object.entries(intervals).forEach(([label, interval]) => {
            const timestamp = dueDate.getTime() - interval;
            if (timestamp > Date.now()) {
                const notificationData = {
                    noteId: note.id,
                    timestamp: timestamp,
                    title: 'Recordatorio de Nota',
                    options: { body: `Tu nota "${note.nombre || '(Sin Título)'}" vence en ${label}.`, icon: '/icons/android-chrome-192x192.png', tag: `nota-${note.id}-${timestamp}` }
                };
                store.add(notificationData);
            }
        });
    } catch (error) {
        console.error('[SW] Error fatal en scheduleNotifications:', error);
    }
}

async function cancelScheduledNotifications(noteId) {
    try {
        await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.openCursor();
            request.onerror = (event) => reject(event.target.error);
            request.onsuccess = event => {
                const cursor = event.target.result;
                if (cursor) {
                    if (cursor.value.noteId === noteId) cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };
        });
    } catch (error) {
        console.error('[SW] Error fatal en cancelScheduledNotifications:', error);
    }
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
                if (clientList[i].focused) client = clientList[i];
            }
            return client.focus();
        }
        return clients.openWindow('/');
    }));
});


// ==========================================================
// ======> AQUÍ ESTÁ EL CÓDIGO NUEVO Y NECESARIO <======
// ==========================================================
self.addEventListener('push', event => {
  console.log('[SW] ¡Evento Push recibido!');

  const pushData = event.data ? event.data.text() : 'Sin contenido';

  const title = 'Notificación Push de Prueba';
  const options = {
    body: `Contenido: ${pushData}`,
    icon: '/icons/android-chrome-192x192.png'
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});
// ==========================================================
// ==========================================================


// --- 5. ESTRATEGIA DE CACHÉ ---
self.addEventListener('fetch', event => {
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
            // No hacer nada en caso de error de red si no está en caché
        })
    );
});