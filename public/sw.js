/// <reference lib="webworker" />

// Service Worker pour Rire pour 1 enfant - PWA
const CACHE_NAME = 'rire1enfant-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.ico',
];

// Installation - mise en cache des assets statiques
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      // Force le SW à s'activer immédiatement
      return self.skipWaiting();
    })
  );
});

// Activation - nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      // Prend le contrôle des pages immédiatement
      return self.clients.claim();
    })
  );
});

// Fetch - stratégie Cache First pour les assets, Network First pour les API
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ne pas intercepter les requêtes non-GET ou les extensions chrome
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // Stratégie Network First pour l'API Supabase
  if (url.pathname.startsWith('/rest/') || url.pathname.startsWith('/auth/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Met en cache la réponse pour usage offline
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback sur le cache si offline
          return caches.match(request);
        })
    );
    return;
  }

  // Stratégie Cache First pour les assets statiques
  event.respondWith(
    caches.match(request).then((cached) => {
      // Retourne le cache immédiatement si trouvé
      if (cached) {
        // Rafraîchit en arrière-plan
        fetch(request).then((response) => {
          if (response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, response);
            });
          }
        }).catch(() => {
          // Ignore les erreurs de rafraîchissement
        });
        return cached;
      }

      // Sinon, fetch depuis le réseau
      return fetch(request).then((response) => {
        if (!response || response.status !== 200) {
          return response;
        }

        // Met en cache les nouvelles ressources
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });

        return response;
      });
    }).catch(() => {
      // Fallback si tout échoue
      if (request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});

// Gestion des notifications push
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);

  const data = event.data?.json() ?? {};
  const title = data.title ?? 'Rire pour 1 enfant';
  const options = {
    body: data.body ?? 'Nouvelle notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag ?? 'default',
    data: data.data ?? {},
    actions: data.actions ?? [],
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Clic sur notification
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();

  const notificationData = event.notification.data;
  const urlToOpen = notificationData?.url ?? '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Vérifie si une fenêtre est déjà ouverte
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Sinon, ouvre une nouvelle fenêtre
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});


