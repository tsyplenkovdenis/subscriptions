// Service worker приложения «Подписки»: показывает push-уведомления.

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', event => {
    let data = {};

    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { body: event.data ? event.data.text() : '' };
    }

    event.waitUntil(
        self.registration.showNotification(data.title || 'Подписки', {
            body: data.body || '',
            icon: 'icon-512.png',
            tag: data.tag || 'subscriptions',
            data: { url: './' }
        })
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();

    event.waitUntil(
        self.clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then(list => {
                for (const client of list) {
                    if ('focus' in client) {
                        return client.focus();
                    }
                }

                return self.clients.openWindow('./');
            })
    );
});
