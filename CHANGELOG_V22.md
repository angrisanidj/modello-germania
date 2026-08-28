# Changelog v22

## v22.4.5 — 28 agosto 2026

- Hardening infrastrutturale: fingerprint e seed serializzano le date di sondaggio come date civili, eliminando lo slittamento di un giorno dovuto a `toISOString()` nei fusi positivi.
- Schema fingerprint esplicito `civil-date-v1`; cache/seed vengono quindi rigenerati in modo deterministico senza cambiare il motore statistico.
- Guard A upstream automatizzata e verificata; stato normale atteso verde.
- Audit finale coverage 50/80/95 e fascia 3–7% superato. Nessuna modifica metodologica, al forecast o al territorio.


## Release pubblica pulita · 28 agosto 2026

- rimossi dall'interfaccia pubblica i pannelli di audit, gli shadow test e i pulsanti di sensitivity usati durante la validazione;
- mantenuti nel JavaScript i gate probabilistici, gli autotest e i fallback automatici;
- mantenuti il backtest nazionale, la validazione territoriale e le nuove probabilità condizionate per configurazione parlamentare;
- riscritta la nota di rilascio in forma editoriale, senza linguaggio da promotion gate;
- nessuna modifica al motore statistico `v22.4.1-residual-fix` o ai suoi parametri.

## Bug fix generalizzato

- corretto l'aggiornamento automatico: anche con cache dello stesso giorno viene effettuato un controllo remoto silenzioso all'apertura e poi ogni ora;
- Monte Carlo rilanciato solo quando cambia realmente il fingerprint dei sondaggi;
- forecast in corso annullato se arriva un nuovo snapshot dei sondaggi;
- cache nowcast/forecast compatta e scritture `localStorage` protette da errori/quota;
- pannello della clausola dei tre collegi allineato alla **proiezione alla media**, senza mescolare lo scenario rappresentativo stocastico;
- CDU e CSU restano controllate separatamente per eleggibilità;
- corretto il trattamento degli “Altri” nell'Erststimme: l'aggregato dei piccoli candidati resta nel denominatore ma, per determinare il vincitore, conta soltanto il candidato/lista minore più forte;
- label del vero candidato/lista “Altri” mostrata nel dettaglio quando disponibile;
- invalidazione delle cache territoriali e delle immagini social portata a v22;
- preview social principale rinominata `preview-bundestag-v22.png`;
- salvataggio snapshot giornaliero reso tollerante agli errori dello storage.

## Validazione

- nuovo pannello “Validazione territoriale v22”;
- backtest condizionale 2021→2025 sui confini 2025;
- accuratezza separata sui collegi che cambiano vincitore;
- MAE della quota del vincitore;
- cross-validation spaziale leave-one-Land-out per shock Land e Wahlkreis;
- test random dell'allocatore Sainte-Laguë e test di riproducibilità del Monte Carlo.

## Interfaccia e pacchetto

- badge v22;
- preview e card social v22 neutre, senza percentuali destinate a diventare obsolete;
- pagine share uniformate per X, Threads, Facebook, LinkedIn, Telegram e WhatsApp;
- documentazione di integrazione e validazione inclusa nel pacchetto.
