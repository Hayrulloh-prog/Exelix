// EXELIX Web Push Notification Handler
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
  }

  let title = data.title || 'EXELIX';
  let body = data.body || data.originalMessage || 'Вам отправлено новое уведомление';
  let icon = data.icon || '/icon-192.png';

  const options = {
    body: body,
    icon: icon,
    badge: '/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: 'exelix-notification-' + Date.now(),
    renotify: true,
    requireInteraction: true,
    data: {
      dateOfArrival: Date.now(),
      url: '/dashboard',
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

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/dashboard');
        }
      })
    );
  }
});
