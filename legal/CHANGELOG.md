# Changelog della cartella legal/

Voce più recente in alto. Ogni voce: data, commit rivisto, cosa è cambiato e
perché.

## 2026-09-17 · rendiconto: pubblicazione facoltativa; A12 e I4 (§2.98)

Decisione di Cesare: pubblicare il rendiconto è una **possibilità** data
all'artista, non un obbligo, e non incide sul funzionamento. Nel codice l'impronta
va sempre on-chain e il file va su IPFS solo se la casella "Pubblica il
rendiconto" è spuntata (attiva di default) o più tardi dallo storico.
- **08 A-8:** punto 3 senza pubblicazione (l'artista conserva ed esibisce il
  file); nuovo punto 3-bis, pubblicazione facoltativa, non pubblicare non è
  inadempimento.
- **04 §5.7.2, 05 §3, 02 C-12, 01, 03 W-19, 06 §3:** allineati.
- **07 A12:** registrata la valutazione dell'utente (autorizzazione quasi certa);
  la domanda diventa quale autorizzazione e quali alternative.
- **07 I4:** da 🟠 a 🟢; nessun divieto noto (lettura rapida dei Termini
  DistroKid), resta un'avvertenza all'artista.

## 2026-09-17 · versamento delle royalty: chi versa, quando, su quale rendiconto (§2.98)

Decisione di Cesare: versa l'**artista** (incassa e converte in USDC) oppure la
**Piattaforma** dopo aver ricevuto il denaro dall'artista; frequenza variabile
**entro un intervallo fissato per token** nell'accordo artista; `statementRef` =
**hash del rendiconto**. Nel codice (commit `fd7f822`) `statementRef` era l'hash
di una frase: ora è lo SHA-256 del file (PDF, CSV, XLSX), pubblicato su IPFS e
collegato nello storico solo se l'impronta coincide. Il modulo è mostrato
all'artista e al wallet Founder.
- **02 §1 e C-12:** decisione e codice; restano aperti verifica del rendiconto,
  obbligo solo contrattuale, intervallo non ancora nel wizard.
- **04 §5.7.1-5.7.2:** chi versa, intervallo, rendiconto pubblicato.
- **05 §3:** la riga `royalty_deposits` descrive il file su IPFS, pubblico e di
  fatto permanente; oscurare dati bancari e di terzi.
- **06 §3, 01, 03 W-19:** testi allineati.
- **07:** nuove **A12** 🔴 (la Piattaforma che riceve e converte il denaro
  dell'artista: servizio di pagamento, MiCA, antiriciclaggio?) e **I4** 🟠
  (riservatezza dei rendiconti dei distributori).
- **08:** nuova clausola **A-8** (versamento delle royalty) e requisito **C-12**
  (intervallo per token nel wizard e sulla pagina).
`server/data/schema.js` cambia solo per le colonne del file del rendiconto:
impronte aggiornate.

## 2026-09-17 · milestone pagate solo in ordine (§2.96)

Il contratto escrow live paga una milestone quando ha le conferme e i fondi
coprono lei più quelle già pagate, **senza guardare l'ordine**: una milestone
successiva poteva essere pagata prima di una precedente non consegnata. Dal
17 set il sito nasconde la conferma finché la precedente non è pagata (PR #68);
il contratto di fase 2 rifiuta la conferma fuori ordine.
- **02 §1:** la riga `confirmMilestoneAs…` dice cosa verifica il contratto live e
  cosa verificherà quello di fase 2.
- **04 §5.3** e **08 A-5 (punto 2-bis):** l'ordine fissato dall'artista entra nei
  Termini e nell'accordo.
- **06 §2.2** non cambia: non descrive l'ordine e resta vera.
I contratti della fase 2 restano **non** rivisti nel loro insieme: le impronte
in `reviewed-files.sha256` non sono aggiornate, come nella voce sotto.

## 2026-09-17 (sera) · redeploy di fase 2: royalty, rimborsi per token, multisig (§2.97)

Revisione completa dei due contratti ridistribuiti (token `0xa619…82EF`, escrow
`0xc004…D368`), rimasti non rivisti dal §2.92. Proprietà dei tre contratti
passata al Safe `0xBA2a…245d` (2 su 3); il Founder è solo `operator`.
- **02:** intestazione, indirizzi, impronte, 112 test, ruoli; tabella §1 rifatta.
  C-1 aggiornato (serve il multisig). C-2 risolto in parte (motivo e hash on-chain,
  ma `NONE` ancora accettato). C-3 risolto nel contratto. C-4 `deadline` rimossa.
  **C-5 risolto** (rimborso per token con burn). C-9 risolto in parte. **C-12
  superato e alzato ad Alta**: il token ora paga royalty, non verificate. C-13:
  decisione di tenere titolo e artista on-chain.
- **01 §1 e §4:** il token dà un diritto economico on-chain; poteri del
  proprietario con 2 firme.
- **03:** nuove righe W-16…W-19 sul whitepaper, ora falso su rimborsi, motivo di
  annullamento, royalty e multisig. **Da applicare solo su richiesta** (GitBook).
- **04:** §2.2 (royalty su USDC di test), §5.2 (Owner e operatore), §5.3 (ordine
  verificato dal contratto), §5.4 riscritto (rimborso a chi possiede i token, con
  burn), nuovo §5.7 (royalty).
- **06 §2.1–§2.3 e scheda rischi:** rimborsi per token, versamenti non verificati.
- **07 A2** riformulata; **C6** aggiornata.
- **08 A-2 §3 e B-1(f):** nota di implementazione ora allineata al codice.

## 2026-09-17 · royalties e rimborsi di fase 2 nel backend e nel sito (§2.95)

Nuova tabella `royalty_deposits` in `schema.js`: copia dei versamenti di royalty
letti dalle ricevute on-chain, per lo storico nella pagina dell'asset.
- **05 §3:** nuova riga. Qui sì c'è l'indirizzo wallet di chi versa (già
  pubblico on-chain) e, facoltativo, il testo del rendiconto.
I contratti della fase 2 restano **non** rivisti: le loro impronte in
`reviewed-files.sha256` sono ancora le vecchie e `check.sh` continua a
segnalarli. La revisione completa va fatta nella PR del redeploy. Il codice di
backend e frontend riconosce da solo i contratti attuali e non cambia nulla
finché il redeploy non c'è.

## 2026-09-17 · storico prezzi dei token (§2.94)

Commit `94ae18f`. Nuove tabelle `token_trades` e `token_trade_scans` in
`schema.js`: copia degli scambi a pagamento letti dalle ricevute on-chain, per
il grafico nella pagina dell'asset.
- **05 §3:** nuova riga. Nessun indirizzo wallet salvato, ma l'hash della
  transazione porta ai wallet sulla blockchain pubblica.
- **06 §2.4 (nuovo):** avvertenza accanto al grafico, IT/EN, uguale al sito.
- **07 A4:** aggiunta la domanda se mostrare i prezzi fatti rafforzi la lettura
  del marketplace come sede di negoziazione. Nessuna nuova domanda 🔴: A4 lo era
  già.

## 2026-09-16 (notte) · email verificata alla registrazione, immagini e video (§2.93)

Revisione limitata ai file del §2.93 (`server/data/schema.js`,
`server/routes/compliance.routes.js`, `webapp/src/app/core/embedded-wallet.ts`).
I contratti della fase 2 (commit `0f819ec`) **non** sono rivisti qui: le loro
impronte in `reviewed-files.sha256` restano quelle vecchie, così `check.sh` li
segnala ancora.

- **05 §2, §3, §5:** nuove righe per l'email di registrazione (`registrations`,
  `email_verifications`, IP, firma) e per immagini e video su IPFS; Brevo tra i
  fornitori, con DPA art. 28 da firmare.
- **01 §7:** l'email verificata e Brevo si aggiungono ai dati raccolti senza
  titolare né termine di conservazione (07 H1 resta aperta e più urgente).
- **04 §8.4, 08 A-1-bis comma 1 (b):** audio, immagini e video, non solo audio.
- **08 C-11:** implementato, con i suoi limiti: blocco solo lato app per acquisto
  e contributo; non attivo finché Brevo non è configurato.
- Da notare per l'avvocato: le immagini e i video caricati dagli artisti sono
  pubblici e difficili da togliere da IPFS; la procedura di rimozione (§2.87)
  deve coprirli insieme all'audio. Il caricamento avverte di usare solo contenuti
  di cui si hanno i diritti.

## 2026-09-16 (notte) · banner del 06 §1 applicato; `index.html` solo meta SEO

- **06 §1:** il testo del banner è ora quello del sito (tecnico §2.91), anche in
  fondo alla landing. Senza link a Termini e Privacy, che non esistono ancora.
- **`index.html`:** aggiunti solo meta tag SEO, Open Graph e dati strutturati;
  l'immagine di anteprima è sul sito stesso. Nessuna risorsa esterna nuova, quindi
  05 §3–6 non cambia.
- Dal sito sono state tolte frasi non vere rispetto al codice ("verificati prima
  della quotazione", "pagati automaticamente con le royalty", "rimborso pro-rata se
  la campagna si blocca", "governance consultiva"). Nessun documento di `legal/` le
  citava.

## 2026-09-16 (notte) · domanda B8: chi è il titolare del progetto per il tetto ECSPR

- **07:** aggiunta B8 🔴. Il tetto ECSPR di 5 M€ in 12 mesi si calcola per
  titolare del progetto: con veicolo lussemburghese e un comparto per brano,
  se il titolare è il veicolo tutte le campagne si sommano in un solo tetto e
  la pre-produzione non scala. Collegata ad A7 (aggregazione per il prospetto),
  B1 e B6. Aggiunta all'elenco 🔴; riga di revisione aggiornata a `27d8d5f`.

## 2026-09-16 (sera) · nuovo file 09: confronto con ANote, SongVest, Royalty Exchange

- **09 (nuovo):** come le tre piattaforme hanno risolto la qualificazione
  giuridica, da fonti dirette (loro termini, Form 1-A di SongVest alla SEC).
  ANote dichiara che il *royalty interest* non è uno strumento finanziario MiFID
  e non è vigilata dalla CSSF; SongVest offre security con Reg A+ Tier 2;
  Royalty Exchange vende asset interi a un solo acquirente e ha annullato l'unico
  tentativo di frazionamento (Royalty Flow, 2018). Nessuna delle tre tocca il
  denaro degli investitori, nessuna finanzia brani non ancora pubblicati.
  Strategia a fasi proposta per Humfiverse (§7).
- **07:** aggiunte A10 (la tesi di ANote regge in Italia? e con un token?),
  A11 (autorizzazione CSSF per il veicolo che emette al pubblico in modo
  continuativo), B6 (veicoli dedicati nell'ECSPR), B7 🔴 (USDC di terzi
  nell'escrow). A10 e B7 aggiunte alle 🔴; 09 nel materiale da mandare.
- **README:** 09 nell'indice.

## 2026-09-16 · effetti del §2.89 su 01, 02 e 03

- **01 §6, 03 N-3:** le risposte KYC ora sono firmate dal wallet; resta
  un'autodichiarazione non verificata.
- **02 C-12:** i dati di royalty li inserisce solo il titolare dell'asset con una
  firma, ma restano non verificati rispetto agli incassi reali.

## 2026-09-16 · effetti dell'autorizzazione di lancio su 02 e 08

- **02 C-3:** lo studio ora è indicato e firmato dall'artista, ma artista = studio
  resta possibile. Il punto resta aperto.
- **08 C-5:** l'autorizzazione di lancio firmata (§2.88) è la base per la firma
  del wallet sull'accettazione dell'Accordo Artista; mancano versione del
  template e hash del testo nel messaggio firmato.

## 2026-09-16 (sera) · artista ≠ studio, royalty e verifica firmate

- **Codice (§2.89):** artista e studio devono avere wallet diversi (wizard,
  autorizzazione di lancio, servizio del backend; non ancora nel contratto). I
  dati di royalty li può scrivere solo il wallet proprietario dell'asset, con
  firma. La verifica dell'investitore è firmata dal suo wallet su un'impronta
  delle risposte, e lo stato pubblico dice solo verificato sì/no.
- **02 C-3:** segnata come risolta in parte. Il contratto accetta ancora
  artista = studio.
- **05 §3 e §5:** aggiunta la firma della verifica (solo l'impronta, non
  salvata); chiarito che l'esito non è più pubblico e che thirdweb riceve solo
  l'impronta.
- **Sicurezza:** B-2 e B-3 chiusi nella nota privata.

## 2026-09-16 · autorizzazione di lancio firmata dall'artista

- **Codice:** per creare una campagna il wallet dell'artista firma un testo con i
  dati del lancio (wallet che incassa, token, importo, studio, milestone); il
  backend lo verifica prima di far agire la chiave del Founder (technical §2.88).
  `embedded-wallet.ts` ora firma messaggi (`personal_sign`).
- **05:** nuova riga nel §3 per l'autorizzazione di lancio, non salvata nel
  database; nel §5 thirdweb riceve anche il testo dei messaggi firmati con il
  wallet integrato, perché la firma avviene sui suoi server. Da verificare
  l'informativa allo studio, i cui nome e wallet compaiono nel testo.
- **Sicurezza:** aggiornata solo la nota privata (fuori da git), come da regola.

## 2026-09-15 (notte) · whitepaper corretto, sezione backend privata

- **Whitepaper:** applicate le correzioni W-1…W-15 del file 03 e i rischi del file
  06 §3, adattati alle decisioni della sera (annullamento per motivi di legge,
  2% trattenuto, rimborso ai possessori dei token dopo la "phase 2", nessuna
  scadenza). Aggiornato anche il cap. 4 dove escludeva azioni contro l'artista.
- **02 §3 (backend):** spostata in `.claude/legal-private/backend-sicurezza.md`,
  fuori da git, perché il repo è pubblico. Tolti anche dagli altri file i
  dettagli sugli endpoint. Resta nella cronologia git dei commit `025e92e` e
  precedenti.
- **08 C-9, 07 A9:** la firma qualificata dell'artista serve anche con i comparti
  lussemburghesi, come prova della cessione con data certa; da confermare se è
  obbligatoria.

## 2026-09-15 (sera) · decisioni dell'utente

- **5 giorni** all'artista per rispondere prima dell'annullamento (08 A-1; 04 §5.6).
- **Il 2% sui contributi resta sempre alla piattaforma**; quando l'annullamento
  dipende dall'artista è compreso nel danno da chiedergli (08 A-2, A-3, B-1; 04
  §5.6; 02 C-11; 07 C4).
- **Rimborso e rivalsa a chi possiede i token** al momento dell'annullamento.
  Richiede il redeploy "phase 2"; fino ad allora il contratto rimborsa chi ha
  contribuito (08 A-2; 02 C-5; 07 C6).
- **L'artista firma con firma elettronica qualificata** (08 C-9; 07 C8).
  Motivazione dell'utente: l'artista costituisce di fatto un soggetto che emette
  titoli tramite la piattaforma. Aggiunta la domanda A9 su chi è l'emittente.
- 08 A-2 §4, C-11 e domanda C9: campagna annullata dopo il rilascio completo, e
  obbligo di raccogliere un'email (segnalati dall'altra sessione, §2.87).

## 2026-09-15 · commit `82a7a1b` (+ decisioni in `8d7040c`, `025e92e`, `9dc8e0b`)

Prima stesura, su richiesta di Cesare.

- **01** Normativa spiegata e collegata al codice: MiFID II/MiCA, prospetto
  (Listing Act), ECSPR, AIFMD, MTF/DLT Pilot, AML, GDPR, consumatori, sanzioni,
  USA, fisco, diritto d'autore/DSA, AI Act.
- **02** Controllo legale di token, escrow e marketplace (C-1…C-14) e del backend
  (sezione poi spostata in un file privato). Test: 94 passati.
- **03** Incoerenze tra codice e whitepaper (W-1…W-15), contratto artista
  (T-1…T-11), note legali, README.
- **04** Bozza di Termini di Servizio per il prototipo.
- **05** Bozza di informativa privacy sui dati realmente raccolti.
- **06** Avvertenze nel punto di pagamento (IT/EN) e rischi da aggiungere al
  whitepaper.
- **07** Domande per l'avvocato, per competenza e priorità.
- **08** Bozza di clausole per Accordo Artista e Accordo Investitore, e requisiti
  per l'accettazione.
- `check.sh`, `reviewed-files.sha256`, skill `legal-review`, sezione "Legal docs"
  in `CLAUDE.md`: meccanismo di aggiornamento.

Allineato durante la stesura a due decisioni dell'utente prese nella stessa
giornata:
- **Niente scadenze** per le campagne (technical-architecture §2.86).
- **Il Founder mantiene il potere di annullare** una campagna per contenuti
  illeciti o in violazione di diritti di terzi, con rimborso pro-quota della parte
  non rilasciata e azione degli investitori contro l'artista per il resto e per il
  danno, da inserire nei contratti accettati alla registrazione (note legali
  §7.10).

Nota: le bozze di README, 01, 02 e 03 sono finite per errore nei commit
`8d7040c` e `025e92e` di un'altra sessione, già pubblicati su
`origin/dev/cesare`, prima di essere complete. La versione valida è quella di
questo commit.
