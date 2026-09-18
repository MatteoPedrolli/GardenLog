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
  await page.click('#archivi-list .card:has(.card-title:text-is("Concimi")) button.btn');
  await page.fill('#f-arch-Concime', 'Nitrophoska');
  await page.fill('#f-arch-N_percento', '12');
  await page.fill('#f-arch-K_percento', '12');
  await page.click('#overlay-archivio .btn-primary');
  await page.waitForTimeout(200);
  ok('concime aggiunto in archivio', await page.evaluate(() => DB.concimi.length) === 1);

  // ── visita: fasce orarie e checklist ──
  await page.click('#nav-visite');
  await page.click('#topbar-action-btn');
  await page.fill('#f-visita-cliente-search', 'Mario');
  await page.waitForTimeout(200);
  await page.click('#visita-cliente-suggestions .suggestion-item');
  await page.waitForTimeout(150);

  // il salvataggio si rifiuta finché la fascia proposta non è stata guardata
  await page.click('#btn-salva-visita');
  await page.waitForTimeout(200);
  ok('la fascia proposta blocca il salvataggio',
    (await page.textContent('#toast')).includes('Conferma'));
  ok('nessuna visita salvata di nascosto', await page.evaluate(() => DB.visite.length) === 0);

  // 08:00–12:00 in due persone = 8 ore
  const fascia = page.locator('#fasce-list .fascia').first();
  await fascia.locator('input[type=time]').first().fill('08:00');
  await fascia.locator('input[type=time]').nth(1).fill('12:00');
  await fascia.locator('input[type=number]').fill('2');
  await page.waitForTimeout(150);
  ok('il totale ore lo calcola l\'app',
    (await page.textContent('#ore-totale-val')).includes('8,00'));

  await page.click('#operazioni-check .op-riga:has-text("Concimazione")');
  await page.waitForTimeout(150);
  ok('spuntare segna il prato senza chiederlo',
    await page.evaluate(() => isSi(pendingOperazioni[0].Flag_prato)));
  await page.selectOption('#operazioni-check .op-dett select',
    await page.evaluate(() => DB.concimi[0].ConcimeID));
  await page.fill('#operazioni-check .op-dett input[type=number]', '10');

  // la casella libera per quello che non sta in archivio
  await page.fill('#f-op-libera', 'Riparazione irrigazione');
  await page.press('#f-op-libera', 'Enter');
  await page.waitForTimeout(150);
  ok('operazione libera aggiunta',
    (await page.textContent('#operazioni-libere')).includes('Riparazione irrigazione'));

  // ── il conto si compila mentre registri, nella stessa schermata ──
  ok('tre righe automatiche: manodopera, trasferimento, concime',
    await page.locator('#conto-righe .conto-riga').count() === 3);
  ok('manodopera precompilata con le ore calcolate',
    await page.locator('#conto-righe .conto-riga').first().locator('input').first().inputValue() === '8');
  ok('il trasferimento c\'è sempre, senza aggiungerlo',
    (await page.textContent('#conto-righe')).includes('Trasferimento'));
  ok('l\'operazione libera non fa riga di conto',
    !(await page.textContent('#conto-righe')).includes('Riparazione irrigazione'));
  ok('avvisa che ci sono righe senza prezzo',
    (await page.textContent('#conto-totale')).includes('senza prezzo'));

  const riga = i => page.locator('#conto-righe .conto-riga').nth(i);
  await riga(0).locator('input').nth(1).fill('32');   // manodopera
  await riga(1).locator('input').nth(1).fill('45');   // trasferimento, a occhio
  await riga(2).locator('input').nth(1).fill('1.8');  // concime
  await page.waitForTimeout(200);
  // 8 h × 32 € + 45 € + 10 kg × 1,80 € = 319 €
  ok('totale calcolato dalle righe',
    (await page.textContent('#conto-totale')).includes('319,00'));
  ok('niente più avvisi quando i prezzi ci sono tutti',
    !(await page.textContent('#conto-totale')).includes('senza prezzo'));

  await page.fill('#f-conto-libera', 'Noleggio rullo');
  await page.press('#f-conto-libera', 'Enter');
  await page.waitForTimeout(150);
  ok('riga aggiunta a mano', await page.locator('#conto-righe .conto-riga').count() === 4);

  // il conto segue le ore mentre le correggi, senza uscire dalla schermata
  await page.locator('#fasce-list .fascia').first().locator('input[type=number]').fill('3');
  await page.waitForTimeout(200);
  ok('cambiando le persone la manodopera si aggiorna da sola',
    await riga(0).locator('input').first().inputValue() === '12');
  ok('il prezzo che avevi scritto resta',
    await riga(0).locator('input').nth(1).inputValue() === '32');
  await page.locator('#fasce-list .fascia').first().locator('input[type=number]').fill('2');
  await page.waitForTimeout(200);

  await page.click('#btn-salva-visita');
  await page.waitForTimeout(300);
  ok('visita salvata', await page.evaluate(() => DB.visite.length) === 1);
  ok('ore e fasce registrate',
    await page.evaluate(() => DB.visite[0].Ore_Visita === 8 && DB.visite[0].Fasce.length === 1));
  ok('operazione agganciata al suo tipo',
    await page.evaluate(() => DB.operazioni.find(o => o.TipoID === 'concimazione') != null));
  ok('operazione libera salvata senza tipo',
    await page.evaluate(() => DB.operazioni.some(o => !o.TipoID && o.Tipo_operazione === 'Riparazione irrigazione')));
  // 10 kg al 12% su 200 mq = 1200 g di azoto = 6 g/m²
  ok('azoto per metro quadro calcolato',
    await page.evaluate(() => DB.operazioni.find(o => o.TipoID === 'concimazione').N_g_m2) == 6);
  ok('conto salvato con la visita',
    await page.evaluate(() => DB.visite[0].Conto?.length) === 4);

  // ── persistenza ──
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(600);
  ok('dati ritrovati dopo la ricarica',
    await page.evaluate(() => DB.clienti.length === 1 && DB.visite.length === 1 && DB.operazioni.length === 2));
  ok('archivio ritrovato dopo la ricarica', await page.evaluate(() => DB.concimi.length) === 1);
  ok('conto ritrovato dopo la ricarica',
    await page.evaluate(() => DB.visite[0].Conto?.length) === 4);
  ok('prezzo scritto a mano sopravvive alla ricarica',
    await page.evaluate(() => DB.visite[0].Conto.find(r => r.Chiave === 'manodopera').Prezzo) == 32);

  // ── il rapportino da mandare ──
  ok('senza indirizzo dell\'azienda non si manda niente', await page.evaluate(() => {
    DB.impostazioni.EmailAzienda = '';
    return inviaRapportino(DB.visite[0]) === false;
  }));
  const testo = await page.evaluate(() => {
    DB.impostazioni.EmailAzienda = 'ufficio@esempio.it';
    DB.impostazioni.NomeMittente = 'Matteo';
    return testoRapportino(DB.visite[0]);
  });
  ok('il testo ha cliente, ore, lavoro e conto',
    testo.includes('Mario Rossi') && testo.includes('MANODOPERA') &&
    testo.includes('LAVORO SVOLTO') && testo.includes('CONTO'));
  ok('il testo riporta il totale', testo.includes('TOTALE: 319,00 €'));
  ok('il testo dice quali voci sono senza importo', testo.includes('senza importo'));
  ok('il testo è firmato', testo.trimEnd().endsWith('Matteo'));
  ok('le quantità hanno la virgola, non il punto',
    await page.evaluate(() => formattaQuantita(11.5) === '11,5') && !/\d\.\d/.test(testo),
    testo.match(/.*\d\.\d.*/)?.[0] || '');
  ok('una riga senza prezzo lo dice invece di lasciare un buco',
    testo.includes('importo da definire') && !testo.includes('— ×'));
  ok('gli importi si possono spegnere', await page.evaluate(() => {
    DB.impostazioni.MostraImporti = '';
    const t = testoRapportino(DB.visite[0]);
    DB.impostazioni.MostraImporti = 'Sì';
    return !t.includes('CONTO') && t.includes('LAVORO SVOLTO');
  }));

  // ── il rapportino come documento che viaggia verso l'ufficio ──
  const doc = await page.evaluate(() => costruisciRapportino({
    visita: DB.visite[0],
    cliente: DB.clienti.find(c => c.ClienteID == DB.visite[0].ClienteID),
    operazioni: DB.operazioni.filter(o => o.VisitaID == DB.visite[0].VisitaID),
    tipi: DB.tipiOperazione, voci: DB.voci,
    concimi: DB.concimi, sementi: DB.sementi, fitofarmaci: DB.fitofarmaci,
  }));
  ok('il documento porta il cliente e la data', doc.cliente.nome === 'Mario Rossi' && !!doc.data);
  ok('il documento porta le ore calcolate', doc.ore.totale === 8 && doc.ore.fasce.length === 1);
  ok('il nome del prodotto viaggia col documento, non solo il codice',
    doc.operazioni.some(o => o.prodotto === 'Nitrophoska'),
    JSON.stringify(doc.operazioni.map(o => o.prodotto)));
  ok('le righe del conto portano le quantità', doc.righe.length === 4);
  ok('il prezzo è una proposta, non una decisione',
    doc.righe.find(r => r.chiave === 'manodopera').prezzoProposto == 32);
  ok('l\'identificativo è quello della visita, così una correzione sostituisce',
    doc.id === await page.evaluate(() => DB.visite[0].VisitaID));

  ok('si rilegge quello che si è scritto', await page.evaluate(d => {
    const riletto = leggiRapportino(JSON.stringify(d));
    return riletto.id === d.id && riletto.ore.totale === d.ore.totale;
  }, doc));
  ok('un file che non è un rapportino viene respinto', await page.evaluate(() => {
    try { leggiRapportino('{"tipo":"altro"}'); return false; } catch (e) { return true; }
  }));
  ok('un file troncato viene respinto invece di passare a metà', await page.evaluate(() => {
    try { leggiRapportino('{"tipo":"rappo'); return false; } catch (e) { return true; }
  }));
  // Un documento scritto da una versione futura può avere campi che questa non
  // sa leggere: archiviarlo monco in silenzio sarebbe il guasto peggiore.
  ok('un rapportino di una versione futura si ferma e lo dice', await page.evaluate(() => {
    try { leggiRapportino({ tipo:'rapportino', versione: 99, id:'x' }); return false; }
    catch (e) { return e.message.includes('recente'); }
  }));
  ok('il nome del file resta leggibile a occhio', await page.evaluate(d =>
    /^\d{4}-\d{2}-\d{2}-mario-rossi-/.test(nomeFileRapportino(d)), doc));

  // ── il trattamento si fattura a corpo, non a litri ──
  ok('la voce trattamento è a corpo',
    await page.evaluate(() => isSi(DB.voci.find(v => v.VoceID === 'trattamento').ACorpo)));
  ok('il trattamento è agganciato alla voce a corpo, non al fitofarmaco',
    await page.evaluate(() => DB.tipiOperazione.find(t => t.TipoID === 'trattamento-fitosanitario').VoceID) === 'trattamento');
  ok('due litri di prodotto fanno una riga da uno, non da due', await page.evaluate(() => {
    const finta = { OperazioneID:'op-test', TipoID:'trattamento-fitosanitario',
      Tipo_operazione:'Trattamento fitosanitario', Quantita: 2, Unita:'l' };
    const riga = righeAutomatiche([], [finta]).find(r => r.Chiave === 'op-test');
    return riga && riga.Quantita === 1 && riga.Unita === '';
  }));

  // ── riaprendo la visita si ritrova tutto, conto compreso ──
  await page.click('#nav-visite');
  await page.click('.visit-card button:has-text("Apri")');
  await page.waitForTimeout(300);
  ok('riaprendo, il conto è quello di prima',
    await page.locator('#conto-righe .conto-riga').count() === 4);
  ok('il prezzo scritto a mano è ancora lì',
    await page.locator('#conto-righe .conto-riga').first().locator('input').nth(1).inputValue() === '32');
  ok('la riga aggiunta a mano non sparisce',
    (await page.textContent('#conto-righe')).includes('Noleggio rullo'));
  // 8 h × 32 € + 45 € + 10 kg × 1,80 € = 319 €
  ok('totale ritrovato', (await page.textContent('#conto-totale')).includes('319,00'));
  await page.evaluate(() => closeDrawer('overlay-visita'));
  await page.waitForTimeout(150);

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
    await page.evaluate(() => DB.clienti.length === 1 && DB.visite.length === 1 && DB.operazioni.length === 2));
  ok('contatore modifiche azzerato dal backup', await page.evaluate(() => META.modificheDalBackup) === 0);

  // ── migrazioni ──
  ok('backup senza versione attraversa le migrazioni', await page.evaluate(() => {
    const db = migra({ clienti: [{ ClienteID: 'x', Cliente: 'Vecchio', FasciaID: '2', Target_N_g_m2_anno: 99 }] });
    return db.clienti[0].Target_N_g_m2_anno === undefined && db.clienti[0].Cliente === 'Vecchio';
  }));
  ok('migrazione regge un database vuoto',
    await page.evaluate(() => COLLEZIONI.every(k => Array.isArray(migra(null)[k]))));
  ok('la migrazione riaggancia le operazioni vecchie', await page.evaluate(() => {
    const db = migra({ operazioni: [
      { OperazioneID:'a', Tipo_operazione:'Potatura', Flag_siepe:'Sì' },
      { OperazioneID:'b', Tipo_operazione:'Concimazione', Dose_kg:7 },
      { OperazioneID:'c', Tipo_operazione:'Diserbo', Flag_prato:'Sì' },
    ] }, 2);
    const [a, b, c] = db.operazioni;
    return a.TipoID === 'potatura-siepi'
        && b.TipoID === 'concimazione' && b.Quantita === 7 && b.Dose_kg === undefined
        && c.TipoID === 'diserbo-selettivo'
        && db.tipiOperazione.length === 13;
  }));
  ok('migrazione 4 → 5 senza calpestare i prezzi già messi', await page.evaluate(() => {
    const db = migra({
      voci: [{ VoceID:'trasferimento', Nome:'Trasferimento', Prezzo: 45 }],
      tipiOperazione: [{ TipoID:'trattamento-fitosanitario', Nome:'Trattamento fitosanitario', VoceID:'fitofarmaco' }],
    }, 4);
    const trasf = db.voci.find(v => v.VoceID === 'trasferimento');
    const tipo = db.tipiOperazione.find(t => t.TipoID === 'trattamento-fitosanitario');
    return isSi(trasf.ACorpo) && trasf.Prezzo === 45
        && db.voci.some(v => v.VoceID === 'trattamento')
        && tipo.VoceID === 'trattamento';
  }));
  ok('un aggancio scelto a mano non viene riscritto dalla migrazione', await page.evaluate(() => {
    const db = migra({
      voci: [{ VoceID:'trasferimento', Nome:'Trasferimento' }],
      tipiOperazione: [{ TipoID:'trattamento-fitosanitario', VoceID:'concime' }],
    }, 4);
    return db.tipiOperazione[0].VoceID === 'concime';
  }));
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

  // ── scheda cliente: riepilogo prato in una riga ──
  await page.click('#nav-clienti');
  await page.click('.client-card');
  await page.waitForTimeout(200);
  const scheda = await page.textContent('#page-clienti');
  ok('scheda cliente: fascia, superficie e percentuale',
    scheda.includes('Fascia 7') && scheda.includes('200 mq') && scheda.includes('concimato'));
  ok('scheda cliente: niente dettaglio di azoto e potassio',
    !scheda.includes('Target N') && !scheda.includes('g/m²'), scheda.slice(0, 0));

  // ── eliminazione a cascata ──
  await page.click('button.btn-danger:has-text("Elimina")');
  await page.waitForTimeout(400);
  ok('cliente eliminato con visite e operazioni',
    await page.evaluate(() => DB.visite.length === 0 && DB.operazioni.length === 0));

  // ── tasto indietro: chiude un livello per volta, non esce dall'app ──
  await page.click('#nav-prati');
  await page.goBack();
  await page.waitForTimeout(200);
  ok('indietro da una pagina riporta alla home', await page.isVisible('#page-home'));
  ok('indietro non ha fatto uscire dall\'app', await page.evaluate(() => typeof DB === 'object'));

  await page.click('#nav-clienti');
  await page.click('#topbar-action-btn');
  await page.waitForTimeout(200);
  ok('pannello aperto', await page.evaluate(() => !!document.querySelector('.overlay.open')));
  await page.goBack();
  await page.waitForTimeout(200);
  ok('indietro chiude il pannello', await page.evaluate(() => !document.querySelector('.overlay.open')));
  ok('indietro sul pannello lascia la pagina dov\'era', await page.isVisible('#page-clienti'));

  await page.click('.client-card');
  await page.waitForTimeout(200);
  await page.goBack();
  await page.waitForTimeout(200);
  ok('indietro dalla scheda cliente torna alla lista',
    await page.evaluate(() => !!document.getElementById('clienti-list')));

  await page.click('#nav-home');
  await page.waitForTimeout(150);

  // ── avviso di versione nuova ──
  ok('la barra di aggiornamento è nascosta finché non serve',
    !(await page.isVisible('#barra-aggiorna')));
  await page.evaluate(() => mostraAggiornamento());
  await page.waitForTimeout(150);
  ok('quando arriva una versione nuova la barra resta a video',
    await page.isVisible('#barra-aggiorna'));
  await page.evaluate(() => document.getElementById('barra-aggiorna').classList.remove('mostra'));

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
