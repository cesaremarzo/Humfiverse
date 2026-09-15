# Revisione dei documenti esistenti

*Revisione del 2026-09-15, commit `82a7a1b`. Non è consulenza legale.*

Frasi dei documenti esistenti che oggi non corrispondono al codice, o che
un avvocato probabilmente farebbe cambiare. Per ognuna c'è una correzione
proposta.

> **Nessuna correzione è stata applicata.** Il whitepaper è sincronizzato con
> GitBook ed è pubblico: modificarlo è una decisione vostra. GitBook oggi legge
> ancora da `dev/cesare` (SESSION_LOG), quindi anche un semplice commit su quel
> branch lo pubblica.

---

## A. Whitepaper (`whitepaper/`)

Il tono è molto buono: onesto su testnet, audit e assenza di un'offerta. I
problemi sono affermazioni precise che il codice smentisce. In un documento
pubblico che invita a verificare tutto ("If something here can't be checked
this way, that's worth reporting as an inconsistency", cap. 9), queste
imprecisioni pesano il doppio.

| # | Dove | Testo attuale | Problema | Correzione proposta |
|---|---|---|---|---|
| W-1 | cap. 4, "One accounting rule" | *"Tokens only ever leave a catalogue's pool two ways: a first purchase, or a resale"* | Esiste `releaseFromPool` del Founder, senza pagamento (02, C-1). E la rivendita non fa uscire token dal pool | *"Tokens leave a catalogue's pool when they are bought, when a campaign contribution releases them, or when the platform operator releases them directly — a power the operator currently holds and which is planned to be restricted. No one can mint more than the declared supply."* |
| W-2 | cap. 6, ultimo paragrafo | *"No arbitration, no timeout, no one who can override it."* | Il Founder può cancellare la campagna in qualsiasi momento e aprire i rimborsi (C-2) | *"No one can release a tranche on one side's say-so. The platform operator can, however, cancel a campaign, which stops all further releases and opens refunds of what hasn't been released."* |
| W-3 | cap. 2, 3 e 6 | Rilascio *"only once both the artist and the assigned studio confirm"* | Senza studio, o con studio = artista, basta l'artista (C-3) | Aggiungere: *"A campaign with no studio is released on the artist's confirmation alone; this is shown on the campaign page."* E vietare nel codice artista = studio |
| W-4 | cap. 2, punto 2 e diagramma | Se annullata, *"contributors are refunded for whatever hasn't been released"* | Vero, ma solo per chi ha pagato e non per chi possiede i token ora; e il 2% non torna (C-5, C-11) | *"…refunded pro-rata to the wallets that contributed, less the 2% contribution fee. Tokens bought on resale carry no refund right today."* |
| W-5 | cap. 2, "Why an escrow" | *"the money is never in one pool anyone can dip into"* | Tutti i fondi di tutte le campagne stanno nello stesso contratto: la separazione è contabile, nel codice, e testata | *"Each campaign's money is accounted for separately inside the escrow contract, and its tests show one campaign cannot spend another's funds."* |
| W-6 | cap. 2, diagramma | *"Rights holder paid immediately, in full"* | Il 2% viene trattenuto | *"Rights holder paid immediately (less the 2% platform fee)"* |
| W-7 | cap. 2 e 5, "Not a trading venue" | La rivendita è *"more like a classified ad than a stock exchange"* | Argomento non ancora confermato da un avvocato; il marketplace è reale e trattiene l'1% (C-7) | Togliere l'affermazione "not a trading venue" finché l'avvocato non la conferma. Scrivere: *"Whether resale can be offered, and under which licence, is an open legal question."* (il cap. 3 lo dice già) |
| W-8 | cap. 5, "Investor protection" | *"Before buying anything, an investor completes an identity check"* | Solo sul sito; il contratto non verifica (C-6) | *"The app asks for an identity and appropriateness check before a purchase. The prototype contracts do not enforce it: a real launch needs transfer restrictions at contract level."* |
| W-9 | README e cap. 2 | *"a legal entity holds the real royalty right… your token is a claim against that entity"* | Oggi non esiste un'entità e il ricavato va all'artista (C-8). Il cap. 9 lo dice, ma README e cap. 2 lo presentano come un fatto | Tempo al futuro: *"In the planned structure, a legal entity will hold…"* |
| W-10 | cap. 3 | *"Two smart contracts"* e *"86 automated tests"* | Sono tre e i test sono 94 | *"Three smart contracts… 94 automated tests (as of 15 Sep 2026)"* |
| W-11 | cap. 9 | *"two independently verified smart contracts"* e *"71 passing tests"* | Come sopra, e in contraddizione con il cap. 3 | Stessa correzione; meglio un solo punto che riporta il numero |
| W-12 | cap. 4, "What Humfiverse earns" | *"can only ever be sent to the platform's designated fee address"* | Il Founder può cambiare quell'indirizzo (`setFeeRecipient`) | *"…sent to the fee address the operator designates; every change of that address is a public on-chain event."* |
| W-13 | cap. 2, punto 2 | *"Neither Humfiverse nor the artist can touch it early"* | Con raccolta parziale le prime tranche si possono rilasciare prima del raggiungimento dell'obiettivo (C-4) | *"…released tranche by tranche as soon as enough has been raised to cover each one."* |
| W-14 | cap. 8 | Mancano rischi presenti nel codice | Diluizione (C-1), cancellazione discrezionale (C-2), chiave unica (C-9), metadati modificabili (C-10), dati on-chain non cancellabili (C-13) | Aggiungere come punti di rischio. Testi pronti nel file 06, §3 |
| W-15 | cap. 1 | *"anotherblock proved an on-chain version specifically in the EU"* | Affermazione su un terzo da verificare prima di pubblicarla | Verificare la fonte o togliere "proved" |

## B. Contratto artista (`server/contract-template.js`, v0.3-draft)

È il documento più vicino a un contratto vero che un utente accetta. Le
incoerenze con il codice sono sostanziali.

| # | Clausola | Problema | Proposta |
|---|---|---|---|
| T-1 | `manager-discretion` | Attribuisce all'**SPV Manager** il potere discrezionale di confermare o sospendere le milestone. L'escrow (§2.27) esiste proprio per togliere questo potere. Il contratto dice l'opposto del codice e del whitepaper, cap. 5 e 6 | Riscrivere: le tranche si rilasciano con la conferma di artista e studio sul contratto escrow; il gestore non ha potere di conferma. Descrivere invece il **potere di cancellazione** (C-2) con i casi in cui si può usare |
| T-2 | `milestones` | *"Ogni tranche è rilasciata all'Artista"* | La tranche dello studio va allo studio. Non si parla della conferma dello studio né della trattenuta del 3% | Indicare destinatari, doppia conferma e commissione |
| T-3 | `refund` | Rimborso *"ai token holder"* in caso di obiettivo mancato o milestone non consegnata | Il codice rimborsa chi ha contribuito, solo dopo una cancellazione del Founder, e trattiene il 2% (C-2, C-4, C-5, C-11) | Allineare codice e testo (phase 2) oppure descrivere il comportamento reale |
| T-4 | manca | **Nessuna clausola sulle commissioni** | Il 2% sulle vendite primarie, il 2% sui contributi e il 3% sulle tranche riducono ciò che l'artista riceve | Aggiungere una clausola dedicata con esempio numerico (il wizard mostra già il calcolo) |
| T-5 | manca | **Lo studio non è parte del contratto**, ma ha un potere di conferma che decide i pagamenti dell'artista | Serve un accordo studio-piattaforma o un'adesione dello studio |
| T-6 | `assignment` | Cede alla SPV *"il diritto di incassare i proventi royalty"*, *"per la durata e alle condizioni descritte nella documentazione di offerta"* | La SPV non esiste; non distingue composizione e master; rimanda a una "documentazione di offerta" che non esiste; nel codice il denaro va all'artista (C-8) | Da riscrivere con l'avvocato dopo la domanda A5. Nel prototipo: dichiarare che la cessione non ha effetto finché l'entità non esiste |
| T-7 | `exclusivity` | Esclusiva solo *"per la durata della campagna"* | Se la cessione delle royalty dura più della campagna, l'artista potrebbe cedere le stesse royalty a terzi finita la campagna | Durata dell'esclusiva = durata della cessione |
| T-8 | manca | Garanzie dell'artista su **titolarità dei diritti**, assenza di vincoli o cessioni precedenti, contenuti di terzi e manleva | Base di tutto il modello (note legali §5); oggi c'è solo la garanzia sulla dichiarazione AI | Aggiungere garanzie e manleva |
| T-9 | manca | Dati del wallet che incassa e obbligo di custodirne la chiave | Il wallet decide dove vanno i soldi | Indicare il wallet nel testo accettato e registrarlo con l'accettazione (B-4) |
| T-10 | `jurisdiction` | Legge lussemburghese e foro di Lussemburgo-Città | Il veicolo non esiste e le parti oggi sono italiane: chi è la controparte? | Nel prototipo, indicare la controparte reale o dichiarare che il testo non è vincolante (lo fa già la `note`) |
| T-11 | `legalBasisNote` | Traduzioni AI non certificate e testo francese autorevole | Già dichiarato bene. L’avvocato deve decidere la lingua (note legali §7.7, domanda A6 del file 07) | Nessuna modifica ora |

## C. Note legali interne (`planning/legal-regulatory-notes.md`)

Documento di lavoro, non pubblico: basta aggiornarlo.

| # | Dove | Problema | Proposta |
|---|---|---|---|
| N-1 | §7.8 | Dice che il mercato secondario sarebbe stato **simulato**. Oggi è un contratto reale (§2.59, §2.71) | Nota datata: "superato il …, vedi legal/02 C-7" |
| N-2 | §7.1.1 | Soglia prospetto **8 milioni di euro** | Possibile superamento con il Listing Act (01, §2): segnare [verificare] |
| N-3 | §7.9 | Dice che il KYC non è legato a un'identità autenticata | Oggi è legato al wallet, ma senza firma (B-3) |
| N-4 | §4.1.1 | "Humfiverse has no confirmation function at all" | Vero, ma omette cancellazione e `releaseFromPool` (C-1, C-2) |
| N-5 | tutta | Non copre GDPR, sanzioni, fisco pratico, DSA, AI Act | Rimandare a `legal/01` |

## D. README del repo

| # | Testo | Problema | Proposta |
|---|---|---|---|
| R-1 | *"Humfiverse deliberately has no ability to release an escrow milestone by itself"* | Vero; aggiungere il potere di cancellazione per completezza | *"…though the owner can cancel a campaign and open refunds."* |
| R-2 | Tabella "Real / Simulated" | Il KYC compare come "simulated", ma raccoglie dati personali reali se l'utente li inserisce | Aggiungere: *"KYC — simulated verification, but whatever is typed is stored: do not enter real data"* |

## E. Cosa manca del tutto

| Documento | Stato | Bozza |
|---|---|---|
| Termini di Servizio per gli utenti e investitori | Assente | `legal/04` |
| Informativa privacy | Assente, con dati personali già raccolti | `legal/05` |
| Informativa cookie e storage | Assente (thirdweb e sessioni in `localStorage`, Google Fonts) | `legal/05`, §9 |
| Avvertenze di rischio sulle pagine di acquisto | Parziali (testi `buy.*` nelle traduzioni) | `legal/06` |
| Procedura di segnalazione di contenuti illeciti (DSA) | Assente | `legal/04`, §10 |
| Note legali / impressum (chi gestisce il sito) | Assente; il whitepaper, cap. 9, dice che non elenca il team | Obbligatorio per un servizio online nell'UE (Direttiva 2000/31/CE, art. 5) → domanda G1 del file 07 |
