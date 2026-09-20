/**
 * Riceve i rapportini dall'app del cantiere e li deposita come file nella
 * cartella di Drive dell'account giardini. Da incollare in Apps Script e
 * distribuire come applicazione web.
 *
 * COME SI INSTALLA
 *  1. script.google.com → Nuovo progetto, con l'account dei giardini
 *  2. incolla questo file al posto di quello che c'è
 *  3. Distribuisci → Nuova distribuzione → tipo "Applicazione web"
 *       Esegui come:    io
 *       Chi ha accesso: CHIUNQUE          ← senza questo l'app non può scrivere
 *  4. copia l'indirizzo che ti dà e incollalo nell'app, in Dati → Rapportino
 *
 * SE LO AGGIORNI: non basta salvare. Va rifatta una distribuzione (Distribuisci →
 * Gestisci distribuzioni → matita → Versione: nuova → Distribuisci), altrimenti
 * continua a girare la versione di prima e l'indirizzo resta lo stesso.
 *
 * PERCHÉ "CHIUNQUE": l'app sul telefono non è collegata a un account Google, e
 * non può autenticarsi. Chi conosce l'indirizzo può depositare un file in questa
 * cartella e leggere l'agenda — nient'altro: non l'archivio, non il listino, non
 * l'anagrafica. Se l'indirizzo dovesse girare, si rifà la distribuzione e cambia.
 *
 * L'AGENDA È L'UNICA COSA CHE SI LEGGE, ed è il motivo per cui contiene solo
 * giorno, mezza giornata, cliente e note: chi la scrive (l'app dell'ufficio) tiene
 * indirizzi, telefoni, ore e prezzi fuori dal file proprio perché questo
 * indirizzo è pubblico per chi lo conosce. Chi aggiungesse un campo lì lo
 * pubblicherebbe qui.
 */

const CARTELLA_RADICE = 'GiardinoApp';

// Ogni tipo di documento ha la sua cartella. Il telefono manda rapportini di
// fine lavoro e prenotazioni di appuntamenti: sono due cose diverse e in ufficio
// le guardano due schermate diverse, quindi non stanno nello stesso mucchio.
const CARTELLE = {
  rapportino: 'rapportini',
  appuntamento: 'appuntamenti',
};

// E un file solo che il telefono può leggere. L'elenco sta qui e non nella
// richiesta: il nome del file non si prende mai da chi chiama, o l'indirizzo
// diventerebbe un modo per leggersi il listino o l'anagrafica.
const LEGGIBILI = {
  agenda: 'agenda.json',
};

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error('richiesta vuota');
    const doc = JSON.parse(e.postData.contents);
    const dove = CARTELLE[doc.tipo];
    if (!dove) throw new Error('tipo di documento sconosciuto: ' + doc.tipo);
    if (!doc.id) throw new Error('documento senza identificativo');

    const cartella = sottocartella(sottocartella(DriveApp.getRootFolder(), CARTELLA_RADICE), dove);
    const nome = nomeFile(doc);

    // Stesso rapportino rimandato dopo una correzione: la revisione vecchia va
    // nel cestino, non affianco. Due versioni dello stesso lavoro nella stessa
    // cartella sono il modo migliore per fatturarlo due volte.
    const vecchi = cartella.getFilesByName(nome);
    while (vecchi.hasNext()) vecchi.next().setTrashed(true);

    cartella.createFile(nome, JSON.stringify(doc, null, 2), 'application/json');
    return risposta({ status: 'ok', tipo: doc.tipo, file: nome, revisione: doc.revisione || 1 });
  } catch (err) {
    return risposta({ status: 'error', msg: String((err && err.message) || err) });
  }
}

// Senza parametri serve a verificare dal browser che la distribuzione risponda.
// Con ?documento=agenda restituisce l'agenda scritta dall'ufficio: è l'unica
// lettura che questo servizio concede, e l'unico file che può nominare.
function doGet(e) {
  try {
    const quale = (e && e.parameter && e.parameter.documento) || '';
    if (!quale) {
      return risposta({ status: 'ok', servizio: 'rapportini', versione: 3,
        accetta: Object.keys(CARTELLE), leggibili: Object.keys(LEGGIBILI) });
    }
    // Un nome preso da una lista, non dalla richiesta: così l'indirizzo non
    // diventa un modo per leggere il listino o l'anagrafica.
    const nome = LEGGIBILI[quale];
    if (!nome) throw new Error('documento non leggibile: ' + quale);

    const radice = sottocartella(DriveApp.getRootFolder(), CARTELLA_RADICE);
    const file = radice.getFilesByName(nome);
    if (!file.hasNext()) throw new Error('l\'ufficio non ha ancora scritto ' + nome);
    return ContentService.createTextOutput(file.next().getBlob().getDataAsString())
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return risposta({ status: 'error', msg: String((err && err.message) || err) });
  }
}

function nomeFile(doc) {
  const pulito = String((doc.cliente && doc.cliente.nome) || 'cliente')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  // Il rapportino porta la data del lavoro, l'appuntamento il lunedì della
  // settimana in cui andrebbe fatto: in entrambi i casi la cartella resta
  // leggibile a occhio.
  const data = String(doc.data || doc.settimana || '').slice(0, 10) || 'senza-data';
  return data + '-' + pulito + '-' + doc.id + '.json';
}

function sottocartella(padre, nome) {
  const trovate = padre.getFoldersByName(nome);
  return trovate.hasNext() ? trovate.next() : padre.createFolder(nome);
}

function risposta(oggetto) {
  return ContentService.createTextOutput(JSON.stringify(oggetto))
    .setMimeType(ContentService.MimeType.JSON);
}
