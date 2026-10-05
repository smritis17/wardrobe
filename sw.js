// Offline support: serve the app from cache instantly, refresh the cache in the background.
// Bump CACHE on every deploy so phones pick up the new version.
const CACHE = 'wardrobe-v4';
const MODEL = 'wardrobe-cutout'; // the background-removal model; kept across deploys so it downloads once
const ASSETS = ['./', './index.html', './styles.css', './app.js', './cutout.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== MODEL).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (/^(staticimgly\.com|cdn\.jsdelivr\.net)$/.test(url.hostname)) {
    // Versioned files that never change: cache once, never re-download.
    e.respondWith(caches.open(MODEL).then(async cache => {
      const cached = await cache.match(e.request);
      if (cached) return cached;
      const res = await fetch(e.request);
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    }));
    return;
  }
  const cacheable = url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!cacheable) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request).then(res => {
      if (res.ok || res.type === 'opaque') cache.put(e.request, res.clone());
      return res;
    }).catch(() => cached);
    return cached || fresh;
  }));
});
