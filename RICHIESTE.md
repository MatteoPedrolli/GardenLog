# Richieste in attesa

Quello che è stato chiesto durante il beta testing e si è deciso di fare più
avanti. Ogni voce dice cosa si è chiesto, cosa tocca e cosa resta da decidere,
così chi la prende in mano non deve ricostruire la conversazione. Quando una
voce si fa, si toglie da qui e quello che vale anche dopo va nel CLAUDE.md.

## Una riga di testo su ogni fascia oraria

*Chiesto il 24/09/2026.* Nel rapportino, accanto a orario e persone, una riga
che dica cosa è stato fatto in quelle ore («potatura siepe lato strada»).

Cosa tocca:

- sul telefono un campo in più sulla fascia (`Cosa`). È un campo che si
  aggiunge: le visite di prima non ce l'hanno e restano valide, **non serve
  alzare `VERSIONE_DATI`**. Va compilato con `oninput` e senza ridisegnare
  l'elenco delle fasce mentre si scrive;
- nel rapportino `ore.fasce[].cosa`, sempre in più: un ufficio fermo alla
  versione di prima lo ignora e non rifiuta il documento, quindi nemmeno
  `VERSIONE_RAPPORTINO` deve salire;
- in ufficio si legge nella schermata del lavoro e in archivio, accanto alle ore.

Da decidere: **se va anche sul foglio del cliente.** Oggi ore e fasce restano in
ufficio («al cliente va solo il conto»), e questa riga è proprio il genere di
cosa che un cliente leggerebbe volentieri. Se sì, è un cambio a quella regola e
va scritto.

## Piantumazione: più piante diverse, ognuna con nome, numero e prezzo

*Chiesto il 24/09/2026.* Oggi piantumazione è un'operazione con una sola
quantità («12 n») e senza nome. Spesso in un lavoro se ne mettono di più tipi:
12 lauri, 3 aceri, 20 lavande.

Cosa tocca:

- sul telefono il dettaglio della piantumazione diventa un **elenco di righe**
  (nome pianta + numero), con «aggiungi un'altra». Il modo più semplice di
  salvarle è **un'operazione per specie**, tutte dello stesso tipo: lo schema
  delle operazioni resta quello di oggi con in più un nome, e ogni specie ha già
  la sua riga nel conto, giunta dall'`OperazioneID` come per i concimi;
- nel rapportino il nome viaggia accanto alla quantità, come già fa `prodotto`.

Deciso il 24/09/2026:

1. **Il prezzo delle piante si scrive sul telefono.** È sull'etichetta del vaso:
   in ufficio bisognerebbe alzarsi e andare in vivaio a controllare. È
   un'eccezione dichiarata alla regola *sul telefono non ci sono prezzi*, e
   quando si fa va scritta nel CLAUDE.md con questo perché, accanto alla regola.
   Vale solo per le piante: il listino resta dell'ufficio per tutto il resto. In
   ufficio il prezzo arriva sulla riga come un prezzo scritto a mano, quindi il
   listino non lo sovrascrive.
2. **Il nome della pianta esce sul conto del cliente** («Lauro × 12»). Per i
   fitofarmaci resta la regola di oggi, il nome commerciale non esce: anche questa
   differenza va scritta nel CLAUDE.md, o qualcuno la «sistemerà».

## Accorpare più voci del conto in una

*Chiesto il 24/09/2026.* Esempio: una siepe nuova. Il rapportino porta ore,
piante, pali, telo pacciamante e pacciamatura, ognuno con la sua riga. A volte si
vuole che al cliente arrivi una voce sola: si spuntano le righe, si uniscono, si
dà un nome al gruppo («Fornitura e posa siepe»), e come prezzo compare
**suggerita la somma** delle righe unite, che resta modificabile.

Cosa tocca:

- si fa **in ufficio**, nella schermata del lavoro in arrivo, dove il conto ha già
  i prezzi e si corregge prima di archiviare. Sul telefono i prezzi non ci sono
  (a parte le piante), quindi lì la somma non si potrebbe suggerire;
- le righe unite **non si buttano**: restano dentro il gruppo, così in ufficio si
  vede ancora di cosa è fatto e si può sciogliere. Al cliente, foglio e mail,
  arriva solo il gruppo, con il suo nome e il suo prezzo;
- un campo in più nel file d'archivio (il gruppo con dentro le sue righe), che
  un archivio di prima non ha e resta valido: non serve cambiare versione.

Deciso il 24/09/2026:

- **il gruppo si fattura a corpo**: quantità 1, e il prezzo è quello del gruppo;
- **il prezzo del gruppo non si sovrascrive.** Se il cantiere rimanda il
  rapportino corretto e una riga dentro il gruppo cambia quantità, il gruppo resta
  com'era e la schermata dice che sotto è cambiato qualcosa, con la somma nuova
  accanto: decide chi fattura. È la stessa regola dei prezzi scritti a mano.

## Una riga di testo sulle fasce: resta aperto

Resta da decidere se la riga delle fasce va anche sul foglio del cliente (vedi
sopra).
