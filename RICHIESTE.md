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

Da decidere, prima di scrivere codice:

1. **Il prezzo.** Il CLAUDE.md dice che *sul telefono non ci sono prezzi*: il
   listino sta in ufficio, in un posto solo. Le piante però spesso si comprano
   per quel lavoro, e il prezzo lo sa chi le ha comprate. Le strade sono due:
   il prezzo si scrive sul telefono solo per le piante, come eccezione dichiarata
   (e va detto nel CLAUDE.md perché), oppure dal telefono arrivano nome e numero
   e il prezzo lo mette l'ufficio sulla riga, dove un prezzo scritto a mano già
   non viene mai sovrascritto.
2. **Il nome sul foglio del cliente.** Per i diserbi il nome commerciale non esce
   (`voce` generica, il nome in `prodotto`). Per le piante il cliente vuole
   leggere «Lauro × 12», non «Piante × 35»: andrebbe stampato, e quindi la regola
   del nome che non esce varrebbe per i fitofarmaci e non per le piante.
