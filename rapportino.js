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
  // Il prezzo che arriva dal cantiere è solo quello delle piante: sta
  // sull'etichetta del vaso. Si prende dall'operazione e non dalla riga del conto,
  // perché i conti delle visite di prima portano ancora i loro prezzi storici, e
  // quelli non devono viaggiare come se fossero un listino.
  const prezzoPianta = o => o && o.TipoID === 'piantumazione' && o.Prezzo !== '' && o.Prezzo != null &&
    !isNaN(parseFloat(o.Prezzo)) ? parseFloat(o.Prezzo) : null;
  const fasce = (visita.Fasce || []).map(f => ({
    inizio: f.Inizio, fine: f.Fine,
    persone: Number(f.Persone) || 1,
    // Cosa si è fatto in quelle ore. È un campo in più: un ufficio fermo alla
    // versione di prima lo ignora, e il documento resta della stessa versione.
    cosa: String(f.Cosa || '').trim(),
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
        prezzo: prezzoPianta(o),
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
      prezzo: prezzoPianta((operazioni || []).find(o => o.OperazioneID && o.OperazioneID === r.Chiave)),
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
// L'anno compare solo quando non è quello in corso: un 2029 battuto al posto di
// 2026 si leggeva «dal 24/09 · settimana 39», identico a quello giusto, e il
// lavoro spariva fra quelli «per più avanti» senza che niente lo dicesse.
function etichettaSettimana(lunedi) {
  if (!lunedi) return '';
  const d = new Date(lunedi + 'T12:00:00');
  if (isNaN(d)) return '';
  const giorno = String(d.getDate()).padStart(2, '0');
  const mese = String(d.getMonth() + 1).padStart(2, '0');
  const anno = d.getFullYear() === new Date().getFullYear() ? '' : '/' + d.getFullYear();
  return `dal ${giorno}/${mese}${anno} · settimana ${numeroSettimana(d)}`;
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
    // Arrivato dopo, senza alzare la versione: un appuntamento che non lo porta
    // non è un sopralluogo, ed è quello che erano tutti prima.
    sopralluogo: prenotazione.Sopralluogo === 'Sì' || prenotazione.Sopralluogo === true,
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
    sopralluogo: !!doc.sopralluogo,
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
// Porta **solo** giorno, mezza giornata, ora, nome del cliente e note. Non
// indirizzi, non telefoni, non stime ore, non prezzi: viaggia per un indirizzo che è pubblico per
// chi lo conosce, e quello che non parte non si può perdere per strada. Le note
// sono lì perché sono l'unica cosa che fa il giro completo — il cantiere le
// scrive prenotando, l'ufficio le tiene sul cartellino, e tornano in giardino.
// L'ora è arrivata dopo, senza alzare la versione: è quella detta al cliente, e
// in giardino è la cosa che serve di più. Un telefono vecchio semplicemente non
// la mostra; un'agenda vecchia arriva senza, che vuol dire «ora non fissata».
//
// Dieci appuntamenti e non tutti: è l'orizzonte che serve in cantiere. Oltre, la
// pianificazione cambia ancora e una lista lunga sarebbe una lista sbagliata.

const VERSIONE_AGENDA = 1;
const APPUNTAMENTI_IN_AGENDA = 10;

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
    .sort((a, b) => (a.giorno + primaLaMattina(a.mezza) + (a.ora || '')).localeCompare(
      b.giorno + primaLaMattina(b.mezza) + (b.ora || '')))
    .slice(0, APPUNTAMENTI_IN_AGENDA)
    .map(l => ({
      giorno: l.giorno,
      mezza: l.mezza === 'pomeriggio' ? 'pomeriggio' : 'mattina',
      ora: /^\d{2}:\d{2}$/.test(l.ora || '') ? l.ora : '',
      cliente: l.cliente || '',
      note: l.note || '',
      // Se è un sopralluogo, e quale. Non dicono niente di nessuno — un sì/no e
      // un codice — e servono al telefono per elencare i sopralluoghi anche
      // senza la chiave. Arrivati dopo, senza alzare VERSIONE_AGENDA.
      sopralluogo: !!l.sopralluogo,
      id: l.sopralluogo ? (l.id || '') : '',
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
        ora: /^\d{2}:\d{2}$/.test(a.ora || '') ? a.ora : '',
        cliente: a.cliente || '',
        note: a.note || '',
        sopralluogo: !!a.sopralluogo,
        id: a.id || '',
      })),
  };
}

// ── I SOPRALLUOGHI COME DOCUMENTO ──
// Il secondo documento che va dall'ufficio al telefono, ed è l'unico che porta
// **dati di contatto**: via, telefono, mail di chi ha chiesto un sopralluogo.
// In giardino servono — dove andare, chi chiamare se il cancello è chiuso — e
// il cliente spesso non è ancora in nessuna anagrafica del telefono.
//
// Per questo **non sta nell'agenda**, che si legge con l'indirizzo dello script
// e basta. Sta in un file suo che lo script consegna **solo con la chiave**, e
// se la chiave sullo script non c'è non lo consegna a nessuno: chiuso finché
// qualcuno non lo apre apposta, non aperto finché qualcuno non se ne accorge.
//
// Solo i sopralluoghi già piazzati su una mezza giornata, da oggi in avanti:
// la stessa regola dell'agenda, e per la stessa ragione — uno ancora in colonna
// non ha un momento suo.
const VERSIONE_SOPRALLUOGHI = 1;

function costruisciSopralluoghi(lavori, oggi) {
  const da = oggi ? dataISO(oggi) : dataISO(new Date());
  return {
    tipo: 'sopralluoghi',
    versione: VERSIONE_SOPRALLUOGHI,
    aggiornato: new Date().toISOString(),
    da,
    sopralluoghi: (lavori || [])
      .filter(l => l && l.sopralluogo && l.giorno && l.giorno >= da)
      .sort((a, b) => (a.giorno + primaLaMattina(a.mezza) + (a.ora || '')).localeCompare(
        b.giorno + primaLaMattina(b.mezza) + (b.ora || '')))
      .slice(0, APPUNTAMENTI_IN_AGENDA)
      .map(l => ({
        id: l.id || '',
        giorno: l.giorno,
        mezza: l.mezza === 'pomeriggio' ? 'pomeriggio' : 'mattina',
        ora: /^\d{2}:\d{2}$/.test(l.ora || '') ? l.ora : '',
        cliente: l.cliente || '',
        paese: l.luogo || '',
        via: l.via || '',
        telefono: l.telefono || '',
        email: l.email || '',
        note: l.note || '',
      })),
  };
}

function leggiSopralluoghi(grezzo) {
  let doc = grezzo;
  if (typeof grezzo === 'string') {
    try { doc = JSON.parse(grezzo); }
    catch (e) { throw new Error('Il file non è leggibile: non è JSON valido'); }
  }
  // Lo script, quando rifiuta, risponde con un suo JSON d'errore: quel messaggio
  // — «chiave sbagliata», «manca la chiave» — è proprio quello da far leggere.
  if (doc && doc.status === 'error') throw new Error(doc.msg || 'il servizio ha rifiutato');
  if (!doc || doc.tipo !== 'sopralluoghi') throw new Error('Questo file non è un elenco di sopralluoghi');
  const versione = Number(doc.versione) || 0;
  if (versione !== VERSIONE_SOPRALLUOGHI) {
    throw new Error(`Sopralluoghi della versione ${versione || '?'}: questa app legge la ${VERSIONE_SOPRALLUOGHI}`);
  }
  return {
    tipo: 'sopralluoghi',
    versione,
    aggiornato: doc.aggiornato || '',
    da: doc.da || '',
    sopralluoghi: (Array.isArray(doc.sopralluoghi) ? doc.sopralluoghi : [])
      .filter(x => x && x.id && x.giorno)
      .map(x => ({
        id: String(x.id),
        giorno: String(x.giorno).slice(0, 10),
        mezza: x.mezza === 'pomeriggio' ? 'pomeriggio' : 'mattina',
        ora: /^\d{2}:\d{2}$/.test(x.ora || '') ? x.ora : '',
        cliente: x.cliente || '', paese: x.paese || '', via: x.via || '',
        telefono: x.telefono || '', email: x.email || '', note: x.note || '',
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

// ── IL RILIEVO COME DOCUMENTO ──
// Il quarto documento, e il secondo che va dal cantiere all'ufficio. È il
// taccuino del preventivo: quello che si vede stando lì, scritto col cliente
// davanti, e che in ufficio diventa un preventivo con i prezzi addosso.
//
// **Dal giardino partono lavorazioni, non righe di preventivo.** Una lavorazione è
// un fatto misurato: «Siepe · 24 m · lauro 80-100 · sesto 0,40 · 10 h». Le righe
// col testo per il cliente, le quantità dei materiali e i prezzi li fa l'ufficio:
// scriverli in giardino voleva dire scrivere due volte la stessa cosa — la voce e
// una descrizione uguale sotto — e fare sul telefono conti che spettano a chi ha
// il listino. Il campo dice *cosa* e *quanto*, la cosa che solo lui sa.
//
// Denormalizzato come il rapportino: il nome della voce e la composizione
// dell'insieme viaggiano coi loro identificativi, perché l'ufficio deve poter
// leggere un rilievo anche fra due anni, anche se quell'insieme nel frattempo è
// cambiato o non c'è più.
//
// Una mezza giornata sono otto ore di manodopera: quattro d'orologio in due. Sta
// qui e non in una delle due app perché la usano entrambe — la lavagna per sapere
// quante mezze giornate occupa un lavoro, il rilievo per dire quanto ci vuole — e
// due idee diverse di quanto dura una mezza giornata sarebbero peggio di nessuna.
const ORE_MEZZA = 8;

// Le mezze giornate di un preventivo **non si stimano a parte**: sono le ore di
// manodopera, sommate e arrotondate per eccesso. Erano un numero col suo −/+, e
// le righe dicevano cosa c'era da fare senza dire quanto lavoro costava. Adesso
// le ore stanno sulla lavorazione e la lavagna ne riceve la somma. Per eccesso
// perché una mezza giornata cominciata è occupata: con 9 ore non si comincia un
// altro lavoro nel pomeriggio.
const VOCE_MANODOPERA = 'manodopera';
// Le piante si contano dal sesto, non da un coefficiente: è la voce che
// l'ufficio riconosce per farlo.
const VOCE_PIANTE = 'piante';

// Il numero scritto con la virgola, com'è scritto qui: «2,5» sono due ore e mezza,
// non una casella vuota.
function numeroDaTesto(valore) {
  if (valore === '' || valore == null) return 0;
  const n = Number(String(valore).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

const alCentesimo = n => Math.round(n * 100) / 100;

// Le ore di un elenco di righe (di un preventivo): la voce manodopera e basta, e
// anche quella dentro una riga a corpo, fra i suoi componenti. Un noleggio a ore
// è in ore ma non è lavoro nostro, e non occupa la lavagna. Si arrotonda al
// centesimo prima di dividere: tre righe da 0,1 non devono fare
// 0,30000000000000004 e saltare alla mezza dopo.
function oreManodopera(righe) {
  const somma = (righe || []).reduce((t, r) => {
    if (!r) return t;
    const proprie = r.voceID === VOCE_MANODOPERA ? numeroDaTesto(r.quantita) : 0;
    return t + proprie + (Array.isArray(r.componenti) ? oreManodopera(r.componenti) : 0);
  }, 0);
  return alCentesimo(somma);
}

// Le ore di un rilievo stanno sulle lavorazioni.
function oreDelleLavorazioni(lavorazioni) {
  return alCentesimo((lavorazioni || []).reduce((t, l) => t + numeroDaTesto(l && l.ore), 0));
}

function mezzeDaOre(ore) {
  const n = Number(ore) || 0;
  return n > 0 ? Math.ceil(n / ORE_MEZZA) : 0;
}

// La formula è quella del foglio di calcolo della segretaria: metri diviso il
// sesto d'impianto, **più uno**, arrotondato per difetto. Il più uno è la pianta
// di testa: una siepe di 24 m a sesto 0,40 ne vuole 61, non 60, perché ce n'è una
// a ogni estremo. Sta qui perché la fanno tutte e due le app: il telefono la
// mostra mentre si scrive il sesto, l'ufficio la usa per il conto.
function pianteDaSesto(metri, sesto) {
  const m = parseFloat(String(metri).replace(',', '.'));
  const s = parseFloat(String(sesto).replace(',', '.'));
  if (isNaN(m) || isNaN(s) || m <= 0 || s <= 0) return null;
  // Il piccolo margine evita che 24 / 0,4 = 59,999… perda la pianta di testa.
  return Math.floor(m / s + 1 + 1e-9);
}

// Quante piante chiede una lavorazione: dal sesto quando si misura in metri (una
// fila), scritte a mano quando si misura un'area — su un'aiuola il sesto non dice
// quante file ci stanno.
function pianteDellaLavorazione(l) {
  if (!l) return null;
  if (l.unita === 'm' && numeroDaTesto(l.sesto) > 0) return pianteDaSesto(l.misura, l.sesto);
  const n = numeroDaTesto(l.piante);
  return n > 0 ? Math.round(n) : null;
}

const VERSIONE_RILIEVO = 1;

// Elenco chiuso perché sui preventivi scritti a mano la stessa unità compare in
// modi diversi — `cad` e `cad.` nello stesso mazzo — e due scritture non si
// sommano. Sono **le unità che usano già le voci di listino** (`h`, `n`, `kg`,
// `l`, `sacchi`, `m²`) più i metri lineari e l'a corpo: un elenco che non le
// coprisse farebbe scegliere al menù qualcos'altro, e una riga direbbe m² dove il
// modello dice n. È già successo.
const UNITA_RILIEVO = ['m²', 'ml', 'n', 'kg', 'l', 'h', 'sacchi', 'a corpo'];

// I quattro generi di lavorazione. **Insieme**: un'aiuola, una siepe — si misura
// una volta e i materiali li conta l'ufficio. **Voce**: una cosa del listino a
// misura, come il verde da smaltire. **Manodopera**: solo ore, per quello che non
// lascia materiali (una potatura). **Libera**: scritta a mano, quando non c'è
// niente che le somigli.
const GENERI_LAVORAZIONE = ['insieme', 'voce', 'manodopera', 'libera'];

function lavorazioneDalTelefono(l) {
  return {
    id: l.LavID || '',
    genere: GENERI_LAVORAZIONE.includes(l.Genere) ? l.Genere : 'libera',
    nome: l.Nome || '',
    insieme: l.Genere === 'insieme' ? {
      id: l.TipoID || '',
      nome: l.Nome || '',
      componenti: (l.Componenti || []).map(c => ({
        tipoID: c.TipoID || '', voceID: c.VoceID || '', voce: c.Voce || '', unita: c.Unita || '',
      })),
    } : null,
    voceID: l.Genere === 'voce' ? (l.VoceID || '') : '',
    misura: numeroDaTesto(l.Misura),
    unita: l.Unita || '',
    pianta: l.Pianta || '',
    sesto: numeroDaTesto(l.Sesto),
    piante: numeroDaTesto(l.Piante),
    ore: numeroDaTesto(l.Ore),
    note: l.Note || '',
  };
}

function costruisciRilievo({ rilievo, cliente, voci }) {
  const perID = {};
  (voci || []).forEach(v => { perID[v.VoceID] = v; });
  const lavorazioni = (rilievo.Lavorazioni || []).map(lavorazioneDalTelefono);
  // Un rilievo salvato sul telefono prima delle lavorazioni porta le righe di
  // allora: partono come lavorazioni, così l'ufficio ne legge un genere solo.
  (rilievo.Righe || []).forEach(r => lavorazioni.push(lavorazioneDaRiga({
    id: r.RigaID, voceID: r.VoceID,
    voce: r.Voce || (perID[r.VoceID] && perID[r.VoceID].Nome) || '',
    descrizione: r.Descrizione, quantita: numeroDaTesto(r.Quantita), unita: r.Unita,
  })));
  const ore = oreDelleLavorazioni(lavorazioni);
  return {
    tipo: 'rilievo',
    versione: VERSIONE_RILIEVO,
    id: rilievo.RilievoID,
    revisione: (Number(rilievo.Revisione) || 0) + 1,
    creato: new Date().toISOString(),
    // L'anagrafica scritta sul rilievo vince su quella del telefono: è quello che
    // si è visto e chiesto stando lì. Telefono e mail sono arrivati dopo, senza
    // alzare VERSIONE_RILIEVO: un ufficio che non li conosce li ignora, un
    // rilievo vecchio arriva senza — che vuol dire «non scritti».
    cliente: (() => {
      const a = rilievo.Anagrafica || {};
      return {
        id: (cliente && cliente.ClienteID) || rilievo.ClienteID || '',
        nome: a.Cliente || (cliente && cliente.Cliente) || rilievo.Cliente || '',
        indirizzo: a.Indirizzo || (cliente && cliente.Indirizzo) || '',
        citta: a.Citta || (cliente && cliente.Citta) || '',
        telefono: a.Telefono || '',
        email: a.Email || '',
      };
    })(),
    // Il sopralluogo della lavagna da cui nasce, se nasce da uno.
    sopralluogo: rilievo.SopralluogoID || '',
    // Il rilievo aspetta un numero che esce dal CAD — l'area del prato, lo schema
    // degli irrigatori — e finché non arriva non è finito. Era tutto quello che
    // diceva il «tipo di lavoro» che c'era prima, ed è l'unica cosa rimasta.
    disegno: !!rilievo.Disegno,
    lavorazioni,
    // Ore e mezze escono dalle lavorazioni, non da un campo a parte: lo stesso
    // fatto misurato una volta sola. Viaggiano scritte lo stesso, perché un
    // ufficio che le legge non deve rifare il conto, e `mezze` c'era già.
    ore,
    mezze: mezzeDaOre(ore),
    note: rilievo.Note || '',
  };
}

// I rilievi mandati prima delle lavorazioni portano `righe`, con la descrizione
// per il cliente già scritta in giardino. Si leggono come lavorazioni, senza
// alzare VERSIONE_RILIEVO: una riga di manodopera è manodopera, ogni altra è una
// voce a misura — e la descrizione scritta allora resta, perché qualcuno l'ha
// pensata.
function lavorazioneDaRiga(r) {
  const manodopera = r.voceID === VOCE_MANODOPERA;
  return {
    id: r.id || '',
    genere: manodopera ? 'manodopera' : (r.voceID ? 'voce' : 'libera'),
    nome: manodopera ? (r.descrizione || 'Manodopera') : (r.voce || r.descrizione || ''),
    insieme: null,
    voceID: manodopera ? '' : (r.voceID || ''),
    misura: manodopera ? 0 : numeroDaTesto(r.quantita),
    unita: manodopera ? '' : (r.unita || ''),
    pianta: '', sesto: 0, piante: 0,
    ore: manodopera ? numeroDaTesto(r.quantita) : 0,
    note: '',
    descrizione: manodopera ? '' : (r.descrizione || ''),
  };
}

function leggiLavorazione(l) {
  const ins = l.insieme;
  return {
    id: l.id || '',
    genere: GENERI_LAVORAZIONE.includes(l.genere) ? l.genere : 'libera',
    nome: l.nome || '',
    insieme: ins ? {
      id: ins.id || '', nome: ins.nome || '',
      componenti: (Array.isArray(ins.componenti) ? ins.componenti : []).map(c => ({
        tipoID: c.tipoID || '', voceID: c.voceID || '', voce: c.voce || '', unita: c.unita || '',
      })),
    } : null,
    voceID: l.voceID || '',
    misura: numeroDaTesto(l.misura),
    unita: l.unita || '',
    pianta: l.pianta || '',
    sesto: numeroDaTesto(l.sesto),
    piante: numeroDaTesto(l.piante),
    ore: numeroDaTesto(l.ore),
    note: l.note || '',
    descrizione: l.descrizione || '',
  };
}

function leggiRilievo(grezzo) {
  let doc = grezzo;
  if (typeof grezzo === 'string') {
    try { doc = JSON.parse(grezzo); }
    catch (e) { throw new Error('Il file non è leggibile: non è JSON valido'); }
  }
  if (!doc || doc.tipo !== 'rilievo') throw new Error('Questo file non è un rilievo');
  const versione = Number(doc.versione) || 0;
  // La solita regola della modalità costruzione: o è di questa versione, o si
  // rifiuta dicendolo. Un rilievo letto a metà diventa un preventivo sbagliato,
  // e un preventivo sbagliato si firma.
  if (versione !== VERSIONE_RILIEVO) {
    throw new Error(`Rilievo della versione ${versione || '?'}: questa app legge la ${VERSIONE_RILIEVO}`);
  }
  if (!doc.id) throw new Error('Rilievo senza identificativo');
  const lavorazioni = Array.isArray(doc.lavorazioni)
    ? doc.lavorazioni.map(leggiLavorazione)
    : (Array.isArray(doc.righe) ? doc.righe : []).map(lavorazioneDaRiga);
  const { righe, ...resto } = doc;
  return {
    ...resto,
    versione,
    revisione: Number(doc.revisione) || 1,
    cliente: {
      id: '', nome: '', indirizzo: '', citta: '', telefono: '', email: '',
      ...(doc.cliente || {}),
    },
    sopralluogo: doc.sopralluogo || '',
    // I rilievi mandati prima portano il vecchio «lavoro» invece di «disegno»: due
    // dei quattro tipi aspettavano il CAD, e si leggono ancora così. Senza alzare
    // VERSIONE_RILIEVO — un campo in meno da guardare, non un formato diverso.
    disegno: !!doc.disegno || ['prato-rotoli', 'irrigazione'].includes(doc.lavoro),
    lavorazioni,
    // I rilievi di prima delle ore sulle righe portano solo le mezze contate a
    // mano: valgono ancora, e `ore` assente vuol dire questo.
    ore: Number(doc.ore) || 0,
    mezze: Number(doc.mezze) || 0,
    note: doc.note || '',
  };
}

function nomeFileRilievo(doc) {
  const pulito = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  const quando = (doc.creato || '').slice(0, 10) || 'senza-data';
  return `${quando}-${pulito(doc.cliente && doc.cliente.nome) || 'cliente'}-${doc.id}.json`;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VERSIONE_RAPPORTINO, costruisciRapportino, leggiRapportino, nomeFileRapportino,
    VERSIONE_APPUNTAMENTO, costruisciAppuntamento, leggiAppuntamento, nomeFileAppuntamento,
    VERSIONE_AGENDA, APPUNTAMENTI_IN_AGENDA, costruisciAgenda, leggiAgenda, etichettaMezzaGiornata,
    ORE_MEZZA, VOCE_MANODOPERA, VOCE_PIANTE, numeroDaTesto, oreManodopera, oreDelleLavorazioni,
    mezzeDaOre, pianteDaSesto, pianteDellaLavorazione, GENERI_LAVORAZIONE,
    VERSIONE_SOPRALLUOGHI, costruisciSopralluoghi, leggiSopralluoghi,
    VERSIONE_RILIEVO, UNITA_RILIEVO,
    costruisciRilievo, leggiRilievo, nomeFileRilievo,
    dataISO, lunediDellaSettimana, lunediDellaPrimaSettimana, numeroSettimana, etichettaSettimana,
  };
}
