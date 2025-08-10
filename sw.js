const CACHE_NAME = "simple-cache-v1";
const ASSETS = [
  "/",                  // raiz
  "/index.html",        // HTML principal
  "/style.css",         // CSS
  "/script.js",         // JS principal
  "/manifest.json",     // Manifesto PWA
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/favicon-64.png",
  "/icons/favicon-32.png"
];

// Instala o Service Worker e adiciona arquivos ao cache
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Ativa o SW e remove caches antigos
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Estratégia: rede primeiro para HTML, cache para assets
self.addEventListener("fetch", event => {
  const { request } = event;

  // Rede primeiro para HTML
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache primeiro para demais arquivos (CSS, JS, imagens, etc.)
  event.respondWith(
    caches.match(request).then(cached => {
      return (
        cached ||
        fetch(request).then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
      );
    })
  );
});
