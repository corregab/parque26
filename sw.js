/* Service Worker do PARQUÊ '26 — cache offline */
const CACHE = 'parque26-v4';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

// instala e pré-cacheia os arquivos do app
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// limpa caches antigos ao ativar
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// estratégia: rede primeiro para o HTML (pega atualizações), cache primeiro para o resto
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // só gerencia arquivos do próprio site; deixa nuvem (Supabase) e CDNs passarem direto
  if (url.origin !== self.location.origin) return;
  const isHTML = req.mode === 'navigate' || url.pathname.endsWith('index.html') || url.pathname.endsWith('/');
  if (isHTML) {
    // network-first: sempre tenta a versão mais nova, cai pro cache se estiver offline
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
  } else {
    // cache-first para ícones, fontes, etc.
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => hit))
    );
  }
});

/* ---------- WEB PUSH: notificações ---------- */
// recebe o push mesmo com o app fechado e mostra a notificação
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: 'PARQUÊ \'26', body: e.data ? e.data.text() : '' }; }
  const title = d.title || 'PARQUÊ \'26';
  const opts = {
    body: d.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: d.tag || undefined,           // agrupa notificações do mesmo tipo
    renotify: !!d.tag,
    data: { url: d.url || './' },
    vibrate: [80, 40, 80]
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

// ao tocar na notificação, foca o app (ou abre) e vai pra url indicada
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const alvo = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cls) => {
      for (const c of cls) {
        if (c.url.includes(self.location.origin)) { c.focus(); return; }
      }
      return self.clients.openWindow(alvo);
    })
  );
});
