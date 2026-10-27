// Service Worker для приложения «Трафарет»
const CACHE_NAME = 'trafaret-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg'
];

// Установка — кэшируем основные ресурсы
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('SW install: не удалось закэшировать', err))
  );
});

// Активация — удаляем старые кэши
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — стратегия: network-first с fallback на кэш
// (важно для камеры: всегда свежий index.html, но оффлайн тоже работает)
self.addEventListener('fetch', (event) => {
  // Не кэшируем запросы к камере и blob/data
  const url = event.request.url;
  if (url.startsWith('blob:') || url.startsWith('data:')) return;

  // Только GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Кэшируем успешные ответы для последующего оффлайн-доступа
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone).catch(() => {});
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => {
        if (cached) return cached;
        // Если запрос на навигацию — отдаём index.html
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('Оффлайн', { status: 503, statusText: 'Offline' });
      }))
  );
});
