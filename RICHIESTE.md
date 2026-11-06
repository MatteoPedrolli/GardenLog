# Richieste in attesa

Quello che è stato chiesto durante il beta testing e si è deciso di fare più
avanti. Ogni voce dice cosa si è chiesto, cosa tocca e cosa resta da decidere,
così chi la prende in mano non deve ricostruire la conversazione. Quando una
voce si fa, si toglie da qui e quello che vale anche dopo va nel CLAUDE.md.

## Più squadre che vedono gli stessi dati

**Chiesto il 06/11/2026, come ipotesi.** Non si sa ancora quante squadre serviranno:
da due a sei. Si è ragionato su cosa vorrebbe dire, senza decidere niente.

**Il punto di partenza.** L'app oggi è pensata per una persona sola col telefono.
Sul Drive c'è già tutto quello che è stato *mandato*: i rapportini (ore, operazioni,
concimi e quantità), i rilievi, le prenotazioni, i conferimenti, l'anagrafica
condivisa, e da novembre la copia di sicurezza di ogni telefono in `backup/`. Restano
solo sul telefono:

- i **dati di prato e siepe** sulla scheda cliente: metri quadri, fascia, specie,
  misure. Il riquadro del prato non è un dato a sé: si ricalcola dalle concimazioni
  (che stanno nei rapportini), dai metri quadri e dai concimi dell'archivio;
- gli **archivi**: concimi con N% e K%, sementi, fitofarmaci, tipi di operazione,
  settori (questi ultimi arrivano in ufficio solo con l'esportazione a mano);
- quello che non è ancora partito.

**Come si farebbe, senza cambiare l'architettura.** La regola «ogni file ha un solo
autore» regge anche con più squadre, perché ogni telefono scrive solo i suoi documenti:

1. **Prato e siepe entrano nell'anagrafica condivisa**, come telefono e mail: aggiungere
   campi a `CAMPI_CLIENTE` in `rapportino.js`. L'ufficio resta l'originale, i telefoni
   mandano le modifiche.
2. **Lo storico per cliente lo pubblica l'ufficio**, ricavato dai rapportini di tutte le
   squadre, in un file riservato (fra i `RISERVATI` dello script, con la chiave) che i
   telefoni scaricano. È il caso che conta: due squadre che concimano lo stesso prato
   senza saperlo.
3. **Gli archivi diventano dell'ufficio** — concimi, tipi, settori — e i telefoni li
   scaricano, invece di averne ognuno una copia che diverge.

A quel punto il telefono è una copia di lavoro più una casella d'uscita, e la copia di
sicurezza automatica copre quello che non è ancora partito.

**Da due a sei squadre cambia poco nei dati e molto nella lavagna.** Il salto vero è da
una a due: serve dire **di quale squadra** è un appuntamento. Con due la lavagna di oggi
regge con un'etichetta sul cartellino; con sei va pensata diversamente (una riga per
squadra, o un filtro), e **l'agenda va per squadra**: dieci appuntamenti di tutte le
squadre mescolati non dicono a nessuno dove andare. Con più squadre cresce anche il numero
di file in `rapportini/`, che l'ufficio rilegge a ogni apertura: oltre qualche migliaio
andrà diviso per anno, come l'archivio.

**Da decidere prima di cominciare:**

- quante squadre, e se lavorano sugli **stessi clienti** o ognuna sui suoi;
- cosa vede una squadra delle altre: tutto (ore, note, conto) o solo quello che serve in
  giardino — concimazioni, prato, siepe, ultimo intervento;
- chi decide gli **archivi**: chi lavora o l'ufficio;
- se ogni squadra ha **un telefono** o se più persone usano lo stesso.

Tocca: `rapportino.js` (campi dell'anagrafica, documento dello storico), lo script (un
file riservato in più, da ridistribuire), l'ufficio (lavagna per squadra, agenda per
squadra, pubblicazione dello storico e degli archivi), il telefono (scaricarli e
mostrarli, il nome della squadra sulle prenotazioni).
