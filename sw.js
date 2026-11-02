// Service worker приложения «Подписки».
// 1. Работа без интернета: файлы приложения хранятся в кэше телефона.
// 2. Показ push-уведомлений.

// При изменении списка файлов увеличьте номер версии.
const CACHE = 'subscriptions-v2';
const APP_FILES = [
    './',
    './index.html',
    './manifest.webmanifest',
    './apple-touch-icon.png',
    './icon-512.png'
];
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE)
            .then(cache => cache.addAll(APP_FILES))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => key !== CACHE)
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

// Сначала сеть (чтобы обновления приходили сразу),
// при отсутствии сети или долгом ответе — кэш.
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    // Запросы к серверу уведомлений и прочие чужие адреса не трогаем.
    if (request.method !== 'GET' || url.origin !== self.location.origin) {
        return;
    }

    event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
    const cache = await caches.open(CACHE);

    try {
        const response = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);

        if (response.ok) {
            cache.put(request, response.clone());
        }

        return response;
    } catch {
        const cached =
            await cache.match(request, { ignoreSearch: true }) ||
            (request.mode === 'navigate'
                ? await cache.match('./index.html') || await cache.match('./')
                : null);

        return cached || new Response('Нет подключения к интернету', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }
}

function fetchWithTimeout(request, timeout) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), timeout);

        fetch(request).then(
            response => {
                clearTimeout(timer);
                resolve(response);
            },
            error => {
                clearTimeout(timer);
                reject(error);
            }
        );
    });
}

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
