// ???????? ??? ???(??????????IndexedDB ????? ???). ????? ??? ??CACHE ??????????
const CACHE = 'beopmusa-17';
const JS = ['01-core', '02-sync', '03-data', '04-ui', '05-srs', '10-home', '11-subject', '12-ink', '13-exam', '14-quiz', '15-settings', '16-cards', '17-focus', '18-add', '19-tools', '20-gichul', '21-law', '22-plan', '23-guide', '99-boot'];
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'css/app.css', ...JS.map(n => `js/${n}.js`)];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/data/')) return;
  // ????? ????? ???, ????? ??? ??????????)
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request, {ignoreSearch: true})));
});
