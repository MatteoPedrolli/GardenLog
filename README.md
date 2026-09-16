# GardenLog / GiardinoApp

App per registrare gli interventi di giardinaggio: clienti, visite, operazioni,
prossimi interventi e report sulla concimazione dei prati.

È una PWA in un file solo (`index.html`) più il service worker (`sw.js`): si
apre dal browser, si installa sulla schermata home e funziona offline.

## I dati stanno sul dispositivo

Non c'è un server. Tutto è salvato in locale, in IndexedDB con una seconda
copia in `localStorage`: il salvataggio è istantaneo e l'app si usa in giardino
anche senza campo.

Il rovescio della medaglia è che **l'unica copia dei dati è sul dispositivo**.
Un telefono perso, formattato o cambiato se li porta via. Per questo esiste il
backup, ed è la cosa importante da ricordare:

- **Esporta backup** (pagina Dati, ingranaggio in alto a destra) scrive un file
  JSON con tutto. Su iPhone passa dal foglio di condivisione, così il file può
  finire in File, iCloud o in una mail; sul computer è un normale download.
- **Importa backup** rimette tutto com'era, su questo o su un altro dispositivo.
- In home compare un avviso quando il backup comincia a invecchiare.

## Analisi sul computer

La pagina Dati esporta tre tabelle CSV — clienti, visite, operazioni — già
pronte per Excel o Fogli Google in italiano (separatore `;`, virgola decimale,
UTF-8 con BOM).

## Archivi

Concimi, sementi, fitofarmaci e fasce di concimazione si gestiscono nella
pagina Dati. Le fasce portano i target di azoto e potassio per metro quadro,
da cui il report Prati calcola quanto manca: modificare una fascia aggiorna
tutti i clienti che la usano.

Alla prima apertura vengono create tre fasce di esempio, da correggere con i
propri numeri.

## Il vecchio foglio Google

L'app è nata leggendo e scrivendo su Google Sheets tramite Apps Script. Ora non
lo usa più. In fondo alla pagina Dati resta un pulsante per importare una volta
sola lo storico rimasto sul foglio; richiede connessione e sostituisce i dati
presenti sul dispositivo.

## Sviluppo

Serve un server locale, perché i service worker non funzionano su `file://`:

```
npx http-server -p 8099 -c-1 .
```
