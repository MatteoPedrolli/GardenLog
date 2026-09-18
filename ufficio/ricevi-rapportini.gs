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
 * PERCHÉ "CHIUNQUE": l'app sul telefono non è collegata a un account Google, e
 * non può autenticarsi. Chi conosce l'indirizzo può depositare un file in questa
 * cartella — non leggere, non cancellare: doPost scrive e basta. Se l'indirizzo
 * dovesse girare, si rifà la distribuzione e cambia.
 */

const CARTELLA_RADICE = 'GiardinoApp';
const CARTELLA_ARRIVI = 'rapportini';

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error('richiesta vuota');
    const doc = JSON.parse(e.postData.contents);
    if (doc.tipo !== 'rapportino') throw new Error('non è un rapportino');
    if (!doc.id) throw new Error('rapportino senza identificativo');

    const cartella = sottocartella(sottocartella(DriveApp.getRootFolder(), CARTELLA_RADICE), CARTELLA_ARRIVI);
    const nome = nomeFile(doc);

    // Stesso rapportino rimandato dopo una correzione: la revisione vecchia va
    // nel cestino, non affianco. Due versioni dello stesso lavoro nella stessa
    // cartella sono il modo migliore per fatturarlo due volte.
    const vecchi = cartella.getFilesByName(nome);
    while (vecchi.hasNext()) vecchi.next().setTrashed(true);

    cartella.createFile(nome, JSON.stringify(doc, null, 2), 'application/json');
    return risposta({ status: 'ok', file: nome, revisione: doc.revisione || 1 });
  } catch (err) {
    return risposta({ status: 'error', msg: String((err && err.message) || err) });
  }
}

// Serve a verificare dal browser che la distribuzione risponda, senza scrivere niente.
function doGet() {
  return risposta({ status: 'ok', servizio: 'rapportini', versione: 1 });
}

function nomeFile(doc) {
  const pulito = String((doc.cliente && doc.cliente.nome) || 'cliente')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  const data = String(doc.data || '').slice(0, 10) || 'senza-data';
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
