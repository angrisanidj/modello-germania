# Validazione v22 — Modello Germania

Data audit: 25 agosto 2026.

## 1. Verifica nazionale

La verifica retrospettiva già incorporata nella dashboard è stata mantenuta e ricontrollata:

| Elezione | MAE voti | Copertura intervallo 80% |
|---|---:|---:|
| 2017 | 1,45 p.p. | 4/6 |
| 2021 | 0,83 p.p. | 5/6 |
| 2025 | 0,87 p.p. | 6/7 |
| **Totale** | **MAE 1,04 p.p. · RMSE 1,24 p.p.** | **15/19 = 79%** |

Il 79% è interpretato come controllo della dispersione marginale, non come prova di calibrazione con 19 osservazioni indipendenti: i risultati di partito appartengono a soli tre eventi elettorali.

Il leave-one-election-out della correzione del bias continua a sconsigliare un house effect fisso: MAE circa 1,12 p.p. con correzione al 25%, 1,23 al 50% e 1,45 con correzione piena, contro 1,04 senza correzione.

## 2. Allocatore dei seggi

L'autotest incorporato usa le Zweitstimmen ufficiali 2025 e deve riprodurre esattamente:

- CDU 164
- CSU 44
- AfD 152
- SPD 120
- Verdi 85
- Linke 64
- SSW 1

Lo stesso controllo viene eseguito sia sull'allocatore Sainte-Laguë ordinario sia sulla versione ottimizzata usata nel Monte Carlo.

In audit esterno sono stati inoltre generati **10.000 vettori casuali di voto**: le due implementazioni Sainte-Laguë hanno prodotto la stessa assegnazione per ogni partito e sempre esattamente 630 seggi.

## 3. Validazione territoriale nuova in v22

La dashboard calcola automaticamente la validazione quando carica `data/kerg.csv` ufficiale.

Il dataset della Bundeswahlleiterin contiene, per la Bundestagswahl 2025, anche i valori della Vorperiode 2021 convertiti alla suddivisione dei 299 Wahlkreise del 2025. Fonte:

- https://www.bundeswahlleiterin.de/bundestagswahlen/2025/ergebnisse/opendata.html
- https://www.bundeswahlleiterin.de/bundestagswahlen/2025/ergebnisse/opendata/btw25/csv/kerg.csv

La v22 esegue due controlli distinti.

### Backtest condizionale 2021→2025

Parte dalle Erststimmen 2021 convertite sui confini 2025 e applica lo **swing nazionale effettivamente osservato** tra 2021 e 2025. Confronta quindi il vincitore previsto con il vincitore reale del 2025 in tutti i 299 collegi.

La dashboard mostra:

- quota dei 299 vincitori ricostruiti correttamente;
- accuratezza nei soli collegi che hanno cambiato vincitore tra 2021 e 2025;
- MAE della quota di Erststimme del vincitore.

Questo test isola la trasformazione `nazionale → territorio`: **non** è un forecast completo out-of-sample, perché lo swing nazionale 2025 è fornito al modello come dato noto.

### Cross-validation spaziale leave-one-Land-out

Per gli shock gerarchici:

1. un Land viene escluso;
2. la dispersione viene stimata sugli altri Länder;
3. si verifica se il residuo del Land escluso cade nell'intervallo nominale dell'80%;
4. la stessa procedura viene ripetuta sui residui di Wahlkreis, addestrando sugli altri Länder.

La dashboard espone copertura osservata e numero di osservazioni. È una verifica spaziale della calibrazione 2021→2025, non una seconda elezione territoriale indipendente.

## 4. Controlli di coerenza 2025

Quando `kerg.csv` viene caricato, il modello continua a imporre l'autotest che deve ricostruire:

- vincitori: CDU 143, CSU 47, AfD 46, SPD 45, Verdi 12, Linke 6;
- vittorie con Zweitstimmendeckung: CDU 128, CSU 44, AfD 42, SPD 44, Verdi 12, Linke 6;
- **23** vittorie di collegio senza mandato per insufficiente Zweitstimmendeckung.

Se questi valori non coincidono, la base territoriale non supera il QA.

## 5. Test di robustezza del codice eseguiti per v22

- sintassi JavaScript: OK;
- autotest incorporati: OK;
- 10.000 confronti random `sainteLague()` vs `sainteLagueFast()`: OK;
- runtime Monte Carlo sintetico su 299 collegi: OK;
- riproducibilità: due Monte Carlo da 1.000 simulazioni con lo stesso fingerprint producono statistiche, scenario rappresentativo e probabilità di coalizione identici: OK;
- replay dello scenario rappresentativo dopo lettura della cache compatta: OK;
- cache compatta nel test: circa 21 KB UTF-16 per il nowcast e 7 KB per un forecast, molto sotto le dimensioni della vecchia cache con tutti i campioni;
- fingerprint dei sondaggi: varia quando cambia una rilevazione e resta stabile su dati identici: OK;
- test “Altri”: più candidati minori non vengono più sommati come se fossero un unico candidato capace di vincere il Wahlkreis: OK;
- HTML: nessun ID duplicato, nessuna label con target mancante, link `_blank` con `noopener`: OK.

## 6. Limiti che restano

La v22 non elimina i limiti strutturali del modello:

- la calibrazione territoriale dispone soprattutto della transizione completa 2021→2025;
- candidato locale, incumbency, voto strategico e candidati futuri non sono osservati;
- CDU/CSU mantiene un rapporto nazionale ancorato alla struttura 2025 in assenza di un modulo bavarese autonomo;
- gli indipendenti non hanno ancora un'allocazione completa dei seggi come categoria separata; v22 evita però il falso vincitore creato dalla somma di tutti gli “Altri”;
- il forecast temporale amplia l'incertezza ma non prevede la direzione futura del consenso;
- campione, modalità di rilevazione e qualità dell'istituto non entrano ancora nel peso della media.

## Giudizio dopo la validazione

La v22 è adatta a essere presentata come **nowcast probabilistico — “se si votasse oggi”**. Il riparto nazionale e la gestione delle soglie sono le parti più solide. La geografia è ora un modello probabilistico gerarchico con una validazione esplicita, ma va ancora descritta come componente sperimentale e non come 299 sondaggi locali indipendenti.
