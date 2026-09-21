// ── IL RAPPORTINO COME DOCUMENTO ──
// È il solo formato che le due app si scambiano: il telefono lo produce,
// l'ufficio lo legge. Le due app NON condividono un database — il telefono ha
// le sue visite, l'ufficio il suo archivio — quindi ciò che non deve divergere
// non è il modello dei dati ma questo documento. Per questo sta in un file suo,
// caricato da entrambe, con la sua versione e i suoi test.
//
// Regola che tiene in piedi tutto: **il documento è denormalizzato**. L'ufficio
// non ha l'archivio prodotti del telefono e non può risolvere un ConcimeID, così
// i nomi viaggiano insieme ai riferimenti. Un rapportino si legge da solo, anche
// fra due anni, anche se nel frattempo quel concime è stato cancellato.

const VERSIONE_RAPPORTINO = 3;

function costruisciRapportino({ visita, cliente, operazioni, tipi, voci, concimi, sementi, fitofarmaci }) {
  const nomeProdotto = (o) => {
    if (o.ConcimeID) return (concimi || []).find(x => x.ConcimeID == o.ConcimeID)?.Concime || '';
    if (o.SementeID) return (sementi || []).find(x => x.SementeID == o.SementeID)?.Nome_commerciale || '';
    if (o.FitofarmacaID) return (fitofarmaci || []).find(x => x.FitofarmacaID == o.FitofarmacaID)?.Nome_commerciale || '';
    return '';
  };
  const fasce = (visita.Fasce || []).map(f => ({
    inizio: f.Inizio, fine: f.Fine,
    persone: Number(f.Persone) || 1,
    ore: Number((((minutiRapportino(f.Fine) - minutiRapportino(f.Inizio)) / 60) * (Number(f.Persone) || 1)).toFixed(2)),
  }));

  return {
    tipo: 'rapportino',
    versione: VERSIONE_RAPPORTINO,
    // L'identificativo è quello della visita: rimandare lo stesso rapportino
    // corretto deve sostituire il precedente, non affiancarglisi.
    id: visita.VisitaID,
    revisione: (Number(visita.Revisione) || 0) + 1,
    creato: new Date().toISOString(),
    cliente: {
      id: cliente?.ClienteID || visita.ClienteID || '',
      nome: cliente?.Cliente || '',
      indirizzo: cliente?.Indirizzo || '',
      citta: cliente?.Citta || '',
    },
    data: visita.Data || '',
    ore: {
      fasce,
      totale: Number(fasce.reduce((s, f) => s + f.ore, 0).toFixed(2)) || Number(visita.Ore_Visita) || 0,
    },
    operazioni: (operazioni || []).map(o => {
      const tipo = (tipi || []).find(t => t.TipoID === o.TipoID);
      return {
        // L'identificativo dell'operazione è la chiave di giunzione con la riga
        // del conto, che porta già lo stesso valore in `chiave`. Senza, l'ufficio
        // vede «Concime 25 kg» e non sa *quale* concime, anche se il nome sta
        // due campi più in là: due concimi diversi si fatturavano uguale.
        id: o.OperazioneID || '',
        tipoID: o.TipoID || '',
        // Il riferimento al prodotto viaggia accanto al nome, come sempre qui:
        // l'identificativo serve al listino, il nome a leggere il documento fra
        // due anni anche se quel prodotto è stato cancellato.
        prodottoID: o.ConcimeID || o.SementeID || o.FitofarmacaID || '',
        nome: o.Tipo_operazione || tipo?.Nome || '',
        descrizione: o.Descrizione || '',
        quantita: o.Quantita === '' || o.Quantita == null ? null : Number(o.Quantita),
        unita: o.Unita || '',
        prodotto: nomeProdotto(o),
        prato: !!o.Flag_prato && String(o.Flag_prato).trim() !== '',
        siepe: !!o.Flag_siepe && String(o.Flag_siepe).trim() !== '',
      };
    }),
    // Le righe viaggiano con le quantità e senza prezzi: il listino sta in
    // ufficio ed è l'ufficio a decidere quanto vale ognuna. Il cantiere dice
    // cosa è stato fatto e quanto, che è la cosa che solo lui sa.
    righe: (visita.Conto || []).map(r => ({
      chiave: r.Chiave || '',
      voceID: r.VoceID || '',
      voce: r.Voce || '',
      quantita: r.Quantita === '' || r.Quantita == null ? null : Number(r.Quantita),
      unita: r.Unita || '',
    })),
    // Niente «prossimo intervento»: quello che c'è da fare la prossima volta è
    // una prenotazione, e viaggia col suo documento. Scriverlo anche qui voleva
    // dire due posti dove cercarlo e due da tenere allineati.
    note: visita.Note_visita || '',
  };
}

function minutiRapportino(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

// Rilegge un documento arrivato da fuori. Non si fida di niente: un file può
// essere troncato, scritto da una versione futura, o non essere un rapportino.
function leggiRapportino(grezzo) {
  let doc = grezzo;
  if (typeof grezzo === 'string') {
    try { doc = JSON.parse(grezzo); }
    catch (e) { throw new Error('Il file non è leggibile: non è JSON valido'); }
  }
  if (!doc || doc.tipo !== 'rapportino') throw new Error('Questo file non è un rapportino');
  const versione = Number(doc.versione) || 0;
  // Finché si è in costruzione non si converte niente: o è di questa versione,
  // o non si legge. Archiviare un documento monco senza dirlo a nessuno è il
  // guasto peggiore che possa capitare qui dentro.
  if (versione !== VERSIONE_RAPPORTINO) {
    throw new Error(`Rapportino della versione ${versione || '?'}: questa app legge la ${VERSIONE_RAPPORTINO}`);
  }
  if (!doc.id) throw new Error('Rapportino senza identificativo');
  return {
    ...doc,
    versione,
    revisione: Number(doc.revisione) || 1,
    cliente: doc.cliente || { id: '', nome: '' },
    ore: doc.ore || { fasce: [], totale: 0 },
    operazioni: Array.isArray(doc.operazioni) ? doc.operazioni : [],
    righe: Array.isArray(doc.righe) ? doc.righe : [],
  };
}

// Il nome del file porta data e cliente perché la cartella di Drive resti
// leggibile a occhio, e l'identificativo perché due lavori dallo stesso cliente
// nello stesso giorno non si sovrascrivano.
function nomeFileRapportino(doc) {
  const pulito = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  const data = (doc.data || '').slice(0, 10) || 'senza-data';
  return `${data}-${pulito(doc.cliente?.nome) || 'cliente'}-${doc.id}.json`;
}

// ── L'APPUNTAMENTO COME DOCUMENTO ──
// Il secondo documento che le due app si scambiano, e va nella direzione opposta
// al rapportino solo nel tempo: il cantiere prenota, l'ufficio pianifica. Nasce
// perché il prossimo intervento scritto su una visita è una nota — «torna a
// marzo» — mentre una prenotazione è una richiesta di mettere qualcosa in
// calendario, e le due cose non si assomigliano abbastanza da condividere un
// campo.
//
// Denormalizzato come il rapportino, e per lo stesso motivo: l'ufficio deve
// poterlo leggere anche se quel cliente non ce l'ha ancora in anagrafica.
//
// **Un campo di testo, non due.** Portava un «cosa c'è da fare» accanto alle
// note, ed erano due caselle per dire la stessa cosa: una delle due restava
// sempre indietro, e in ufficio arrivavano da riunire. Quello che c'è da fare si
// scrive nelle note, che sono anche l'unica cosa che fa il giro completo — da lì
// finiscono sull'agenda e tornano in giardino.

const VERSIONE_APPUNTAMENTO = 3;

// ── LE SETTIMANE ──
// Un appuntamento non si fissa in un giorno preciso ma in una settimana, e una
// settimana si identifica col **lunedì che la apre**: una data sola, che si
// ordina da sé e non ha i pasticci di capodanno dei numeri di settimana (la
// settimana 1 può cominciare a dicembre). Il numero resta per leggerla.
//
// Sta qui perché la usano tutte e due le app, e due definizioni di «quale
// settimana» che divergono sarebbero peggio di nessuna.

// Una data come la scrivono i documenti: aaaa-mm-gg, letta in ora locale. Non
// toISOString, che passa per UTC e a Trento restituisce il giorno prima per
// tutta la sera.
function dataISO(data) {
  const d = data instanceof Date ? data : new Date(data);
  if (isNaN(d)) return '';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + String(d.getDate()).padStart(2, '0');
}

function lunediDellaSettimana(data) {
  const d = new Date(data);
  if (isNaN(d)) return '';
  // Mezzogiorno, non mezzanotte: con l'ora legale e i fusi, una data a
  // mezzanotte scivola al giorno prima passando per toISOString.
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dataISO(d);
}

// La settimana 1 è quella che contiene il 1° gennaio, e le settimane partono di
// lunedì. È come si contano sul calendario appeso in ufficio, ed è la regola che
// conta: se il capo o il commercialista dicono «settimana 40» deve essere la
// stessa di qui.
//
// Non è la regola ISO, che fa partire la settimana 1 dal primo giovedì e ogni
// tanto tira fuori una settimana 53 a fine dicembre. Le due coincidono per quasi
// tutto l'anno e divergono solo a cavallo di capodanno.
function lunediDellaPrimaSettimana(anno) {
  return lunediDellaSettimana(new Date(anno, 0, 1));
}

function numeroSettimana(data) {
  const lunedi = lunediDellaSettimana(data);
  if (!lunedi) return 0;
  // A quale anno appartiene questa settimana? A fine dicembre può già essere la
  // prima dell'anno dopo, e i primi giorni di gennaio possono essere ancora
  // dell'anno prima: si guarda dove cade rispetto ai due inizi possibili.
  const annoSolare = Number(lunedi.slice(0, 4));
  let anno = annoSolare + 1;
  let primo = lunediDellaPrimaSettimana(anno);
  if (lunedi < primo) {
    anno = annoSolare;
    primo = lunediDellaPrimaSettimana(anno);
    if (lunedi < primo) primo = lunediDellaPrimaSettimana(--anno);
  }
  const giorni = (new Date(lunedi + 'T12:00:00') - new Date(primo + 'T12:00:00')) / 86400000;
  return 1 + Math.round(giorni / 7);
}

// Come si scrive una settimana, ovunque compaia: «dal 22/06 · settimana 26».
function etichettaSettimana(lunedi) {
  if (!lunedi) return '';
  const d = new Date(lunedi + 'T12:00:00');
  if (isNaN(d)) return '';
  const giorno = String(d.getDate()).padStart(2, '0');
  const mese = String(d.getMonth() + 1).padStart(2, '0');
  return `dal ${giorno}/${mese} · settimana ${numeroSettimana(d)}`;
}

function costruisciAppuntamento({ prenotazione, cliente }) {
  return {
    tipo: 'appuntamento',
    versione: VERSIONE_APPUNTAMENTO,
    id: prenotazione.PrenotazioneID,
    revisione: (Number(prenotazione.Revisione) || 0) + 1,
    creato: new Date().toISOString(),
    cliente: {
      id: (cliente && cliente.ClienteID) || prenotazione.ClienteID || '',
      nome: (cliente && cliente.Cliente) || prenotazione.Cliente || '',
      indirizzo: (cliente && cliente.Indirizzo) || '',
      citta: (cliente && cliente.Citta) || '',
    },
    ore: Number(prenotazione.Ore) || 0,
    // La settimana in cui andrebbe fatto, scritta come il lunedì che la apre.
    // Non un giorno preciso: quando si prenota in giardino il giorno non si sa
    // ancora, e fingere di saperlo vorrebbe dire spostarlo tre volte.
    settimana: prenotazione.Settimana ? lunediDellaSettimana(prenotazione.Settimana) : '',
    requisiti: String(prenotazione.Requisiti || '').split(',').map(r => r.trim()).filter(r => r),
    note: prenotazione.Note || '',
  };
}

function leggiAppuntamento(grezzo) {
  let doc = grezzo;
  if (typeof grezzo === 'string') {
    try { doc = JSON.parse(grezzo); }
    catch (e) { throw new Error('Il file non è leggibile: non è JSON valido'); }
  }
  if (!doc || doc.tipo !== 'appuntamento') throw new Error('Questo file non è un appuntamento');
  const versione = Number(doc.versione) || 0;
  // Finché si è in costruzione non si converte niente: o è di questa versione,
  // o non si legge. Un documento letto male è peggio di uno rifiutato.
  if (versione !== VERSIONE_APPUNTAMENTO) {
    throw new Error(`Appuntamento della versione ${versione || '?'}: questa app legge la ${VERSIONE_APPUNTAMENTO}`);
  }
  if (!doc.id) throw new Error('Appuntamento senza identificativo');
  return {
    ...doc,
    versione,
    revisione: Number(doc.revisione) || 1,
    cliente: doc.cliente || { id: '', nome: '' },
    ore: Number(doc.ore) || 0,
    settimana: doc.settimana || '',
    requisiti: Array.isArray(doc.requisiti) ? doc.requisiti : [],
  };
}

function nomeFileAppuntamento(doc) {
  const pulito = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  const quando = (doc.settimana || '').slice(0, 10) || 'senza-settimana';
  return `${quando}-${pulito(doc.cliente && doc.cliente.nome) || 'cliente'}-${doc.id}.json`;
}

// ── L'AGENDA COME DOCUMENTO ──
// Il terzo documento, e il primo che va **dall'ufficio al cantiere**: le mezze
// giornate già pianificate, così chi è in giardino sa dove si va domani senza
// telefonare in ufficio.
//
// Porta **solo** giorno, mezza giornata, nome del cliente e note. Non indirizzi,
// non telefoni, non ore, non prezzi: viaggia per un indirizzo che è pubblico per
// chi lo conosce, e quello che non parte non si può perdere per strada. Le note
// sono lì perché sono l'unica cosa che fa il giro completo — il cantiere le
// scrive prenotando, l'ufficio le tiene sul cartellino, e tornano in giardino.
//
// Sei appuntamenti e non tutti: è l'orizzonte che serve in cantiere. Oltre, la
// pianificazione cambia ancora e una lista lunga sarebbe una lista sbagliata.

const VERSIONE_AGENDA = 1;
const APPUNTAMENTI_IN_AGENDA = 6;

// L'ordine è quello della lavagna letta da sinistra: prima il giorno, poi la
// mattina e poi il pomeriggio.
function primaLaMattina(mezza) {
  return mezza === 'pomeriggio' ? '2' : '1';
}

// Prende i lavori della lavagna e ne ricava l'agenda. Solo quelli che hanno un
// giorno: un lavoro ancora in colonna non ha un momento suo, e metterlo in agenda
// vorrebbe dire prometterlo.
function costruisciAgenda(lavori, oggi) {
  const da = oggi ? dataISO(oggi) : dataISO(new Date());
  const voci = (lavori || [])
    .filter(l => l && l.giorno && l.giorno >= da)
    .sort((a, b) => (a.giorno + primaLaMattina(a.mezza)).localeCompare(b.giorno + primaLaMattina(b.mezza)))
    .slice(0, APPUNTAMENTI_IN_AGENDA)
    .map(l => ({
      giorno: l.giorno,
      mezza: l.mezza === 'pomeriggio' ? 'pomeriggio' : 'mattina',
      cliente: l.cliente || '',
      note: l.note || '',
    }));
  return {
    tipo: 'agenda',
    versione: VERSIONE_AGENDA,
    aggiornata: new Date().toISOString(),
    da,
    appuntamenti: voci,
  };
}

function leggiAgenda(grezzo) {
  let doc = grezzo;
  if (typeof grezzo === 'string') {
    try { doc = JSON.parse(grezzo); }
    catch (e) { throw new Error('Il file non è leggibile: non è JSON valido'); }
  }
  if (!doc || doc.tipo !== 'agenda') throw new Error('Questo file non è un\'agenda');
  const versione = Number(doc.versione) || 0;
  // Come per gli altri documenti: o è di questa versione, o si rifiuta. Mostrare
  // un\'agenda letta a metà manderebbe qualcuno nel posto sbagliato.
  if (versione !== VERSIONE_AGENDA) {
    throw new Error(`Agenda della versione ${versione || '?'}: questa app legge la ${VERSIONE_AGENDA}`);
  }
  return {
    tipo: 'agenda',
    versione,
    aggiornata: doc.aggiornata || '',
    da: doc.da || '',
    appuntamenti: (Array.isArray(doc.appuntamenti) ? doc.appuntamenti : [])
      .filter(a => a && a.giorno)
      .map(a => ({
        giorno: String(a.giorno).slice(0, 10),
        mezza: a.mezza === 'pomeriggio' ? 'pomeriggio' : 'mattina',
        cliente: a.cliente || '',
        note: a.note || '',
      })),
  };
}

// Come si legge una mezza giornata: «Mar 23/06 mattina».
function etichettaMezzaGiornata(giorno, mezza) {
  const d = new Date(giorno + 'T12:00:00');
  if (isNaN(d)) return '';
  const nomi = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  const gg = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${nomi[d.getDay()]} ${gg}/${mm} ${mezza === 'pomeriggio' ? 'pomeriggio' : 'mattina'}`;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VERSIONE_RAPPORTINO, costruisciRapportino, leggiRapportino, nomeFileRapportino,
    VERSIONE_APPUNTAMENTO, costruisciAppuntamento, leggiAppuntamento, nomeFileAppuntamento,
    VERSIONE_AGENDA, APPUNTAMENTI_IN_AGENDA, costruisciAgenda, leggiAgenda, etichettaMezzaGiornata,
    dataISO, lunediDellaSettimana, lunediDellaPrimaSettimana, numeroSettimana, etichettaSettimana,
  };
}
