# Bundestag — pacchetto minimo per commit manuale

Carica **tutto il contenuto di questa cartella nella stessa directory del sito**.

## Struttura

```text
/
├── dashboard_elezioni_tedesche_v21_3_mappa_ai.html
├── mappa_uninominali_locale.html
├── preview-bundestag-v21.png
├── card_x.png
├── card_threads.png
├── card_facebook.png
├── card_linkedin.png
├── card_telegram.png
├── card_whatsapp.png
├── share-x.html
├── share-threads.html
├── share-facebook.html
├── share-linkedin.html
├── share-telegram.html
├── share-whatsapp.html
└── data/
    ├── kerg.csv
    └── wkr2025.geojson
```

## I due file da aggiungere manualmente nella cartella `data/`

### 1. Risultati territoriali ufficiali 2025
Salva questo file con nome **`data/kerg.csv`**:

https://www.bundeswahlleiterin.de/bundestagswahlen/2025/ergebnisse/opendata/btw25/csv/kerg.csv

### 2. Geometrie dei 299 Wahlkreise
Salva questo file con nome **`data/wkr2025.geojson`**:

https://raw.githubusercontent.com/ZeitOnline/bundestagswahl-historische-wahlkreis-daten/main/shapes_2025/wkr2025.geojson

## Importante

La dashboard cerca **prima** questi due file locali. Se sono presenti, la mappa geografica principale dei 299 collegi funziona senza dipendere dal CORS delle fonti esterne.

`mappa_uninominali_locale.html` è solo il fallback finale e non sostituisce la mappa geografica reale.
