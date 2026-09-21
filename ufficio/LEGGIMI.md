# La parte su Drive

L'app del cantiere deposita i rapportini in una cartella di Drive dell'account
giardini; l'app dell'ufficio, sul PC, legge quella stessa cartella come una
cartella normale del disco.

```
  TELEFONO ──POST──→ Apps Script ──→ Drive: GiardinoApp/rapportini/
      ↑                                 │
      │                            Drive per desktop
      │                                 ↓
      └──GET agenda──← Apps Script ← PC UFFICIO ──→ prezzi, archivio
```

Nell'altro verso torna una cosa sola: l'**agenda**, i prossimi sei appuntamenti
già pianificati. Tutto il resto resta in ufficio.

La cartella, dopo un po' di lavoro, ha questa forma:

```
  GiardinoApp/
    rapportini/                    ← ci scrive il telefono, l'ufficio legge
      2026-09-18-mario-rossi-<id>.json
    appuntamenti/                  ← ci scrive il telefono: le prenotazioni
      2027-03-15-mario-rossi-<id>.json
    archivio/                      ← ci scrive l'ufficio
      2026/
        2026-09-18-mario-rossi-<id>.json
    clienti.json                   ← l'anagrafica dell'ufficio
    listino.json                   ← i prezzi, solo dell'ufficio
    impostazioni.json              ← l'intestazione del conto
    lavagna.json                   ← la pianificazione
    agenda.json                    ← ci scrive l'ufficio, il telefono la legge
    anagrafica-dal-telefono.json   ← il file che il telefono esporta, da importare
    prodotti-dal-telefono.json     ← concimi, sementi e fitofarmaci, da importare
```

Le prenotazioni depositate in `appuntamenti/` compaiono **da sole** sulla lavagna:
non c'è niente da premere. Chi prenota è in giardino col cliente davanti.

## L'agenda: l'unica cosa che torna in cantiere

`agenda.json` lo scrive l'ufficio e lo legge il telefono, ed è l'unico file che va
in quel verso. Si riscrive **a ogni salvataggio della lavagna** — cioè a ogni
mossa: un'agenda da aggiornare a mano è un'agenda che in giardino dice il giorno
sbagliato.

Contiene i **prossimi sei appuntamenti** già piazzati su una mezza giornata, da
oggi in avanti, e di ognuno solo **giorno, mezza giornata, cliente e note**. Non
indirizzi, non telefoni, non ore, non prezzi: l'indirizzo dello script è pubblico
per chi lo conosce, e quello che non parte non si può leggere per strada. Chi
aggiunge un campo lì lo pubblica là.

Le note sì, e sono il motivo per cui l'agenda esiste: sono la cosa che fa il giro
completo. Il cantiere le scrive prenotando, l'ufficio se le tiene sul cartellino,
e tornano in giardino il giorno del lavoro. Per questo sulla lavagna il cartellino
ha **un campo di testo e non due**: le operazioni si scrivono lì, e da lì partono.

Sul telefono l'agenda si scarica quando c'è rete e **resta salvata**: in giardino
il campo spesso non c'è, ed è lì che serve sapere dove si va domani.

## L'app dell'ufficio

Sta in `index.html`, qui dentro, e si apre col browser dallo stesso indirizzo
dell'app del cantiere con `/ufficio/` in fondo. Al primo avvio chiede di scegliere
la cartella `GiardinoApp`; da allora se la ricorda, e ogni tanto chiede il permesso
con un clic — Chrome non lo tiene per sempre.

Fa tre cose: mostra i rapportini arrivati e non ancora archiviati, ci applica il
listino e li archivia. Serve **Chrome o Edge su PC**: l'accesso a una cartella del
disco è un'API che Safari e i browser da telefono non hanno. Non è un limite che
dà fastidio — quella cartella esiste solo sul PC dell'ufficio.

**L'archivio dell'ufficio sono file in quella cartella**, non dati dentro il
browser. È il motivo per cui si è scelto Drive: la cartella sta sul PC, che ha il
suo backup automatico, e IndexedDB del browser non ci finirebbe dentro. Quello che
conta deve stare dove il backup passa.

Un lavoro archiviato si porta dentro il rapportino per intero. Fra due anni quel
file deve raccontare il lavoro da solo, anche se la cartella degli arrivi è stata
svuotata e il telefono cambiato.

Un lavoro si può anche **togliere** dall'archivio, dalla sua scheda. Non serve a
correggerlo — per quello si rimanda il rapportino dal cantiere — ma al lavoro che
non ci doveva stare. La conferma dice cosa succede: se il rapportino è ancora in
`rapportini/` torna fra quelli in arrivo, altrimenti quel file era l'unica copia.

## Due pezzi da installare, una volta sola

**1. Lo script che riceve** — `ricevi-rapportini.gs`, da incollare in
[script.google.com](https://script.google.com) con l'account dei giardini e
distribuire come applicazione web. Le istruzioni sono in testa al file.
L'indirizzo che ne esce va incollato nell'app, in Dati → Rapportino.

Quando lo script cambia **non basta salvare**: va rifatta la distribuzione
(Distribuisci → Gestisci distribuzioni → matita → Versione: **nuova**), o continua
a girare quella di prima. E va rifatta sulla distribuzione che c'è già, non come
distribuzione nuova: una nuova dà un indirizzo diverso, e il telefono continua a
parlare col vecchio.

**2. Google Drive per desktop** sul PC dell'ufficio, collegato allo stesso
account. La cartella `GiardinoApp` diventa così una cartella vera sul disco, e
l'app dell'ufficio ci accede direttamente.

## Perché così

Il telefono non può scrivere su una cartella del PC dell'ufficio: dovrebbe
raggiungerlo da fuori, e le connessioni italiane spesso non lo permettono
(CGNAT). Drive fa da cassetta delle lettere e risolve il problema senza aprire
niente verso l'esterno — e come effetto secondario porta l'archivio fuori sede,
con lo storico delle versioni, senza che nessuno debba ricordarsi di fare un
backup.

## Chi scrive cosa

Un file, un solo autore. Il telefono deposita in `rapportini/` e non tocca
altro; l'ufficio legge da lì, scrive nel suo archivio e scrive `agenda.json`, che
il telefono legge e non tocca. Nessuno sovrascrive il lavoro di nessuno, e non
serve nessuna sincronizzazione bidirezionale.

Per questo un rapportino risulta «in arrivo» perché **l'archivio non ne ha ancora
una copia a quella revisione**, non perché qualcuno lo abbia spostato: l'ufficio
non scrive in `rapportini/` nemmeno per segnare che ha finito.

E per questo la stessa visita corretta e rimandata **riscrive il suo file
d'archivio** invece di affiancarne un secondo: il nome nasce da data e cliente, e
un cliente rinominato sul telefono metterebbe lo stesso lavoro in archivio due
volte — pronto per essere fatturato due volte.
