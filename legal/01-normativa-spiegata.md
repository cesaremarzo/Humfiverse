# La normativa che riguarda Humfiverse, spiegata

*Revisione del 2026-09-15, commit `82a7a1b`. Non è consulenza legale.*

Questo documento non ripete `planning/legal-regulatory-notes.md`, che resta la
ricerca di partenza. Lo riorganizza in una mappa unica e aggiunge le aree che
quelle note non coprono: privacy, antiriciclaggio in pratica, consumatori,
sanzioni, fisco, diritto d'autore e AI. Soprattutto collega ogni norma a una
funzione precisa del codice, perché le domande all'avvocato vanno fatte sul
prodotto che esiste, non su quello immaginato.

Le cifre e le date normative sono aggiornate alle fonti disponibili a metà
2026. Dove una soglia o una data può essere cambiata, è segnato **[verificare]**.

---

## 0. La mappa in una pagina

```
                     Il token dà diritto a una quota di royalty?
                                     │
                    ┌────────────────┴────────────────┐
                   SÌ                                  NO (puro collezionabile)
                    │                                  │
         Strumento finanziario                  Cripto-attività MiCA
         (MiFID II, Prospetto,                  (white paper MiCA, CASP
          ECSPR se crowdfunding,                 per custodia e scambio)
          DLT Pilot per il mercato)                    │
                    │                                  │
                    └────────────────┬─────────────────┘
                                     │
          Valgono comunque, in ogni caso:
          antiriciclaggio · GDPR · tutela dei consumatori · sanzioni UE ·
          fisco (DAC8) · diritto d'autore e diritti connessi · AI Act (trasparenza)
          · se si raccolgono fondi in comune e li si gestisce: AIFMD
```

La decisione del 28 agosto 2026, nelle note interne al §7, è trattare il token
come **strumento finanziario MiFID II**, con un veicolo di cartolarizzazione
lussemburghese. È un'ipotesi di lavoro che l'avvocato non ha ancora confermato,
ed è la domanda n. 1 del file 07.

**Il codice di oggi va però in un'altra direzione** (dettagli nel file 02):

- il token è un ERC-1155 trasferibile da chiunque a chiunque;
- il ricavato della vendita va direttamente nel wallet dell'artista, senza
  passare da un veicolo;
- il KYC è solo una schermata del sito, e i contratti non lo verificano;
- esiste un marketplace per la rivendita tra utenti che trattiene l'1%.

Ognuno di questi punti conta nella classificazione, non solo come dettaglio
tecnico.

---

## 1. È uno strumento finanziario? (MiFID II contro MiCA)

**Le norme:** Direttiva 2014/65/UE (MiFID II), art. 4(1)(15) e (44) e Allegato I
sez. C. Regolamento (UE) 2023/1114 (MiCA), art. 2(4)(a), che esclude dal proprio
ambito gli strumenti finanziari. Le linee guida ESMA sulla qualificazione delle
cripto-attività come strumenti finanziari.

**In parole semplici.** L'UE guarda a *cosa dà* il token, non a come lo si
chiama. Un token negoziabile che dà diritto a una parte dei ricavi di un'attività
somiglia a un'obbligazione o a un titolo partecipativo, cioè a un "valore
mobiliare". In quel caso MiCA non si applica e valgono le regole sui titoli:
MiFID II, prospetto, abusi di mercato. Se invece il token non desse alcun
diritto economico, sarebbe una cripto-attività MiCA, con regole diverse ma
comunque impegnative.

**Come si applica al codice:**

- Dal 2026-09-17 (fase 2) `HumfiverseCatalogueToken` **paga royalty**: chiunque
  può versare USDC per un token, il contratto li divide in parti uguali su tutti
  i token esistenti e ogni possessore riscuote la sua quota (02, C-12). Il token
  *on-chain* quindi **dà già un diritto economico**, anche se oggi solo con USDC
  di test senza valore. Quanto viene versato dipende da chi versa (l'artista, o
  la Piattaforma per suo conto): ogni versamento indica il file del rendiconto,
  pubblicato, ma il contratto non lo collega agli incassi reali del brano.
- È proprio questo il rischio: un regolatore valuta la sostanza dell'offerta
  nel suo insieme (sito, whitepaper, testi della pagina campagna), non solo il
  contratto Solidity. Dire "compri una quota di royalty" basta a spostare la
  qualificazione verso lo strumento finanziario, e ora anche il contratto
  Solidity la distribuzione la fa davvero.
- La **negoziabilità** conta: ERC-1155 è liberamente trasferibile e il
  marketplace lo rende negoziabile in pratica. È uno degli elementi della
  definizione di valore mobiliare.

**Cosa chiedere:** file 07, domande A1–A3.

## 2. Offerta al pubblico e prospetto

**Le norme:** Regolamento (UE) 2017/1129 (Prospetto), modificato dal Listing Act
(Regolamento (UE) 2024/2809). In Italia il TUF (D.Lgs. 58/1998) e il Regolamento
Emittenti CONSOB. In Lussemburgo la Loi du 16 juillet 2019 relative aux
prospectus.

**In parole semplici.** Chi offre titoli al pubblico deve pubblicare un
prospetto approvato dall'autorità, salvo esenzioni: offerta sotto una certa
soglia in 12 mesi, solo a investitori qualificati, meno di 150 persone per
Stato, taglio minimo elevato.

**Punto da verificare.** Le note interne (§7.1.1) citano la soglia italiana di
**8 milioni di euro**. Il Listing Act ha armonizzato l'esenzione a **12 milioni
di euro** per offerente in 12 mesi, con la possibilità per gli Stati di fissare
una soglia più bassa, e un documento informativo ridotto sotto soglia.
**[verificare]** quale soglia vale oggi in Italia e in Lussemburgo, e da
quando.

**Come si applica al codice.** Ogni token id ha un `fundingOf` (prezzo ×
offerta) scelto dall'artista nel wizard, senza tetto. Il contratto non impedisce
che un solo artista, o molte campagne dello stesso "programma" Humfiverse,
superino una soglia. Resta aperta la questione dell'aggregazione tra veicoli
diversi (note §7.1.1).

## 3. Crowdfunding (ECSPR)

**Le norme:** Regolamento (UE) 2020/1503 (ECSPR). In Italia la CONSOB è
l'autorità competente e ha un proprio regolamento sul crowdfunding.

**In parole semplici.** Una piattaforma che mette in contatto chi cerca fondi per
un progetto con investitori può chiedere un'autorizzazione europea come
"fornitore di servizi di crowdfunding". L'autorizzazione è più leggera di una SIM
e vale in tutta l'UE. I limiti sono stringenti:

- massimo **5 milioni di euro** per titolare del progetto in 12 mesi;
- solo alcuni strumenti ammessi: valori mobiliari, strumenti ammessi a fini di
  crowdfunding, prestiti;
- per gli investitori non sofisticati: test di ingresso, simulazione della
  capacità di sostenere perdite, avvertenze, **periodo di riflessione di 4
  giorni** in cui l'investitore può ritirarsi senza penali;
- scheda informativa (KIIS) per ogni progetto;
- il fornitore non può gestire i fondi come se fossero propri: servono un
  prestatore di servizi di pagamento o un conto separato.

**Come si applica al codice.** È il quadro più vicino al modello *pre-produzione*
(escrow a milestone), ma il codice oggi non rispetta alcuni suoi requisiti:

- **Periodo di riflessione.** `contribute()` rilascia i token nello stesso
  istante in cui arriva il pagamento, e il 2% di commissione non è mai
  rimborsabile. Il ripensamento entro 4 giorni non è previsto.
- **Obiettivo non raggiunto.** Nel crowdfunding tipico, se l'obiettivo non viene
  raggiunto entro la scadenza i soldi tornano indietro. Humfiverse ha **deciso di
  non avere scadenze** (§2.86): una campagna finisce solo se vende tutto, se
  rilascia tutto o se viene annullata, e le prime tranche possono essere
  rilasciate anche se la raccolta si ferma al 30%. È una scelta di prodotto
  legittima, ma va dichiarata con chiarezza e verificata con l'avvocato se si
  punta all'ECSPR (domanda B3).
- **Chi custodisce i fondi.** I fondi stanno in un contratto di cui il Founder è
  `owner`. Serve capire se un escrow on-chain possa sostituire il prestatore di
  servizi di pagamento o il conto separato che ECSPR richiede.

## 4. Fondi di investimento alternativi (AIFMD)

**Le norme:** Direttiva 2011/61/UE (AIFMD), modificata dalla Direttiva (UE)
2024/927 (AIFMD II).

**In parole semplici.** Se si raccolgono soldi da più investitori e li si
investe secondo una politica definita, nell'interesse loro, si rischia di essere
un fondo. Un fondo richiede un gestore autorizzato, un depositario e molta
compliance.

**Come si applica al codice.** Le note interne (§4.1.1) e il whitepaper (cap. 5)
sostengono che Humfiverse non gestisce, perché non conferma le milestone. È vero
per la *conferma*. Ma il proprietario dei contratti (`owner()`) ha anche altri poteri che un
avvocato potrebbe considerare discrezionali. Dal 2026-09-17 questi poteri sono di
un Safe con 2 firme su 3 (Cesare, Co-founder, una chiave di riserva), e la
chiave del backend ha solo quelli di routine (02, C-9):

- `cancelCampaign`: ferma una campagna in qualsiasi momento, anche a metà, e
  apre i rimborsi. Per decisione (note legali §7.10) questo potere resta, ma va
  limitato per contratto a motivi di legge: contenuti illeciti o violazione di
  diritti di terzi. Così diventa un atto di conformità, non una scelta di
  investimento. Il contratto di fase 2 registra motivo e hash della decisione, ma
  accetta ancora l'annullamento senza motivo finché resta una tranche da pagare;
- `registerStudio` / `setStudioActive` / `renameStudio`: sceglie quali studi sono
  ammessi;
- `releaseFromPool`: consegna token del pool senza pagamento;
- `createCampaign`: decide quali campagne esistono.

A parte le due firme richieste e la registrazione del motivo, nessuno di questi
poteri è limitato da regole scritte nel contratto. L'argomento
"nessuna discrezionalità" regge solo se questi poteri sono vincolati da
documenti costitutivi o da regole codificate. Vedi il file 02, C-1 e C-2.

## 5. Mercato secondario (MTF/OTF e DLT Pilot)

**Le norme:** MiFID II, Titolo II (sistemi multilaterali di negoziazione).
Regolamento (UE) 2022/858 (DLT Pilot Regime).

**In parole semplici.** Chi gestisce un sistema che fa incontrare *più* interessi
di acquisto e vendita di strumenti finanziari, secondo regole non
discrezionali, gestisce una sede di negoziazione (MTF o OTF). Serve
un'autorizzazione pesante. Il DLT Pilot Regime offre un percorso sperimentale
per sedi di negoziazione e regolamento su blockchain.

**Come si applica al codice.** Il whitepaper (cap. 2 e 5) sostiene che la
rivendita è "come un annuncio, non una borsa", perché i prezzi non si muovono da
soli. Il limite di questo argomento: la definizione di sistema multilaterale non
richiede un prezzo algoritmico. `HumfiverseMarketplace` fa incontrare venditori e
compratori terzi con regole fisse, esegue lo scambio e **trattiene l'1%**. Le
note §7.8 dicevano che il mercato secondario sarebbe stato solo *simulato*: oggi
invece è un contratto reale (commit §2.59). È la domanda A4 del file 07.

Il contratto accetta inoltre **qualsiasi** indirizzo ERC-1155 (`list(address
token, ...)`), non solo i token Humfiverse. Chiunque potrebbe mettere in vendita
sul marketplace Humfiverse un token qualunque.

## 6. Antiriciclaggio (AML/KYC)

**Le norme:** Direttiva (UE) 2015/849 e successive; Regolamento (UE) 2024/1624
(AMLR), che si applica dal 10 luglio 2027; Regolamento (UE) 2023/1113 (Transfer
of Funds, "travel rule" per le cripto-attività). In Italia il D.Lgs. 231/2007.

**In parole semplici.** Intermediari finanziari, piattaforme di crowdfunding e
prestatori di servizi per le cripto-attività devono identificare i clienti,
verificare l'identità con documenti, controllare le liste PEP e sanzioni,
conservare i dati (in genere 10 anni in Italia **[verificare]**) e segnalare le
operazioni sospette.

**Come si applica al codice:**

- Il KYC di Humfiverse è un **modulo auto-dichiarato**: nome, data di nascita,
  nazionalità, origine dei fondi, PEP sì/no. Nessun documento viene verificato e
  nessuna lista viene controllata (`compliance.service.js`).
- È applicato **solo dal sito** (`asset-detail.component.html`). Chiunque può
  chiamare `buy()`, `contribute()`, `buyListing()` o
  `safeTransferFrom` direttamente sul contratto, senza aver mai visto il sito.
- Dal §2.89 il wallet firma le risposte inviate, quindi chi compila il modulo
  dimostra di controllare quel wallet. Resta un'autodichiarazione: la firma non
  prova che nome e data di nascita siano veri.
- Per un prototipo su testnet va bene. Per un lancio reale non basta: servono
  un fornitore KYC vero e un token "permissioned" (le note tecniche §2.4 citano
  ERC-3643), cioè trasferibile solo tra wallet verificati.

## 7. Privacy (GDPR)

**Le norme:** Regolamento (UE) 2016/679 (GDPR); D.Lgs. 196/2003 come modificato;
linee guida EDPB 02/2025 sul trattamento dei dati personali con tecnologie
blockchain.

**In parole semplici.** Chi decide perché e come si trattano dati personali
(il *titolare*) deve avere una base giuridica, informare le persone, raccogliere
solo il necessario, proteggere i dati, stabilire per quanto tempo tenerli,
permettere accesso e cancellazione, e regolare i trasferimenti fuori dall'UE.
Un indirizzo wallet collegato a un nome è un dato personale, e con esso tutta la
storia pubblica delle sue transazioni.

**Come si applica al codice. È l'area più urgente, perché il sito è già online
e raccoglie dati adesso:**

- `kyc_records` conserva **nome completo, data di nascita, nazionalità, origine
  dei fondi, stato PEP, wallet**. Sono dati reali, se l'utente li inserisce
  davvero, raccolti da un prototipo senza società titolare, senza informativa
  privacy e senza termine di conservazione.
- L'**origine dei fondi** e lo **stato PEP** sono dati delicati: non sono
  "categorie particolari" dell'art. 9, ma hanno un rischio elevato.
- Dal §2.93 il backend conserva anche l'**email verificata** di ogni wallet
  registrato (`registrations`) e lo storico dei codici inviati
  (`email_verifications`, con IP), inviati tramite **Brevo**. Stesso problema dei
  dati di verifica: nessun titolare, nessuna informativa definitiva, nessun
  termine di conservazione. La finestra di registrazione lo dice all'utente.
- **Blockchain e IPFS non si cancellano.** Nome artista e titolo sono scritti
  on-chain (`artistName`, `trackTitle`) e l'audio è fissato su IPFS tramite
  Pinata. Il diritto alla cancellazione (art. 17) non si può esercitare su quei
  dati. Le linee guida EDPB chiedono di non scrivere dati personali on-chain se
  non è indispensabile.
- **Fornitori extra-UE:** thirdweb (login Google, Apple, email, wallet
  integrato), Render (backend, regione non indicata in `render.yaml`), Turso
  (database), Pinata (IPFS), Alchemy (RPC, vede IP e wallet), Google Fonts
  (caricati da `fonts.googleapis.com`, che trasmette a Google l'IP del
  visitatore; un tribunale tedesco, LG München I, 20.1.2022, lo ha ritenuto
  illecito senza consenso), GitHub Pages, Netlify.
- Serve un **accordo sul trattamento dei dati (DPA, art. 28)** con ognuno, e
  una base per il trasferimento (EU-US Data Privacy Framework o clausole
  contrattuali standard).
- Probabilmente serve una **valutazione d'impatto (DPIA, art. 35)**: i dati
  finanziari e di identità, uniti a una tecnologia nuova, rientrano nei criteri
  EDPB.

**Raccomandazione pratica immediata (non serve un avvocato per farla):** finché
non esiste una società titolare e un'informativa, il modulo KYC del prototipo
dovrebbe dire chiaramente di inserire **dati di prova, non veri**, oppure non
salvarli affatto. Bozza di informativa nel file 05.

## 8. Tutela dei consumatori

**Le norme:** Direttiva 93/13/CEE (clausole abusive); Direttiva 2011/83/UE come
modificata dalla Direttiva (UE) 2023/2673 (contratti di servizi finanziari a
distanza, applicabile da giugno 2026 **[verificare]**); in Italia il Codice del
Consumo (D.Lgs. 206/2005); in Lussemburgo il Code de la consommation. European
Accessibility Act (Direttiva (UE) 2019/882), dal 28 giugno 2025, per alcuni
servizi digitali ai consumatori.

**In parole semplici.** Il consumatore non può essere vincolato a clausole che
creano uno squilibrio a suo danno (esclusioni di responsabilità ampie, foro
lontano, penali). Se compra servizi finanziari a distanza ha diritto a
informazioni precontrattuali e, in molti casi, a recedere entro 14 giorni.

**Come si applica al codice:**

- Gli **investitori** sono per lo più consumatori. Oggi non hanno Termini di
  Servizio da accettare: l'unico contratto nel codice è quello dell'artista.
- La commissione del 2% non rimborsabile e l'assenza di recesso (token
  consegnati subito, fondi in escrow) vanno confrontate con il diritto di
  recesso.
- Il **contratto artista** fissa il foro esclusivo in Lussemburgo. Un artista che
  è una persona fisica e non agisce come professionista potrebbe essere
  considerato consumatore: la clausola lo riconosce ("salva la giurisdizione
  inderogabile del consumatore"), ma va verificato.

## 9. Sanzioni internazionali

**Le norme:** Regolamento (UE) 833/2014 e successivi pacchetti (Russia);
Regolamento (UE) 269/2014 (congelamento di beni); liste OFAC per gli USA.

**In parole semplici.** È vietato mettere fondi o risorse economiche a
disposizione di persone presenti nelle liste sanzioni. Nei confronti di
cittadini e residenti russi valgono anche divieti specifici su servizi di
cripto-attività e sulla vendita di valori mobiliari **[verificare quali articoli
si applicano]**.

**Come si applica al codice.** Il sito è tradotto in **russo** (`ru.json`), il
KYC non controlla le liste sanzioni e i contratti non bloccano nessun indirizzo.
Tradurre il sito in una lingua è un indizio di un pubblico a cui ci si rivolge.
Da valutare prima di qualsiasi lancio con valore reale.

## 10. Stati Uniti e altri Paesi fuori UE

**In parole semplici.** Il sito è raggiungibile da tutto il mondo e tradotto in 9
lingue, tra cui cinese, giapponese e arabo. Negli USA un token che dà royalty è
quasi certamente un *security* secondo il test Howey, e offrirlo a residenti
statunitensi senza registrazione o esenzione espone a sanzioni SEC. La prassi è
bloccare per area geografica e dichiarare nei Termini chi è escluso
(Regulation S).

## 11. Fisco

**Le norme:** Direttiva (UE) 2023/2226 (DAC8, comunicazione delle operazioni in
cripto-attività dal 1° gennaio 2026). In Italia la Legge di Bilancio 2025 ha
portato al 33% dal 2026 l'aliquota sulle plusvalenze da cripto-attività
**[verificare]**; i redditi da strumenti finanziari sono in genere al 26%.

**In parole semplici.** La natura del token decide anche come vengono tassati i
guadagni dell'investitore: cripto-attività o strumento finanziario, royalty come
reddito di capitale o reddito diverso. Decide anche quali obblighi di
comunicazione ha la piattaforma. La **commissione di Humfiverse** (2%, 3%, 1%) è
un ricavo della società, e l'IVA sui servizi di intermediazione finanziaria può
essere esente o no a seconda della qualificazione. Serve un commercialista o un
tributarista, non solo l'avvocato.

## 12. Diritto d'autore, diritti connessi e contenuti caricati

**Le norme:** L. 633/1941 (legge sul diritto d'autore); D.Lgs. 35/2017 (gestione
collettiva); Regolamento (UE) 2022/2065 (Digital Services Act) per chi ospita
contenuti caricati dagli utenti.

**In parole semplici.** Un brano ha due diritti distinti: la composizione
(autori ed editori) e la registrazione (master, produttore). Le royalty arrivano
da canali diversi: SIAE o altre società di gestione collettiva, distributori,
DSP. Chi ospita file caricati dagli utenti deve reagire alle segnalazioni di
violazione.

**Come si applica al codice:**

- `POST /api/onchain/audio/:assetId` carica l'audio su IPFS tramite Pinata e
  scrive il CID on-chain. Se un utente carica un brano non suo, il file resta
  raggiungibile da qualsiasi gateway IPFS anche se Humfiverse lo "rimuove".
  Serve una procedura di segnalazione e rimozione (DSA, art. 16) e servono
  garanzie dell'artista nel contratto.
- Il contratto artista (`assignment`) cede i "proventi royalty" senza
  distinguere tra composizione e master, né tra i canali di incasso. Vedi file 03.

## 13. Intelligenza artificiale

**Le norme:** Regolamento (UE) 2024/1689 (AI Act), art. 50 (obblighi di
trasparenza sui contenuti generati), applicabile dal 2 agosto 2026
**[verificare l'ambito per chi pubblica, non genera]**.

**Come si applica.** Il modello pre-produzione accetta bozze generate con AI, e
contratto e whitepaper prevedono una dichiarazione sull'uso di AI. È coerente con
la direzione normativa. Resta da capire chi porta la responsabilità se la
dichiarazione è falsa e un DSP smette di pagare i diritti.

## 14. Responsabilità dei partecipanti (DAO e governance)

Già trattata bene nelle note interne (§4, caso *Samuels v. Lido DAO*, N.D. Cal.
2024). Oggi non c'è governance on-chain, quindi il rischio è rimandato.

---

## Riepilogo: cosa pesa di più, adesso

| # | Tema | Perché adesso | Chi serve |
|---|---|---|---|
| 1 | **Privacy dei dati KYC già raccolti** | Il sito è online e raccoglie dati reali senza titolare né informativa | Privacy / DPO |
| 2 | **Qualificazione del token** | Decide tutto il resto; il codice attuale (token trasferibile, marketplace, pagamento diretto all'artista) va in una direzione diversa dalle note | Avvocato mercati finanziari (LU + IT) |
| 3 | **Marketplace reale con commissione** | Le note dicevano "solo simulato"; oggi è un contratto funzionante | Come sopra |
| 4 | **Poteri del Founder** | Contraddicono in parte l'argomento "nessuna discrezionalità" (AIFMD) e alcune frasi del whitepaper | Come sopra |
| 5 | **Whitepaper pubblico non allineato** | Informazioni inesatte in un documento pubblico (file 03) | Team, poi avvocato |
| 6 | Fisco, sanzioni, diritto d'autore | Da impostare prima del lancio reale | Tributarista, IP/musica |
