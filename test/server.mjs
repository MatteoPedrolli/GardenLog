// Server statico minimo per i test: evita di dipendere da un pacchetto solo
// per servire cinque file. I service worker non funzionano su file://, quindi
// un server ci vuole comunque.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TIPI = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.csv': 'text/csv; charset=utf-8',
};

export function avviaServer(radice) {
  const server = createServer(async (req, res) => {
    const percorso = decodeURIComponent(req.url.split('?')[0]);
    // Una cartella si serve col suo index.html, come fa GitHub Pages: l'app
    // dell'ufficio sta in /ufficio/ e i test devono chiamarla con lo stesso
    // indirizzo che userà il PC.
    const chiesto = percorso.endsWith('/') ? percorso + 'index.html' : percorso;
    const file = join(radice, normalize(chiesto));
    // niente uscite dalla radice con ../
    if (!file.startsWith(radice)) { res.writeHead(403).end('vietato'); return; }
    try {
      const corpo = await readFile(file);
      res.writeHead(200, {
        'Content-Type': TIPI[extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(corpo);
    } catch (e) {
      res.writeHead(404).end('non trovato');
    }
  });
  return new Promise(risolvi => {
    server.listen(0, '127.0.0.1', () => {
      risolvi({ url: `http://127.0.0.1:${server.address().port}/`, chiudi: () => server.close() });
    });
  });
}
