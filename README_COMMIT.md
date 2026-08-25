# File pronti da commit

1. Sostituisci il tuo `index.html` con quello in questo pacchetto.
2. Sostituisci tutte le sei pagine `share-*.html`. Ora puntano a `./` (cioè al vero `index.html`) e usano URL assoluti per le preview.
3. Per la mappa geografica principale, esegui **SCARICA_DATI_MAPPA.bat** su Windows. Lo script crea:
   - `data/kerg.csv`
   - `data/wkr2025.geojson`
4. Committa anche i due file appena creati nella cartella `data/`.

Struttura finale:
```
/
  index.html
  mappa_uninominali_locale.html
  preview-bundestag-v21.png
  card_*.png
  share-*.html
  /data
    kerg.csv
    wkr2025.geojson
```

Fonti dei due file territoriali:
- kerg.csv: Bundeswahlleiterin, risultati ufficiali Bundestagswahl 2025
- wkr2025.geojson: geometrie Wahlkreise 2025, repository ZEIT ONLINE basato sui confini della Bundeswahlleiterin
