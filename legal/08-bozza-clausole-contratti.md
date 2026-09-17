# Bozza di clausole: Accordo Artista, Accordo Investitore, accettazione

*Bozza del 2026-09-15, commit `82a7a1b`; A-5 aggiornata il 2026-09-17 (ordine delle milestone); A-8 e C-12 nuove il 2026-09-17 (versamento delle royalty, §2.98); A-6 aggiornata il 2026-09-17 (vendita diretta al 6%, 1% sulle royalty, §2.101). **Da far rivedere a un avvocato.** Non
è consulenza legale.*

Traduce in testo contrattuale la decisione del 15 settembre 2026 (note legali
§7.10) e le correzioni del file 03 (T-1…T-9). **Non è ancora nel codice.** Va
riportato in `server/contract-template.js`, nelle 5 lingue del template, e nel
flusso di registrazione.

**Scelte di stesura**
- **Legge:** il template attuale sceglie la legge lussemburghese con testo
  francese autorevole. Queste clausole sono scritte in italiano e citano norme
  italiane solo come riferimento di lavoro. L'avvocato deve adattarle alla legge
  scelta (domanda A6).
- **`[V]`** segna le clausole da approvare con una spunta separata (flag
  `vessatoria: true` nel template).
- **Termini definiti:** "**Piattaforma**" = il gestore di Humfiverse; "**Veicolo**"
  = il comparto che detiene i proventi, finché non esiste leggere "la
  Piattaforma"; "**Investitori**" = vedi A-2, comma 3.

---

## A. Accordo Artista

Sostituisce le clausole `manager-discretion`, `milestones` e `refund` e integra
`assignment` ed `exclusivity` del template v0.3-draft.

### A-1 · Annullamento della campagna `[V]`
*Sostituisce `manager-discretion` (T-1).*

1. La Piattaforma può annullare la Campagna, anche dopo il rilascio di una o più
   tranche, esclusivamente se:
   (a) il Brano o i materiali della Campagna hanno contenuto illecito;
   (b) il Brano o i materiali violano diritti d'autore, diritti connessi, diritti
   all'immagine o alla personalità, marchi o altri diritti di terzi, compreso
   l'uso di campioni non autorizzati, come risulta da una segnalazione
   circostanziata del titolare dei diritti, da un provvedimento di un'autorità o
   da una decisione giudiziaria;
   (c) una o più dichiarazioni e garanzie dell'Artista di cui alla clausola A-4
   risultano false o inesatte.
2. Prima dell'annullamento la Piattaforma comunica all'Artista, all'indirizzo
   email e al wallet indicati, i motivi e gli elementi su cui si basa, e gli
   concede 5 giorni per presentare osservazioni o rimuovere la violazione. Il
   termine non si applica quando la legge o un provvedimento dell'autorità
   impongono la rimozione immediata.
3. La decisione è scritta, motivata e datata, ed è comunicata all'Artista e agli
   Investitori della Campagna.
4. Le conferme delle milestone restano esclusivamente dell'Artista e dello Studio
   secondo la clausola A-5. La Piattaforma non ha il potere di confermarle o di
   sospenderle, se non annullando la Campagna nei casi del comma 1.
5. L'annullamento nei casi del comma 1 non costituisce inadempimento della
   Piattaforma o del Veicolo.

### A-1-bis · Rimozione dei contenuti `[V]`
*Nuova. Corrisponde ai requisiti tecnici di technical-architecture §2.87.*

1. Nei casi della clausola A-1, comma 1, la Piattaforma può, anche prima della
   decisione di annullamento se la legge o un'autorità lo impongono:
   (a) nascondere la pagina della Campagna, la scheda e le inserzioni di
   rivendita, indicando che il contenuto è stato rimosso e il motivo generale;
   (b) togliere il file audio, l'immagine e il video dal proprio servizio IPFS
   (Pinata) e cancellare il collegamento all'audio registrato nel contratto del
   token;
   (c) sostituire nome e immagine del token con un segnaposto neutro.
2. L'Artista riconosce che:
   (a) **le copie del file già scaricate o conservate da altri nodi o gateway
   IPFS possono restare accessibili** e la Piattaforma non può cancellarle;
   (b) **titolo del Brano e nome dell'Artista scritti nel contratto del token al
   momento della creazione restano per sempre** sulla blockchain.
3. La rimozione non pregiudica il rimborso agli Investitori (A-2), che resta
   accessibile dal loro portafoglio.

### A-2 · Effetti dell'annullamento e rimborso `[V]`
*Sostituisce `refund` (T-3).*

1. Con l'annullamento cessano i contributi e i rilasci di tranche.
2. Gli Investitori hanno diritto al rimborso, pro-quota in base ai token
   posseduti, dell'importo raccolto e non ancora rilasciato, calcolato e pagato
   dal contratto escrow. **La commissione di contribuzione del 2% resta in ogni
   caso alla Piattaforma e non è rimborsata tramite il contratto escrow.** Se
   l'annullamento dipende da un motivo della clausola A-1, comma 1, la commissione
   è parte del danno che l'Artista deve risarcire (A-3).
   *(Decisione del 2026-09-15.)*
3. Ai fini di questo Accordo sono Investitori **i possessori dei token della
   Campagna al momento dell'annullamento**, nella proporzione dei token posseduti.
   Chi ha venduto i propri token prima dell'annullamento non ha diritto al
   rimborso per quei token. *(Decisione del 2026-09-15.)*

   > **Nota di implementazione.** Dal 2026-09-17 l'escrow di fase 2
   > (`0xc004…D368`) rimborsa chi possiede i token e li brucia (file 02, C-5): il
   > codice è allineato a questa clausola. Il vecchio escrow (`0x16C8…721c`)
   > rimborsava i contributori, ma le sue due campagne sono concluse.
4. **Campagna già interamente rilasciata.** Se la Campagna viene annullata dopo
   il rilascio di tutte le tranche, non c'è nulla da rimborsare tramite il
   contratto escrow. Restano comunque applicabili la rimozione dei contenuti
   (A-1-bis) e gli obblighi di restituzione e risarcimento dell'Artista (A-3), per
   l'intero importo raccolto. [Da decidere, domanda C9: cosa rappresentano da quel
   momento i token della Campagna, se possono ancora essere rivenduti e come
   vanno indicati nel portafoglio.]
5. L'Artista riconosce che le campagne **non hanno scadenza**, che una tranche
   può essere rilasciata appena i fondi raccolti la coprono anche se l'obiettivo
   non è raggiunto, e che il mancato raggiungimento dell'obiettivo non dà di per
   sé luogo a rimborsi.

### A-3 · Restituzione delle tranche e risarcimento `[V]`
*Nuova (§7.10).*

1. Se la Campagna è annullata per un motivo della clausola A-1, comma 1, l'Artista
   è tenuto a:
   (a) restituire l'intero importo delle tranche già rilasciate, **comprese quelle
   pagate allo Studio**, al lordo delle commissioni trattenute;
   (b) risarcire ogni ulteriore danno subito dagli Investitori, dal Veicolo e
   dalla Piattaforma, **comprese le commissioni di contribuzione (2%) pagate
   dagli Investitori** e trattenute dalla Piattaforma, e le spese legali e di
   recupero.
2. Il rimborso della clausola A-2 non estingue né riduce questi obblighi.
3. [**Opzione, domanda C2.** L'Artista riconosce che il Veicolo, o la
   Piattaforma, è legittimato ad agire in nome e per conto degli Investitori per
   il recupero, in forza del mandato conferito dagli Investitori con l'Accordo
   Investitore (B-2), e che le somme recuperate sono ripartite tra gli Investitori
   pro-quota, al netto delle spese di recupero documentate.]
4. [**Opzione, domanda C2.** Clausola penale: in caso di annullamento per le lettere
   (b) o (c) della clausola A-1, comma 1, l'Artista corrisponde, oltre alla
   restituzione, una penale pari al [__]% dell'importo raccolto, salvo il
   risarcimento del maggior danno.]
5. [**Opzione, domanda C3.** Garanzie: trattenuta dell'ultima tranche fino a [__]
   mesi dall'uscita del Brano; compensazione con le royalty future spettanti
   all'Artista.]

### A-4 · Dichiarazioni, garanzie e manleva
*Nuova (T-8). Integra `ai-disclosure`.*

1. L'Artista dichiara e garantisce che:
   (a) il Brano è originale ed è titolare, o ha ottenuto, tutti i diritti
   necessari sulla composizione, sul testo, sulla registrazione e su ogni
   campione o contributo di terzi;
   (b) i proventi oggetto della cessione non sono già stati ceduti, dati in
   garanzia o affidati in esclusiva a terzi in modo incompatibile con questo
   Accordo, e indica qui i mandati in essere con società di gestione collettiva,
   editori, etichette o distributori: [__];
   (c) il Brano e i materiali non violano diritti di terzi né la legge;
   (d) le informazioni fornite, compresa la dichiarazione sull'uso di
   intelligenza artificiale, sono vere e complete;
   (e) il wallet `[indirizzo]` indicato per gli incassi e per la conferma delle
   milestone è sotto il suo controllo esclusivo.
2. L'Artista tiene indenni la Piattaforma, il Veicolo e gli Investitori da ogni
   pretesa, danno, costo e spesa, comprese le spese legali, derivanti dalla
   violazione di queste garanzie.

### A-5 · Milestone e tranche
*Sostituisce `milestones` (T-2).*

1. I contributi sono custoditi nel contratto escrow `[indirizzo]`. Ogni tranche è
   rilasciata dal contratto quando **l'Artista e lo Studio** confermano la
   milestone dai rispettivi wallet. [Se la Campagna non ha uno Studio, basta la
   conferma dell'Artista.]
2. Le tranche contrassegnate "Studio" sono pagate al wallet dello Studio; le
   altre al wallet dell'Artista.
2-bis. Le milestone si rilasciano **nell'ordine stabilito dall'Artista alla
   creazione della Campagna**. Una milestone non può essere confermata finché
   quella precedente non è stata pagata, qualunque sia l'importo raccolto.
3. L'Artista si impegna a confermare una milestone solo quando è effettivamente
   raggiunta. Una conferma falsa è una violazione delle garanzie della clausola
   A-4.
4. Se Artista e Studio non confermano, i fondi restano nel contratto escrow
   finché la Campagna non si completa o non viene annullata.

### A-6 · Commissioni
*Nuova (T-4).*

La Piattaforma trattiene, tramite i contratti: il **6%** di ogni acquisto
diretto di un catalogo; il 2% di ogni contributo a una Campagna; il 3% di ogni
tranche rilasciata; l'**1%** di ogni versamento di royalty, prima della
distribuzione; l'1% di ogni rivendita, a carico del venditore. Le commissioni
sono trattenute dall'importo, mai aggiunte, e le aliquote sono costanti nei
contratti: nessuno può cambiarle.

Le due aliquote sulla raccolta coprono percorsi diversi, non la stessa
operazione. Su 10.000 USDC raccolti:

| | Vendita diretta del catalogo | Campagna con milestone |
|---|---|---|
| Alla raccolta | 600 USDC (6%) | 200 USDC (2%) |
| Sul rilascio delle tranche | non applicabile | 294 USDC (3% di 9.800) |
| **Totale alla Piattaforma** | **600 USDC (6,00%)** | **494 USDC (4,94%)** |
| **All'Artista (e allo Studio)** | **9.400 USDC** | **9.506 USDC** |

Sulle royalty: di ogni 1.000 USDC versati, 10 restano alla Piattaforma e 990
sono divisi fra tutti i token esistenti. L'1% si applica all'intero versamento,
**compresa la quota dei token invenduti**, che torna all'Artista.

### A-7 · Esclusiva `[V]`
*Modifica `exclusivity` (T-7).*

Per tutta la durata della cessione dei proventi, e non solo della Campagna,
l'Artista si impegna a non cedere, dare in garanzia o affidare in esclusiva a
terzi gli stessi proventi.

### A-8 · Versamento delle royalty
*Nuova (decisione del 2026-09-17; 02 C-12).*

1. L'Artista versa sul contratto del Token, in USDC, i proventi royalty oggetto
   della cessione, in uno dei due modi seguenti, a sua scelta per ogni
   versamento:
   (a) li incassa, li converte in USDC e li versa direttamente;
   (b) li trasferisce alla Piattaforma, che li converte e li versa entro [__]
   giorni lavorativi dalla ricezione **[dipende dalla domanda 07 A12]**. Costi e
   cambio della conversione: [a carico dell'Artista / dei proventi], al cambio del
   giorno della conversione **[verificare]**.
2. **Frequenza.** I versamenti avvengono con cadenza non inferiore a [__] e non
   superiore a [__] mesi, fissata per questo Token nella scheda della Campagna.
   In ogni caso l'Artista versa entro [__] giorni da quando riceve un rendiconto
   con proventi superiori a [__] USDC.
3. **Rendiconto.** Ogni versamento corrisponde a un rendiconto del distributore o
   dell'ente di gestione, integrale per il periodo e per il Brano. Al momento del
   versamento l'Artista lo seleziona nel sito e la sua impronta SHA-256 è scritta
   sulla blockchain. L'Artista conserva il file e lo esibisce su richiesta della
   Piattaforma o del Veicolo.
3-bis. **Pubblicazione facoltativa.** L'Artista **può** pubblicare il rendiconto
   nel sito, al versamento o in seguito. Prima di farlo verifica che i propri
   contratti con distributori, etichette o enti di gestione lo consentano, e
   oscura i propri dati bancari e i dati personali di terzi, senza modificare
   periodi, quantità e importi. La mancata pubblicazione non è inadempimento.
4. Un versamento inferiore ai proventi del rendiconto, un rendiconto alterato o il
   mancato versamento nei termini del punto 2 sono inadempimento grave ai sensi
   della clausola A-3 **[verificare il rinvio]**.
5. L'Artista prende atto che il contratto divide ogni versamento su tutti i token
   esistenti, compresi quelli invenduti, la cui quota spetta a lui (04 §5.7).

---

## B. Accordo Investitore

Oggi non esiste. È accettato alla registrazione insieme ai Termini di Servizio
(file 04, §15).

### B-1 · Conoscenza dei rischi e del funzionamento `[V]`

L'Investitore dichiara di aver letto e compreso che:
(a) nel prototipo i token non hanno valore e non danno diritto a royalty;
(b) le campagne non hanno scadenza e le tranche possono essere rilasciate con una
raccolta parziale;
(c) il 2% sui contributi resta alla Piattaforma in ogni caso, anche se la Campagna è
annullata, e può essere richiesto all'Artista come parte del danno;
(d) la Piattaforma può annullare una Campagna solo nei casi della clausola A-1
dell'Accordo Artista, riportata integralmente qui: [testo];
(e) con l'annullamento riceve solo la quota della parte non rilasciata, e il
recupero del resto dall'artista non è garantito;
(f) il rimborso spetta a chi possiede i token al momento dell'annullamento, in
proporzione ai token posseduti, che vengono distrutti con il rimborso.

### B-2 · Diritti verso l'artista `[V]`

1. Il rimborso della parte non rilasciata non comporta rinuncia ai diritti
   dell'Investitore verso l'Artista per la restituzione delle tranche rilasciate
   e il risarcimento del danno. L'Accordo Artista (clausola A-3) prevede questi
   obblighi anche a favore dell'Investitore, come terzo beneficiario (art. 1411
   c.c.) **[verificare lo strumento con l'avvocato]**.
2. [**Opzione, domanda C2.** L'Investitore conferisce al Veicolo, o alla
   Piattaforma, mandato con rappresentanza, revocabile per giusta causa, per
   agire nei confronti dell'Artista in suo nome per il recupero, con ripartizione
   pro-quota delle somme recuperate al netto delle spese documentate.
   L'Investitore può agire personalmente se il mandatario non avvia l'azione entro
   [90] giorni dall'annullamento.]

### B-3 · Nessuna consulenza, verifica dell'identità, Paesi esclusi

Rinvio ai Termini di Servizio §3, §7 e §12.

### B-4 · Legge e foro

Se l'Investitore è un consumatore: foro del luogo di residenza o domicilio.
Negli altri casi: [__].

---

## C. Requisiti per l'accettazione (per chi implementa)

Decisione §7.10: artisti e investitori accettano **alla registrazione**, che dal
§2.83 coincide con l'accesso Google, Apple o email o il primo collegamento del
wallet. Gli investitori accettano anche i Termini, con la spunta attiva solo dopo
aver scorso tutto il testo.

| # | Requisito | Perché |
|---|---|---|
| C-1 | Testo completo visibile in una finestra scorrevole; **spunta "Accetto" attiva solo dopo l'ultima riga** | Decisione dell'utente. Prova che il testo è stato visualizzato |
| C-2 | **Spunte separate per ogni clausola `[V]`**, oltre all'accettazione generale, anche queste dopo lo scorrimento | Art. 1341, comma 2, c.c. Il meccanismo esiste già nel wizard artista (§7.6) |
| C-3 | Elenco dei titoli delle clausole `[V]` richiamati accanto alle spunte, non solo "accetto le clausole vessatorie" | La giurisprudenza italiana chiede un richiamo specifico **[verificare]** |
| C-4 | **Registrare:** versione del template, lingua, data e ora (server), account (id thirdweb o email) e wallet, elenco delle spunte, **hash SHA-256 del testo mostrato**, IP | Senza questi dati l'accettazione non si dimostra. Oggi `contract_acceptances` non salva il wallet né l'hash del testo |
| C-5 | **Firma del wallet** (EIP-4361, "Sign-In with Ethereum") su un messaggio che contiene versione e hash | Collega l'accettazione al wallet che incassa o investe. Oggi `receipt_hash` è casuale. **Base già presente per l'artista** (technical §2.88): il wallet firma un'autorizzazione di lancio con wallet che incassa, token, importo, studio e milestone. Per farla valere anche come prova dell'accettazione basta aggiungere al testo firmato la versione del template e l'hash del testo accettato |
| C-6 | Copia scaricabile o inviata per email di quanto accettato | Obblighi informativi verso i consumatori; prova per l'utente |
| C-7 | **Nuova versione = nuova accettazione** al primo accesso successivo; le campagne già aperte restano regolate dalla versione accettata alla loro creazione | Evita di cambiare le regole a chi ha già partecipato, come per le commissioni `constant` |
| C-8 | Controllo lato server: niente acquisto, contributo o creazione di campagna senza accettazione valida registrata | Come già fa `validateContractAcceptance`. Resta il limite on-chain (02, C-6) |
| C-9 | **L'Artista firma l'Accordo con firma elettronica qualificata** (FEQ: Regolamento (UE) 910/2014 "eIDAS", art. 25, equivalente alla firma autografa in tutta l'UE; in Italia art. 21 CAD), tramite un prestatore di servizi fiduciari qualificato presente nella lista di fiducia UE. La firma avviene su un PDF del testo accettato, il cui hash è registrato come in C-4. La campagna non si crea senza firma valida. L'Investitore accetta con scorrimento, spunte e firma del wallet (C-1…C-5). *Decisione del 2026-09-15* | Motivazione dell'utente: l'Artista sta di fatto costituendo, tramite la Piattaforma, un soggetto che emette titoli. **La firma qualificata resta utile anche con i comparti del veicolo lussemburghese**, dove l'Artista non emette nulla ma cede i proventi al comparto: serve a provare una cessione con data certa, opponibile ai creditori dell'Artista, e valida in tutta l'UE, oltre agli obblighi di restituzione e risarcimento (A-3). Non risulta però obbligatoria per legge in nessuno dei due schemi **[verificare, domanda A9]** |
| C-11 | **Raccogliere e verificare un'email** di artisti e investitori alla registrazione, anche per chi usa MetaMask | Serve per l'avviso motivato all'artista e per informare gli investitori (A-1 §2-3). Oggi la piattaforma conosce solo il wallet **Implementato il 2026-09-16 (tecnico §2.93)**: codice di 6 cifre via Brevo a tutti, anche a chi entra con Google, Apple o email, più firma del wallet su indirizzo e id della verifica; richiesta prima di lanciare una campagna e prima della verifica investitore. Acquisto e contributo sono bloccati solo dall'app, non dal contratto (02, C-6). Non attiva finché Brevo non è configurato sul server |
| C-12 | **Intervallo dei versamenti per Token** (A-8, punto 2): raccolto nel wizard alla creazione della Campagna, salvato con l'accettazione e mostrato nella pagina dell'asset | L'investitore deve sapere quando aspettarsi le royalty; oggi il contratto e il sito non lo conoscono (02 C-12) |
| C-10 | Traduzioni: il testo autorevole è indicato e le altre lingue lo dicono (già presente) | Già in `legalBasisNote` |
