# GiardinoApp — note per chi ci lavora

App per registrare gli interventi di giardinaggio: clienti, visite, operazioni,
prossimi interventi, report sulla concimazione dei prati. La usa una persona
sola, quasi sempre dal telefono, spesso in giardino senza campo.

## Com'è fatta

- `index.html` — l'app del cantiere: stili, markup e codice in un file solo
- `ufficio/index.html` — l'app dell'ufficio, stessa forma, un file solo
- `rapportino.js` — il documento che le due app si scambiano, caricato da entrambe
- `sw.js` — service worker, serve l'app dalla cache così si apre offline
- `manifest.json` + icone — installazione sulla schermata home
- `test/` — giro di prova con un browser vero, su entrambe le app

Nessun build, nessun framework, nessuna dipendenza a runtime. Si apre il file e
funziona. Prima di aggiungere un pacchetto, chiedersi se serve davvero: finora
non è mai servito.

## I vincoli che contano

**I dati stanno sul dispositivo.** IndexedDB come archivio, `localStorage` come
seconda copia per Safari in navigazione privata. Non c'è un server: l'app non
deve tornare a dipendere dalla rete per salvare o leggere. L'unica cosa che
ancora esce verso l'esterno è la ricerca degli indirizzi (Nominatim), che può
fallire senza conseguenze.

**Il backup è l'unica rete di sicurezza.** Se l'unica copia dei dati sparisce
con il telefono, sono persi. Ogni cosa che tocca i dati deve tenerne conto: un
salvataggio fallito va detto a chiaro schermo, non messo in console; una
condivisione annullata non va segnata come backup fatto.

**Tutto in italiano.** Interfaccia, nomi delle funzioni nuove, commenti,
messaggi di errore. Il codice più vecchio ha nomi inglesi (`renderClienti`,
`saveVisita`): lasciarli dov'è, non serve una rinominazione di massa.

**I commenti spiegano il perché, non il cosa.** Quelli che ci sono raccontano
il caso che li ha fatti nascere — il doppio tocco che creava visite doppie,
Apps Script che rispondeva 200 con dentro una pagina di errore. Vale la pena
continuare così: sono la memoria dei problemi già incontrati.

## Come si lavora

```
npm test     # il giro di prova, serve playwright (npm i)
npm start    # server locale: i service worker non vanno su file://
```

I test vanno lanciati prima di ogni commit. Coprono le cose che rompendosi non
si fanno notare: il calcolo di azoto e potassio, la persistenza dopo la
ricarica, il backup, le eliminazioni a cascata, l'apertura offline. Se una
funzionalità nuova tocca i dati, merita una verifica lì dentro.

## Quando cambia lo schema dei dati

Tutto quello che entra — da IndexedDB, da un backup, dal vecchio foglio Google —
passa da `migra()`. Per cambiare la forma dei dati:

1. alza `VERSIONE_DATI`
2. aggiungi la voce corrispondente in `MIGRAZIONI`
3. verifica che regga anche su dati già a posto e su un database vuoto

I backup esportati mesi fa devono continuare ad aprirsi. È il motivo per cui
quell'imbuto esiste.

## La schermata visita è un rapporto, non un registro

Segue l'ordine del rapportino che si consegna a fine lavoro: cliente, ore,
operazioni, note, prossimo intervento. Non è estetica — scorrere lo schermo
nello stesso ordine del foglio evita di tradurre da una forma all'altra alla
fine di una giornata di lavoro. Chi la riordina perde quel vantaggio.

**Le ore sono un calcolo, non un numero.** Fasce orarie con orario e numero di
persone; il totale lo fa `oreTotali()`. Una fascia che l'app propone resta
`proposta: true` finché non viene toccata o confermata, e `saveVisita()` si
rifiuta di salvare se ne resta una: le ore finiscono in fattura, e un orario
precompilato che nessuno ha guardato è un errore che paga il cliente.

**Le operazioni si spuntano.** L'elenco viene da `DB.tipiOperazione`, ordinato
per quanto si usano da quel cliente. Spuntando si apre solo il dettaglio che
quel tipo richiede (`dettaglio`: niente, concime, semente, fitofarmaco,
quantita) e i flag prato/siepe li mette il tipo, non l'utente.

I campi che l'utente compila usano `oninput`, non `onchange`: con `onchange` il
modello resta indietro fino al blur. E non si ridisegna l'elenco mentre si
scrive — si aggiorna solo quello che cambia, o il campo sparisce da sotto le dita.

## Il rapportino e il conto

**Visita e rapportino sono la stessa schermata.** Il conto sta in fondo, dopo
le operazioni, e si compila mentre registri. Erano due: per mostrare il conto,
il rapportino ti ripeteva ore e operazioni in sola lettura — le stesse
informazioni due volte, una da compilare e una da rileggere. Chi le separa di
nuovo reintroduce quella copia.

Il conto di fine lavoro **nasce già compilato**: la manodopera dalle fasce
orarie, i materiali dalle operazioni che hanno una voce collegata. Chi lo apre
corregge, non scrive da zero.

Ogni riga automatica porta una `Chiave` che dice da dove nasce — `manodopera`
oppure l'`OperazioneID`. `costruisciConto()` la usa per riallineare: le
quantità seguono i dati della visita, **un prezzo scritto a mano non viene mai
risovrascritto dal listino**, e le righe aggiunte a mano (senza `Chiave`)
restano dove sono.

I prezzi in `DB.voci` sono facoltativi. Vuoto non è un errore: vuol dire che
quella voce si valuta volta per volta. Il totale somma solo le righe che hanno
sia quantità sia prezzo, e **dice quante ne ha lasciate fuori** — un totale che
sembra completo mentre gli manca lo smaltimento è peggio di nessun totale.

Potature, taglio prato e arieggiatura non hanno voce collegata: sono
manodopera, già contata dalle ore. Collegarle vorrebbe dire fatturarle due volte.

**Il trasferimento compare sempre**, con l'importo da scrivere: c'è a ogni
lavoro e si valuta volta per volta. Doverlo aggiungere a mano era il modo
migliore per dimenticarlo, e dimenticarlo costa all'azienda.

**Una voce `ACorpo` si paga con una cifra sola, non a misura.** Il trattamento
fitosanitario si fattura così: nel conto vale 1 × l'importo, mentre prodotto e
litri restano sull'operazione, dove servono al registro dei trattamenti. È la
ragione per cui agronomia e conto sono due elenchi distinti sulla stessa
visita: lo stesso fatto si misura in modi diversi a seconda di chi lo legge.

**L'invio non manda niente.** `inviaRapportino()` apre l'app di posta con
destinatario, oggetto e testo già scritti: l'ultimo tocco è di chi usa l'app, e
non serve un server. Per questo la visita viene segnata come *in posta* e non
come *inviata* — l'app sa di averla passata alla posta, non sa se è partita.
Prima si salva e poi si apre la posta, o un invio fallito lascerebbe una mail
mandata e una visita mai registrata.

Nel testo della mail niente colonne allineate con gli spazi: le app di posta
usano caratteri a larghezza variabile e arrivano storte. Una voce per riga.

## Due app, un documento

L'app del cantiere (`index.html`) e quella dell'ufficio **non condividono un
database**: il telefono ha le sue visite, l'ufficio il suo archivio. Si scambiano
**documenti**, e il solo formato in comune è il rapportino — `rapportino.js`,
caricato da entrambe, con la sua versione e i suoi test.

Quel documento è **denormalizzato apposta**: l'ufficio non ha l'archivio prodotti
del telefono e non può risolvere un `ConcimeID`, così i nomi viaggiano insieme ai
riferimenti. Un rapportino si deve leggere da solo anche fra due anni, anche se
quel concime nel frattempo è stato cancellato.

`leggiRapportino()` non si fida di niente: un file può essere troncato, non
essere un rapportino, o venire da una versione futura. In quest'ultimo caso si
ferma e lo dice, invece di archiviare un documento monco in silenzio.

Il trasporto sta in `ufficio/`: uno script Apps Script riceve dal telefono e
deposita nella cartella Drive, che sul PC dell'ufficio è una cartella normale.
Un file, un solo autore — il telefono deposita, l'ufficio legge.

**La consegna passa da una coda.** Il rapportino si salva sempre in locale e
parte quando c'è rete: in giardino il campo spesso non c'è, e se l'invio fosse
l'unica strada il lavoro si perderebbe proprio dove si fa. `svuotaCoda()` gira
all'avvio, al ritorno della rete e ogni due minuti mentre l'app è aperta.

Niente esce dalla coda senza una conferma esplicita. Apps Script risponde 200
anche quando fallisce, con una pagina HTML al posto del JSON — la stessa
trappola del vecchio foglio — e un servizio può rispondere JSON valido che non
conferma nulla. Silenzio non vuol dire consegnato: si accetta solo
`status: "ok"`. E la richiesta va mandata **senza intestazione Content-Type**,
o scatta il controllo preventivo CORS che Apps Script non sa gestire.

## L'app dell'ufficio

Sta in `ufficio/index.html`, gira su Chrome o Edge su PC, e **non ha un database
suo**: il suo archivio sono file nella stessa cartella di Drive da cui legge i
rapportini. È il motivo per cui la cartella esiste — sta sul PC dell'ufficio, che
ha già il suo backup automatico, e IndexedDB non ci finirebbe dentro. Chi sposta
l'archivio nel browser perde la sola rete di sicurezza che c'è.

```
  GiardinoApp/rapportini/            ← scrive il telefono, l'ufficio legge
  GiardinoApp/archivio/<anno>/…      ← scrive l'ufficio
  GiardinoApp/listino.json           ← i prezzi, solo dell'ufficio
```

**Tutto il contatto con l'API delle cartelle sta in un punto solo.** `usaCartella()`
prende una maniglia e il resto dell'app non sa da dove arrivi: è il motivo per cui
si può provare senza aprire una finestra di sistema, che un test non saprebbe
toccare. Chi sparge `showDirectoryPicker` nel codice rende quella parte non
verificabile.

**Un rapportino è «in arrivo» perché l'archivio non ne ha una copia a quella
revisione**, non perché qualcuno l'abbia spostato: l'ufficio non scrive in
`rapportini/` nemmeno per segnare che ha finito. Un file, un solo autore.

**La stessa visita corretta riscrive il suo file d'archivio.** Il nome nasce da
data e cliente, e un cliente rinominato sul telefono metterebbe lo stesso lavoro
in archivio due volte — pronto per essere fatturato due volte. Per questo
`archivia()` riusa il nome del file già in archivio, se c'è.

**Il listino dell'ufficio è quello vero.** Il `prezzoProposto` che arriva dal
cantiere vale solo dove il listino tace. E come sul telefono, un prezzo scritto a
mano non viene mai risovrascritto: sopravvive anche a una correzione rimandata dal
cantiere.

**Il listino si modifica a video e si scrive su file col bottone.** Finché resta da
salvare, `LISTINO_DA_SALVARE` impedisce a una rilettura della cartella di
sovrascriverlo: un prezzo appena battuto che sparisce a un Ricontrolla è lavoro
perso in silenzio. Vale la stessa regola del telefono — un salvataggio fallito si
dice a chiaro schermo, non in console.

**Un file illeggibile si vede.** Drive a metà sincronizzazione lascia file
troncati, e nella cartella può finirci dentro qualcosa che non è un rapportino:
`leggiRapportino()` e `leggiLavoro()` si fermano, e l'elenco in arrivo dice quali e
perché. Un rapportino che non si riesce a leggere è lavoro fatto che rischia di non
essere fatturato, e non può stare nascosto in una console.

## Come arrivano gli aggiornamenti

Il service worker serve la copia in cache e scarica la versione nuova in
sottofondo, quindi **una modifica pubblicata si vede al secondo avvio**, non al
primo. Due trappole ci sono già costate un giro a vuoto:

- GitHub Pages dice al browser di tenersi i file per dieci minuti. Senza
  `cache: 'reload'` all'installazione e `cache: 'no-cache'` sul controllo in
  sottofondo, il service worker si ricachegga la versione vecchia credendo di
  essersi aggiornato.
- Su iPhone chiudere l'app spesso la sospende soltanto: riaprendola riprende la
  stessa pagina, senza ricaricare. Per questo quando arriva una versione nuova
  compare una **barra che resta** con un bottone che ricarica, invece di un
  toast che dice "chiudi e riapri" e sparisce in due secondi.

Dopo aver pubblicato, controllare sempre l'esito della pubblicazione su GitHub
prima di dire che è in linea: una volta è fallita per un timeout loro e il sito
ha continuato a servire la versione di tre mesi prima.

## Cose da sapere prima di metterci mano

- L'interfaccia usa `onclick="funzione()"`, quindi le funzioni devono restare
  globali. È il motivo per cui `index.html` non è diviso in moduli ES: servirebbe
  riscrivere tutti i gestori, senza che si veda nulla di nuovo.
- Gli id finiscono dentro stringhe JavaScript dentro attributi HTML: passarli da
  `perOnclick()`, o un cognome come "Dall'Oglio" rende il bottone inerte.
- I flag sul modello dei dati sono `'Sì'` o stringa vuota, non booleani, e vanno
  letti con `isSi()`: i backup vecchi contengono di tutto.
- I target azoto/potassio non stanno sul cliente ma sulla fascia, e si
  ricalcolano con `applicaFasce()` a ogni caricamento e dopo ogni modifica.
- Il vecchio endpoint Apps Script sopravvive solo dentro `importaDaSheets()`,
  per la migrazione una tantum. Non usarlo per altro.
- I tipi di operazione di partenza hanno identificativi parlanti e stabili
  (`concimazione`, `potatura-siepi`…) perché il codice li cerca per
  identificativo e mai per nome: chi rinomina un tipo non deve svuotare il
  report Prati.
- Sulle operazioni il campo è `Quantita` con la sua `Unita`. Si chiamava
  `Dose_kg` e mentiva: i liquidi sono in litri e le piante si contano a numero.
- `saveVisita()` riparte da `{ ...precedente }`. Il modulo della visita non
  conosce tutti i campi — il conto si compila altrove — e ricostruire l'oggetto
  da zero cancella quello che non vede. È già successo.
- Le pagine che sono testo nudo, non schede, devono darsi il margine laterale
  da sole: `#content` non ne ha, e gli importi finiscono oltre il bordo.
