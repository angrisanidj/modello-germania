# Modello Germania v22 — integrazione

## Installazione sul repository esistente

Copia **tutti i file nella root del repository**, sovrascrivendo quelli omonimi.

Il pacchetto contiene:

- `index.html`
- `mappa_uninominali_locale.html`
- `preview-bundestag-v22.png`
- `preview-bundestag.png`
- 6 card social (`card_*.png`)
- 6 pagine share (`share-*.html`)
- `VALIDAZIONE_V22.md`
- `CHANGELOG_V22.md`
- `data/README_DATI.txt`

## Dati territoriali

Mantieni nel repository i file già presenti:

- `data/kerg.csv`
- `data/wkr2025.geojson`

Non sono stati modificati da v22 e non sono duplicati nell'archivio. La dashboard ha comunque fallback remoti verso la Bundeswahlleiterin / GitHub / jsDelivr, ma i file locali restano la configurazione preferita.

## Cache

Il bump di versione invalida automaticamente le vecchie cache Monte Carlo/forecast. Dopo il primo calcolo v22, un reload con lo stesso snapshot riusa la cache compatta.

All'apertura, anche se esiste una cache sondaggi del giorno corrente, dopo circa 1,5 secondi viene eseguito un controllo silenzioso della fonte; in seguito il controllo si ripete ogni ora. Se i dati sono identici, il Monte Carlo non riparte.
