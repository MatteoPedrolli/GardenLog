// Service worker di GiardinoApp.
// Da quando i dati stanno sul dispositivo e non su un server, l'unica cosa che
// ancora richiede la rete è il caricamento della pagina: senza questo file
// l'app aperta in giardino senza campo non partirebbe nemmeno.
const CACHE = 'giardinolog-v1';

const GUSCIO = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Una risorsa che manca non deve far fallire tutta l'installazione:
    // meglio un'icona assente che un'app che non si apre offline.
    await Promise.all(GUSCIO.map(url => cache.add(url).catch(err => console.warn('sw: salto', url, err))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const nomi = await caches.keys();
    await Promise.all(nomi.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Ricerca indirizzi e vecchio foglio Google vanno sempre in rete: una
  // risposta vecchia servita dalla cache sarebbe peggio di un errore onesto.
  if (url.hostname.endsWith('openstreetmap.org') || url.hostname.endsWith('google.com')) return;
  const nostra = url.origin === self.location.origin
    || url.hostname.endsWith('googleapis.com')
    || url.hostname.endsWith('gstatic.com');
  if (!nostra) return;
  e.respondWith(dallaCachePoiRete(req));
});

// Risponde subito con la copia in cache (apertura istantanea, anche offline) e
// nel frattempo scarica la versione nuova per la volta successiva.
async function dallaCachePoiRete(req) {
  const cache = await caches.open(CACHE);
  const inCache = await cache.match(req);

  const dallaRete = fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
    return res;
  }).catch(() => null);

  if (inCache) {
    // Se la pagina scaricata è diversa da quella mostrata, l'app è cambiata:
    // la copia nuova è già in cache, basta riaprire.
    if (req.mode === 'navigate') {
      dallaRete.then(async res => {
        if (!res?.ok) return;
        try {
          const [nuovo, vecchio] = await Promise.all([res.clone().text(), inCache.clone().text()]);
          if (nuovo !== vecchio) avvisaClienti();
        } catch (e) { /* confronto non riuscito: nessun avviso */ }
      });
    }
    return inCache;
  }

  const res = await dallaRete;
  if (res) return res;
  // Offline e mai vista: per una navigazione vale comunque la pena provare
  // con la home in cache invece di mostrare l'errore del browser.
  if (req.mode === 'navigate') {
    const home = await cache.match('./index.html') || await cache.match('./');
    if (home) return home;
  }
  return new Response('Offline', { status: 503, statusText: 'Offline' });
}

async function avvisaClienti() {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(c => c.postMessage({ tipo: 'aggiornamento' }));
}
