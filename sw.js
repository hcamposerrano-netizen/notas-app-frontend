// Aumentamos la versión del caché para forzar una actualización
const STATIC_CACHE_NAME = 'notas-app-static-cache-v4';
const DYNAMIC_CACHE_NAME = 'notas-app-dynamic-cache-v2';

// Lista de archivos estáticos que componen el "cascarón" de la aplicación.
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
  '/icons/android-chrome-192x192.png', // Corregir ruta si es necesario
  '/icons/android-chrome-512x512.png'  // Corregir ruta si es necesario
];

// 1. Evento 'install': Cacheamos el App Shell.
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then(cache => {
      console.log('Cache estático abierto, guardando App Shell.');
      // Usamos addAll para cachear todos los archivos del App Shell.
      // Si alguno falla, la instalación entera falla, asegurando un estado consistente.
      return cache.addAll(APP_SHELL_FILES);
    })
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
    })
  );
  return self.clients.claim();
});

// 3. Evento 'fetch': Interceptamos todas las peticiones de red.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Estrategia para las peticiones a la API (Stale-While-Revalidate)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(DYNAMIC_CACHE_NAME).then(cache => {
        return fetch(event.request).then(networkResponse => {
            // Si la petición es exitosa, guardamos la nueva respuesta en el caché dinámico
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
        }).catch(() => {
            // Si la red falla, intentamos devolver desde el caché
            return cache.match(event.request);
        });
      })
    );
  } 
  // Estrategia para los archivos estáticos (Cache First)
  else {
    event.respondWith(
      caches.match(event.request).then(response => {
        // Devuelve el archivo desde el caché si existe, si no, ve a la red.
        return response || fetch(event.request).then(fetchResponse => {
            // Opcional: Cachear archivos estáticos no pre-cacheados dinámicamente
            return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                cache.put(event.request, fetchResponse.clone());
                return fetchResponse;
            });
        });
      })
    );
  }
});