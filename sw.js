/* Service Worker - Simple$$ */
const CACHE_NAME = "simpless-cache-v1.0.1"; // aumente a versão quando publicar mudanças

// IMPORTANTE: usar o prefixo /simpless/ pois o app roda nesse subcaminho no GitHub Pages
const ASSETS = [
  "/simpless/",
  "/simpless/index.html",
  "/simpless/style.css",
  "/simpless/js/app.js",
  "/simpless/manifest.json",
  "/simpless/icons/icon-192.png",
  "/simpless/icons/icon-512.png",
  "/simpless/icons/maskable-512.png",
  "/simpless/icons/apple-touch-icon.png",
  "/simpless/icons/favicon-64.png",
  "/simpless/icons/favicon-32.png"
];

// Instala e pré-carrega assets essenciais
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

// Ativa e remove caches antigos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// Estratégias:
// - HTML (navegação): Network First → pega versão nova quando online, cai no cache se offline
// - Demais (CSS/JS/ícones): Stale-While-Revalidate → rápido e atualiza em background
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const accept = request.headers.get("accept") || "";

  // Trata navegação/HTML
  if (request.mode === "navigate" || accept.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Outros recursos (CSS/JS/imagens)
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetched = fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
