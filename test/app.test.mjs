// Giro di prova su GiardinoApp con un browser vero.
//
// Non è una suite esaustiva: copre le cose che, rompendosi, fanno danno senza
// farsi notare — il calcolo di azoto e potassio, la persistenza dei dati, il
// backup e le eliminazioni a cascata. Da lanciare prima di ogni commit:
//
//   npm test
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { avviaServer } from './server.mjs';

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const esiti = [];
const ok = (nome, condizione, extra = '') =>
  esiti.push({ passato: !!condizione, nome, extra });

const { url: BASE, chiudi } = await avviaServer(RADICE);
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const erroriJS = [];
const risorseKO = [];
page.on('pageerror', e => erroriJS.push(String(e)));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) erroriJS.push('console: ' + m.text()); });
page.on('requestfailed', r => risorseKO.push(`${r.url()} (${r.failure()?.errorText || '?'})`));
page.on('response', r => { if (r.status() >= 400) risorseKO.push(`${r.url()} (HTTP ${r.status()})`); });
page.on('dialog', d => d.accept());

// I font stanno su un dominio esterno: il test non deve dipendere dalla rete.
await ctx.route('**://fonts.googleapis.com/**', r => r.abort());
await ctx.route('**://fonts.gstatic.com/**', r => r.abort());

try {
  // ── avvio a freddo ──
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  ok('avvio a freddo senza errori JavaScript', erroriJS.length === 0, erroriJS.join(' | '));
  ok('fasce di esempio create alla prima apertura', await page.evaluate(() => DB.fasce.length) === 3);
  ok('statistiche a zero', (await page.textContent('#stat-clienti')) === '0');

  // ── nuovo cliente con prato ──
  await page.click('.quick-card:nth-child(2)');
  await page.fill('#f-cliente-nome', 'Mario Rossi');
  await page.fill('#f-cliente-citta', 'Lavis');
  await page.click('#toggle-prato');
  await page.fill('#f-cliente-mq', '200');
  await page.selectOption('#f-cliente-fascia', '1');
  await page.click('#btn-salva-cliente');
  await page.waitForTimeout(300);
  ok('cliente salvato', await page.evaluate(() => DB.clienti.length) === 1);
  ok('target azoto preso dalla fascia', await page.evaluate(() => DB.clienti[0].Target_N_g_m2_anno) == 25);
  ok('lista clienti aggiornata', (await page.textContent('#clienti-list')).includes('Mario Rossi'));
  ok('contatore in home aggiornato', (await page.textContent('#stat-clienti')) === '1');

  // ── archivio concimi ──
  await page.click('.topbar-action');
  await page.waitForTimeout(200);
  ok('pagina Dati raggiungibile', await page.isVisible('#page-dati'));
  await page.click('#archivi-list .card:first-child button.btn');
  await page.fill('#f-arch-Concime', 'Nitrophoska');
  await page.fill('#f-arch-N_percento', '12');
  await page.fill('#f-arch-K_percento', '12');
  await page.click('#overlay-archivio .btn-primary');
  await page.waitForTimeout(200);
  ok('concime aggiunto in archivio', await page.evaluate(() => DB.concimi.length) === 1);

  // ── visita con concimazione ──
  await page.click('#nav-visite');
  await page.click('#topbar-action-btn');
  await page.fill('#f-visita-cliente-search', 'Mario');
  await page.waitForTimeout(200);
  await page.click('#visita-cliente-suggestions .suggestion-item');
  await page.fill('#f-visita-ore', '2');
  await page.click('#overlay-visita button[onclick="addOperazione()"]');
  await page.waitForTimeout(200);
  await page.selectOption('#f-op-tipo', 'Concimazione');
  await page.selectOption('#f-op-concime', await page.evaluate(() => DB.concimi[0].ConcimeID));
  await page.fill('#f-op-dose', '10');
  await page.click('#overlay-operazione .btn-primary');
  await page.waitForTimeout(200);
  await page.click('#btn-salva-visita');
  await page.waitForTimeout(300);
  ok('visita salvata', await page.evaluate(() => DB.visite.length) === 1);
  ok('operazione legata alla sua visita',
    await page.evaluate(() => DB.operazioni.length === 1 && DB.operazioni[0].VisitaID === DB.visite[0].VisitaID));
  // 10 kg al 12% su 200 mq = 1200 g di azoto = 6 g/m²
  ok('azoto per metro quadro calcolato', await page.evaluate(() => DB.operazioni[0].N_g_m2) == 6);

  // ── persistenza ──
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(600);
  ok('dati ritrovati dopo la ricarica',
    await page.evaluate(() => DB.clienti.length === 1 && DB.visite.length === 1 && DB.operazioni.length === 1));
  ok('archivio ritrovato dopo la ricarica', await page.evaluate(() => DB.concimi.length) === 1);

  // ── report prati ──
  await page.click('#nav-prati');
  const prati = await page.textContent('#prati-list');
  ok('report prati mostra il cliente', prati.includes('Mario Rossi'));
  ok('report prati mostra somministrato e target', prati.includes('6') && prati.includes('25'));

  // ── backup ──
  const backup = await page.evaluate(() =>
    JSON.stringify({ app: 'GiardinoApp', versione: 2, esportato: new Date().toISOString(), db: DB }));
  await page.evaluate(() => { DB.clienti = []; DB.visite = []; DB.operazioni = []; return salvaDB(); });
  ok('dati azzerati per la prova', await page.evaluate(() => DB.clienti.length) === 0);
  await page.click('.topbar-action');
  await page.setInputFiles('#file-backup', { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await page.waitForTimeout(400);
  ok('backup reimportato per intero',
    await page.evaluate(() => DB.clienti.length === 1 && DB.visite.length === 1 && DB.operazioni.length === 1));
  ok('contatore modifiche azzerato dal backup', await page.evaluate(() => META.modificheDalBackup) === 0);

  // ── migrazioni ──
  ok('backup senza versione attraversa le migrazioni', await page.evaluate(() => {
    const db = migra({ clienti: [{ ClienteID: 'x', Cliente: 'Vecchio', FasciaID: '2', Target_N_g_m2_anno: 99 }] });
    return db.clienti[0].Target_N_g_m2_anno === undefined && db.clienti[0].Cliente === 'Vecchio';
  }));
  ok('migrazione regge un database vuoto',
    await page.evaluate(() => COLLEZIONI.every(k => Array.isArray(migra(null)[k]))));
  ok('dati già aggiornati passano indenni',
    await page.evaluate(() => migra({ clienti: [{ ClienteID: 'y', Cliente: 'Nuovo' }] }, 2).clienti[0].Cliente === 'Nuovo'));

  // ── CSV ──
  const csv = await page.evaluate(() => {
    const { intestazioni, righe } = righeCSV('operazioni');
    return [intestazioni, ...righe].map(r => r.map(cellaCSV).join(';')).join('\n');
  });
  ok('CSV con separatore punto e virgola', csv.split('\n')[0].startsWith('Data;Cliente'));
  ok('CSV riporta il nome del concime', csv.includes('Nitrophoska'));
  ok('CSV con la virgola come decimale', /;6,00;/.test(csv), csv.split('\n')[1]);

  // ── apostrofo nel cognome: "Dall'Oglio" non è un caso di scuola ──
  await page.click('#nav-clienti');
  await page.click('#topbar-action-btn');
  await page.fill('#f-cliente-nome', "Luca Dall'Oglio");
  await page.click('#btn-salva-cliente');
  await page.waitForTimeout(300);
  await page.click('#nav-visite');
  await page.click('#topbar-action-btn');
  await page.fill('#f-visita-cliente-search', 'Dall');
  await page.waitForTimeout(200);
  await page.click('#visita-cliente-suggestions .suggestion-item');
  await page.waitForTimeout(150);
  ok('cliente con apostrofo selezionabile',
    (await page.textContent('#f-visita-cliente-nome')).includes("Dall'Oglio"));
  await page.evaluate(() => closeDrawer('overlay-visita'));

  // ── rinumerare una fascia si porta dietro i clienti ──
  await page.click('.topbar-action');
  await page.waitForTimeout(200);
  await page.evaluate(() => openVoceArchivio('fasce', '1'));
  await page.fill('#f-arch-FasciaID', '7');
  await page.click('#overlay-archivio .btn-primary');
  await page.waitForTimeout(300);
  ok('cliente spostato sulla fascia rinumerata',
    await page.evaluate(() => DB.clienti.find(c => c.Cliente === 'Mario Rossi').FasciaID) === '7');
  ok('target ancora collegato dopo la rinumerazione',
    await page.evaluate(() => DB.clienti.find(c => c.Cliente === 'Mario Rossi').Target_N_g_m2_anno) == 25);

  // ── eliminazione a cascata ──
  await page.click('#nav-clienti');
  await page.click('.client-card');
  await page.waitForTimeout(200);
  await page.click('button.btn-danger:has-text("Elimina")');
  await page.waitForTimeout(400);
  ok('cliente eliminato con visite e operazioni',
    await page.evaluate(() => DB.visite.length === 0 && DB.operazioni.length === 0));

  // ── offline ──
  await page.waitForTimeout(1200);  // lascia installare il service worker
  await ctx.setOffline(true);
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  ok('app si apre senza rete', await page.isVisible('#page-home'));
  ok('dati leggibili senza rete', await page.evaluate(() => DB.clienti.length) >= 1);

  // ── bilancio ──
  ok('nessun errore JavaScript in tutto il giro', erroriJS.length === 0, erroriJS.join(' | '));
  const mancanti = risorseKO.filter(u => !/fonts\.(googleapis|gstatic)\.com/.test(u));
  ok('nessuna risorsa dell\'app mancante', mancanti.length === 0, mancanti.join(' | '));
} finally {
  await browser.close();
  chiudi();
}

for (const { passato, nome, extra } of esiti) {
  console.log(`${passato ? '  ok' : 'FALLITO'}  ${nome}${extra ? '  — ' + extra : ''}`);
}
const falliti = esiti.filter(e => !e.passato);
console.log(falliti.length
  ? `\n${falliti.length} verifiche fallite su ${esiti.length}`
  : `\n${esiti.length} verifiche passate`);
process.exit(falliti.length ? 1 : 0);
