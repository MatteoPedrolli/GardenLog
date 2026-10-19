// Service worker dell'app del capo. Serve a una cosa sola: aprirla anche senza
// campo, con l'agenda scaricata l'ultima volta.
//
// Prima la rete, poi la cache — al contrario del telefono del cantiere. Lì una
// modifica si vede al secondo avvio, e per non perderla c'è una barra
// dell'aggiornamento e un bottone in Impostazioni; qui non ci sono, e il capo non
// deve sapere che esistono versioni. Con la rete prende sempre la pagina nuova;
// senza, quella di prima. Per la stessa ragione CACHE non si alza a ogni modifica:
// la copia si rinfresca da sola a ogni apertura con la rete.
const CACHE = 'giardinolog-capo';
const GUSCIO = ['./', './index.html', './manifest.json', '../rapportino.js',
  '../icon-192.png', '../icon-512.png', '../apple-touch-icon.png'];
// Con il campo debole la rete può non rispondere né sbagliare: dopo un po' si
// apre la copia in cache invece di lasciare lo schermo bianco.
const ATTESA_RETE = 4000;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // 'reload' scavalca la cache del browser: GitHub Pages dice di tenersi i
    // file per dieci minuti.
    await Promise.all(GUSCIO.map(url => cache.add(new Request(url, { cache: 'reload' }))
      .catch(err => console.warn('sw capo: salto', url, err))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Lo script dell'ufficio e i caratteri vanno in rete e basta: un'agenda servita
  // dalla cache del service worker direbbe una cosa vecchia credendola nuova.
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(primaLaRete(req));
});

async function primaLaRete(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([
      fetch(new Request(req, { cache: 'no-cache' })),
      new Promise((_, no) => setTimeout(() => no(new Error('rete lenta')), ATTESA_RETE)),
    ]);
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch (e) {
    const inCache = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (inCache) return inCache;
    if (req.mode === 'navigate') {
      const pagina = await cache.match('./index.html') || await cache.match('./');
      if (pagina) return pagina;
    }
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}
