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

  // ── le voci da conteggiare si compilano mentre registri ──
  // Senza prezzi: il listino sta in ufficio. Il cantiere dice cosa è stato fatto
  // e quanto, che è la cosa che solo lui sa.
  ok('tre righe automatiche: manodopera, trasferimento, concime',
    await page.locator('#conto-righe .conto-riga').count() === 3);
  ok('manodopera precompilata con le ore calcolate',
    await page.locator('#conto-righe .conto-riga').first().locator('input').first().inputValue() === '8');
  ok('il trasferimento c\'è sempre, senza aggiungerlo',
    (await page.textContent('#conto-righe')).includes('Trasferimento'));
  ok('l\'operazione libera non fa riga di conto',
    !(await page.textContent('#conto-righe')).includes('Riparazione irrigazione'));
  ok('ogni riga ha un campo solo, la quantità: nessun prezzo sul telefono',
    await page.locator('#conto-righe .conto-riga').first().locator('input').count() === 1);
  ok('e in fondo non c\'è nessun totale da leggere',
    await page.locator('#conto-totale').count() === 0);

  const riga = i => page.locator('#conto-righe .conto-riga').nth(i);

  await page.fill('#f-conto-libera', 'Noleggio rullo');
  await page.press('#f-conto-libera', 'Enter');
  await page.waitForTimeout(150);
  ok('riga aggiunta a mano', await page.locator('#conto-righe .conto-riga').count() === 4);

  // il conto segue le ore mentre le correggi, senza uscire dalla schermata
  await page.locator('#fasce-list .fascia').first().locator('input[type=number]').fill('3');
  await page.waitForTimeout(200);
  ok('cambiando le persone la manodopera si aggiorna da sola',
    await riga(0).locator('input').first().inputValue() === '12');
  ok('e la riga aggiunta a mano resta dov\'è',
    (await page.textContent('#conto-righe')).includes('Noleggio rullo'));
  await page.locator('#fasce-list .fascia').first().locator('input[type=number]').fill('2');
  await page.waitForTimeout(200);

  // Il prossimo intervento è l'unica cosa che dal cantiere arriva in ufficio come
  // lavoro da pianificare: la lavagna lo prende da qui.
  await page.fill('#f-visita-prossimo', 'Potatura siepe di lauro');
  await page.selectOption('#f-visita-mese', '03');
  await page.fill('#f-visita-anno', '2027');

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
  // ── i prezzi sono passati in ufficio ──
  ok('nessun prezzo sulle righe registrate dal telefono',
    await page.evaluate(() => DB.visite[0].Conto.every(r => r.Prezzo === undefined)));
  ok('le quantità restano: sono quello che solo il cantiere sa',
    await page.evaluate(() => DB.visite[0].Conto.find(r => r.Chiave === 'manodopera').Quantita) == 8);
  ok('le voci in archivio non hanno più un prezzo',
    await page.evaluate(() => DB.voci.every(v => v.Prezzo === undefined)));
  ok('e l\'interruttore degli importi non esiste più',
    await page.evaluate(() => DB.impostazioni.MostraImporti === undefined));
  ok('le quantità hanno la virgola, non il punto',
    await page.evaluate(() => formattaQuantita(11.5) === '11,5'));

  // ── il passaggio di consegne del listino ──
  // I prezzi già scritti sul telefono non si buttano via a un aggiornamento:
  // restano da parte finché non sono stati portati in ufficio.
  const listinoDalTelefono = await page.evaluate(() => {
    DB.listinoVecchio = [{ VoceID: 'manodopera', Nome: 'Manodopera', Unita: 'h', Prezzo: 32, ACorpo: '' }];
    renderListinoVecchio();
    return listinoPerUfficio();
  });
  ok('finché ci sono prezzi da portare, la pagina Dati lo dice',
    (await page.textContent('#listino-vecchio-wrap')).includes('passato in ufficio'));
  ok('ed esce un documento, non una tabella da ribattere',
    listinoDalTelefono.tipo === 'listino' && listinoDalTelefono.voci[0].prezzo === 32);
  ok('la scheda sparisce quando il giro è fatto', await page.evaluate(() => {
    delete DB.listinoVecchio;
    renderListinoVecchio();
    return document.getElementById('listino-vecchio-wrap').innerHTML === '';
  }));


  // ── la coda di uscita: il lavoro resta al sicuro, la consegna riprova ──
  const CONSEGNA = 'https://consegna.esempio.invalid/exec';
  let rispostaFinta = { status: 'ok' };
  let consegneRicevute = 0;
  await ctx.route(CONSEGNA, r => {
    consegneRicevute++;
    if (rispostaFinta === 'html') {
      // Apps Script risponde 200 con una pagina HTML quando qualcosa va storto:
      // è la trappola che aveva già fregato la vecchia app col foglio.
      return r.fulfill({ status: 200, contentType: 'text/html', body: '<html>Errore</html>' });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rispostaFinta) });
  });

  ok('senza indirizzo di consegna non parte niente e lo dice', await page.evaluate(async () => {
    DB.impostazioni.UrlRapportini = '';
    try { await consegnaRapportino({ tipo: 'rapportino', id: 'x' }); return false; }
    catch (e) { return e.message.includes('indirizzo'); }
  }));

  await page.evaluate(u => { DB.impostazioni.UrlRapportini = u; }, CONSEGNA);
  await page.evaluate(async () => { accodaRapportino(DB.visite[0]); await salvaDB({ conta: false }); renderAll(); });
  ok('il rapportino entra in coda', await page.evaluate(() => DB.coda.length) === 1);
  ok('la visita si vede che è da consegnare',
    (await page.textContent('#visite-list')).includes('da consegnare'));

  // rimandare lo stesso rapportino corretto non ne fa partire due
  await page.evaluate(() => accodaRapportino(DB.visite[0]));
  ok('riaccodare la stessa visita sostituisce invece di duplicare',
    await page.evaluate(() => DB.coda.length) === 1);

  // senza rete la coda aspetta, non perde niente
  await ctx.setOffline(true);
  await page.evaluate(() => svuotaCoda());
  await page.waitForTimeout(200);
  ok('senza rete il rapportino resta in coda', await page.evaluate(() => DB.coda.length) === 1);
  await ctx.setOffline(false);

  // il servizio risponde con una pagina HTML: non è una conferma
  rispostaFinta = 'html';
  await page.evaluate(() => svuotaCoda());
  await page.waitForTimeout(300);
  ok('una risposta che non è una conferma non svuota la coda',
    await page.evaluate(() => DB.coda.length) === 1);
  ok('l\'errore resta scritto sulla voce in coda',
    await page.evaluate(() => !!DB.coda[0].errore));

  // risposta che è JSON valido ma non conferma niente: capita con un portale
  // captive o un servizio che cambia formato. Silenzio non vuol dire consegnato.
  rispostaFinta = { qualcosa: 'altro' };
  await page.evaluate(() => svuotaCoda());
  await page.waitForTimeout(300);
  ok('una risposta senza conferma non vale come consegna',
    await page.evaluate(() => DB.coda.length) === 1);

  // il servizio risponde male ma in JSON
  rispostaFinta = { status: 'error', msg: 'cartella non trovata' };
  await page.evaluate(() => svuotaCoda());
  await page.waitForTimeout(300);
  ok('un errore dichiarato dal servizio non fa sparire il rapportino',
    await page.evaluate(() => DB.coda.length === 1 && DB.coda[0].errore.includes('cartella')));

  // e finalmente va a buon fine
  rispostaFinta = { status: 'ok' };
  await page.evaluate(() => svuotaCoda());
  await page.waitForTimeout(400);
  ok('consegnato, la coda si svuota', await page.evaluate(() => DB.coda.length) === 0);
  ok('la visita si segna consegnata', await page.evaluate(() => !!DB.visite[0].Consegnato));
  ok('la visita porta il numero di revisione consegnata',
    await page.evaluate(() => DB.visite[0].Revisione) >= 1);
  ok('il servizio è stato chiamato davvero', consegneRicevute >= 3, 'chiamate: ' + consegneRicevute);
  await page.evaluate(() => { DB.visite[0].Consegnato = ''; return salvaDB({ conta: false }); });
  await ctx.unroute(CONSEGNA);

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
  // Il documento porta le quantità e non i prezzi: il listino sta in ufficio.
  // Il campo resta nel formato, sempre vuoto, perché i rapportini già depositati
  // su Drive lo contengono e devono continuare a leggersi.
  ok('nessun prezzo viaggia più dal cantiere',
    doc.righe.every(r => r.prezzoProposto === null));
  ok('ma le quantità sì', doc.righe.find(r => r.chiave === 'manodopera').quantita === 8);
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
  ok('le quantità sono quelle di prima',
    await page.locator('#conto-righe .conto-riga').first().locator('input').first().inputValue() === '8');
  ok('la riga aggiunta a mano non sparisce',
    (await page.textContent('#conto-righe')).includes('Noleggio rullo'));
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
    // Il prezzo non è più sulla voce — il listino è passato in ufficio — ma non è
    // stato buttato: un backup di due versioni fa lo attraversa e lo consegna.
    return isSi(trasf.ACorpo) && trasf.Prezzo === undefined
        && db.listinoVecchio.some(v => v.VoceID === 'trasferimento' && v.Prezzo === 45)
        && db.voci.some(v => v.VoceID === 'trattamento')
        && tipo.VoceID === 'trattamento';
  }));
  // ── 7 → 8: il listino passa in ufficio ──
  ok('la migrazione 8 toglie i prezzi dalle voci', await page.evaluate(() => {
    const db = migra({ voci: [
      { VoceID:'manodopera', Nome:'Manodopera', Unita:'h', Prezzo: 32 },
      { VoceID:'piante', Nome:'Piante', Unita:'n', Prezzo: '' },
    ], impostazioni: { MostraImporti: 'Sì' } }, 7);
    return db.voci.every(v => v.Prezzo === undefined) && db.impostazioni.MostraImporti === undefined;
  }));
  // Cancellare a un aggiornamento un listino costruito in mesi sarebbe
  // imperdonabile: quello che c'era resta finché non è stato portato di là.
  ok('ma li mette da parte invece di buttarli', await page.evaluate(() => {
    const db = migra({ voci: [
      { VoceID:'manodopera', Nome:'Manodopera', Unita:'h', Prezzo: 32 },
      { VoceID:'piante', Nome:'Piante', Unita:'n', Prezzo: '' },
    ] }, 7);
    return db.listinoVecchio.length === 1 && db.listinoVecchio[0].Prezzo === 32;
  }));
  ok('e senza prezzi da salvare non lascia niente in giro', await page.evaluate(() => {
    const db = migra({ voci: [{ VoceID:'piante', Nome:'Piante', Prezzo: '' }] }, 7);
    return db.listinoVecchio === undefined || db.listinoVecchio.length === 0;
  }));
  ok('i conti delle visite già registrate non si riscrivono', await page.evaluate(() => {
    const db = migra({ visite: [{ VisitaID:'v1', Conto: [{ Chiave:'manodopera', Quantita: 8, Prezzo: 30 }] }] }, 7);
    return db.visite[0].Conto[0].Prezzo === 30;
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

  // ── l'anagrafica che il telefono passa all'ufficio ──
  // Presa qui, con più di un cliente in archivio: in ufficio ne arriverà anche
  // uno che nei rapportini non compare, ed è il caso che conta.
  const anagraficaDalTelefono = await page.evaluate(() => anagraficaPerUfficio());
  ok('l\'anagrafica esce con i clienti e il loro identificativo',
    anagraficaDalTelefono.tipo === 'anagrafica' &&
    anagraficaDalTelefono.clienti.length >= 2 &&
    anagraficaDalTelefono.clienti.every(c => c.id),
    JSON.stringify(anagraficaDalTelefono.clienti.map(c => c.nome)));
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

  // ── il service worker del cantiere non si prende l'app dell'ufficio ──
  // Ha lo scope sulla radice, quindi /ufficio/ gli passa davanti. Se la
  // cacheggiasse, l'app dell'ufficio si aggiornerebbe con le regole del telefono
  // — al secondo avvio — ma senza la barra che avvisa, e sul PC nessuno se ne
  // accorgerebbe. Si guarda la cache, non la pagina: l'emulazione offline di
  // Playwright non vale per le richieste che fa il service worker, e una prova
  // basata su quella passerebbe per il motivo sbagliato.
  await page.waitForTimeout(1200);  // lascia installare il service worker
  await page.goto(BASE + 'ufficio/', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  const ufficioInCache = await page.evaluate(async () => {
    for (const nome of await caches.keys()) {
      const chiavi = await (await caches.open(nome)).keys();
      if (chiavi.some(r => r.url.includes('/ufficio/'))) return true;
    }
    return false;
  });
  ok('il service worker del cantiere non mette in cache l\'app dell\'ufficio', !ufficioInCache);
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(400);

  // ── offline ──
  await ctx.setOffline(true);
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  ok('app si apre senza rete', await page.isVisible('#page-home'));
  ok('dati leggibili senza rete', await page.evaluate(() => DB.clienti.length) >= 1);


  // ── L'APP DELL'UFFICIO ──
  // Legge la cartella di Drive come una cartella normale del disco. Qui la
  // cartella è finta: l'API del browser apre una finestra di sistema che un test
  // non può toccare, ed è il motivo per cui tutto il contatto con quell'API sta
  // in un punto solo. Il documento che le diamo in pasto non è inventato — è
  // quello che l'app del cantiere ha prodotto poche righe sopra: se le due app
  // non si capiscono, si vede qui.
  const ctxU = await browser.newContext();
  const pagU = await ctxU.newPage();
  const erroriU = [];
  pagU.on('pageerror', e => erroriU.push(String(e)));
  pagU.on('console', m => {
    if (m.type() === 'error' && !m.text().includes('Failed to load resource')) erroriU.push('console: ' + m.text());
  });
  pagU.on('dialog', d => d.accept());
  await ctxU.route('**://fonts.googleapis.com/**', r => r.abort());
  await ctxU.route('**://fonts.gstatic.com/**', r => r.abort());
  await pagU.goto(BASE + 'ufficio/', { waitUntil: 'load' });
  await pagU.waitForTimeout(400);

  ok('l\'app dell\'ufficio si apre e chiede la cartella',
    (await pagU.textContent('#pagina-arrivi')).includes('Collega la cartella'));

  await pagU.evaluate(() => {
    // Una cartella che sa fare solo quello che l'app le chiede: getFileHandle,
    // getDirectoryHandle, values(), createWritable.
    window.creaCartellaFinta = function (nome) {
      const file = new Map();
      const sotto = new Map();
      return {
        kind: 'directory', name: nome, _file: file, _sotto: sotto,
        async getDirectoryHandle(n, o) {
          if (!sotto.has(n)) {
            if (!o || !o.create) throw new Error('NotFoundError');
            sotto.set(n, window.creaCartellaFinta(n));
          }
          return sotto.get(n);
        },
        async getFileHandle(n, o) {
          if (!file.has(n)) {
            if (!o || !o.create) throw new Error('NotFoundError');
            file.set(n, '');
          }
          return {
            kind: 'file', name: n,
            async getFile() { const t = file.get(n); return { text: async () => t }; },
            async createWritable() { return { async write(t) { file.set(n, t); }, async close() {} }; },
          };
        },
        values() {
          const voci = [...file.keys()].map(n => ({ kind: 'file', name: n }))
            .concat([...sotto.keys()].map(n => ({ kind: 'directory', name: n })));
          return (async function* () { for (const v of voci) yield v; })();
        },
        async queryPermission() { return 'granted'; },
        async requestPermission() { return 'granted'; },
      };
    };
  });

  await pagU.evaluate(async d => {
    window.RADICE = window.creaCartellaFinta('GiardinoApp');
    const arrivi = await window.RADICE.getDirectoryHandle('rapportini', { create: true });
    await scriviTesto(arrivi, nomeFileRapportino(d), JSON.stringify(d));
    // Drive a metà sincronizzazione lascia file troncati, e nella cartella può
    // finirci dentro qualcosa che non è un rapportino.
    await scriviTesto(arrivi, 'a-troncato.json', '{"tipo":"rapportino","id":"abc"');
    await scriviTesto(arrivi, 'b-altro.json', '{"tipo":"listaspesa"}');
    await usaCartella(window.RADICE);
  }, doc);
  await pagU.waitForTimeout(200);

  ok('il rapportino del cantiere arriva in ufficio',
    await pagU.evaluate(() => ARRIVI.length) === 1);
  ok('i file illeggibili si vedono invece di sparire',
    await pagU.evaluate(() => ILLEGGIBILI.length) === 2);
  ok('l\'elenco in arrivo li dice a schermo',
    (await pagU.textContent('#pagina-arrivi')).includes('non leggibili'));
  ok('il cliente si legge senza avere l\'anagrafica',
    (await pagU.textContent('#pagina-arrivi')).includes('Mario Rossi'));

  // il listino dell'ufficio è l'unico che conta: quello del cantiere è un'idea
  const prezzoApplicato = await pagU.evaluate(() => {
    const manodopera = ARRIVI[0].doc.righe.find(r => r.chiave === 'manodopera');
    importaVoce(manodopera.voceID, 'Manodopera', 'h');
    modificaVoce(manodopera.voceID, 'prezzo', '35');
    apriLavoro(ARRIVI[0].doc.id);
    return LAVORO.righe.find(r => r.chiave === 'manodopera').prezzo;
  });
  ok('il listino dell\'ufficio vince sul prezzo proposto dal cantiere', prezzoApplicato === 35);
  ok('la schermata del lavoro mostra le ore del cantiere',
    (await pagU.textContent('#pagina-lavoro')).includes('8,00 h'));

  const conto = await pagU.evaluate(() => totaleConteggio(LAVORO.righe));
  ok('il totale somma le righe complete', conto.totale > 0, JSON.stringify(conto));
  ok('e dice quante ne ha lasciate fuori', conto.escluse >= 1, JSON.stringify(conto));
  ok('l\'avvertenza sul totale incompleto è a schermo',
    (await pagU.textContent('#pagina-lavoro')).includes('fuori dal totale'));

  // un prezzo scritto a mano è una decisione, e non va risovrascritta
  await pagU.evaluate(() => {
    const i = LAVORO.righe.findIndex(r => r.chiave === 'manodopera');
    modificaRiga(i, 'prezzo', '40');
  });
  ok('un prezzo scritto a mano si segna come tale',
    await pagU.evaluate(() => LAVORO.righe.find(r => r.chiave === 'manodopera').manuale) === true);
  ok('l\'importo della riga si aggiorna senza ridisegnare la tabella',
    (await pagU.textContent('#pagina-lavoro')).includes('320,00 €'));

  await pagU.evaluate(() => archivia());
  await pagU.waitForTimeout(200);
  ok('archiviato, il lavoro esce dall\'elenco in arrivo',
    await pagU.evaluate(() => ARRIVI.length) === 0);
  ok('e compare in archivio', await pagU.evaluate(() => ARCHIVIO.length) === 1);
  const annoLavoro = String(doc.data).slice(0, 4);
  ok('l\'archivio è un file nella cartella di Drive, non nel browser',
    await pagU.evaluate(async a => {
      const archivio = await window.RADICE.getDirectoryHandle('archivio');
      return (await elencaFile(await archivio.getDirectoryHandle(a))).length;
    }, annoLavoro) === 1);
  // Il file deve raccontare il lavoro da solo anche fra due anni, senza il
  // telefono e senza la cartella degli arrivi.
  ok('il rapportino viaggia dentro il lavoro archiviato',
    await pagU.evaluate(() => !!ARCHIVIO[0].rapportino && ARCHIVIO[0].rapportino.operazioni.length > 0));
  ok('il totale archiviato è quello corretto a mano',
    await pagU.evaluate(() => ARCHIVIO[0].righe.find(r => r.chiave === 'manodopera').prezzo) == 40);

  // ── la stessa visita corretta e rimandata ──
  const revisioneCorretta = (Number(doc.revisione) || 1) + 1;
  await pagU.evaluate(async ({ d, rev }) => {
    const arrivi = await window.RADICE.getDirectoryHandle('rapportini');
    await scriviTesto(arrivi, nomeFileRapportino(d), JSON.stringify({ ...d, revisione: rev, note: 'ore corrette' }));
    await ricarica();
    disegna();
  }, { d: doc, rev: revisioneCorretta });
  ok('una revisione più recente torna fra i lavori da rivedere',
    await pagU.evaluate(() => ARRIVI.length === 1 && ARRIVI[0].corretto === true));
  ok('e si vede che è una correzione',
    (await pagU.textContent('#pagina-arrivi')).includes('corretto'));
  ok('il prezzo messo a mano sopravvive alla correzione',
    await pagU.evaluate(() => {
      apriLavoro(ARRIVI[0].doc.id);
      return LAVORO.righe.find(r => r.chiave === 'manodopera').prezzo;
    }) == 40);

  await pagU.evaluate(() => archivia());
  await pagU.waitForTimeout(200);
  // Due file con lo stesso lavoro dentro sono il modo migliore per fatturarlo
  // due volte: la revisione nuova riscrive quella vecchia.
  ok('la correzione riscrive il file, non ne affianca un secondo',
    await pagU.evaluate(async a => {
      const archivio = await window.RADICE.getDirectoryHandle('archivio');
      return (await elencaFile(await archivio.getDirectoryHandle(a))).length;
    }, annoLavoro) === 1);
  ok('in archivio resta un solo lavoro', await pagU.evaluate(() => ARCHIVIO.length) === 1);
  ok('con la revisione aggiornata',
    await pagU.evaluate(() => ARCHIVIO[0].revisione) === revisioneCorretta);

  // ── fatturato, e il listino che resta scritto ──
  await pagU.evaluate(() => cambiaStato(ARCHIVIO[0].id, 'fatturato'));
  await pagU.waitForTimeout(150);
  // Il nome del file nasce da data e cliente: se sul telefono il cliente viene
  // rinominato, la revisione nuova cadrebbe in un file diverso e lo stesso lavoro
  // starebbe in archivio due volte — pronto per essere fatturato due volte.
  await pagU.evaluate(async ({ d, rev }) => {
    const arrivi = await window.RADICE.getDirectoryHandle('rapportini');
    const corretto = { ...d, revisione: rev, cliente: { ...d.cliente, nome: 'Mario Rossi Junior' } };
    await scriviTesto(arrivi, nomeFileRapportino(corretto), JSON.stringify(corretto));
    await ricarica();
    apriLavoro(d.id);
    await archivia();
  }, { d: doc, rev: revisioneCorretta + 1 });
  await pagU.waitForTimeout(200);
  ok('un cliente rinominato non crea un secondo file per lo stesso lavoro',
    await pagU.evaluate(async a => {
      const archivio = await window.RADICE.getDirectoryHandle('archivio');
      return (await elencaFile(await archivio.getDirectoryHandle(a))).length;
    }, annoLavoro) === 1, 'file in archivio');
  ok('e in archivio il lavoro resta uno', await pagU.evaluate(() => ARCHIVIO.length) === 1);

  ok('lo stato fatturato finisce sul file, non solo a schermo',
    await pagU.evaluate(async () => { await ricarica(); return ARCHIVIO[0].stato; }) === 'fatturato');

  // Un prezzo appena battuto e non ancora salvato non deve sparire perché
  // qualcuno ha premuto Ricontrolla: la rilettura della cartella lo rispetta.
  ok('le modifiche al listino non salvate sopravvivono a una rilettura',
    await pagU.evaluate(async () => {
      await ricarica();
      const v = LISTINO.voci.find(x => String(x.prezzo) === '35');
      return !!v && LISTINO_DA_SALVARE === true;
    }));
  await pagU.evaluate(() => salvaListino());
  await pagU.waitForTimeout(150);
  ok('il listino si rilegge dalla cartella dopo il salvataggio',
    await pagU.evaluate(async () => {
      await ricarica();
      return LISTINO.voci.length >= 1 && LISTINO_DA_SALVARE === false;
    }));
  ok('le voci viste nei rapportini e non in listino si possono importare',
    await pagU.evaluate(() => vociMancanti().length) >= 1);

  // Il giro completo: i prezzi che stavano sul telefono arrivano in ufficio senza
  // che nessuno li ribatta. È il motivo per cui il file esce in questo formato.
  ok('il listino esportato dal telefono lo legge l\'ufficio così com\'è',
    await pagU.evaluate(async doc => {
      await scriviTesto(window.RADICE, 'listino.json', JSON.stringify(doc));
      LISTINO_DA_SALVARE = false;
      await ricarica();
      const v = LISTINO.voci.find(x => x.voceID === 'manodopera');
      return !!v && Number(v.prezzo) === 32;
    }, listinoDalTelefono));

  // ── il foglio che va al cliente ──
  await pagU.evaluate(() => {
    vaiA('impostazioni');
    modificaImpostazione('azienda', 'Giardini Prova');
    modificaImpostazione('piva', '01234567890');
  });
  ok('il cartello delle impostazioni non salvate si accende',
    await pagU.isVisible('#impostazioni-da-salvare'));
  ok('le impostazioni non salvate sopravvivono a una rilettura',
    await pagU.evaluate(async () => { await ricarica(); return IMPOSTAZIONI.azienda; }) === 'Giardini Prova');
  await pagU.evaluate(() => salvaImpostazioni());
  await pagU.waitForTimeout(150);
  ok('l\'intestazione si rilegge dal file della cartella',
    await pagU.evaluate(async () => { await ricarica(); return IMPOSTAZIONI.piva; }) === '01234567890');

  const foglio = await pagU.evaluate(() => {
    window.print = () => {};  // in headless non c'è un dialogo di stampa da aprire
    stampaConto('archivio', ARCHIVIO[0].id);
    return { html: document.getElementById('foglio').innerHTML, titolo: document.title };
  });
  ok('il foglio porta l\'intestazione dell\'azienda', foglio.html.includes('Giardini Prova'));
  ok('e il cliente a cui va consegnato', foglio.html.includes('Mario Rossi'));
  // I prezzi del listino sono IVA inclusa: un importo su un foglio che esce senza
  // dirlo è un'ambiguità che qualcuno paga.
  ok('il totale dice che l\'IVA è inclusa', foglio.html.includes('IVA inclusa'));
  ok('una voce senza prezzo stampa «da definire», non uno spazio bianco',
    foglio.html.includes('da definire'));
  // Ore e operazioni restano in ufficio: al cliente va il conto.
  ok('il foglio non porta le operazioni agronomiche', !foglio.html.includes('Nitrophoska'));
  ok('il nome che Chrome proporrà per il PDF parla di conto e cliente',
    /^Conto \d{4}-\d{2}-\d{2} Mario Rossi/.test(foglio.titolo), foglio.titolo);
  ok('il foglio non si vede a schermo: esiste solo per la stampa',
    !(await pagU.isVisible('#foglio')));
  ok('dall\'archivio si stampa senza riaprire il lavoro',
    (await pagU.evaluate(() => { vaiA('archivio'); return document.getElementById('pagina-archivio').innerHTML; }))
      .includes('stampaConto('));

  // ── la lavagna ──
  // Non è un calendario: è quello che in ufficio si tiene a matita. Le prove non
  // passano dal trascinamento del mouse ma dalla funzione che il rilascio chiama:
  // è lì che stanno le regole, e il trascinamento è solo il modo di invocarla.
  const settimana = await pagU.evaluate(() => {
    vaiA('lavagna');
    SETTIMANA = lunediDi(new Date('2026-09-21T12:00:00'));
    disegnaLavagna();
    return document.querySelector('#pagina-lavagna .settimana-num').textContent;
  });
  ok('la settimana ISO è quella giusta', settimana === 'Settimana 39', settimana);
  ok('la settimana ha sei giorni, non sette',
    await pagU.locator('#pagina-lavagna .giorno').count() === 6);
  ok('il sabato è a disposizione, non una giornata come le altre',
    (await pagU.textContent('#pagina-lavagna .giorno.sabato')).includes('a disposizione'));
  ok('ogni giorno è spezzato in mattina e pomeriggio',
    await pagU.locator('#pagina-lavagna .giorno').first().locator('.mezza').count() === 2);

  const presi = await pagU.evaluate(async () => {
    await importaProssimi();
    return LAVAGNA.lavori.length;
  });
  ok('il prossimo intervento segnato in cantiere arriva sulla lavagna', presi === 1);
  ok('col mese scritto a parole, non col numero della select',
    await pagU.evaluate(() => LAVAGNA.lavori[0].quando) === 'marzo 2027');
  ok('e con una data che serve a mettere in ordine la coda',
    await pagU.evaluate(() => LAVAGNA.lavori[0].entro) === '2027-03-01');
  // Lo stesso rapportino non deve tornare a ogni clic sul bottone.
  ok('un secondo giro non lo duplica',
    await pagU.evaluate(async () => { await importaProssimi(); return LAVAGNA.lavori.length; }) === 1);

  // ── dalla coda alla settimana: a matita ──
  const idLavoro = await pagU.evaluate(() => LAVAGNA.lavori[0].id);
  await pagU.evaluate(async id => spostaLavoro(id, '2026-09-22', 'pomeriggio'), idLavoro);
  await pagU.waitForTimeout(150);
  ok('trascinato in una mezza giornata diventa a matita',
    await pagU.evaluate(() => LAVAGNA.lavori[0].stato) === 'matita');
  ok('e si vede nel pomeriggio di quel giorno',
    await pagU.evaluate(() => LAVAGNA.lavori[0].giorno + ' ' + LAVAGNA.lavori[0].mezza) === '2026-09-22 pomeriggio');
  ok('la lavagna si è salvata da sola, senza un bottone',
    await pagU.evaluate(async () => {
      const l = JSON.parse(await leggiTesto(window.RADICE, 'lavagna.json'));
      return l.lavori[0].stato === 'matita' && l.lavori[0].giorno === '2026-09-22';
    }));

  // ── un tocco e il cliente ha confermato ──
  await pagU.evaluate(id => cambiaPenna(id), idLavoro);
  await pagU.waitForTimeout(120);
  ok('un clic sul cartellino lo segna confermato',
    await pagU.evaluate(() => LAVAGNA.lavori[0].stato) === 'confermato');
  ok('confermato si vede evidenziato, come sul foglio in ufficio',
    (await pagU.evaluate(() => { disegnaLavagna(); return document.getElementById('pagina-lavagna').innerHTML; }))
      .includes('cartellino confermato'));

  // ── niente si muove da solo cambiando settimana ──
  await pagU.evaluate(() => { cambiaSettimana(1); });
  ok('cambiando settimana il cartellino non si porta dietro',
    !(await pagU.textContent('#pagina-lavagna .giorni')).includes('Mario Rossi'));
  ok('e il lavoro è rimasto sulla sua data, non su una casella',
    await pagU.evaluate(() => LAVAGNA.lavori[0].giorno) === '2026-09-22');
  await pagU.evaluate(() => { cambiaSettimana(-1); });
  ok('tornando indietro è ancora lì',
    (await pagU.textContent('#pagina-lavagna .giorni')).includes('Mario Rossi'));

  // ── il lavoro si allarga a mano, mezza giornata per volta ──
  // La larghezza la decide chi pianifica, non la stima ore: dedurla legava la
  // lavagna a un numero messo a occhio.
  await pagU.evaluate(async id => {
    const l = LAVAGNA.lavori.find(x => x.id === id);
    l.ore = 20;
    await spostaLavoro(id, '2026-09-25', 'mattina');   // venerdì mattina
  }, idLavoro);
  await pagU.waitForTimeout(150);
  ok('venti ore in una mezza giornata restano dove le metti',
    await pagU.evaluate(() => copertura(LAVAGNA.lavori[0]).length) === 1);
  await pagU.evaluate(async id => { await allarga(id); await allarga(id); }, idLavoro);
  await pagU.waitForTimeout(150);
  const spalmato = await pagU.evaluate(() => copertura(LAVAGNA.lavori[0]));
  ok('due tocchi su + lo allargano di due mezze giornate', spalmato.length === 3,
    JSON.stringify(spalmato));
  ok('e il − lo stringe di nuovo', await pagU.evaluate(async id => {
    await stringi(id);
    const largo = copertura(LAVAGNA.lavori[0]).length;
    await allarga(id);
    return largo;
  }, idLavoro) === 2);
  ok('sotto una mezza giornata non si scende', await pagU.evaluate(async id => {
    const l = LAVAGNA.lavori.find(x => x.id === id);
    const prima = l.mezze;
    l.mezze = 1;
    await stringi(id);
    const dopo = l.mezze;
    l.mezze = prima;
    return dopo === 1;
  }, idLavoro));
  // La domenica non si lavora. Va provato con un lavoro che ci arriva davvero:
  // partendo dal venerdì con tre mezze giornate si finisce il sabato, e la prova
  // passerebbe senza aver verificato niente.
  const oltreDomenica = await pagU.evaluate(async id => {
    const l = LAVAGNA.lavori.find(x => x.id === id);
    l.ore = 24;
    l.mezze = 3;
    await spostaLavoro(id, '2026-09-26', 'mattina');   // sabato mattina
    return copertura(l);
  }, idLavoro);
  ok('un lavoro che sfora il sabato salta la domenica',
    oltreDomenica.length === 3 && !oltreDomenica.some(x => x.giorno === '2026-09-27'),
    JSON.stringify(oltreDomenica));
  ok('e riprende il lunedì',
    oltreDomenica[2].giorno === '2026-09-28' && oltreDomenica[2].mezza === 'mattina',
    JSON.stringify(oltreDomenica));
  ok('quando sfora la settimana mostrata, il cartellino lo dice',
    (await pagU.evaluate(() => { disegnaLavagna(); return document.getElementById('pagina-lavagna').innerHTML; }))
      .includes('continua la settimana prossima'));

  // rimesso dove stava, per le prove che seguono
  await pagU.evaluate(async id => {
    const l = LAVAGNA.lavori.find(x => x.id === id);
    l.ore = 20;
    l.mezze = 3;
    await spostaLavoro(id, '2026-09-25', 'mattina');
  }, idLavoro);
  // Le ore seguono la larghezza, non il contrario: sono un'indicazione per chi
  // guarda la colonna, non un vincolo sulla pianificazione.
  ok('le ore si spalmano sulle mezze giornate che occupa',
    await pagU.evaluate(() => [
      oreNellaMezza(LAVAGNA.lavori[0], '2026-09-25', 'mattina'),
      oreNellaMezza(LAVAGNA.lavori[0], '2026-09-25', 'pomeriggio'),
      oreNellaMezza(LAVAGNA.lavori[0], '2026-09-26', 'mattina'),
    ].join('|')) === '6.67|6.67|6.67');

  // ── rimetterlo in coda lo fa slittare, e lo dice ──
  await pagU.evaluate(async id => spostaLavoro(id, '', ''), idLavoro);
  await pagU.waitForTimeout(150);
  ok('tornato in coda, il lavoro è segnato come slittato',
    await pagU.evaluate(() => LAVAGNA.lavori[0].stato === 'lista' && LAVAGNA.lavori[0].rimandato === true));
  ok('e la coda lo dice a schermo',
    (await pagU.textContent('#pagina-lavagna')).includes('slittat'));

  // ── l'ordine della coda: bloccati in fondo, slittati in cima ──
  const ordine = await pagU.evaluate(async () => {
    LAVAGNA.lavori.push(sistemaLavoro({ cliente: 'Scade prima', entro: '2026-10-01', stato: 'lista' }));
    LAVAGNA.lavori.push(sistemaLavoro({ cliente: 'Scade dopo', entro: '2026-12-01', stato: 'lista' }));
    LAVAGNA.lavori.push(sistemaLavoro({ cliente: 'Bloccato', entro: '2026-09-22',
      requisiti: ['serve la piattaforma'], stato: 'lista' }));
    await salvaLavagna();
    disegnaLavagna();
    return LAVAGNA.lavori.filter(l => !piazzato(l)).sort(ordinaCoda).map(l => l.cliente);
  });
  ok('chi è slittato sta in cima', ordine[0].startsWith('Mario Rossi'), JSON.stringify(ordine));
  ok('poi chi scade prima', ordine[1] === 'Scade prima' && ordine[2] === 'Scade dopo', JSON.stringify(ordine));
  ok('e quello che non si può fare sta in fondo, anche se scade domani',
    ordine[ordine.length - 1] === 'Bloccato', JSON.stringify(ordine));

  ok('un lavoro aggiunto a mano si rilegge dal file',
    await pagU.evaluate(async () => { await ricarica(); return LAVAGNA.lavori.length; }) === 4);

  // ── correggere un lavoro senza cancellarlo e riscriverlo ──
  ok('il modulo si riapre già compilato', await pagU.evaluate(() => {
    disegnaLavagna();
    apriModuloLavoro(LAVAGNA.lavori.find(l => l.cliente === 'Scade prima').id);
    return document.getElementById('n-cliente').value === 'Scade prima';
  }));
  ok('e salvando corregge quello che c\'era invece di aggiungerne un altro',
    await pagU.evaluate(async () => {
      const prima = LAVAGNA.lavori.length;
      document.getElementById('n-cliente').value = 'Scade prima, corretto';
      document.getElementById('n-ore').value = '3';
      await salvaModuloLavoro();
      return LAVAGNA.lavori.length === prima &&
        LAVAGNA.lavori.some(l => l.cliente === 'Scade prima, corretto' && l.ore === 3);
    }));
  // Il modulo non conosce dove sta sulla settimana né se è confermato:
  // ricostruire il lavoro da zero lo staccherebbe dalla lavagna.
  ok('correggere un lavoro già piazzato non lo stacca dal suo giorno',
    await pagU.evaluate(async id => {
      const l = LAVAGNA.lavori.find(x => x.id === id);
      await spostaLavoro(id, '2026-09-24', 'mattina');
      await cambiaPenna(id);
      apriModuloLavoro(id);
      document.getElementById('n-cosa').value = 'Potatura, con scala';
      await salvaModuloLavoro();
      return l.giorno === '2026-09-24' && l.mezza === 'mattina' &&
        l.stato === 'confermato' && l.cosa === 'Potatura, con scala';
    }, idLavoro));

  // ── il prossimo intervento si prende anche da un rapportino appena arrivato ──
  // È il caso normale: lo si legge quando arriva, non dopo aver chiuso il conto.
  ok('un rapportino ancora in arrivo dà il suo prossimo intervento',
    await pagU.evaluate(async d => {
      const arrivi = await window.RADICE.getDirectoryHandle('rapportini');
      const nuovo = { ...d, id: 'visita-appena-arrivata', revisione: 1,
        cliente: { ...d.cliente, nome: 'Cliente Appena Arrivato' },
        prossimo: { cosa: 'Arieggiatura', mese: '04', anno: '2027' } };
      await scriviTesto(arrivi, nomeFileRapportino(nuovo), JSON.stringify(nuovo));
      await ricarica();
      if (!ARRIVI.some(a => a.doc.id === 'visita-appena-arrivata')) return 'non è arrivato';
      const prima = LAVAGNA.lavori.length;
      await importaProssimi();
      return LAVAGNA.lavori.length === prima + 1 &&
        LAVAGNA.lavori.some(l => l.cliente === 'Cliente Appena Arrivato' && l.entro === '2027-04-01');
    }, doc) === true);

  // ── la leggenda sta in fondo, dove non scavalca la lavagna ──
  const paginaLavagna = await pagU.evaluate(() => {
    disegnaLavagna();
    return document.getElementById('pagina-lavagna').innerHTML;
  });
  ok('la leggenda viene dopo la settimana, non prima',
    paginaLavagna.indexOf('legenda-lavagna') > paginaLavagna.indexOf('class="giorni"'),
    'leggenda a ' + paginaLavagna.indexOf('legenda-lavagna'));

  // ── l'anagrafica dell'ufficio ──
  ok('parte vuota finché non la si riempie',
    await pagU.evaluate(() => { vaiA('clienti'); return CLIENTI.length; }) === 0);
  ok('i clienti visti nei rapportini si possono prendere da lì',
    await pagU.evaluate(async () => {
      const mancanti = clientiMancanti().length;
      await prendiClientiDaiRapportini();
      return mancanti > 0 && CLIENTI.length === mancanti;
    }));
  ok('e finiscono su file, non solo a schermo',
    await pagU.evaluate(async () => {
      const a = JSON.parse(await leggiTesto(window.RADICE, 'clienti.json'));
      return a.tipo === 'anagrafica-ufficio' && a.clienti.length > 0;
    }));

  // Telefono e mail sono dell'ufficio: il cantiere non li conosce, e nessuna
  // importazione deve cancellarli.
  const telefonoMesso = await pagU.evaluate(async () => {
    modificaCliente(CLIENTI[0].id, 'telefono', '0461 000111');
    await salvaClienti();
    return CLIENTI[0].id;
  });
  ok('importando dal telefono arrivano i clienti nuovi',
    await pagU.evaluate(async doc => {
      await scriviTesto(window.RADICE, 'anagrafica-dal-telefono.json', JSON.stringify(doc));
      const prima = CLIENTI.length;
      await importaAnagrafica();
      return CLIENTI.length > prima;
    }, anagraficaDalTelefono));
  ok('ma un numero di telefono messo in ufficio non viene sovrascritto',
    await pagU.evaluate(id => (CLIENTI.find(c => c.id === id) || {}).telefono, telefonoMesso) === '0461 000111');
  ok('e reimportare non duplica niente',
    await pagU.evaluate(async doc => {
      const prima = CLIENTI.length;
      await scriviTesto(window.RADICE, 'anagrafica-dal-telefono.json', JSON.stringify(doc));
      await importaAnagrafica();
      return CLIENTI.length === prima;
    }, anagraficaDalTelefono));
  ok('senza il file dal telefono lo dice invece di tacere',
    await pagU.evaluate(async () => {
      const salva = CARTELLA;
      await scriviTesto(window.RADICE, 'anagrafica-dal-telefono.json', 'non è json');
      await importaAnagrafica();
      CARTELLA = salva;
      return document.getElementById('avviso').classList.contains('brutto');
    }));
  ok('le modifiche non salvate sopravvivono a una rilettura',
    await pagU.evaluate(async id => {
      modificaCliente(id, 'email', 'prova@esempio.it');
      await ricarica();
      return (CLIENTI.find(c => c.id === id) || {}).email === 'prova@esempio.it' && CLIENTI_DA_SALVARE === true;
    }, telefonoMesso));

  // Un lavoro archiviato da una versione futura può avere campi che questa non
  // sa leggere: fermarsi è meglio che mostrare un totale sbagliato.
  ok('un lavoro archiviato di una versione futura si ferma e lo dice',
    await pagU.evaluate(() => {
      try { leggiLavoro({ tipo: 'lavoro-archiviato', versione: 99, id: 'x' }); return false; }
      catch (e) { return e.message.includes('recente'); }
    }));
  ok('un file che non è un lavoro archiviato viene respinto',
    await pagU.evaluate(() => {
      try { leggiLavoro('{"tipo":"altro"}'); return false; } catch (e) { return true; }
    }));

  ok('nessun errore JavaScript nell\'app dell\'ufficio', erroriU.length === 0, erroriU.join(' | '));
  await ctxU.close();

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
