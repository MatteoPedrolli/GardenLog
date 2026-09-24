# GiardinoApp — note per chi ci lavora

App per registrare gli interventi di giardinaggio: clienti, visite, operazioni,
appuntamenti, e su ogni cliente lo stato di concimazione del prato. La usa una
persona sola, quasi sempre dal telefono, spesso in giardino senza campo.

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

Quando cambiano `index.html` o `ufficio/index.html` si alza il numero di `CACHE`
in `sw.js`, o il telefono continua a servire la copia vecchia.

Le correzioni del beta testing sono **piccole** e vanno su `main`: i lavori grossi
(i preventivi) vanno avanti su un ramo loro, e un rifacimento fatto qui ci si
scontrerebbe. Prima di ogni modifica `git fetch origin main`.

I test vanno lanciati prima di ogni commit. Coprono le cose che rompendosi non
si fanno notare: il calcolo di azoto e potassio, la persistenza dopo la
ricarica, il backup, le eliminazioni a cascata, l'apertura offline. Se una
funzionalità nuova tocca i dati, merita una verifica lì dentro.

## Modalità costruzione

**Dal 23/09/2026 la suite è in servizio in azienda**: rapportini veri, fatture
vere. La regola di questa sezione resta — **non si scrivono migrazioni**, lo schema
cambia quando serve, si alza `VERSIONE_DATI` e i dati di una versione diversa non
vengono convertiti — ma non si alza più `VERSIONE_DATI` da soli.

**Prima di alzarla si chiede, dicendo cosa costa**: quali dati di chi lavora
finiscono in `CHIAVE_DA_PARTE` al primo avvio, e quali backup e documenti in giro
(rapportini in coda, appuntamenti, agenda) non si riaprono più. Con dati veri sul
telefono e in ufficio, un cambio di schema non è più un dettaglio di chi scrive il
codice: è una decisione di chi li usa.

Mantenere nove passaggi di conversione per dati che nessuno userà più costava più
di quanto valessero, e ogni passaggio era una cosa in più che poteva rompersi
senza farsi notare. Gli archivi di partenza stavano lì dentro: un database nuovo
attraversava le migrazioni *per finta* pur di raccoglierli. Ora stanno in
`datiIniziali()`, dove si leggono.

**Rompere la compatibilità non vuol dire cancellare di nascosto.** Quello che non
si sa leggere finisce in `CHIAVE_DA_PARTE` prima che il primo salvataggio lo
ricopra, la home mostra un avviso che resta, e dalla pagina Dati si scarica come
file. Sono l'unica copia rimasta: si cancellano solo con una conferma. Un backup
di un'altra versione, allo stesso modo, viene rifiutato invece che importato a
metà — il file resta lì, da riaprire quando servirà.

**Il rovesciamento è un passaggio da fare apposta, non una data.** Essere in
servizio non lo fa scattare da solo: finché siamo in beta testing la regola resta
questa. Il giorno in cui si decide, da lì in poi ogni cambio di schema vuole la
sua migrazione, o si perdono dati veri. Chi fa quel passaggio alza `VERSIONE_DATI`
un'ultima volta, rimette l'imbuto e riscrive questa sezione.

## La schermata visita è un rapporto, non un registro

Segue l'ordine del rapportino che si consegna a fine lavoro: cliente, ore,
operazioni, note. Non è estetica — scorrere lo schermo
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

**Il prossimo intervento non si scrive più qui.** Era un campo in fondo alla
visita, e adesso è una **prenotazione**: viaggia col suo documento e finisce sulla
lavagna dell'ufficio. Scriverlo in tutti e due i posti voleva dire due posti dove
cercarlo e due da tenere allineati. In fondo alla visita resta una scorciatoia che
apre la prenotazione **col cliente già messo** — è quello che hai davanti, farlo
ricercare sarebbe lavoro inventato — e quello che c'era da ricordare per la
prossima volta si scrive nelle note della prenotazione.

Le note sono **l'unico campo di testo** della prenotazione, e sono obbligatorie:
un cartellino col solo nome del cliente non dice niente a chi pianifica, e in
giardino non si può più chiedere.

Il promemoria che compare aprendo una visita (`mostraPromemoria`) legge da lì: le
prenotazioni sono il posto dove sta scritto cosa si era detto di fare.

**La pagina Prossimi guarda in due direzioni.** In cima c'è l'agenda che arriva
dall'ufficio — dove si va, con le note di chi c'è stato prima — e sotto quello che
si è prenotato da qui. `DB.agenda` è una copia di quello che l'ufficio ha deciso,
non un dato nostro: si riscrive intera a ogni scaricamento e non si modifica a mano.
Sta nel DB perché in giardino il campo spesso non c'è, ed è lì che serve; assente
vuol dire «non ancora scaricata», che è un valore buono e non chiede una
migrazione. Un'agenda che non si scarica **non cancella quella di prima**: vecchia
di un giorno è un'informazione, il vuoto no.

## Sul telefono lo schermo è poco

**Non c'è una barra in alto.** Ripeteva il nome della pagina che la barra in basso
già evidenzia, e il suo ＋ faceva quello che fanno le schede «Nuova visita» e
«Nuovo cliente» della home: era spazio tolto alla schermata per dire due volte la
stessa cosa. Le **impostazioni** (la pagina Dati e backup) sono l'ultima voce della
barra in basso, con le altre. Le voci sono in minuscolo: in maiuscolo cinque non ci
stavano.

Resta un **titoletto** piccolo, `#titoletto`, sulla stessa fascia scura: senza, si
perdeva il segno di dove si è. Dice la pagina in una parola ed è alto la metà della
barra di prima; sulla home non c'è, perché il riquadro con la data fa già da
testata.

Sopra, resta `#barra-stato`, una fascia scura alta quanto la barra di
stato dell'iPhone: con `black-translucent` l'orologio è bianco, e sullo sfondo
chiaro sparirebbe. Per saperne l'altezza serve `viewport-fit=cover`, che però porta
la pagina fino in fondo allo schermo: per questo barra in basso, pannelli, avvisi
e barra dell'aggiornamento sommano `env(safe-area-inset-bottom)`. Chi aggiunge
qualcosa fissato in basso deve fare lo stesso, o finisce sotto la linea per tornare
alla home.

## Il prato sta sul cliente

C'era una pagina **Report Prati**, con l'elenco dei prati e per ognuno le
percentuali, le barre e il dettaglio delle concimazioni. Non l'ha mai aperta
nessuno: la domanda «quanto ho concimato qui» arriva **guardando un cliente**, non
scorrendo un elenco di prati, e una pagina in più da raggiungere era una pagina
in meno da usare.

Adesso è un riquadro sulla scheda cliente, accanto a quello della siepe — sono la
stessa cosa detta per l'altra pianta. Dentro: la fascia, i metri quadri, **due
barre**, azoto e potassio, con la percentuale e i g/m² fatti sul target, e le
ultime concimazione, semina e arieggiatura.

**Due barre e non una percentuale sola**: il potassio resta indietro rispetto
all'azoto, e un numero unico lo nasconderebbe. Il colore — rosso sotto il 40%,
giallo fino all'80%, verde oltre — è quello che si guarda prima del numero, e le
soglie stanno in `semaforoDa()`, in un posto solo, o le due barre direbbero due
cose diverse.

Il dettaglio riga per riga delle concimazioni non è passato: sotto, nello storico
visite, quelle operazioni ci sono già.

## Le voci da conteggiare

**Visita e conto sono la stessa schermata.** In fondo, dopo le operazioni, c'è
l'elenco delle voci da conteggiare, e si compila mentre registri. Erano due
schermate: per mostrare il conto, il rapportino ti ripeteva ore e operazioni in
sola lettura — le stesse informazioni due volte, una da compilare e una da
rileggere. Chi le separa di nuovo reintroduce quella copia.

**Sul telefono non ci sono prezzi.** Il listino sta in ufficio, in un posto solo
invece che su due dispositivi che divergono. Il cantiere dice *cosa* è stato
fatto e *quanto* — la cosa che solo lui sa — e quanto vale lo decide chi
fattura. Chi rimette un campo prezzo qui rimette anche il problema di tenerli
allineati.

L'elenco **nasce già compilato**: la manodopera dalle fasce orarie, i materiali
dalle operazioni che hanno una voce collegata. Chi lo apre corregge, non scrive
da zero.

Ogni riga automatica porta una `Chiave` che dice da dove nasce — `manodopera`
oppure l'`OperazioneID`. `costruisciConto()` la usa per riallineare: le quantità
seguono i dati della visita, e le righe aggiunte a mano (senza `Chiave`) restano
dove sono.

Potature, taglio prato e arieggiatura non hanno voce collegata: sono manodopera,
già contata dalle ore. Collegarle vorrebbe dire fatturarle due volte.

**Il trasferimento compare sempre**: c'è a ogni lavoro. Doverlo aggiungere a mano
era il modo migliore per dimenticarlo, e dimenticarlo costa all'azienda.

**Una voce `ACorpo` si conta una volta, non a misura.** Il trattamento
fitosanitario si fattura così: nell'elenco vale 1, mentre prodotto e litri
restano sull'operazione, dove servono al registro dei trattamenti. È la ragione
per cui agronomia e conto sono due elenchi distinti sulla stessa visita: lo
stesso fatto si misura in modi diversi a seconda di chi lo legge.

**«Concime» è una categoria, «Nitrophoska» è quello che hai comprato.** Due
concimi diversi costano diverso, e con la sola voce generica si fatturavano
uguale. Il listino dell'ufficio ha quindi due elenchi: le **voci** e i
**prodotti**. Quando un prodotto ha un prezzo suo quello vince; quando non ce
l'ha, vale ancora la voce — e la pagina Listino dice quali prodotti sono stati
usati senza averne uno, o te ne accorgeresti solo da un totale più basso.

La giunzione è `chiave` sulla riga ↔ `id` sull'operazione: la riga la portava già,
l'operazione no, e mancando quella l'ufficio vedeva «Concime 25 kg» senza sapere
quale. Un prodotto segnato **a corpo** in ufficio vale 1 in elenco: i litri
restano sull'operazione, dove servono al registro dei trattamenti.

**Il nome del prodotto non esce.** La riga porta `prodotto` in un campo suo e
`voce` resta generica: il foglio e la mail stampano `voce`, l'ufficio legge
`voceConProdotto()`. È la stessa divisione di ore e operazioni — l'ufficio vede
tutto, al cliente va il conto — e tiene i nomi commerciali dei diserbi fuori da un
documento che esce.

I `Conto` delle visite già registrate **conservano i loro `Prezzo`**: sono il
registro di quello che è stato fatturato prima che il listino passasse in
ufficio, non un listino. Riscriverli cancellerebbe l'unica traccia che ne resta.

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

I documenti sono tre. Il **rapportino** racconta un lavoro finito; l'**appuntamento**
è una prenotazione fatta dal cantiere, col cliente davanti. Sono cose diverse e in
ufficio le guardano due schermate diverse, quindi viaggiano separate e finiscono in
due cartelle: `rapportini/` e `appuntamenti/`. Il terzo è l'**agenda**, e va
nell'altro verso: la scrive l'ufficio e la legge il telefono.

**L'agenda porta quattro campi e non uno di più**: giorno, mezza giornata, cliente,
note. Non è economia di formato, è la ragione per cui esiste così: è l'unico
documento che si *legge* dall'indirizzo dello script, che è pubblico per chi lo
conosce. Indirizzi, telefoni, ore, requisiti e prezzi restano in ufficio, e chi
aggiunge un campo a `costruisciAgenda()` lo pubblica là.

Le note sì, e sono il motivo per cui l'agenda vale la pena: sono la cosa che fa il
giro completo. Il cantiere le scrive prenotando, l'ufficio se le tiene sul
cartellino, e tornano in giardino il giorno del lavoro.

Sei appuntamenti, da oggi in avanti, e solo quelli già piazzati su una mezza
giornata: un lavoro ancora in colonna non ha un momento suo, e metterlo in agenda
vorrebbe dire prometterlo. Oltre i sei la pianificazione cambia ancora, e una lista
lunga sarebbe una lista sbagliata.

Entrambi, in modalità costruzione, si leggono **solo alla loro versione corrente**:
o il documento è di questa versione, o si rifiuta dicendolo. Archiviare un
documento monco senza dirlo a nessuno è il guasto peggiore che possa capitare qui.

Il trasporto sta in `ufficio/`: uno script Apps Script riceve dal telefono e
deposita nella cartella Drive, che sul PC dell'ufficio è una cartella normale. Lo
script instrada per `tipo`: aggiungere un documento nuovo vuol dire aggiungere una
riga a `CARTELLE` **e rifare la distribuzione**, o continua a girare la versione di
prima. Un file, un solo autore — il telefono deposita, l'ufficio legge, e l'agenda
è l'unico file dove i ruoli si scambiano.

**In lettura lo script sa nominare un file solo.** `doGet` prende il nome da
`LEGGIBILI`, non dalla richiesta: un nome che arriva da chi chiama farebbe di quel
`?documento=` un modo per leggersi il listino o l'anagrafica. La lista è di due
righe e va tenuta corta per la stessa ragione.

**La consegna passa da una coda.** Il rapportino si salva sempre in locale e
parte quando c'è rete: in giardino il campo spesso non c'è, e se l'invio fosse
l'unica strada il lavoro si perderebbe proprio dove si fa. `svuotaCoda()` gira
all'avvio, al ritorno della rete e ogni due minuti mentre l'app è aperta.

**Un documento rifiutato non tiene in ostaggio quelli dietro.** Il servizio che
non risponde ferma la fila — inutile insistere — ma un documento che il servizio
*ha letto e respinto* no: resta in coda col suo errore e gli altri passano. È
successo davvero, con una prenotazione mandata a una distribuzione vecchia dello
script: veniva respinta, e i rapportini dietro non partivano più. Un lavoro fatto
non può restare sul telefono per colpa di un altro documento.

Il banner della coda dice **di che documento** si tratta: chiamare «rapportino»
una prenotazione ferma manda a cercare nel posto sbagliato.

E l'errore si legge **accanto al documento che non è partito**, non solo sul banner
in home: chi cerca una prenotazione ferma sta sulla pagina Appuntamenti, e «da
consegnare» senza un perché non dice cosa fare. Per un po' l'errore è stato solo
in home, e ha fatto perdere mezza giornata a capire cosa fosse rotto.

**Chi è in fila non ha un errore suo, e va detto anche quello.** Quando il servizio
non risponde `svuotaCoda()` fa `break`, così i documenti dietro non vengono nemmeno
provati: il loro `errore` resta vuoto. Mostrare solo l'errore proprio vorrebbe dire
che la prenotazione bloccata dice «da consegnare» e tace — ed è il caso in cui non è
colpa sua. Conta solo quello che le sta **davanti**: la coda si svuota in ordine, e
un documento accodato dopo non la trattiene.

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

**Le pagine non hanno un titolo che ripeta la barra.** Il nome dell'app in cima
alla barra laterale e «Clienti», «Archivio», «Lavagna» in testa alle pagine dicevano
la stessa cosa della voce evidenziata, e rubavano spazio alla schermata. Un titolo
resta solo dove dice qualcosa che la barra non sa: il nome del cliente di un lavoro
aperto, o la schermata per collegare la cartella.

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

**Il listino dell'ufficio è l'unico che c'è.** Dal cantiere arrivano quantità e
niente prezzi. Un prezzo scritto a mano non viene mai risovrascritto dal listino:
sopravvive anche a una correzione rimandata dal cantiere.

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

## La lavagna non è un calendario

Vive solo in ufficio, sul PC. In alto la settimana spezzata in mezze giornate,
sotto quello che c'è da fare e non ha ancora una data. È la lavagna che si
teneva a matita, non un'agenda: **niente si muove da solo**, nemmeno passando di
settimana.

**La posizione di un lavoro è una data vera** (`giorno` + `mezza`), non un posto
nella griglia. Con un indice dentro la settimana mostrata i cartellini si
sposterebbero da soli cambiando settimana — che è esattamente quello che non deve
succedere.

**Matita e penna sono due stati, non due colori.** `matita` vuol dire previsto e
il cliente non lo sa; `confermato` vuol dire che il cliente sa che arrivate.
Spostare o togliere un confermato chiede conferma: vuol dire che qualcuno deve
telefonare, e non può succedere per un trascinamento distratto.

**Grigio, verde, blu — e la parola accanto.** Grigio previsto, verde confermato,
blu fatto. Il colore da solo non basta: si perde a chi distingue male verde e
grigio, e sulla carta. Ogni cartellino dice anche a parole dove sta.

**`fatto` è un interruttore, non un terzo stato.** Sta sopra matita e confermato,
così togliendo la spunta il lavoro ritrova da sé dov'era, e «confermato» continua
a voler dire che il cliente lo sa. Si mette **a mano**, con la sua casella, e non
arriva dal rapportino anche se l'informazione lì ci sarebbe: su questa lavagna
niente si muove da solo, e un cartellino che diventa blu perché è comparso un file
in una cartella è esattamente quello che quella regola vieta. Chi pianifica sa di
esserci stato prima che il rapportino arrivi, e a volte il rapportino non arriva.

Un lavoro fatto **non si trascina e non cambia penna**: spostare una cosa già
avvenuta non vuol dire niente. Prima si toglie la spunta.

**Un appuntamento si fissa in una settimana, non in un giorno.** Il giorno lo
decide chi pianifica trascinando il cartellino; prometterlo prima vorrebbe dire
spostarlo tre volte. Una settimana si **identifica col lunedì che la apre** — una
data sola, che si ordina da sé e non è ambigua in nessuna convenzione — e si
**legge** sempre nello stesso modo, da `etichettaSettimana()`: «dal 22/06 ·
settimana 26». Quelle funzioni stanno in `rapportino.js` perché le usano tutte e
due le app, e due idee diverse di «quale settimana» sarebbero peggio di nessuna.

**La settimana 1 è quella che contiene il 1° gennaio**, e le settimane partono di
lunedì: è come si contano sul calendario appeso in ufficio. Non è la regola ISO,
che fa partire la settimana 1 dal primo giovedì e ogni tanto tira fuori una
settimana 53 a fine dicembre. Le due coincidono per quasi tutto l'anno e
divergono solo a cavallo di capodanno — ed è lì che i test guardano. Il numero
conta perché è quello che si dice a voce: se il capo o il commercialista dicono
«settimana 40», dev'essere la stessa dell'app.

Anche così, **ogni tanto un anno ha 53 settimane**: 52 settimane da 7 giorni
fanno 364, e il calendario slitta. Non è un difetto della regola, è aritmetica.

Nei moduli si sceglie **un giorno qualunque** e conta la sua settimana: un
calendario lo sanno usare tutti i telefoni, mentre `<input type="week">` su iOS
diventa una casella di testo. Sotto al campo compare la settimana che ne esce, o
si finisce per credere di aver fissato una data.

**L'anno si scrive quando non è quello in corso**: «dal 24/09/2029 · settimana 39».
È successo davvero, un 2029 battuto al posto di 2026: l'etichetta era identica a
quella giusta e il lavoro spariva fra quelli per più avanti senza che niente lo
dicesse.

**Quello che è per più avanti non sta in mezzo ai piedi.** La colonna mostra i
lavori della settimana guardata e di quelle già passate; gli altri restano da
parte, contati, con un bottone per guardarli — nascondere senza dire quanto è il
tipo di aiuto che fa perdere un lavoro. Un lavoro **senza settimana** si vede
sempre: non ha un momento suo, quindi è adesso. Il riferimento è la settimana
mostrata e non l'oggi, così spostandosi avanti con le frecce i lavori di quella
settimana compaiono da soli — e il pallino nella barra conta quello che la
colonna mostra, o uno dei due mente.

**La coda sta sotto la settimana, non accanto.** Era una colonna a sinistra, e i
sei giorni si dividevano quello che restava: stretti, sbordavano. Sotto, i giorni
hanno tutta la larghezza e la coda si legge come una pagina: tre colonne riempite
da sinistra a destra, riga dopo riga, **in ordine di priorità** — chi scade prima,
poi chi non ha settimana. Uno slittato non passa davanti per il fatto di essere
slittato: lo dicono l'avviso e l'etichetta, ma salire in cima falsava la priorità.

**I bloccati hanno la quarta colonna**, a destra: hanno un requisito aperto e non
si possono ancora fare. Un lavoro si rimette in coda lasciandolo su una qualsiasi
delle due: dove finisce lo decide il requisito, non il punto dove lo lasci.

Dentro i giorni non si ordina niente: lì l'ordine lo dà chi pianifica.

**Una mezza giornata sono otto ore di manodopera** — quattro d'orologio in due.
Servono a sapere quante mezze giornate occupa un lavoro lungo, non a dichiarare
piena una giornata: `piuGiorni` è un interruttore che si accende a mano, perché
spalmare un lavoro è una decisione, non un calcolo. La domenica si salta.

**La lavagna si salva a ogni mossa**, senza un bottone: una lavagna che ti chiede
di ricordarti di salvare è una lavagna che perde una settimana di pianificazione.
E con lei si riscrive `agenda.json`, dentro `salvaLavagna()` e non in un bottone a
parte: chi pianifica sposta un cartellino e passa al successivo, e un'agenda da
aggiornare a mano è un'agenda che in giardino dice il giorno sbagliato.

**Il sabato resta a disposizione**: c'è, ma non è una giornata come le altre e il
piede della colonna lo dice.

**Un cartellino ha un campo di testo, non due.** «Cosa c'è da fare» e «cosa
ricordare» erano due caselle per dire la stessa cosa, e una delle due restava
sempre indietro: adesso c'è solo `note`, in tutte e due le app e nel documento
dell'appuntamento. Le note sono anche l'unica cosa che fa il giro completo, quindi
quel campo è il posto dove scrivere le operazioni: da lì partono per l'agenda e
tornano in giardino.

**Quanto è largo un lavoro lo dice chi pianifica**, non la stima ore: `mezze` si
alza e si abbassa di uno con `+` e `−`. Dedurlo dalle ore legava la lavagna a un
numero messo a occhio, e chi pianifica sa cose che la stima non sa. Le ore seguono:
si spalmano sulle mezze giornate occupate e restano un'indicazione per chi guarda
la colonna.

I lavori arrivano da due parti:

- le **prenotazioni** depositate in `appuntamenti/` entrano **da sole** a ogni
  rilettura della cartella. Chi prenota è in giardino col cliente davanti, e
  chiedere all'ufficio di ricopiarle vorrebbe dire perderne una ogni tanto;
- a mano, per le telefonate e per quello che decide l'ufficio.

Ogni lavoro porta **il giorno in cui è entrato** (`inserito`), e il cartellino in
coda lo dice accanto all'origine: guardando la coda la domanda è anche «da quanto
aspetta». Il campo è arrivato dopo, senza alzare versioni: un lavoro che non ce
l'ha vale ancora. Le prenotazioni la recuperano da `creato` sul loro documento in
`appuntamenti/`, a ogni rilettura; i lavori messi a mano prima restano senza, perché
la data non è mai stata scritta da nessuna parte e inventarla sarebbe peggio.

Tutto quello che è già stato guardato finisce in `visti`, così quello che l'ufficio
ha scartato non ricompare al giro dopo. Sul telefono il mese del prossimo intervento
è il valore di una select (`"03"`, non `"marzo"`): passa da `nomeMese()` prima di
andare a schermo.

## L'archivio: prima il gestionale

Un lavoro archiviato **si apre con un clic**, e lì si guarda il conto senza
passare dalla stampa. La schermata mostra anche ore e operazioni, che sul foglio
del cliente non vanno: qui servono, perché sono il perché di quel totale ed è la
domanda che arriva quando qualcuno telefona.

**Non si corregge.** Per cambiare un lavoro chiuso si rimanda il rapportino
corretto dal cantiere, e torna fra quelli in arrivo con la sua revisione nuova.
Una modifica fatta solo in ufficio si perderebbe al primo reinvio.

**Si può togliere, però.** Non per correggere — per il lavoro che non ci doveva
stare: una prova, un doppione. `eliminaArchiviato()` cancella il file dalla
cartella, e la conferma dice **quale delle due cose succede dopo**, perché sono
diverse: se il rapportino è ancora in `rapportini/` il lavoro torna fra quelli in
arrivo e si riarchivia — è la solita regola, in arrivo perché l'archivio non ne ha
copia — mentre se non c'è più, quel file era l'unica copia rimasta di lavoro fatto
e non torna. Una conferma che dicesse sempre la stessa frase servirebbe a niente.

**A sinistra sta il gestionale**: quanti lavori sono da fatturare e quanto fanno,
quanti sono fatturati, e il totale. Resta lì mentre si scorre l'elenco, perché è
la domanda che in ufficio ci si fa per prima e un numero in fondo alla pagina non
risponde a nessuno. Raccogliendo **per cliente**, ogni gruppo dice quanto gli si
deve ancora: è la riga che serve prima di alzare il telefono.

**L'invio non manda niente**, come sul telefono prima di lui: `inviaConto()` apre
la posta con destinatario — preso dall'anagrafica, ed è il motivo per cui le mail
stanno lì — oggetto e conto già scritti. Il lavoro si segna *in posta* e non
*inviato*: l'app sa di averlo passato alla posta, non sa se è partito. E si segna
prima di aprirla, o una mail mandata resterebbe senza traccia in archivio. Senza
email il conto si manda lo stesso, con il destinatario da scrivere a mano, ma
l'app lo dice.

**Più lavori, un conto solo.** Due giornate dallo stesso cliente sono due
rapportini e due file in archivio, e restano tali; si spuntano, e «Stampa insieme»
e «Manda insieme» fanno un foglio o una mail soli. Dentro, **un blocco per lavoro**
con la sua data e il suo subtotale, e il totale in fondo: il cliente deve poter
vedere cosa è stato fatto quando, e sommare le voci uguali lo nasconderebbe. Si
uniscono **solo lavori dello stesso cliente** (stesso `id` o stesso nome intero):
unire due clienti vorrebbe dire mandare a uno il conto dell'altro. Mandando insieme
si segnano *in posta* tutti prima di aprire la posta, e se uno non si riesce a
segnare la posta non si apre: una mail per due lavori di cui l'archivio ne ricorda
uno è il doppione del mese dopo.

Nel testo della mail niente colonne allineate con gli spazi: le app di posta usano
caratteri a larghezza variabile e arrivano storte. Una voce per riga.

`apriPosta()` è l'unico punto che porta fuori dall'app, e sta da solo per lo stesso
motivo per cui ci sta `usaCartella()`: aprire la posta è una cosa che un test non
può fare.

## Il foglio che va al cliente

**Stampa ed esporta PDF sono la stessa cosa.** Nel dialogo di stampa «Salva come
PDF» è una destinazione, quindi basta un bottone e un `@media print`. Una libreria
PDF sarebbe la prima dipendenza a runtime del progetto, per un risultato peggiore
di quello che il browser fa già.

**Non si stampa la schermata, si stampa un foglio a parte.** `#foglio` è invisibile
a schermo ed esiste solo per la carta: stampando la schermata, i campi da compilare
uscirebbero come caselle vuote e la barra di navigazione non avrebbe senso.

**Al cliente va solo il conto.** Ore, fasce e operazioni agronomiche restano in
ufficio: servono a fatturare e al registro dei trattamenti, non a chi paga. Una
riga senza prezzo stampa «da definire» invece di lasciare un buco, come fa il testo
della mail sul telefono, e se il totale è parziale il foglio lo dice.

**I prezzi in listino sono IVA inclusa**, e il totale sul foglio lo scrive. Se un
giorno diventassero al netto non basta cambiare i numeri: va cambiata quella
riga, o il foglio dichiara una cosa e ne mostra un'altra.

**L'intestazione non sta nel codice.** Sono i dati di un'azienda vera: vivono in
`impostazioni.json` nella cartella, si compilano in Impostazioni e il backup del PC
li copre come tutto il resto. Se mancano, la stampa avvisa ma non si rifiuta — la
decisione resta di chi stampa.

Il titolo della pagina viene cambiato prima di stampare, perché Chrome lo propone
come nome del file in PDF, e rimesso a posto su `afterprint`: rimetterlo subito
darebbe un file chiamato «GiardinoApp · Ufficio».

## L'anagrafica: due archivi, non una copia

L'ufficio ha il suo `clienti.json`, e **non è una copia** di quello del telefono:
qui i clienti hanno telefono e mail — quello che serve per chiamare e confermare
un appuntamento — e il cantiere non li conosce.

Per questo il telefono esporta in un file a parte, `anagrafica-dal-telefono.json`,
e l'ufficio **importa** da lì invece di leggerlo come proprio archivio. Un'importazione
che sovrascrive cancellerebbe i numeri di telefono a ogni giro: arrivano solo i
clienti nuovi, quelli che ci sono già restano come sono stati corretti. Resta valida
la regola di sempre — un file, un solo autore — anche quando i dati viaggiano.

Chi compare sui rapportini e non in anagrafica si aggiunge con un bottone: il
cantiere l'ha già scritto una volta, e farlo ribattere sarebbe lavoro inventato.

**Una scheda cliente chiusa è solo il nome**, e si apre con un clic: con tutti i
campi aperti l'elenco era un muro di caselle, e chi cerca un cliente scorre i nomi.
Aperta, porta **«Vedi conti»**, che va in archivio con i soli lavori di quel
cliente — il gestionale a sinistra compreso, perché quanto gli si deve è la domanda
per cui lo si apre. Il filtro resta scritto in cima con una ✕: un archivio che
mostra una parte senza dirlo fa credere che il resto non ci sia. I conti si
trovano per `id` **o per nome intero**: un cliente aggiunto a mano in ufficio ha un
id che i rapportini non conoscono, e il nome a pezzi porterebbe le fatture di
«Rossini» dentro quelle di «Rossi».

**I prodotti seguono la stessa regola.** Concimi, sementi e fitofarmaci vivono sul
telefono — in giardino senza rete devi poter scegliere un concime, e N% e K%
servono al riquadro del prato, non a chi fattura. Il telefono esporta
`prodotti-dal-telefono.json`, l'ufficio importa i nuovi e **tiene i prezzi** di
quelli che ha già. Il verso non si inverte: un prezzo sbagliato perché il telefono
non ha scaricato l'ultimo listino è un errore che paga il cliente, mentre l'agenda
può arrivare vecchia di un giorno senza danni.

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

## La cromia: carta e inchiostro

**L'app non ha un colore suo: ce l'hanno gli stati.** Era tutta verde, e sulla
lavagna il verde di «confermato» finiva sopra un banner verde, una pastiglia verde
e un bottone verde: smetteva di essere un'informazione e diventava arredamento.
Le variabili si chiamano `--inchiostro`, `--ocra`, `--velo`, `--foglio`, e non
`--green-*`, perché un nome che mente costa più di una rinominazione.

L'accento sta nella **metà calda** della ruota apposta, lontano sia dal verde sia
dal blu. Chi un giorno volesse rifare la cromia ha questo vincolo: gli stati della
lavagna vengono prima.

Le due app usano la stessa palette. I verdi rimasti sul telefono — la pastiglia
del prato, quella della siepe — non sono cromia: dicono di che pianta si parla.

**Niente corsivo e niente graziati.** I nomi dei clienti erano in Playfair Display,
un graziato ad alto contrasto, e le note dell'agenda in corsivo: tutti e due si
leggevano male, e chi usa l'app lo ha chiesto espressamente. I titoli e i nomi usano
`--font-display`, che è Calibri sul PC dell'ufficio e ricade sul DM Sans del testo
dove Calibri non c'è. Per mettere in evidenza si usa il peso o il colore, non il
corsivo.

## I preventivi

Non sono ancora costruiti. Quello che si è capito sta in `ufficio/PREVENTIVI.md`:
i quattro tipi di preventivo e quale ha davvero bisogno di un disegno, perché il
CAD non si rifà, dove sta il lavoro vero (il passaggio dai numeri al preventivo,
non la misurazione), e cosa va chiesto alla segretaria prima che vada in pensione.

Chi ci mette mano legga prima quello, o rifarà un ragionamento già fatto.

## Richieste in attesa

Quello che è stato chiesto e si farà più avanti sta in `RICHIESTE.md`, con cosa
tocca e cosa resta da decidere. Prima di cominciare qualcosa di nuovo, guardare
lì: può darsi che sia già stato ragionato.

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
- L'aggancio tipo → voce sta su `TIPI_DEFAULT`, in un posto solo. `VoceID` vuoto
  non è una dimenticanza: potature, taglio prato e arieggiatura sono manodopera,
  già contata dalle ore, e collegarle vorrebbe dire fatturarle due volte.
- I tipi di operazione di partenza hanno identificativi parlanti e stabili
  (`concimazione`, `potatura-siepi`…) perché il codice li cerca per
  identificativo e mai per nome: chi rinomina un tipo non deve svuotare il
  riquadro del prato sulla scheda cliente.
- Sulle operazioni il campo è `Quantita` con la sua `Unita`. Si chiamava
  `Dose_kg` e mentiva: i liquidi sono in litri e le piante si contano a numero.
- `saveVisita()` riparte da `{ ...precedente }`. Il modulo della visita non
  conosce tutti i campi — il conto si compila altrove — e ricostruire l'oggetto
  da zero cancella quello che non vede. È già successo.
- Le pagine che sono testo nudo, non schede, devono darsi il margine laterale
  da sole: `#content` non ne ha, e gli importi finiscono oltre il bordo.
- Una colonna della lavagna cresce fino al suo contenuto più largo e sborda su
  quella accanto: è già successo con la fila `−/1 mezza/+`, che non andava a capo
  e spingeva le ore sopra il «MATTINA» del giorno dopo. Si vede solo a occhio, per
  questo il giro di prova **misura** lo sbordo su una finestra stretta.
- Lo stesso vale nei pannelli: il margine lo dà `.drawer-body`, non `.drawer`.
  Quello che si vede va lì dentro, o campi e bottoni arrivano a filo dello
  schermo. È già successo al pannello della prenotazione.
