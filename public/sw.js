self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Minimal passthrough for PWA compliance
  event.respondWith(fetch(event.request));
});
