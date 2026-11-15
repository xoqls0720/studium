// 오프라인에서도 열리게 앱 파일을 저장해 둔다. 앱을 바꾸면 CACHE 이름을 올린다.
const CACHE = 'geul-4';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon.png', 'icon-192.png', 'icon-512.png', 'pdf.min.js', 'pdf.worker.min.js', '../shim/claude.js', '../shim/tabs.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('geul-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request, {ignoreSearch: true})));
});
