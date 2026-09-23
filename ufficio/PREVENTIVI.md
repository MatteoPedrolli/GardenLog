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

## Domande ancora aperte

- **Chi possiede il preventivo** una volta che lei non c'è più. Finora la suite
  ha dato per scontata una persona sola; il preventivo nasce in ufficio, sul PC,
  come l'archivio — ma va deciso e scritto.
- **Il rilievo delle misure sul telefono** è stato messo in fondo alla lista. Il
  buco vero è fra i numeri del titolare e il preventivo, non fra il giardino e i
  numeri. Se la beta dice il contrario, si riapre.
- **Come si importa il file del tool dei settori**: un bottone in ufficio che
  legge `irrigazione_*.json`, oppure un'esportazione dedicata dal tool. Da
  decidere guardando un preventivo d'impianto vero.
