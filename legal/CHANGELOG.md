# Changelog della cartella legal/

Voce più recente in alto. Ogni voce: data, commit rivisto, cosa è cambiato e
perché.

## 2026-09-16 · effetti dell'autorizzazione di lancio su 02 e 08

- **02 C-3:** lo studio ora è indicato e firmato dall'artista, ma artista = studio
  resta possibile. Il punto resta aperto.
- **08 C-5:** l'autorizzazione di lancio firmata (§2.88) è la base per la firma
  del wallet sull'accettazione dell'Accordo Artista; mancano versione del
  template e hash del testo nel messaggio firmato.

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
