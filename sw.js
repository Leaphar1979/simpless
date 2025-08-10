/* sw.js — Simple$$ PWA */
const CACHE_VERSION = "v1.0.2";                  // Aumente ao publicar mudanças
const CACHE_NAME = `simpless-${CACHE_VERSION}`;

const ASSETS = [
  "/simpless/",
  "/simpless/index.html",
  "/simpless/style.css?v=8",
  "/simpless/js/app.js?v=8",
  "/simpless/manifest.json",
  "/simpless/icons/icon-192.png",
  "/simpless/icons/icon-512.png",
  "/simpless/icons/maskable-512.png",
  "/simpless/icons/apple-touch-icon.png",
  "/simpless/icons/favicon-64.png",
  "/simpless/icons/favicon-32.png"
];

// Instala e pré-carrega os assets essenciais
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
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

// HTML: Network First | Outros: Stale-While-Revalidate
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const accept = req.headers.get("accept") || "";

  // Navegação/HTML
  if (req.mode === "navigate" || accept.includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Outros recursos
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
