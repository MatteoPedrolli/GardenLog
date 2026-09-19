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

const VERSIONE_RAPPORTINO = 1;

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
        tipoID: o.TipoID || '',
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
    //
    // prezzoProposto resta nel formato, sempre vuoto, perché i rapportini già
    // depositati su Drive lo contengono e devono continuare a leggersi:
    // toglierlo cambierebbe il documento, non il telefono.
    righe: (visita.Conto || []).map(r => ({
      chiave: r.Chiave || '',
      voceID: r.VoceID || '',
      voce: r.Voce || '',
      quantita: r.Quantita === '' || r.Quantita == null ? null : Number(r.Quantita),
      unita: r.Unita || '',
      prezzoProposto: null,
    })),
    note: visita.Note_visita || '',
    prossimo: {
      cosa: visita.Prossimo_intervento || '',
      mese: visita.Mese_prossimo_intervento || '',
      anno: visita.Anno_prossimo_intervento || '',
    },
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
  // Una versione più nuova può contenere campi che questa non sa leggere:
  // meglio fermarsi che archiviare un documento monco senza dirlo a nessuno.
  if (versione > VERSIONE_RAPPORTINO) {
    throw new Error(`Rapportino di una versione più recente (${versione}): aggiorna l'app dell'ufficio`);
  }
  if (!doc.id) throw new Error('Rapportino senza identificativo');
  return {
    ...doc,
    versione: versione || 1,
    revisione: Number(doc.revisione) || 1,
    cliente: doc.cliente || { id: '', nome: '' },
    ore: doc.ore || { fasce: [], totale: 0 },
    operazioni: Array.isArray(doc.operazioni) ? doc.operazioni : [],
    righe: Array.isArray(doc.righe) ? doc.righe : [],
    prossimo: doc.prossimo || { cosa: '', mese: '', anno: '' },
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

const VERSIONE_APPUNTAMENTO = 1;

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
    cosa: prenotazione.Cosa || '',
    ore: Number(prenotazione.Ore) || 0,
    // Una data, non un mese: in ufficio serve a mettere in ordine la coda, e un
    // mese scritto a parole non si ordina.
    entro: prenotazione.Entro || '',
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
  if (versione > VERSIONE_APPUNTAMENTO) {
    throw new Error(`Appuntamento di una versione più recente (${versione}): aggiorna l'app dell'ufficio`);
  }
  if (!doc.id) throw new Error('Appuntamento senza identificativo');
  return {
    ...doc,
    versione: versione || 1,
    revisione: Number(doc.revisione) || 1,
    cliente: doc.cliente || { id: '', nome: '' },
    ore: Number(doc.ore) || 0,
    requisiti: Array.isArray(doc.requisiti) ? doc.requisiti : [],
  };
}

function nomeFileAppuntamento(doc) {
  const pulito = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  const quando = (doc.entro || '').slice(0, 10) || 'senza-data';
  return `${quando}-${pulito(doc.cliente && doc.cliente.nome) || 'cliente'}-${doc.id}.json`;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VERSIONE_RAPPORTINO, costruisciRapportino, leggiRapportino, nomeFileRapportino,
    VERSIONE_APPUNTAMENTO, costruisciAppuntamento, leggiAppuntamento, nomeFileAppuntamento,
  };
}
