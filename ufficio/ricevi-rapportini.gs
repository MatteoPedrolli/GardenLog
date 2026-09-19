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
 * cartella — non leggere, non cancellare: doPost scrive e basta. Se l'indirizzo
 * dovesse girare, si rifà la distribuzione e cambia.
 */

const CARTELLA_RADICE = 'GiardinoApp';

// Ogni tipo di documento ha la sua cartella. Il telefono manda rapportini di
// fine lavoro e prenotazioni di appuntamenti: sono due cose diverse e in ufficio
// le guardano due schermate diverse, quindi non stanno nello stesso mucchio.
const CARTELLE = {
  rapportino: 'rapportini',
  appuntamento: 'appuntamenti',
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

// Serve a verificare dal browser che la distribuzione risponda, senza scrivere niente.
function doGet() {
  return risposta({ status: 'ok', servizio: 'rapportini', versione: 2,
    accetta: Object.keys(CARTELLE) });
}

function nomeFile(doc) {
  const pulito = String((doc.cliente && doc.cliente.nome) || 'cliente')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  // Il rapportino porta la data del lavoro, l'appuntamento quella entro cui
  // andrebbe fatto: in entrambi i casi la cartella resta leggibile a occhio.
  const data = String(doc.data || doc.entro || '').slice(0, 10) || 'senza-data';
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
