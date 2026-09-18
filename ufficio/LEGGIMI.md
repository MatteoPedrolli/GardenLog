# La parte su Drive

L'app del cantiere deposita i rapportini in una cartella di Drive dell'account
giardini; l'app dell'ufficio, sul PC, legge quella stessa cartella come una
cartella normale del disco.

```
  TELEFONO ──POST──→ Apps Script ──→ Drive: GiardinoApp/rapportini/
                                        │
                                   Drive per desktop
                                        ↓
                                     PC UFFICIO ──→ prezzi, archivio
```

## Due pezzi da installare, una volta sola

**1. Lo script che riceve** — `ricevi-rapportini.gs`, da incollare in
[script.google.com](https://script.google.com) con l'account dei giardini e
distribuire come applicazione web. Le istruzioni sono in testa al file.
L'indirizzo che ne esce va incollato nell'app, in Dati → Rapportino.

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
altro; l'ufficio legge da lì e scrive nel suo archivio. Nessuno sovrascrive il
lavoro di nessuno, e non serve nessuna sincronizzazione bidirezionale.
