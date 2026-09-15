# Domande per l'avvocato

*Revisione del 2026-09-15, commit `82a7a1b`.*

Le domande vengono dai file 01-03 e dalle decisioni già prese (note legali §7,
§7.10; technical-architecture §2.86). Sostituiscono e ampliano l'elenco del §6
delle note legali, che resta valido. Ogni domanda rimanda al punto che la
motiva, così l'avvocato può controllare da solo.

## Come usarlo

1. **Non serve un solo avvocato.** Le domande sono raggruppate per competenza.
   Il primo incontro, e il più importante, è con chi segue i mercati finanziari
   (gruppi A, B, C). Da lì dipende quasi tutto il resto.
2. **Priorità:** 🔴 da chiarire prima di andare avanti con lo sviluppo del
   modello · 🟠 prima di qualsiasi lancio con valore reale · 🟢 da impostare,
   non urgente.
3. **Mandate il materiale prima dell'incontro** (elenco in fondo): un'ora spesa
   a leggere costa meno di un'ora spesa a spiegare.
4. Chiedete sempre **quanto costa e quanto tempo richiede** ogni strada
   indicata.

---

## Gruppo A · Mercati finanziari: cosa è il token e chi lo emette
*Avvocato di diritto dei mercati finanziari e fintech, con esperienza in
Lussemburgo (CSSF) e Italia (CONSOB).*

- **A1** 🔴 Un token che rappresenta una quota delle royalty future di un brano,
  trasferibile e rivendibile, è uno **strumento finanziario** (valore mobiliare)
  ai sensi di MiFID II, e quindi fuori da MiCA? Esiste una struttura credibile
  che cambi la risposta, e a quale prezzo commerciale? *(01 §1)*
- **A2** 🔴 Oggi il token on-chain non paga nulla: le royalty sono solo
  promesse da sito, whitepaper e contratto. Ai fini della qualificazione conta il
  contratto Solidity o l'offerta nel suo insieme? Il whitepaper pubblico può già
  essere letto come comunicazione promozionale di un'offerta? *(01 §1, 02 C-12)*
- **A3** 🟠 Serve che il token sia trasferibile solo tra wallet verificati
  (ERC-3643 o simili), o bastano restrizioni contrattuali? *(02 C-6)*
- **A4** 🔴 `HumfiverseMarketplace` fa incontrare venditori e compratori terzi
  con regole fisse ed esecuzione automatica, a prezzo scelto dal venditore, e
  trattiene l'1%. È un **sistema multilaterale** (MTF/OTF)? Regge l'argomento "è
  un annuncio, non una borsa"? Cosa cambia se togliamo la commissione, se
  accettiamo solo token Humfiverse, o se usiamo il DLT Pilot Regime? *(01 §5, 02
  C-7)*
- **A5** 🔴 Nel codice il ricavato va **direttamente al wallet dell'artista**,
  senza veicolo. In questo schema chi è l'**emittente**? Humfiverse sta
  prestando un servizio di collocamento o di ricezione e trasmissione ordini?
  Come dev'essere il flusso giuridico (artista → comparto del veicolo di
  cartolarizzazione → investitori) e cosa deve cambiare nel codice? *(02 C-8)*
- **A6** 🟠 Il veicolo lussemburghese (legge del 22 marzo 2004) resta la scelta
  giusta rispetto a un veicolo italiano che usi il Decreto FinTech (D.L. 25/2023)
  per l'emissione su registro distribuito? Quale lingua deve prevalere nei
  contratti, francese o inglese? *(note §7.7)*
- **A7** 🟠 Quale soglia di esenzione dal prospetto vale oggi in Italia e in
  Lussemburgo dopo il **Listing Act** (Reg. 2024/2809)? La soglia si calcola per
  comparto o per l'intero programma Humfiverse (aggregazione)? *(01 §2, note
  §7.1.1)*
- **A8** 🟠 **AIFMD.** Il Founder oggi può: creare campagne, scegliere gli studi
  ammessi, annullare campagne (per decisione, solo per motivi di legge, §7.10) e
  consegnare token senza pagamento. Quali di questi poteri mettono a rischio la
  tesi "non è un fondo"? Basta limitarli nei documenti costitutivi, o vanno tolti
  dal codice? *(01 §4, 02 C-1, C-2)*
- **A9** 🔴 Abbiamo deciso che l'artista firma con firma qualificata perché
  **"sta di fatto costituendo, tramite la piattaforma, un soggetto che emette
  titoli"**. Se è così, **l'artista è l'emittente**: chi deve pubblicare il
  prospetto o il documento informativo, chi risponde delle informazioni date agli
  investitori (art. 94 TUF), e quali obblighi societari o di comunicazione ha
  l'artista? Oppure l'emittente dev'essere un comparto del veicolo di cui l'artista
  è solo cedente? La risposta decide il contenuto dell'Accordo Artista. In
  entrambi i casi: la firma qualificata è **obbligatoria** o solo consigliata? La
  cessione dei proventi a un comparto richiede data certa o formalità per essere
  opponibile ai creditori dell'artista (in Italia art. 1265 e 2704 c.c.; in
  Lussemburgo la legge del 22 marzo 2004 sulla cartolarizzazione)? *(A5, 02 C-8,
  file 08 C-9)*

## Gruppo B · Campagne di pre-produzione e crowdfunding
*Stesso avvocato del gruppo A.*

- **B1** 🔴 Il modello pre-produzione rientra nell'**ECSPR** (Reg. 2020/1503)?
  Con quale strumento: titolo di debito, strumento partecipativo, prestito? Il
  limite di 5 milioni per titolare di progetto è compatibile con il piano?
  *(01 §3)*
- **B2** 🟠 Un **escrow on-chain** di cui la piattaforma è owner può sostituire il
  conto separato o il prestatore di servizi di pagamento che l'ECSPR richiede per
  la custodia dei fondi? Serve anche una licenza di pagamento o di moneta
  elettronica per maneggiare USDC? *(01 §3)*
- **B3** 🔴 Abbiamo **deciso di non avere scadenze** (§2.86): una campagna finisce
  solo se vende tutto, rilascia tutto o viene annullata; le prime tranche possono
  essere pagate con una raccolta parziale e non c'è un rimborso automatico. È
  compatibile con l'ECSPR e con la tutela del consumatore, se dichiarato con
  chiarezza? Serve almeno una soglia minima di raccolta prima della prima tranche?
  *(02 C-4)*
- **B4** 🟠 Il **periodo di riflessione di 4 giorni** (ECSPR art. 22) o il
  **recesso di 14 giorni** per i servizi finanziari a distanza come si conciliano
  con token consegnati subito e fondi già in escrow? *(01 §3, §8)*
- **B5** 🟠 Una campagna **senza studio** viene rilasciata dalla sola conferma
  dell'artista. Basta dichiararlo o va vietato? *(02 C-3)*

## Gruppo C · Annullamento delle campagne e rivalsa verso l'artista
*Stesso avvocato del gruppo A, più un avvocato civilista o contrattualista per
l'azione di recupero. Decisione del 15 settembre 2026, note legali §7.10.*

- **C1** 🔴 Il potere del Founder di **annullare una campagna** solo per
  contenuti illeciti o per violazione di diritti di terzi (bozza di clausola: file
  08, A-1) è **valido e opponibile** agli artisti e agli investitori consumatori?
  Serve l'approvazione specifica (art. 1341, comma 2, c.c.)? Supera i controlli
  sulle clausole abusive (Codice del Consumo, artt. 33-36) e i loro equivalenti
  lussemburghesi?
- **C2** 🔴 Rimborsata la parte non rilasciata, **come recuperano gli investitori
  le tranche già pagate e il danno** dall'artista? Ogni investitore da solo
  (poco pratico per importi piccoli)? Il veicolo o la piattaforma per tutti,
  tramite **mandato** o **cessione del credito**? L'**azione di classe** (art.
  840-bis c.p.c.) è una strada? Conviene una **clausola penale** (art. 1382 c.c.)
  per semplificare la prova del danno? *(file 08, A-3 e B-2)*
- **C3** 🟠 Per rendere il recupero effettivo: ha senso chiedere all'artista una
  **garanzia**, per esempio trattenere l'ultima tranche fino all'uscita del brano
  o una fideiussione, oppure una **compensazione** con le royalty future?
- **C4** 🟠 *Deciso il 2026-09-15:* il **2% sui contributi resta sempre alla
  piattaforma** e viene chiesto all'artista come parte del danno. **Da
  confermare:** la clausola regge verso investitori consumatori (vedi F2)? Chi può
  chiedere quel 2% all'artista, visto che l'hanno pagato gli investitori? *(02 C-11,
  file 08 A-2 §2 e A-3)*
- **C5** 🟠 Uno **studio** che ha ricevuto tranche in buona fede è esposto a
  pretese, o la rivalsa va solo verso l'artista? *(note §7.10)*
- **C6** 🟠 *Deciso il 2026-09-15:* rimborso e rivalsa spettano **a chi possiede i
  token al momento dell'annullamento**. **Da confermare:** il diritto verso
  l'artista si trasferisce con il token a ogni rivendita (serve che il token
  incorpori il credito)? Come si gestisce il periodo fino al redeploy "phase 2",
  in cui il contratto rimborsa ancora chi ha contribuito? *(02 C-5, file 08 A-2
  §3)*
- **C7** 🟠 Se Humfiverse è un **servizio di hosting** ai sensi del DSA, la
  procedura di segnalazione e motivazione (artt. 16-17) è già sufficiente come
  procedura di annullamento, o ne serve una contrattuale in più?
- **C8** 🟢 L'accettazione dell'**investitore** con scorrimento obbligatorio del
  testo, spunte e firma del wallet, con registrazione di versione, ora, wallet e
  hash, basta come prova? *Deciso il 2026-09-15:* l'**artista** firma con **firma
  elettronica qualificata**. **Da confermare:** basta per le clausole vessatorie e
  per un artista di un altro Stato UE? *(file 08, §C, C-9)*

- **C9** 🟠 Una campagna **già interamente rilasciata** e poi annullata per
  contenuti illeciti o per violazione di diritti: cosa rappresentano i suoi
  token? Il diritto alle royalty future resta, si estingue o si trasforma nel
  credito verso l'artista? Vanno bloccati per la rivendita e mostrati a valore
  zero, o solo segnalati? *(file 08, A-2 §4; technical-architecture §2.86-§2.87)*

## Gruppo D · Antiriciclaggio e sanzioni
*Avvocato AML/compliance; può essere lo stesso del gruppo A.*

- **D1** 🟠 Da quali **Paesi** va escluso il servizio? Il sito è tradotto in
  russo, cinese, giapponese e arabo: può essere letto come un servizio rivolto a
  quei mercati? Quali divieti del Reg. 833/2014 si applicano a token di questo
  tipo? *(01 §9)*
- **D2** 🟠 Humfiverse diventa **soggetto obbligato** antiriciclaggio in Italia o
  in Lussemburgo, e da quando: già con il prototipo o solo con l'offerta reale?
  Quali verifiche servono per artisti e studi, che ricevono i fondi? *(01 §6)*
- **D3** 🟢 Con quale regime si coordina il futuro regolamento AMLR (dal luglio
  2027)?

## Gruppo E · Paesi extra-UE
- **E1** 🟠 Il sito è raggiungibile dagli **Stati Uniti**. Servono blocco
  geografico ed esclusione nei Termini (Regulation S) già nel prototipo, o solo
  con valore reale? *(01 §10)*

## Gruppo F · Consumatori
- **F1** 🟠 Gli investitori sono **consumatori** ai fini del Codice del Consumo e
  della Direttiva 2023/2673? Lo è l'artista persona fisica? *(01 §8)*
- **F2** 🟠 Una **commissione non rimborsabile** trattenuta anche in caso di
  annullamento è una clausola abusiva? *(02 C-11, Termini §6)*
- **F3** 🟢 Obblighi dell'**European Accessibility Act** per il sito?

## Gruppo G · Società, responsabilità, prototipo
*Avvocato societario / commercialista.*

- **G1** 🔴 Oggi **non esiste una società**. Chi è responsabile del prototipo
  pubblico, dei dati raccolti e dei contratti accettati: Cesare e Vincenzo
  personalmente? Quale società costituire subito (SRL italiana, poi il veicolo
  lussemburghese?) e con quali obblighi di trasparenza sul sito (note legali o
  impressum, art. 7 D.Lgs. 70/2003)? *(03 §E)*
- **G2** 🟠 Un **prototipo pubblico su testnet**, con whitepaper, pagine campagna
  e parole come "invest" o "yield", richiede già un'autorizzazione o espone a
  contestazioni di **abusivismo** (art. 166 TUF) o di pubblicità ingannevole?
  Cosa va tolto o riformulato adesso? *(01 §1, 02 C-12)*
- **G3** 🟠 Responsabilità verso gli utenti per la **gestione delle chiavi** (una
  chiave sempre online controlla tutto) e per le debolezze note del backend
  (file privato, 02 §3). Servono requisiti organizzativi documentati (DORA)? *(02
  C-9)*

## Gruppo H · Privacy
*Avvocato privacy o DPO.*

- **H1** 🔴 Il prototipo ha raccolto e raccoglie **nome, data di nascita,
  nazionalità, origine dei fondi e stato PEP** senza titolare né informativa. Va
  cancellato quello che c'è già? Come si chiude il pregresso? *(01 §7)*
- **H2** 🟠 Scrivere **nome artista** e titolo on-chain e l'audio su IPFS è
  compatibile con il GDPR (minimizzazione, art. 17)? Basta un'avvertenza con il
  consenso, o va cambiato il contratto? *(02 C-13)*
- **H3** 🟠 **DPIA** obbligatoria? **Trasferimenti** verso thirdweb, Render,
  Turso, Alchemy, Pinata e Google Fonts: base giuridica e DPA? *(05 §5)*

## Gruppo I · Diritto d'autore e musica
*Avvocato IP o diritto dello spettacolo e della musica.*

- **I1** 🟠 La cessione dei "proventi royalty" deve distinguere **composizione ed
  edizioni** da **master e diritti connessi**, e i canali di incasso (SIAE o altre
  CMO, IME come Soundreef, distributori, DSP)? Quali mandati già firmati
  dall'artista la impediscono? *(03 T-6, note §7.4)*
- **I2** 🟠 **Garanzie e manleva** dell'artista: bastano quelle del file 08, A-4?
  Come si gestiscono i campioni non autorizzati? *(03 T-8)*
- **I3** 🟢 Obblighi dell'**AI Act** (art. 50) per chi pubblica brani generati con
  AI, e responsabilità se la dichiarazione dell'artista è falsa. *(01 §13)*

## Gruppo L · Fisco
*Commercialista o tributarista.*

- **L1** 🟠 Tassazione per l'investitore italiano: plusvalenze al 26% o al 33%, e
  royalty come reddito di capitale o reddito diverso? *(01 §11)*
- **L2** 🟠 **IVA** sulle commissioni (2%, 3%, 1%): esente come intermediazione
  finanziaria o no?
- **L3** 🟢 Obblighi di comunicazione **DAC8** per la piattaforma.

---

## Da chiarire per primo (🔴)

A1 · A2 · A4 · A5 · A9 · B1 · B3 · C1 · C2 · G1 · H1

**H1 e G1 si possono affrontare subito e costano poco.** Le altre richiedono
l'incontro con l'avvocato dei mercati finanziari.

## Materiale da mandare prima dell'incontro

| Documento | Perché |
|---|---|
| `legal/01-normativa-spiegata.md` | Mostra che le basi sono chiare: si parte dalle domande, non dalla spiegazione |
| `legal/02-controllo-smart-contract.md` | Cosa fa davvero il prodotto. Le debolezze del backend sono nel file privato: mostrarle all'avvocato a voce o in un documento riservato |
| `planning/legal-regulatory-notes.md` (§1-§7.10) | Decisioni già prese e loro motivazioni |
| `planning/business-overview.md` §4 e §8 | Flusso del denaro e modello pre-produzione |
| `whitepaper/` (o link GitBook) | Cosa è già pubblico |
| `server/contract-template.js` (testo IT o FR) | Il contratto artista attuale |
| `legal/04`, `05`, `06`, `08` | Bozze da rivedere |
| Link ai contratti verificati su Etherscan | Per chi vuole leggere il codice |
| Una pagina: numeri del piano (campagne per anno, importi medi, Paesi di investitori e artisti) | Senza questi dati l'avvocato non può valutare soglie ed esenzioni |

L'ultima riga manca: va preparata da voi.
