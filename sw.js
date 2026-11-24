const CACHE = "wiki-v23";
const FILES = ["./", "index.html","health.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f => fetch(new Request(f, {cache:"reload"})).then(r => { if (!r.ok) throw new Error(f); return c.put(f, r); })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Файлы приложения: сначала из кэша (работает без сети), в фоне обновляем.
// Запросы к другим сайтам (Google Apps Script) не трогаем.
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(req, {ignoreSearch: true}).then(cached => {
      const fresh = fetch(req, {cache:"no-cache"}).then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req.url.split("?")[0], copy)); }
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
