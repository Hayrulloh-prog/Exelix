const CACHE_NAME = 'exelix-v2';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/EX.svg'
];

// Install event
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache for EXELIX PWA');
        return cache.addAll(urlsToCache);
      })
      .catch((err) => console.log('PWA cache addAll note:', err))
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  // Never cache API calls or WebSocket connections
  if (event.request.url.includes('/api/') || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }

        const fetchRequest = event.request.clone();
        return fetch(fetchRequest).then(
          (response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        ).catch(() => {
          // If offline and requesting navigation, return root cached page
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Push notification handler
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
  }

  // Используем полный текст из бэкенда как в странице Сообщения
  let title = 'EXELIX';
  let body = 'Вам отправлено уведомление';
  let icon = '/icon-192.png';

  // Если передан заголовок и текст из бэкенда, используем их
  if (data.title && data.body) {
    title = data.title;
    body = data.body;
  }

  // Если есть оригинальное сообщение (полный список), используем его
  if (data.originalMessage) {
    body = data.originalMessage;
  }

  const options = {
    body: body,
    icon: icon,
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
      type: data.type || 'default',
      types: data.types || [],
      originalData: data
    },
    actions: [
      {
        action: 'explore',
        title: 'Открыть',
        icon: '/icon-192.png'
      },
      {
        action: 'close',
        title: 'Закрыть',
        icon: '/icon-192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore' || event.action === undefined) {
    // Открываем личный кабинет пользователя
    event.waitUntil(
      clients.matchAll().then(clientList => {
        // Ищем уже открытую вкладку с приложением
        for (const client of clientList) {
          if (client.url.includes('/dashboard') || client.url.includes('/user/')) {
            // Фокус на существующей вкладке
            return client.focus();
          }
        }
        // Если нет открытой вкладки, открываем новую в личном кабинете
        return clients.openWindow('/dashboard');
      })
    );
  }
});
