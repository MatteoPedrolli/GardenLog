# I preventivi — note prima di costruire

Appunti di una conversazione, messi qui perché in chat si perdono. Niente di
questo è ancora codice: è quello che si è capito su **come si fa davvero un
preventivo in questa azienda**, e cosa va costruito di conseguenza.

## Perché adesso, e perché di corsa

La segretaria fa preventivi e consuntivi, e **va in pensione a fine mese**. Il
sistema nasce per sostituire quella funzione.

Il consuntivo è già fatto: l'archivio dell'ufficio col suo conto *è* il
consuntivo. Il preventivo no, ed è il buco.

**Il software si riscrive sempre, il suo metodo no.** La cosa che scade a fine
mese non è il codice: è come si fa un preventivo qui dentro. Quella va raccolta
prima, anche solo su carta — vedi *Cosa chiedere prima che vada via*.

Una cosa detta chiaramente, perché le aspettative contano: un sistema non
sostituisce una persona che fa preventivi. Sostituisce **l'aritmetica e la
burocrazia** — i conti, il modulo, la numerazione, il ritrovare le cose. Il
giudizio su cosa includere, cosa escludere, quanto rischio c'è in un lavoro e
come si scrive una riserva a un cliente difficile resta a chi firma.

## I preventivi sono quattro animali diversi

Ed è la scoperta che ha cambiato il piano: **solo uno ha bisogno di un disegno.**

| Tipo | Da cosa nasce il numero | Serve il disegno? |
|---|---|---|
| Manutenzione ordinaria e straordinaria | mezze giornate + kg di verde di risulta | **no** |
| Siepi e aiuole ex novo | metri o m², sesto d'impianto, taglia della pianta | **no**, è aritmetica |
| Prato in rotoli | area di una forma complicata | sì — ma produce **un numero** |
| Impianto di irrigazione | schema irrigatori + settori | sì, ed è un progetto |

## Il CAD non si fa

Era la prima idea: un CAD semplice sul telefono per prendere le misure in campo.
È stata scartata, e le ragioni valgono anche per chi ci riproverà fra un anno.

**Il CAD c'è già e funziona.** Il prato in rotoli si disegna in CAD e l'area la
danno gli strumenti del CAD. Le superfici non sono poligoni semplici: scomporle
in rettangoli e cerchi su un telefono sarebbe *peggio* di quello che si fa oggi.

**Un CAD «basico» è la cosa più cara che esista**, travestita da cosa semplice:
tela con pan e zoom, aggancio dei punti, annulla, spostamento dei vertici,
precisione al dito. Su un telefono, al sole, con le mani sporche, sarebbe l'unica
parte della suite che non si usa con un pollice e mezza attenzione.

**E il disegno non è l'obiettivo.** Per il prato dal CAD esce *un numero*, i
metri quadri, che si battono in due secondi. Per l'irrigazione il disegno serve a
**decidere**, non a misurare — e lì resta dov'è.

Scartata anche l'idea di camminare il perimetro col GPS: il GPS del telefono
sbaglia di 3-5 metri, su un giardino è inutilizzabile.

Se un giorno servisse davvero aiuto a misurare in campo, lo strumento è un
**distanziometro laser**: si legge il numero e lo si batte. L'app deve essere il
taccuino, non il metro.

## Dove sta il lavoro vero

Non nel misurare. Nel **passaggio**. Oggi la catena è:

```
  CAD → tool dei settori → il titolare calcola costi e ore
      → la segretaria rifà i conti e scrive il preventivo
```

Ogni freccia è una ribattitura a mano, e ogni ribattitura è un posto dove un
numero cambia senza che nessuno se ne accorga.

È **lo stesso problema del rapportino**, e la macchina per risolverlo esiste già
ed è collaudata: quantità da una parte, listino dall'altra, il conto si compila
da sé. **Un preventivo è un conto che si fa prima.**

## Il tool dei settori ha già il ponte

`settori_irrigazione.html` è un file singolo che gira offline, separato da questa
suite. Due cose che ha già dentro e che servono al preventivo:

**La distinta ugelli.** Raggruppata per serie/modello/colore col totale — `4 ×
MP2000 Nero`, `3 × MP3000 Blu`. Quella *è* una distinta materiali: sono righe di
preventivo a cui manca solo il prezzo accanto.

**Il file di progetto.** Salva `irrigazione_<cliente>.json` con
`{cliente, qdisp, pdisp, soglia, prove, rows, catalog, conta}`. Il ponte verso
l'ufficio esiste già in forma di dato: non è collegato a niente. L'ufficio
potrebbe importarlo e far nascere il preventivo con la distinta dentro.

Quello che il tool **non** sa, e che serve al preventivo: tubazioni,
elettrovalvole, pozzetti, centralina, raccorderia, scavo, ore. Oggi lo aggiunge
la segretaria.

Da notare: il `cliente` nel tool è testo libero, senza identificativo. Il
collegamento all'anagrafica andrà fatto per nome o scegliendolo in ufficio.

## Tre incastri con quello che c'è già

**Le mezze giornate.** Le stime si arrotondano alla mezza giornata, e la lavagna
dell'ufficio **è fatta di mezze giornate** — `ORE_MEZZA = 8` ore di manodopera.
Lo stesso numero che fa il prezzo fa anche la pianificazione: preventivo
accettato → il lavoro entra in «Da pianificare» già largo tre mezze giornate.
Non è una coincidenza carina: è lo stesso fatto misurato una volta sola.

**Il verde di risulta.** `smaltimento-verde` in kg è **già** una voce di listino,
e `scarico-verde` è già un tipo di operazione che ci si aggancia. Si stima il
peso e la riga si prezza da sola.

**I sesti d'impianto** sono aritmetica che l'app può fare al posto di chi la fa a
mano ogni volta: 24 m di siepe a sesto 0,4 → 60 piante, taglia 80-100.

## Dove si incastra nel sistema

Il preventivo ha la stessa forma delle cose che ci sono già:

- si prepara **in campo**, col cliente davanti — come la prenotazione;
- si **prezza in ufficio**, dove sta il listino — come il rapportino;
- **esce verso il cliente** — come il foglio del conto.

Quindi è un **quarto documento**, non una parte nuova del sistema, e segue le
stesse regole: versione sua, si rifiuta se non è di questa versione, un file un
solo autore. Il preventivo accettato entra in «Da pianificare» sulla lavagna.

E il listino è già pronto a riceverlo: **voci** generiche e **prodotti** col loro
prezzo, con il prodotto che vince sulla voce.

## Cosa chiedere prima che vada via

In ordine di quanto è difficile ricostruirlo dopo. Vanno bene le fotografie dei
fogli, e registrare la conversazione mentre spiega.

1. **Tre o quattro preventivi veri già fatti**, uno per tipo, **con i conti a
   lato**. Non il risultato: il procedimento. Da soli valgono metà del lavoro,
   perché sono la specifica.
2. **Come passa dai sesti d'impianto al prezzo**: €/m² o €/ml per taglia di
   pianta, e cosa ci ha dentro (pianta, messa a dimora, terriccio, pacciamatura,
   garanzia d'attecchimento?).
3. **Come prezza l'impianto partendo dalla distinta**: cosa aggiunge, con che
   criterio stima tubo e scavo, se usa un moltiplicatore.
4. **La tariffa oraria**, e se cambia per tipo di lavoro o stagione.
5. **Lo smaltimento del verde**: €/kg, €/viaggio o a forfait.
6. **I ricarichi**: percentuale sui materiali? il trasferimento come si conta?
7. **La parte amministrativa**: numerazione dei preventivi, giorni di validità,
   termini di pagamento, IVA, e quali esclusioni e riserve scrive sempre.
8. **Cosa fa quando un preventivo torna indietro**: lo rivede? tiene traccia di
   accettati e rifiutati?

E una cosa che si può fare **solo finché c'è**: darle da controllare i conti che
l'app produce su lavori che lei ha già fatturato a mano. Se tornano, quella parte
è convalidata da chi la faceva. Se non tornano, si scopre perché adesso.

## Cosa dicono i preventivi veri

Cinque preventivi già fatti e i due fogli con cui si calcolavano i prezzi a corpo
sono stati letti prima di scrivere una riga di codice. Quello che segue viene da
lì: è la forma vera del documento, non una ipotesi.

**I numeri non stanno qui.** Prezzi, tariffe e margini vivono in `listino.json`
nella cartella di Drive, come tutto il resto del listino, e i dati dei clienti dei
preventivi non entrano nel repository. Questo file descrive **la forma**.

### Il modello è fisso

Tutti e cinque hanno la stessa ossatura, parola per parola:

```
  [intestazione azienda, in alto a destra]
  Spett.le / cliente / indirizzo / telefono / email
  <Località>, <data per esteso>
  «A seguito Vostra gentile richiesta, Vi comunichiamo la nostra migliore
   offerta per la seguente fornitura:»

  Descrizione | UM | Q.tà | Costo un. | Totale
  …
  TOTALE PREVENTIVO S.E. & O.

  [condizioni: validità, IVA, caparra, variazioni]
  [firma]
```

L'intestazione sta già in `impostazioni.json`: alle condizioni serve un campo
accanto, non un posto nuovo.

### Un preventivo non è un elenco che si somma

Tre cose che la carta dice e che una semplice lista di righe non sa rappresentare.

**Le soluzioni alternative.** Due varianti dello stesso lavoro — siepe nuda o con
telo e porfido; prato da semina o in zolla — con **due righe di totale**. Si
escludono a vicenda: il cliente ne sceglie una. Non sono due righe che si sommano,
e un preventivo che le sommasse direbbe una cifra che non esiste.

**Le righe a tariffa, fuori dal totale.** «Eventuale conferimento a discarica · al
q.le · <prezzo>» — prezzo sì, quantità no, e **fuori dal totale**, tanto che il
totale lo dichiara: *«escluso scarico verde»*. Stessa cosa per il costo orario.
Dicono quanto costa una cosa che forse servirà, e non si possono né omettere né
sommare.

**Le sezioni.** Un preventivo può avere più blocchi con un titolo — zone diverse
dello stesso giardino — ognuno con le sue righe e la sua tariffa oraria ripetuta.

Quindi una riga di preventivo è di **tre tipi**: nel totale, alternativa (con la
sua variante), o a tariffa (fuori dal totale). Chi ne implementa solo il primo
rifà un documento che non somiglia a quelli veri.

### Le unità di misura in uso

`a corpo`, `nr`, `mt`, `mq`, `ore`, `costo orario`, `al q.le`, `cad`. Scritte a
mano e non uniformi: `cad` e `cad.` convivono nello stesso insieme. Un elenco
chiuso toglie il problema.

### I fogli di calcolo, e perché contano meno di quanto sembri

Due fogli servivano a trovare i prezzi «a corpo»:

- **taglio siepe**: un costo al metro ricavato da una **regressione lineare sul
  perimetro della sezione** della siepe, poi moltiplicato per i metri, più il
  verde di risulta a peso e il trasferimento;
- **siepe nuova**: somma di componenti — piante (numero ricavato da metri e sesto
  d'impianto), manodopera a ore, porfido, telo, ala gocciolante — diviso i metri
  per ottenere il prezzo al metro lineare.

**I coefficienti della regressione sono arbitrari, e in fase di preventivo si
stimano le ore totali.** Vale la pena scriverlo perché è il contrario di quello
che il foglio lascia credere: quella formula non è il metodo, è un residuo. Il
metodo vero, per quasi tutto, è **stimare le ore** — e si arrotonda alla mezza
giornata, che è anche l'unità della lavagna.

Il secondo foglio invece è aritmetica che serve davvero: dai metri e dal sesto
escono le piante, e da lì il costo. Quello vale la pena averlo dentro.

### Costo e prezzo sono due numeri diversi

Confrontando un foglio di calcolo col preventivo nato da quello stesso lavoro, il
prezzo esposto al cliente è **sensibilmente più alto** del costo calcolato. Il
foglio fa il costo, il preventivo espone il prezzo, e in mezzo c'è un margine che
**non è scritto da nessuna parte**.

È la decisione più importante rimasta: se è una percentuale, l'app la applica; se
è giudizio caso per caso, l'app calcola il costo, mostra il margine mentre si
scrive il prezzo, e la scelta resta a chi firma. La seconda sembra più vera, ma va
confermata.

Lo stesso vale per lo smaltimento del verde: il foglio interno e il prezzo al
cliente usano due tariffe diverse, e la differenza è il margine.

### Come si identifica e come si accetta

**Niente numerazione.** Nessuno dei cinque preventivi ha un numero: il riferimento
è il **nome del cliente** più la data. Coerente con il resto — anche i rapportini
si chiamano per data e cliente.

**L'accettazione oggi è un «ok» a penna sulla stampa.** Non esiste da nessuna
parte in forma digitale. È l'unico punto in cui il sistema deve aggiungere
qualcosa che prima non c'era, quindi deve costare un clic: un preventivo accettato
entra in «Da pianificare» sulla lavagna, ed è il motivo per cui lo stato serve.

## Cosa è già costruito: il rilievo

La prima metà esiste, ed è quella che si fa in giardino. Il **rilievo** è un
documento come il rapportino, viaggia nella stessa coda e finisce in `rilievi/`;
l'ufficio lo legge in una pagina sua. Quello che porta: il cliente, se aspetta il
disegno dal CAD, le righe misurate con descrizione, quantità e unità — le ore di
manodopera comprese — e le note di quello che si vede solo stando lì.

**Non porta prezzi**, per la stessa ragione per cui non li porta il rapportino: il
listino sta in ufficio, in un posto solo. Il campo dice *cosa* e *quanto*, la cosa
che solo lui sa.

Tre cose decise lì che vale la pena non rifare:

- **le mezze giornate escono dalle ore.** Erano contate a mano, una per rilievo;
  ora la manodopera è una riga in ore — una per insieme, o a sé — e le mezze sono
  la loro somma diviso `ORE_MEZZA`, per eccesso. È anche la larghezza che il
  cartellino avrà sulla lavagna: lo stesso fatto misurato una volta sola, e il
  conto sta in `rapportino.js` perché lo fanno entrambe le app;
- **la manodopera ha il suo prezzo come le altre righe.** Prima stava fuori dalle
  righe perché la dicevano le mezze giornate; adesso le mezze la leggono dalle
  righe, e non si conta due volte;
- **il rilievo che aspetta il disegno lo dichiara**, con una casella: l'ufficio lo
  ripete nell'elenco, o un rilievo si apre credendolo finito. Erano due dei
  quattro tipi di lavoro, che non ci sono più.

**Niente fotografie, e non per dimenticanza.** Sarebbero la cosa più utile da
aggiungere — una foto risponde a quello che alla segretaria si chiedeva a voce —
ma il telefono ricopia tutto il suo database in `localStorage` come seconda copia,
e lì ci stanno circa 5 MB: due foto e ogni salvataggio comincia a fallire. Chi le
vuole deve tenerle **fuori** dal database mirrorato e fuori dal backup, in un
archivio suo da cui partono e poi si scartano. È un lavoro a sé, non un campo in
più.

## Il margine: risposto, e come

La domanda che bloccava tutto aveva una risposta che non era né «percentuale» né
«giudizio puro»: **il rapporto fra costo e prezzo dipende da troppe cose**, quindi
l'app mette il **prezzo consigliato** — quello di listino — e lo si corregge.

E la casella aspetta: resta di un colore finché qualcuno non l'ha guardata, poi
torna bianca. È la regola che il sistema aveva già per le fasce orarie del
telefono, ritrovata da un'altra parte — buon segno che sia quella giusta. Lì una
fascia proposta blocca il salvataggio della visita; qui un prezzo proposto blocca
la **stampa**, che è quello che esce.

Il margine quindi non è scritto da nessuna parte nel codice, ed è giusto così: sta
nella differenza fra quello che il listino propone e quello che chi firma decide,
una riga alla volta.

### Cosa è costruito adesso

Dal rilievo al preventivo il giro è chiuso: righe prezzate col listino, totale,
righe a tariffa fuori dal totale, foglio di stampa che ricalca quelli veri
(intestazione, Spett.le, la frase di apertura, TOTALE PREVENTIVO S.E. & O.,
condizioni in fondo), salvataggio in `preventivi/<anno>/`, e l'accettazione che
porta il lavoro sulla lavagna largo le mezze giornate che escono dalle ore.

Ci sono anche i tre tipi di riga che i preventivi veri hanno — nel totale,
**a tariffa** (fuori dal totale) e **sezione** (solo un titolo) — e le
**soluzioni alternative**, con le righe comuni che entrano nel totale di tutte.
Lo stato **mandato** porta la sua data e l'elenco dice da quanto aspetta. E dai
metri e dal sesto d'impianto esce il numero di piante, con la formula del foglio
della segretaria.

Una correzione a quanto scritto più sopra: in questo file si leggeva «24 m a
sesto 0,4 → 60 piante». Il foglio dice `ROUNDDOWN(metri/distanza + 1)`, quindi
**61**: il più uno è la pianta di testa, perché ce n'è una a ogni estremo. Vale la
pena saperlo perché su una siepe lunga l'errore si moltiplica.

### I quattro tipi non sono un campo

I quattro animali qui sopra sono **modi di arrivare al prezzo**, ed è lì che
servono: a capire cosa costruire. Per un po' sono stati anche un campo da scegliere
sul rilievo, e non funzionava: un'etichetta e un avviso, nient'altro, e una scelta
sola per lavori che nella realtà stanno insieme. Del campo è rimasto solo «aspetta
il disegno dal CAD»; le lavorazioni collegate le portano gli **insiemi** (come
«Aiuola»), che si creano da Archivi. Se un giorno servisse un modello di preventivo
più grande — un giardino nuovo con siepe, prato e irrigazione già impostati — si
costruisce con lo stesso meccanismo, solo con un insieme più grande.

### Il giro dal sopralluogo

Il percorso pensato in azienda, e com'è costruito:

```
  lavagna: sopralluogo (nome, paese, via, telefono, mail) su un giorno
    → telefono, pagina Rilievi: i prossimi sopralluoghi
    → al tocco, il rilievo con l'anagrafica già scritta e modificabile
    → ufficio, Preventivi › Aperti
    → prezzi, poi «Manda per mail» o stampa e «Consegnato a mano» → Inviati
    → «ha detto sì» → Confermati, e il lavoro in coda sulla lavagna
    → «ha detto no», o scaduto senza risposta → Rifiutati
```

Una correzione al percorso come era stato detto: via e telefono **non possono
viaggiare con l'agenda**, che si legge con l'indirizzo dello script e basta. Vanno
in un file a parte che lo script consegna solo con una chiave, e senza chiave il
telefono vede il solo nome. Il perché sta nel CLAUDE.md.

E una distinzione che il percorso non aveva: **scaduto non è rifiutato**. Sta fra
i rifiutati perché non è più da aspettare, ma resta scritto così e si accetta
ancora — sono i preventivi da richiamare, non quelli persi.

### Cosa manca

1. **Il consuntivo contro il preventivo.** È la cosa che la segretaria faceva e
   che ancora non si fa: a lavoro finito, confrontare il conto dell'archivio con
   il preventivo accettato. I due documenti hanno la stessa forma e lo stesso
   cliente, quindi il confronto è a portata — ed è la domanda «ci abbiamo
   guadagnato?», che nessun altro pezzo del sistema risponde.
2. **Il preventivo che non nasce da un rilievo**: una telefonata, un lavoro che si
   conosce a memoria. Oggi serve per forza un rilievo dal campo.
3. **Rifiutato**: lo stato c'è nel modello e non ha ancora un bottone. Serve a
   sapere quanti se ne perdono e perché, che è un'informazione che oggi non esiste
   da nessuna parte.
4. **Le taglie delle piante** (80-100, 100-125…) come dato invece che come testo
   dentro la descrizione: è il secondo pezzo del prezzo al metro, dopo il sesto.

## Domande ancora aperte

- **Il margine fra costo e prezzo**: regola o giudizio. Vedi sopra — è la
  decisione che blocca il resto.
- **Chi possiede il preventivo** una volta che lei non c'è più. Finora la suite
  ha dato per scontata una persona sola; il preventivo nasce in ufficio, sul PC,
  come l'archivio — ma va deciso e scritto.
- **Il rilievo delle misure sul telefono** è stato messo in fondo alla lista. Il
  buco vero è fra i numeri del titolare e il preventivo, non fra il giardino e i
  numeri. Se la beta dice il contrario, si riapre.
- **Come si importa il file del tool dei settori**: un bottone in ufficio che
  legge `irrigazione_*.json`, oppure un'esportazione dedicata dal tool. Da
  decidere guardando un preventivo d'impianto vero.
