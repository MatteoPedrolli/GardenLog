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

**Niente fotografie nel database.** Sarebbe la cosa più utile da aggiungere a un
rilievo — una foto della siepe risponde a quello che in ufficio non si può più
chiedere — ma `salvaDB()` ricopia tutto il database in `localStorage` come seconda
copia, e lì ci stanno circa 5 MB: due foto e ogni salvataggio comincia a fallire.
Chi le vuole le tenga **fuori** dal database mirrorato e fuori dal backup, in un
archivio suo da cui partono e poi si scartano. Non è un dettaglio da scoprire a
cose fatte.

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

**Un cliente può essere di passaggio.** Ci sono interventi senza seguito, e metterli
in anagrafica la riempiva di nomi visti una volta, più difficile da usare per i
clienti veri. Nella ricerca del cliente c'è sempre «*nome* · solo per questa
visita»: nome, via e paese stanno sulla visita (`Passaggio`, con `ClienteID` vuoto)
e non in `DB.clienti`. Il rapportino parte come gli altri — il cliente viaggia già
per esteso — con `passaggio: true`, e l'ufficio non lo propone fra quelli da
aggiungere: se serve, si aggiunge a mano. Niente scheda cliente, prato o storico,
che hanno senso solo per chi si segue. Se torna, **«Metti in anagrafica»** sulla
visita lo crea coi dati già scritti; e per **prenotare** il prossimo intervento lo
si mette in anagrafica, chiedendolo: una prenotazione è un seguito. Campo arrivato
senza alzare versioni.

**Le ore sono un calcolo, non un numero.** Fasce orarie con orario e numero di
persone; il totale lo fa `oreTotali()`. Una fascia che l'app propone resta
`proposta: true` finché non viene toccata o confermata, e `saveVisita()` si
rifiuta di salvare se ne resta una: le ore finiscono in fattura, e un orario
precompilato che nessuno ha guardato è un errore che paga il cliente.

Sotto ogni fascia c'è **una riga di testo, `Cosa`**: cosa si è fatto in quelle ore.
Viaggia nel rapportino (`ore.fasce[].cosa`) e in ufficio si legge sotto la sua
fascia, nel lavoro in arrivo e in archivio; **al cliente non arriva**, come le
fasce. Scriverla non conferma l'orario di una fascia proposta: sono due cose
diverse, e un «potatura» scritto sotto un orario mai guardato non lo rende giusto.

**Ogni fascia ha il suo giorno** (`Data`, sopra gli orari, col nome del giorno
accanto). Si era detto che un lavoro di più giorni fossero più visite, e in
giardino non è andata così: lo stesso lavoro si chiude in un rapportino solo, e le
ore di martedì non vanno confuse con quelle di mercoledì. Una fascia nuova prende
il giorno dell'ultima — si continua la stessa giornata, o si passa alla dopo —
e cambiando la data della visita la seguono le fasce che stavano sul suo giorno,
non le altre: quelle qualcuno le ha messe apposta. Come «Cosa», il giorno non
conferma l'orario. Viaggia nel rapportino (`ore.fasce[].data`) senza alzare la
versione, e in ufficio sta **davanti all'orario** («Lun 21/09/2026», `righeFasce()`);
i rapportini di prima, senza, mostrano la data della visita.

**Le operazioni si spuntano.** L'elenco viene da `DB.tipiOperazione`, ordinato
per quanto si usano da quel cliente. Spuntando si apre solo il dettaglio che
quel tipo richiede (`dettaglio`: niente, concime, semente, fitofarmaco,
quantita) e i flag prato/siepe li mette il tipo, non l'utente.

**Le lavorazioni stanno per settore.** Con trenta tipi un elenco solo da scorrere
col pollice non reggeva, e a voce si dice «sul prato ho fatto…». I settori — Prato,
Aiuole, Potature, Siepe, Irrigazione, Piantumazione, Trattamenti — sono un archivio
(`DB.settori`, Archivi › Settori della visita): ognuno elenca i `TipoID` che
contiene, e le lavorazioni le raggruppa chi lavora, non chi programma. Sono
arrivati con `DEFAULT_ARRIVATI_DOPO`, come i tipi nuovi che si portavano dietro
(asporto terriccio, terra vegetale, livellamento, bordura, potatura alberature):
nessuna versione alzata.

**Un settore aperto alla volta**, e chiusi dicono quante e quali lavorazioni ci
sono spuntate dentro: nascondere una cosa segnata è il modo migliore per fartela
dimenticare.

**Il + accanto a una lavorazione spuntata ne aggiunge un'altra uguale**
(`aggiungiUguale()`): due concimi diversi sullo stesso prato, due fitofarmaci, dodici
lauri e tre aceri. È un'operazione in più dello stesso tipo e settore, vuota, con la
sua riga nel conto; con più d'una ognuna ha la sua ✕. Il + c'è **solo dove c'è
qualcosa da distinguere** — un prodotto, una quantità, un «cosa» (`haDettaglio()`):
due tagli prato nella stessa visita sarebbero la stessa cosa detta due volte. Era
nato per le piante, col bottone «+ Un'altra pianta»; adesso è lo stesso per tutte.

**I settori non sono legati fra loro.** Per un giorno una lavorazione in due
settori è stata una sola, spuntata in tutti e due: la piantumazione delle aiuole
compariva anche nella siepe, e creava solo confusione. Le aiuole e la siepe sono
lavori diversi, con le loro piante e le loro quantità: ogni operazione ricorda il
settore dove è nata (`Settore`, e `SettoreNome` che viaggia nel rapportino come
`settore` e in ufficio si legge accanto all'operazione). Le operazioni registrate
prima valgono nel primo settore che contiene il loro tipo (`settoreDiOperazione()`).
Sopra c'è una **ricerca** che guarda in tutti i settori senza badare ad accenti e
maiuscole: una riga per lavorazione e settore, col settore accanto. Un tipo che non sta
in nessun settore finisce in **«Altre»**, in fondo: un tipo creato ieri si deve
trovare lo stesso. Aprendo una visita già fatta si apre il settore della prima
cosa spuntata.

**Un settore `Libero` ha righe scritte a mano** — cosa, quanti, unità — per i lavori
dove le voci cambiano ogni volta: l'irrigazione (un'elettrovalvola, sei
irrigatori, quaranta metri di tubo). Sono operazioni senza tipo con `Settore`, e
partono nel conto come voci col loro nome e la loro quantità, senza prezzo. Una
riga vuota al salvataggio si lascia cadere; una con la quantità e senza «cosa» ferma
il salvataggio.

**Nella visita gli insiemi non ci sono più**: li hanno sostituiti i settori, che si
aprono invece di spuntare tutto in un colpo. Restano in Archivi per i **rilievi**,
dove «Siepe nuova» o «Aiuola» sono una lavorazione che si misura una volta. Un
insieme non ne contiene altri.

I campi che l'utente compila usano `oninput`, non `onchange`: con `onchange` il
modello resta indietro fino al blur. E non si ridisegna l'elenco mentre si
scrive — si aggiorna solo quello che cambia, o il campo sparisce da sotto le dita.

**Il prossimo intervento non si scrive più qui.** Era un campo in fondo alla
visita, e adesso è una **prenotazione**: viaggia col suo documento e finisce sulla
lavagna dell'ufficio. Scriverlo in tutti e due i posti voleva dire due posti dove
cercarlo e due da tenere allineati. In fondo alla visita resta una scorciatoia che
apre la prenotazione **col cliente già messo** — è quello che hai davanti, farlo
ricercare sarebbe lavoro inventato — e quello che c'era da ricordare per la
prossima volta si scrive nelle note della prenotazione. La visita **resta aperta sotto**
la prenotazione: chiuderla per aprire l'altra buttava via quello che non era ancora
stato salvato, e riaprendola si ritrovava la versione di prima. È successo davvero,
con le correzioni di un rapportino. Con due pannelli aperti, il tasto indietro
chiude quello sopra.

Le note sono **l'unico campo di testo** della prenotazione, e sono obbligatorie:
un cartellino col solo nome del cliente non dice niente a chi pianifica, e in
giardino non si può più chiedere.

Il promemoria che compare aprendo una visita (`mostraPromemoria`) legge da lì: le
prenotazioni sono il posto dove sta scritto cosa si era detto di fare.

**La pagina Prossimi guarda in due direzioni.** In cima c'è l'agenda che arriva
dall'ufficio — dove si va, con le note di chi c'è stato prima — e sotto quello che
si è prenotato da qui — ma **solo quello ancora da consegnare**. Le prenotazioni
arrivate in ufficio non servivano qui: si guardano sulla lavagna e tornano con
l'agenda. Quelle ferme invece restano, col loro errore accanto, ed è il motivo per
cui la sezione non è sparita del tutto: una prenotazione che non parte deve dirlo
lì dove la si cerca. Vuota, la sezione non ha nemmeno il titolo. `DB.agenda` è una copia di quello che l'ufficio ha deciso,
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

**Visita e conto sono la stessa schermata.** Erano due schermate: per mostrare il
conto, il rapportino ti ripeteva ore e operazioni in sola lettura — le stesse
informazioni due volte, una da compilare e una da rileggere. Chi le separa di
nuovo reintroduce quella copia.

**E il conto non ripete quello che sta sopra.** In fondo alla visita c'è solo
**«Altro»**, una casella e basta — la spiegazione che c'era sotto la si leggeva
una volta e poi era solo da scavalcare: quello che non nasce da ore e operazioni — un noleggio,
uno smaltimento — e che sa solo chi è in giardino. Le righe automatiche
(manodopera, trasferimento, i materiali delle operazioni) non si mostrano più una
per una: erano ore e operazioni dette una seconda volta. Si calcolano lo stesso,
stanno in `contoCorrente` e partono col rapportino come prima; si leggono nel
riepilogo **«Cosa parte per il conto»**, aperto e separato da una riga — chiuso lo
si apriva a ogni visita, ed è l'ultima cosa che si guarda prima di mandare — e si
correggono in ufficio. Sotto, **«Salva e invia»** è il bottone scuro e viene per
primo: è quello di tutti i giorni; «Salva» da solo serve a fermarsi a metà.
Dal telefono non si toglie più il trasferimento né si ritocca la manodopera: le
ore si correggono sulla fascia, il resto lo decide chi fattura.

**L'altro si scrive in una casella sola.** Erano tre — «Altra operazione» fra le
operazioni, «Voce non in elenco» e un menù «Aggiungi una voce» nel conto — per dire
la stessa cosa: c'è stato anche questo. Ora c'è solo «+ Altro» (`aggiungiRigaLibera()`):
mentre si scrive suggerisce le voci che ci sono già, e se il testo è il nome di una
voce la riga è quella voce, con la sua unità e il suo prezzo in ufficio; se no è una
riga scritta a mano, che chiede quantità e unità. Le operazioni libere delle visite
di prima restano dove sono, e si possono togliere.

**Sul telefono non ci sono prezzi.** Il listino sta in ufficio, in un posto solo
invece che su due dispositivi che divergono. Il cantiere dice *cosa* è stato
fatto e *quanto* — la cosa che solo lui sa — e quanto vale lo decide chi
fattura. Chi rimette un campo prezzo qui rimette anche il problema di tenerli
allineati.

**L'unica eccezione sono le piante**, e è voluta: il prezzo sta sull'etichetta
del vaso, e in ufficio per saperlo bisognerebbe alzarsi e andare in vivaio. La
piantumazione chiede quindi pianta, numero e prezzo a pezzo, e ne accetta più
d'una (12 lauri, 3 aceri): ogni pianta è **un'operazione sua dello stesso tipo**,
con la sua riga nel conto, così lo schema delle operazioni resta quello di sempre.
Nello **storico delle visite**, invece, le piante sono un'etichetta sola —
«Piantumazione · 15 piante» — che toccata apre l'elenco (`etichetteOperazioni()`):
una siepe di dodici varietà erano dodici etichette, e coprivano il resto della
visita. Cambia solo come si guardano: le operazioni restano una per pianta.
Il tipo si riconosce dall'identificativo `piantumazione` (`ePiantumazione()`), non
da un campo nuovo sul tipo: i tipi stanno già nei DB di chi lavora. Il prezzo
viaggia nel rapportino preso **dall'operazione**, non dalla riga del conto, perché
i conti delle visite di prima portano ancora i loro prezzi storici e quelli non
devono partire come un listino. In ufficio conta come un prezzo scritto a mano: il
listino non lo tocca; se il cantiere lo corregge rimandando il rapportino, segue
il cantiere, finché l'ufficio non lo cambia a mano (`daCantiere`). Per la stessa ragione la
pagina Listino **non le propone** fra le voci viste e non in listino: chiederle lì
faceva credere che ognuna andasse messa in listino, e con «Aggiungi» la voce
prendeva il nome della prima pianta vista.

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

**Le piante invece escono col loro nome**, «Piante – Lauro»: il cliente vuole
sapere cosa ha in giardino, e non c'è un nome commerciale da tenere in casa. È una
differenza voluta fra piante e fitofarmaci, non una svista da uniformare.

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

I documenti sono quattro. Il **rapportino** racconta un lavoro finito;
l'**appuntamento** è una prenotazione fatta dal cantiere, col cliente davanti; il
**rilievo** è il taccuino di un preventivo, preso in giardino prima che il lavoro
esista. Sono cose diverse e in ufficio le guardano tre schermate diverse, quindi
viaggiano separate e finiscono in tre cartelle: `rapportini/`, `appuntamenti/` e
`rilievi/`. Il quarto è l'**agenda**, e va nell'altro verso: la scrive l'ufficio e
la legge il telefono.

**L'agenda porta cinque campi che dicono qualcosa e non uno di più**: giorno,
mezza giornata, ora, cliente, note. Più due che non dicono niente di nessuno — se è
un sopralluogo, e il suo codice — perché il telefono sappia elencarli anche senza
la chiave. Non è economia di formato, è la ragione per cui esiste così: è l'unico
documento che si *legge* dall'indirizzo dello script, che è pubblico per chi lo
conosce. Indirizzi, telefoni, stime ore, requisiti e prezzi restano in ufficio, e chi
aggiunge un campo a `costruisciAgenda()` lo pubblica là. L'ora è arrivata dopo,
senza alzare `VERSIONE_AGENDA`: è quella detta al cliente, non dice niente di
riservato, e in giardino è la cosa che serve di più. Un telefono non aggiornato la
ignora, un'agenda vecchia arriva senza — che vuol dire «ora non fissata».

Le note sì, e sono il motivo per cui l'agenda vale la pena: sono la cosa che fa il
giro completo. Il cantiere le scrive prenotando, l'ufficio se le tiene sul
cartellino, e tornano in giardino il giorno del lavoro.

Dieci appuntamenti, da oggi in avanti, e solo quelli già piazzati su una mezza
giornata: un lavoro ancora in colonna non ha un momento suo, e metterlo in agenda
vorrebbe dire prometterlo. Erano sei, e in giardino non bastavano; oltre i dieci la
pianificazione cambia ancora, e una lista lunga sarebbe una lista sbagliata.

**«Da oggi» vuol dire oggi, non il giorno in cui l'agenda è stata scritta.**
L'agenda si scrive salvando la lavagna, e se l'ultimo spostamento era di lunedì il
telefono mostrava giovedì ancora lunedì, con meno di dieci appuntamenti davanti.
Per questo **l'ufficio la rifà all'apertura** quando la sua data `da` non è quella
di oggi (`rinfrescaAgenda()`, una volta al giorno e non a ogni Ricontrolla), e **il
telefono scarta i giorni passati** mostrandola: un'agenda scaricata ieri, senza
campo, resta buona per quello che ha davanti.

Entrambi, in modalità costruzione, si leggono **solo alla loro versione corrente**:
o il documento è di questa versione, o si rifiuta dicendolo. Archiviare un
documento monco senza dirlo a nessuno è il guasto peggiore che possa capitare qui.

Il trasporto sta in `ufficio/`: uno script Apps Script riceve dal telefono e
deposita nella cartella Drive, che sul PC dell'ufficio è una cartella normale. Lo
script instrada per `tipo`: aggiungere un documento nuovo vuol dire aggiungere una
riga a `CARTELLE` **e rifare la distribuzione**, o continua a girare la versione di
prima. Un file, un solo autore — il telefono deposita, l'ufficio legge, e l'agenda
è l'unico file dove i ruoli si scambiano.

**In lettura lo script sa nominare pochi file.** `doGet` prende il nome da
`LEGGIBILI` e da `RISERVATI`, non dalla richiesta: un nome che arriva da chi chiama
farebbe di quel `?documento=` un modo per leggersi il listino o l'anagrafica. Le
liste sono corte e vanno tenute così.

## I sopralluoghi: i contatti solo con la chiave

Il giro è questo: l'ufficio mette un sopralluogo sulla lavagna — spuntando «È un
sopralluogo» compaiono **via, telefono e mail** — lo piazza su un giorno, e il
telefono lo trova nella pagina Rilievi; al tocco il rilievo si apre con
l'anagrafica già scritta e il filo col sopralluogo (`SopralluogoID` →
`sopralluogo` nel documento), e torna in ufficio fra i preventivi aperti.

**Via e telefono non viaggiano nell'agenda**, perché l'agenda si legge con
l'indirizzo dello script e basta: era la regola chiesta fin dall'inizio, e un
numero di telefono di un privato è esattamente quello che non deve stare lì.
Viaggiano in `sopralluoghi.json`, che l'ufficio scrive insieme all'agenda dentro
`salvaLavagna()` e che lo script consegna **solo con la chiave**: la proprietà
`CHIAVE_LETTURA` dello script (Impostazioni progetto → Proprietà script), uguale a
quella scritta sul telefono in Impostazioni.

**Se la chiave sullo script non c'è, quel file non esce a nessuno.** Non è un
dettaglio: senza quel controllo uno script senza chiave e un telefono senza chiave
sarebbero «uguali», e il file uscirebbe a chiunque abbia l'indirizzo. L'ufficio non
sa se la chiave è impostata, quindi il file lo scrive sempre — è lo script che
decide, chiuso finché qualcuno non lo apre apposta. La prova del giro carica lo
script con dei servizi Google finti e controlla proprio questo, rompendolo apposta.

La chiave non sta nel codice: il repository è pubblico. La risposta di controllo
dello script dice se c'è («impostata»/«manca»), mai quale sia.

**Senza chiave i sopralluoghi si vedono lo stesso**, dall'agenda, col solo nome, e
la pagina dice che via e telefono arrivano con la chiave: mostrare meno senza
dirlo farebbe credere che l'ufficio non li sappia. **Con la chiave sbagliata**
l'errore si legge sulla pagina, accanto agli ultimi scaricati — non sembra un
elenco vuoto. Come l'agenda, quelli scaricati restano per quando il campo manca
(`DB.sopralluoghi`, assente = non ancora scaricati, nessuna versione alzata).

Solo quelli **piazzati su una mezza giornata**, da oggi in avanti: la regola
dell'agenda, e per la stessa ragione.

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
una prenotazione o un rilievo fermi manda a cercare nel posto sbagliato. I nomi
stanno in `NOMI_DOCUMENTO`, in un posto solo, e un tipo che non c'è dentro si
chiama «rapportino» — quindi chi aggiunge un documento aggiunge anche la sua riga
lì.

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

## Il rilievo: un preventivo è un conto che si fa prima

**Il rapportino racconta un lavoro finito, il rilievo un lavoro da fare.** Tutti e
due dicono *cosa* e *quanto* e lasciano all'ufficio *quanto vale*: è la stessa
divisione, ed è il motivo per cui su un rilievo **non c'è un prezzo**. Chi ne
rimette uno qui rimette anche il problema di tenere allineati due listini.

**Il rilievo ha un'anagrafica sua**: nome, via, paese, telefono, mail, sempre
modificabili. Un preventivo si fa spesso per chi non è ancora cliente, e farlo
prima aggiungere all'anagrafica del telefono era una schermata in più col cliente
davanti: basta il nome. La ricerca fra i clienti del telefono resta, ma solo per
riempire i campi; quello scritto sul rilievo vince, perché è quello visto stando
lì. Telefono e mail **il telefono non li tiene**: viaggiano col rilievo verso
l'ufficio, che è dove servono. Sono arrivati senza alzare `VERSIONE_RILIEVO`.

**Dal giardino partono lavorazioni, non righe di preventivo.** Una lavorazione è
un fatto misurato: «Siepe nuova · 24 m · lauro, fitta, alta 1,8 m · 10 h». Le
righe erano quelle del conto — voce, descrizione, quantità, unità — e sul telefono
si vedeva «Piante» e sotto una casella con scritto di nuovo «Piante»: la
descrizione per il cliente, da scrivere in giardino. Era il posto sbagliato. **Dal
campo partono meno cose ma chiare**; il testo per il cliente, le quantità dei
materiali e i prezzi li fa l'ufficio.

I generi sono quattro (`GENERI_LAVORAZIONE`): un **insieme** (siepe, aiuola: si
misura una volta e i materiali li conta l'ufficio), una **voce** a misura (il verde
da smaltire), la **manodopera** (solo ore, con un nome: una potatura), e una
**libera** scritta a mano. Ogni insieme sa come si misura dal suo campo Unità in
Archivi — la siepe a metri, l'aiuola a m² — e se dentro ha la piantumazione chiede
**piante e stile** (`stile`): «perenni da sole, stile naturale, toni bianchi», «lauro,
fitta, alta 1,8 m». **Quali piante e quante le decide l'ufficio**, anche per la siepe:
in giardino si vede il posto e si capisce cosa vuole il cliente, alla scrivania si
sceglie la specie, il sesto e il numero. Si contavano in giardino — sesto per la siepe,
numero per l'aiuola — ed era il posto sbagliato: un'aiuola si progetta, non si conta
col cliente davanti. Il campo è arrivato senza alzare `VERSIONE_RILIEVO`; i rilievi
di prima portano pianta e sesto o il numero, e valgono ancora. «Siepe nuova» è fra
gli insiemi di partenza, arrivata con `DEFAULT_ARRIVATI_DOPO`.

**Le lavorazioni complesse si definiscono sul telefono** (Archivi › Tipi di
operazione, «Un insieme»): le decide chi lavora. L'ufficio non ne ha un elenco suo:
il telefono le esporta da ⚙️ Dati in `lavorazioni-dal-telefono.json`, nella cartella,
e l'ufficio **lo legge a ogni rilettura** (`insiemiConosciuti()`) invece di
importarlo — lì non si modificano, e una copia invecchierebbe senza dirlo. Valgono
nel «Nuovo rilievo» e fra le ricette del listino; dopo vengono quelle viste nei
rilievi e non più nel file, poi siepe e aiuola di partenza. Le pagine dicono da dove
vengono e quando sono state esportate: una lavorazione creata ieri sul telefono che
in ufficio non compare deve far pensare al file, non a un guasto.

La composizione dell'insieme **viaggia con la lavorazione**: in ufficio gli insiemi
non si definiscono, e un rilievo si deve leggere anche se l'insieme poi cambia.
I rilievi di prima portano `righe`, e `leggiRilievo()` li legge come lavorazioni —
la manodopera come ore, il resto come voci a misura, e la descrizione scritta allora
resta. Nessuna versione alzata.

**Le mezze giornate escono dalle ore.** C'era un −/+ per contarle a mano, e il
lavoro non diceva quanto costava. Adesso le **ore stanno sulla lavorazione**, e le
mezze giornate sono **la loro somma**, `ORE_MEZZA` per mezza, arrotondata **per
eccesso** (`mezzeDaOre()`): una mezza giornata cominciata è occupata. Il conto sta
in `rapportino.js` e lo fanno tutte e due le app: due idee diverse di quanto dura
una mezza giornata sarebbero peggio di nessuna. In ufficio le ore diventano il
componente manodopera della riga a corpo, e `oreManodopera()` le conta anche lì
dentro; conta la voce `manodopera`, non l'unità: un noleggio a ore non occupa la
lavagna.

Una lavorazione **incompleta ferma il rilievo** e dice cosa manca
(`cosaMancaLavorazione()`): un insieme senza misura, senza piante e stile o senza ore, una
manodopera senza nome. In ufficio non si può più chiedere, e in lavagna il
pomeriggio sembrerebbe libero. Un rilievo senza ore (sola fornitura) parte, lo
dice, e in lavagna va largo il minimo. Il documento porta `ore` e `mezze` già
calcolate; un rilievo di prima ha solo `mezze`, contate a mano, e valgono ancora.

**Non c'è un «tipo di lavoro».** C'era: quattro tipi da scegliere (manutenzione,
siepi e aiuole, prato in rotoli, irrigazione), presi dai quattro *modi di arrivare
al prezzo* raccontati in `ufficio/PREVENTIVI.md`. Come ragionamento servivano, come
campo no: non cambiavano righe, foglio, mail né accettazione — un'etichetta e un
avviso — ed erano **una scelta sola per lavori che stanno insieme**: un giardino
nuovo è siepe, prato e irrigazione. Neanche la dicitura giustificava il campo: nei
preventivi veri la frase d'apertura è la stessa per tutti.

È rimasto l'unico fatto che contava, in una casella: **«Aspetta il disegno dal
CAD»** (`disegno`), per il rilievo incompleto finché non arriva l'area o lo schema
degli irrigatori. I rilievi mandati prima portano ancora `lavoro`, e
`leggiRilievo()` li legge così: prato in rotoli e irrigazione aspettavano il
disegno. Nessuna versione alzata.

**Le lavorazioni collegate sono gli insiemi**, gli stessi della visita. Li crea chi
usa l'app da Archivi: le lavorazioni che vanno insieme le decide chi lavora, non una
lista scritta da chi programma. Un tipo senza voce è manodopera, ed è già nelle ore
della lavorazione.

Le note sono quello che si vede **solo stando lì** — accesso, dove resta il
camion, il rubinetto, la pendenza. Sono anche la cosa che non si può più chiedere
dopo, e quella che l'anagrafica non sa.

In ufficio un rilievo arrivato dal telefono **si legge e non si tocca**: un file, un
solo autore, come `rapportini/`. Dice anche chi non è in anagrafica, perché telefono e mail — quello
che serve per richiamare e mandare il preventivo — stanno solo lì.

**Un rilievo si scrive anche in ufficio** («＋ Nuovo rilievo» in Preventivi,
`salvaRilievoUfficio()`): per chi telefona o passa con le misure su un foglio, e per
provare i preventivi da un PC con una cartella vuota. Le lavorazioni sono quelle del
telefono, e il preventivo ne esce uguale; le regole di cosa manca stanno in
`rapportino.js` (`lavorazioneIncompleta()`) e il telefono le prende da lì, perché
due idee di «completo» farebbero partire dalla scrivania quello che il giardino
avrebbe fermato. Gli insiemi sono quelli esportati dal telefono e quelli che il
campo ha usato, più siepe nuova e aiuola con la composizione di partenza del
telefono (`INSIEMI_DI_PARTENZA`): un ufficio appena collegato non deve aspettare il
primo rilievo per scriverne uno.

Finisce in `rilievi/` accanto a quelli del telefono, con `origine: 'ufficio'`, e
**un file resta di un solo autore**: quello scritto qui l'ufficio lo corregge
(«Modifica il rilievo» dal preventivo) alzando la revisione come fa il telefono,
nello stesso file, così il preventivo si rifà tenendo i prezzi decisi; quello
arrivato dal telefono resta com'è arrivato. Nessuna versione alzata: `origine`
assente vuol dire «dal telefono», che è quello che erano tutti prima.

## Il prezzo che aspetta di essere guardato

**Il margine fra costo e prezzo non è una regola.** Dipende dal lavoro, dal
cliente, dalla stagione, da quanto rischio c'è. Quindi l'app non lo calcola:
propone il **prezzo di listino** e chi firma lo corregge.

Un prezzo proposto resta **segnato** — casella ocra, bordo tratteggiato — finché
non viene toccato o confermato. È la stessa regola della fascia oraria proposta
sul telefono, e per la stessa ragione: un numero precompilato che nessuno ha
guardato è un errore che paga il cliente. Lì blocca il salvataggio della visita,
qui **blocca la stampa**, perché è la stampa che esce di qui.

Il tratteggio non è decorazione: dice la stessa cosa del colore a chi il colore
non lo distingue, come la parola accanto ai cartellini della lavagna. E l'ocra è
l'accento della palette apposta — non verde, non rosso: non è un'approvazione e
non è un errore.

**Un prezzo che il listino non ha non è una proposta: è un buco**, e resta bianco.
Segnarlo direbbe che c'è qualcosa da confermare dove invece non c'è ancora niente.

**Toccare è confermare**, e non si ridisegna la tabella mentre si scrive: la
classe si toglie a mano dall'elemento, come fa il telefono con le fasce. Totale e
avviso si aggiornano da soli — sono le due cose che devono seguire il numero
sotto le dita.

**Una riga può essere a tariffa**: un prezzo per una cosa che forse servirà — il
conferimento a discarica, il costo orario — senza quantità e **fuori dal totale**.
Sui preventivi veri c'è sempre, e sommarla direbbe una cifra che non esiste. Sul
foglio sta sotto il totale, in una tabella sua.

**Sul foglio va la descrizione, non la voce di listino.** «Piante» non dice al
cliente cosa ha comprato; «Fornitura e messa a dimora di lauro 80-100» sì. La
descrizione **la scrive l'ufficio**: nasce dal nome della lavorazione, con la
pianta e la misura, e accanto c'è «dal campo: …» con quello che il giardino ha
misurato.

**Una lavorazione è una riga a corpo.** Al cliente arriva un prezzo solo per la
siepe, come sui preventivi veri; dentro la riga stanno i **componenti**
(`componentiLavorazione()`): le piante scelte in ufficio, i materiali dalla
**ricetta** del listino, le ore. Sono il conto dietro il prezzo, si vedono sotto la
riga in piccolo, si correggono lì, e al cliente non arrivano — come le fasce di un
rapportino. Il prezzo a corpo **proposto è la somma dei componenti** a listino e la
segue finché nessuno l'ha guardato; deciso, resta, e la somma gli sta accanto con
«Usa la somma». Una voce a misura senza ore — il verde da smaltire — resta una riga
a misura col suo prezzo unitario: spesso diventa una tariffa.

Ogni componente dice **da dove esce la sua quantità** («24 m a sesto 0,4», «1,2 m²
per m», «ore stimate in giardino»): fra sei mesi «61» da solo non dice niente. Una
quantità ritoccata o un prezzo deciso in ufficio (`quantitaMano`, `prezzoMano`)
restano quando il campo rimanda il rilievo, come i prezzi delle righe.

**Le piante si scelgono nella riga.** Il componente «Piante» arriva vuoto, con
accanto «da scegliere in ufficio» e sopra, in «dal campo», piante e stile: qui si
scrive quale pianta e quante, e per una siepe il **sesto**, da cui il numero esce da
sé (metri / sesto + 1). **«+ Un'altra pianta»** ne aggiunge altre — un'aiuola è
lavanda, graminacee e un acero, ognuna col suo prezzo — e la somma fa il prezzo a
corpo. Pianta, sesto e piante aggiunte (`piantaMano`, `sestoMano`, `aggiunta`)
restano quando il campo rimanda il rilievo corretto: se la siepe si allunga, il
numero segue il sesto scelto qui.

**Le ricette stanno nel listino** (`LISTINO.ricette`, Listino › Lavorazioni): quanto
telo, ala, pacciamatura per ogni metro o m² di un insieme. Sono un dato dell'azienda
come i prezzi, e si decidono in un posto solo invece che a ogni preventivo. Gli
insiemi elencati sono quelli del telefono e quelli che il campo ha usato. Senza
ricetta il componente resta senza quantità e lo dice: un buco, non una proposta. Le
piante non hanno ricetta — si scelgono nel preventivo — e le ore nemmeno.

**La scheda di cantiere** (`costruisciSchedaCantiere()`) è l'altro foglio che esce
dal preventivo, e va a chi lavora: per ogni lavorazione misura, piante e stile, le piante scelte,
materiali, ore, le note del campo; in fondo i **materiali da ordinare**, sommati fra
le lavorazioni (due aiuole col telo sono un ordine solo), e le note del sopralluogo.
**Niente prezzi**: gira in cantiere, e un prezzo lì sopra finisce dove non deve. Per
la stessa ragione non aspetta i prezzi confermati — si stampa anche da un preventivo
aperto, per ordinare. Con le alternative vale la soluzione scelta, se c'è. Per ora
si stampa o si salva in PDF; portarla dentro l'app del telefono vorrebbe un file
riservato come `sopralluoghi.json`.

**Il sì del cliente costa un clic** e porta il lavoro in «Da pianificare» sulla
lavagna, largo le mezze giornate che escono dalle ore del preventivo: lo stesso
numero, misurato una volta sola. Le mezze si rifanno dalle righe e non si leggono
dal rilievo (`mezzePreventivo()`), così le ore corrette in ufficio spostano la
larghezza — e si aggiornano mentre si scrive, come il totale. Contano le righe nel
totale (una tariffa a ore è un «se servirà») e, con le alternative, quelle della
soluzione scelta più le comuni: siepe nuda e siepe con telo non durano uguale.
In colonna e **senza un giorno** — quello lo decide chi
pianifica, e su quella lavagna niente si muove da solo. `visti` vale anche qui:
riaccettarlo non lo mette in lavagna due volte.

**Un rilievo è «da preventivare» finché non esiste un preventivo per quella
revisione**, non perché qualcuno l'abbia spostato: è la stessa regola dei
rapportini in arrivo, e il pallino conta quello. Se dal campo arriva il rilievo
corretto, il preventivo si rifà su quello **tenendo i prezzi già decisi**: le
quantità cambiano, il giudizio no.

I preventivi stanno in `preventivi/<anno>/`, scritti dall'ufficio come l'archivio.
Le **condizioni** in fondo al foglio — validità, caparra, esclusioni — vivono in
`impostazioni.json` accanto all'intestazione: sono di un'azienda vera.

**Un preventivo non è sempre un elenco che si somma.** Tre cose lo dicono, e sono
quelle che i preventivi veri hanno e una lista di righe non sa rappresentare:

- **Le soluzioni alternative.** «Siepe nuda o con telo e porfido»: due varianti
  con due totali, che **si escludono**. Una riga **senza soluzione è comune** ed
  entra nel totale di tutte — così la parte uguale si scrive una volta sola
  invece di ribatterla in ogni variante e sbagliarne una. Sul foglio ogni
  soluzione ha il suo totale col suo nome, e sopra c'è scritto a parole che sono
  alternative: due totali uno sotto l'altro, senza quella riga, si leggono come
  una somma da fare. Una soluzione **senza righe sue** è il lavoro comune e basta,
  e lo dice invece di stampare l'intestazione di una tabella sopra il vuoto.
  Togliendone una le sue righe **tornano comuni**, non spariscono: perdere lavoro
  per un clic è il modo peggiore di aiutare.
- **Le righe a tariffa**, fuori dal totale (sopra).
- **Le sezioni**: una riga che è solo un titolo, per i preventivi divisi per zona
  del giardino. Non ha niente da sommare, e **non conta come riga senza prezzo**.

**Con due alternative «ha accettato» non basta**: il sì si dà sulla riga della
soluzione, e il preventivo ricorda quale. Senza, il lavoro entrerebbe in lavagna
senza che si sappia cosa si è venduto.

**«Mandato» porta la sua data**, e l'elenco dice **da quanto aspetta** una
risposta: «15/09» da solo obbliga a farsi il conto. Mandato non vuol dire
accettato e nemmeno partito — l'app sa di averlo messo in posta, come il conto in
archivio.

**Dai metri al numero di piante** è la formula del foglio della segretaria:
metri / sesto + 1, arrotondato per difetto. Il **più uno** è la pianta di testa —
24 m a sesto 0,40 ne vogliono 61, non 60, perché ce n'è una a ogni estremo. La
riga che ne esce si porta dietro i metri e il sesto: fra sei mesi «91 piante» da
solo non dice da dove viene.

**Quattro mucchi: aperti, inviati, confermati, rifiutati.** Il mucchio è lo stato
scritto nel file (`gruppoPreventivo()`), non una cartella: spostare file su Drive
che sincronizza è il modo migliore per ritrovarsene due copie. Fra gli **aperti**
ci sono anche i rilievi appena arrivati — il rilievo compilato «torna in aperti»,
come si era detto — e il pallino conta quelli.

**Scaduto non è rifiutato.** Un preventivo mandato e senza risposta dopo i giorni
di validità (Impostazioni, da tenere uguali a quelli scritti nelle condizioni) sta
fra i rifiutati come «scaduto senza risposta», e si accetta ancora se il cliente
richiama. È **calcolato**, non scritto: cambiare i giorni vale anche per quelli già
mandati. Il «no» del cliente invece si scrive, con la sua data.

**«Manda per mail» come il conto**: apre la posta col preventivo scritto, una voce
per riga e le alternative dette a parole; si segna mandato **prima** di aprirla, e
se il segno non riesce la posta non si apre. Stampare non lo segna — l'app non sa
se quel foglio è andato al cliente — e c'è «Consegnato a mano».

**Dal preventivo all'anagrafica**: chi non c'è si aggiunge con un clic, a chi c'è
si riempie **solo quello che manca**. Il numero corretto in ufficio non lo riscrive
un rilievo, come non lo riscrive un'importazione. Il riquadro sta in cima, coi
contatti: con un preventivo in mano, la prima cosa che si fa è richiamare.

Quello che manca è in `ufficio/PREVENTIVI.md`.

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

**Il conto si salva da solo.** Ogni modifica nella schermata del lavoro si scrive
in archivio un momento dopo (`pianificaSalvataggio()`), e uscendo dalla schermata
quello che resta si salva subito. Col solo bottone capitava di correggere i prezzi,
passare ad altro e lasciare gli importi di prima, mentre in ufficio si credeva il
conto giusto. Salvare vuol dire archiviare: il lavoro lascia «in arrivo» appena ci
si mette mano, e da lì si ritrova in archivio fra i da pagare. Un salvataggio
fallito si legge accanto ai bottoni, in rosso, oltre che nell'avviso.

**Il listino dell'ufficio è l'unico che c'è.** Dal cantiere arrivano quantità e
niente prezzi. Un prezzo scritto a mano non viene mai risovrascritto dal listino:
sopravvive anche a una correzione rimandata dal cantiere.

**Più voci si possono unire in una, a corpo.** Una siepe nuova porta ore, piante,
pali, telo e pacciamatura, ognuno con la sua riga; a volte al cliente deve arrivare
una voce sola. Nella schermata del lavoro si spuntano le righe e «Unisci» fa un
**gruppo**: un nome da dare, quantità 1, e come prezzo proposto la somma delle
righe, che resta modificabile. Le righe non si buttano: stanno in `componenti`,
così in ufficio si vede di cosa è fatto il gruppo e si può **sciogliere**. Al
cliente, foglio e mail, arriva solo il gruppo.

**Il prezzo del gruppo non si sovrascrive**, come ogni prezzo deciso in ufficio. Se
il cantiere rimanda il rapportino corretto, le righe dentro seguono il rapportino
come tutte le altre (`costruisciConteggio()` le cerca anche lì) ma restano nel
gruppo, e il gruppo tiene nome e prezzo. Se la somma sotto è cambiata rispetto a
quella accettata (`sommaVista`) la schermata lo dice, con la somma nuova e un
bottone per prenderla: la si accetta con un tocco, mai da sola.

**Il listino si modifica a video e si scrive su file col bottone.** Finché resta da
salvare, `LISTINO_DA_SALVARE` impedisce a una rilettura della cartella di
sovrascriverlo: un prezzo appena battuto che sparisce a un Ricontrolla è lavoro
perso in silenzio. Vale la stessa regola del telefono — un salvataggio fallito si
dice a chiaro schermo, non in console.

**Un file illeggibile si vede.** Drive a metà sincronizzazione lascia file
troncati, e nella cartella può finirci dentro qualcosa che non è un rapportino:
`leggiRapportino()`, `leggiLavoro()` e `leggiRilievo()` si fermano, e l'avviso lo
scrive `bloccoIlleggibili()` — in un posto solo, e **su tutte le pagine che leggono
dalla cartella**, non solo su quella da cui si entra: un rilievo troncato lo cerca
chi sta sulla pagina Rilievi. Un rapportino che non si riesce a leggere è lavoro fatto che rischia di non
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

**I sopralluoghi e i bloccati hanno una colonna ciascuno**, a destra. Un
sopralluogo (`sopralluogo`, una casella sul lavoro e sulla prenotazione del
telefono) è un'andata a guardare, non un lavoro, e in mezzo agli altri non si
distingueva; un bloccato ha un requisito aperto e non si può ancora fare. Un
sopralluogo bloccato sta **coi bloccati**: anche lui non si può fare, ed è la cosa
da sapere. Un lavoro si rimette in coda lasciandolo su una qualsiasi delle colonne:
dove finisce lo decide il lavoro, non il punto dove lo lasci. Sulla settimana il
sopralluogo si riconosce dalla parola, non dal colore: grigio, verde e blu sono
già degli stati. Il campo è arrivato dopo, senza alzare versioni: chi non ce l'ha
non è un sopralluogo, ed è quello che erano tutti prima.

**In coda i cartellini stanno chiusi**, sempre, e si aprono con un clic: con la coda
piena erano un muro. Chiusi portano però quello che serve a scegliere — nome, la
prima riga delle note, settimana, da quando aspetta, e per un bloccato cosa manca
— perché si era chiesto apposta che dalla coda si vedesse cosa c'è da fare e
quando è entrato. Sui giorni restano aperti: lì sono pochi, e si guardano interi.

**L'ora è quella detta al cliente**, e si scrive col 🕘 sul cartellino già piazzato:
in coda un lavoro non ha un giorno, quindi non ha un'ora. Ora e mezza giornata non
possono dire due cose diverse: scrivendo le 14:30 il cartellino passa al
pomeriggio, perché è l'ora che si è promessa; trascinandolo all'altra mezza
giornata l'ora si toglie, e si riscrive quando la si sa. Cambiare l'ora di un
confermato chiede conferma, come spostarlo. Dentro la mezza giornata l'ora **non
riordina** i cartellini: l'ordine lì resta di chi pianifica.

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

**Un conto da pagare si corregge dall'archivio**, con «Modifica»: si riapre nella
stessa schermata del lavoro in arrivo, e si riscrive lo stesso file. Quello che
l'ufficio decide lì — prezzi, righe aggiunte, gruppi — sopravvive a un rapportino
corretto rimandato dal cantiere, come prima di archiviare; le quantità nate da ore
e operazioni invece seguono il rapportino, e per cambiarle si corregge la visita
sul telefono. Un conto **già pagato non si riapre**: è chiuso davvero. Se il conto
era già passato alla posta, riaprirlo chiede conferma e ricorda di rimandarlo.

**Si può togliere, però.** Non per correggere — per il lavoro che non ci doveva
stare: una prova, un doppione. `eliminaArchiviato()` cancella il file dalla
cartella, e la conferma dice **quale delle due cose succede dopo**, perché sono
diverse: se il rapportino è ancora in `rapportini/` il lavoro torna fra quelli in
arrivo e si riarchivia — è la solita regola, in arrivo perché l'archivio non ne ha
copia — mentre se non c'è più, quel file era l'unica copia rimasta di lavoro fatto
e non torna. Una conferma che dicesse sempre la stessa frase servirebbe a niente.

**L'archivio è due voci della barra: «Da pagare» e «Lavori chiusi».** Si chiamava
«Pagati», ed è stato rinominato: in ufficio quella è la cartella dei lavori finiti,
e «chiusi» è la parola che si usa. Dentro il gestionale è «Chiusi», e il cartellino
del singolo conto continua a dire «pagato», perché è il suo stato. Era una pagina sola
col filtro e, guardando «Tutto», divisa in due parti; il capo l'ha voluto separato
davvero, perché sono due domande diverse — cosa devo ancora incassare, cosa è chiuso
— e due voci dicono subito dove si è. Non c'è più un «Tutto». La pagina resta una
(`STATO_ARCHIVIO` dice quale parte si guarda, `apriArchivio()` ci porta), e la voce
accesa nella barra segue quella parte, anche dentro un lavoro aperto da lì. Il
pallino su «Da pagare» conta i conti aperti. «Vedi conti» porta fra i da pagare di
quel cliente, o fra i suoi pagati se ha pagato tutto: una pagina vuota direbbe che
non c'è niente.

**Fra i da pagare, due colonne: «Da mandare» e «Mandati».** Il capo voleva vedere
quali conti erano già partiti: sono due lavori diversi per l'ufficio — scrivere il
conto, o sollecitarlo — e mescolati non si capiva quale toccasse. La colonna la
decide `inPosta`, che «Invia al cliente» segna da sé; per un conto stampato e
consegnato a mano c'è **«Segna mandato»** (`segnaMandato()`), che si toglie con lo
stesso bottone sul lavoro aperto. Un mandato dice **da quanti giorni aspetta**: chi
guarda quella colonna sta per alzare il telefono. Raccogliendo per cliente le
colonne non ci sono — lì la domanda è quanto deve quel cliente — e la scheda dice
lo stesso se è stato mandato.

**A sinistra sta il gestionale**: quanti lavori sono **da pagare** e quanti
**chiusi**, e i due numeri portano all'una o all'altra parte. **Solo quanti, non
quanto**: le somme c'erano — nel gestionale, in testa alle colonne, sui gruppi per
cliente — e il capo le ha volute togliere, perché quella schermata si guarda anche
con qualcuno accanto. L'importo resta su ogni conto, dove serve. Nei file
lo stato resta `da-fatturare` / `fatturato`: sono cambiate le parole a schermo, non
i dati. Resta lì mentre si scorre l'elenco, perché è
la domanda che in ufficio ci si fa per prima e un numero in fondo alla pagina non
risponde a nessuno. Raccogliendo **per cliente**, ogni gruppo dice quanti lavori ha.

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
decisione resta di chi stampa. **Il logo** sta lì con lei (`IMPOSTAZIONI.logo`, un
PNG rimpicciolito a 600 px al caricamento, `caricaLogo()`): il repository è pubblico,
e un file da tipografia gonfierebbe impostazioni.json per niente.

**Il preventivo stampato ricalca quelli veri**, che il cliente ha sempre visto
così: **logo in alto a sinistra, intestazione a destra**, «Spett.le» a destra come
in una lettera, «Lavis, 5 ottobre 2026» (`localitaAzienda()`, il paese senza CAP né
provincia), la frase d'apertura, e le righe in una **tabella a griglia** con le
colonne nell'ordine dei fogli veri — Descrizione, UM, Q.tà, Costo un., Totale — e la
firma in fondo a destra. Un titolo «Preventivo» in grande non c'era, e non c'è.

**Accanto a ogni «Stampa» c'è «Stampa senza intestazione»**, per la carta
intestata: i dati dell'azienda ci sono già stampati, e ripeterli sopra li
sovrapporrebbe al logo. È un bottone e non una domanda a ogni stampa: si sceglie
guardando il foglio che si ha in mano, e un dialogo in più a ogni conto è un clic
in più per tutti. Senza intestazione l'avviso sull'intestazione mancante non
compare: non serve.

**Chrome non stampa data, titolo e indirizzo dell'app**: li scriveva nel margine
della pagina, in testa e in fondo, e su un conto per un cliente non c'entrano. Per
toglierli `@page` ha margine zero, e il bianco attorno lo rimettono due fasce vuote,
testa e piede di una tabella attorno a tutto il foglio (`mettiNelFoglio()`): in
stampa teste e piedi di tabella si ripetono a ogni pagina, un padding no. Tutto
quello che si stampa passa da lì. La classe è `foglio-pagina` e non `pagina`: quella
è delle schermate dell'app, che stanno nascoste — con quel nome il foglio usciva
bianco.

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
cliente — il gestionale a sinistra compreso, perché quali conti ha aperti è la
domanda per cui lo si apre. Il filtro resta scritto in cima con una ✕: un archivio che
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

Sono costruiti, e come funzionano sta qui sopra — *Il rilievo* e *Il prezzo che
aspetta di essere guardato*. Il **ragionamento** che c'è dietro sta in
`ufficio/PREVENTIVI.md`: i quattro tipi e quale ha davvero bisogno di un disegno,
perché il CAD non si rifà, dove sta il lavoro vero (il passaggio dai numeri al
preventivo, non la misurazione), cosa dicono i cinque preventivi veri che sono
stati letti, e cosa manca ancora.

Chi ci mette mano legga prima quello, o rifarà un ragionamento già fatto.

## Cosa c'è di nuovo

Le modifiche arrivano senza che nessuno le annunci: il service worker aggiorna
l'app in sottofondo e al secondo avvio la schermata è diversa. Chi ci lavora se ne
accorge inciampandoci, o non se ne accorge affatto — **e una cosa che non si sa
che c'è è una cosa che non si usa.**

In ufficio, all'avvio, un pannello dice cosa è cambiato. Si vede **una volta sola
per versione**, e si riapre dalla versione in fondo alla barra: chiuso e basta,
quello che c'era scritto sparirebbe per sempre.

**Sul telefono non c'è, ed è una decisione, non una dimenticanza.** Il telefono lo
usa la stessa persona che decide le modifiche: annunciargliele vorrebbe dire
raccontargli quello che ha appena chiesto. In ufficio invece ci lavora anche chi le
modifiche non le ha chieste, ed è lì che non saperle costa. Se un giorno il
telefono passasse a qualcun altro, questa ragione cade e il pannello va aggiunto —
la barra dell'aggiornamento che c'è già dice *che* è cambiato qualcosa, mai *cosa*.

**Scrivere una riga in `NOVITA` è parte della modifica**, come alzare il numero di
`CACHE` in `sw.js`. Una voce in cima, la data di oggi, e **cosa si vede di
diverso** — non cosa è cambiato nel codice: chi legge sta per cominciare a
lavorare, non a programmare. Le righe sono poche e corte apposta, e il `**grassetto**`
serve a far trovare quella che interessa senza rileggerle tutte.

`VERSIONE_APP` **è** la novità più recente, non un numero a parte: due numeri da
tenere allineati a mano divergono al primo che si dimentica.

**La prima volta in assoluto se ne mostra una sola**, e lo stesso vale per una
versione che non si riconosce — un salto indietro, una voce tolta. Scaricare
addosso tutta la storia a chi apre l'app non è un annuncio, è un muro. Saltandone
una, al prossimo avvio se ne vedono due: è il caso di chi apre l'app ogni tanto,
ed è il motivo per cui si tiene un elenco invece di un solo testo.

Quali novità sono già state lette sta in `localStorage`, non nella cartella: è una
cosa di **questo PC e di questo browser**, e perderla vuol dire rivedere un
pannello, non perdere lavoro. In navigazione privata semplicemente si rivede.

Il pannello **non si chiude cliccando fuori**: uno che sparisce per un clic
distratto non l'ha letto nessuno. Il bottone è uno solo e sta sotto il testo.

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
- Tipi e voci nuovi arrivano anche su un telefono che ha già il suo archivio, ma
  **una volta sola**: si aggiungono a `DEFAULT_ARRIVATI_DOPO`, e
  `aggiungiDefaultArrivatiDopo()` li mette dove mancano e se lo segna in
  `defaultAggiunti`. Chi ne cancella uno apposta non se lo ritrova. È
  un'aggiunta, non una conversione: non alza `VERSIONE_DATI`.
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
- Il pacchetto è dichiarato `"type": "module"`: da riga di comando un
  `require('./rapportino.js')` non esporta niente, senza errori. Per provarlo fuori
  dal browser lo si carica con `vm`, come fa il giro di prova con lo script `.gs`.
- `<input type="number">` **rifiuta la virgola**, e la virgola è come si scrivono
  i decimali qui: «0,4» diventa una casella vuota e il conto non si fa. I campi
  dei numeri sono `type="text" inputmode="decimal"`, e il valore passa da
  `numeroScritto()`. Il listino era già così; il preventivo no, finché un test non
  ha provato a scriverci dentro per davvero.
- Due colonne attaccate di una tabella si leggono come una parola sola: «Q.tàUM»
  in testa e «90n» sotto, perché le celle numeriche non hanno margine a destra.
  Le celle di una tabella **si toccano sempre** — il margine sta dentro — quindi
  una prova che misura i riquadri non vede niente: va misurato il **testo**.
- La regola generale dei campi (`input[type=text]`, a tutta larghezza) sta **sotto**
  quelle che li stringono: a parità di peso vince lei. `input.stretto` era scritta
  così e non valeva da nessuna parte — nel preventivo un «1» stava in una casella
  larga mezzo schermo. Una regola che stringe un campo di testo dice anche il tipo
  (`input[type=text].stretto`).
- Nel preventivo i **componenti** di una riga a corpo sono righe della stessa
  tabella (`tr.componenti`), non una tabella dentro una cella: con una tabella loro
  le colonne non cadevano sotto quelle della riga, e l'occhio non scendeva dritto.
- Una colonna della lavagna cresce fino al suo contenuto più largo e sborda su
  quella accanto: è già successo con la fila `−/1 mezza/+`, che non andava a capo
  e spingeva le ore sopra il «MATTINA» del giorno dopo. Si vede solo a occhio, per
  questo il giro di prova **misura** lo sbordo su una finestra stretta.
- Lo stesso vale nei pannelli: il margine lo dà `.drawer-body`, non `.drawer`.
  Quello che si vede va lì dentro, o campi e bottoni arrivano a filo dello
  schermo. È già successo al pannello della prenotazione.
