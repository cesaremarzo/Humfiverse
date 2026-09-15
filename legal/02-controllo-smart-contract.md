# Controllo degli smart contract e del backend, dal punto di vista legale

*Revisione del 2026-09-15, commit `82a7a1b`. Non è un audit di sicurezza e non
è consulenza legale.*

## Cosa è e cosa non è questo controllo

- **È** una lettura riga per riga di cosa i contratti permettono davvero,
  confrontata con quello che whitepaper, contratto artista e note legali dicono
  che fanno. Lo scopo è trovare dove la realtà tecnica cambia l'analisi legale o
  rende falsa una promessa pubblica.
- **Non è** un audit di sicurezza professionale. Non sostituisce quello di una
  società specializzata, che resta obbligatorio prima di qualsiasi deploy con
  valore reale (whitepaper, cap. 8). Ho letto anche il backend dove decide chi
  può far agire la chiave del Founder.

## Oggetto

| Contratto | File | SHA-256 (primi 16) | Indirizzo Sepolia |
|---|---|---|---|
| HumfiverseCatalogueToken | `contracts/contracts/HumfiverseCatalogueToken.sol` | `450362a70d73e9cf` | `0xb45601440308c92D9BC8fd4a95DEE6a4A86aFB41` |
| HumfiverseMarketplace | `contracts/contracts/HumfiverseMarketplace.sol` | `2e6e2985317c70a8` | `0x755500dEB66169fC605Be8Aa25ACBdAd791F1585` |
| HumfiverseMilestoneEscrow | `contracts/contracts/HumfiverseMilestoneEscrow.sol` | `689367efc1f8c53b` | `0x16C8bfE861Ef1B102CD6D6a4FD4e881FdD38721c` |

Solidity 0.8.24, OpenZeppelin v5, non aggiornabili (niente proxy).
Pagamenti in USDC di test (`0x1c7D…7238`). Test: **94 passati**.

**Wallet della piattaforma** (nomi da `CLAUDE.md`):
- **Founder** `0x142F…BfC6`: `owner()` dei tre contratti **e** chiave operativa
  del backend su Render.
- **Fees** `0xd156…7524`: `feeRecipient()` dei tre contratti.

> Gli indirizzi cambiano a ogni redeploy. Prima di citare questo documento,
> controllare che `legal/check.sh` non segnali modifiche.

---

## 1. Cosa fanno i contratti, in breve

| Funzione | Chi può chiamarla | Effetto |
|---|---|---|
| `mintCatalogue` | Founder | Crea un token id con offerta fissa. Prezzo = `funding / supply`, non modificabile. Imposta il wallet che incassa (`payoutOf`) e se il token è in vendita diretta |
| `buy` | chiunque | Compra dal pool al prezzo fisso. 98% al wallet dell'artista, 2% trattenuto come commissione |
| `releaseFromPool` | Founder o contratto escrow | Consegna token del pool **senza pagamento** |
| `setURI`, `setTrackAudioUri` | Founder | Cambia i metadati (nome, immagine, descrizione) e il link all'audio dopo la vendita |
| `createCampaign` | Founder | Apre una campagna escrow su un token non in vendita diretta e mai venduto |
| `contribute` | chiunque | Paga in USDC. 2% trattenuto, 98% accreditato alla campagna, token consegnati subito |
| `confirmMilestoneAsArtist` / `…AsStudio` | wallet artista / wallet studio | Quando entrambi hanno confermato e i fondi coprono la tranche, la paga meno il 3% |
| `cancelCampaign` | Founder | Blocca la campagna e apre i rimborsi |
| `refund` | chi ha contribuito | Restituisce la sua quota di `raccolto − rilasciato`. Il 2% resta trattenuto |
| `registerStudio`, `setStudioActive`, `renameStudio` | Founder | Gestisce l'elenco degli studi ammessi |
| `list` / `buyListing` / `cancelListing` | chiunque | Rivendita tra utenti. 99% al venditore, 1% trattenuto |
| `withdrawFees` | chiunque | Invia le commissioni accumulate al wallet Fees |
| `setFeeRecipient`, `setPayoutRecipient`, `setEscrowContract`, `transferOwnership`, `renounceOwnership` | Founder | Configurazione |

Le aliquote delle commissioni sono `constant` e non si possono cambiare. Il
wallet che le riceve invece sì (`setFeeRecipient`).

---

## 2. Punti con peso legale

Legenda priorità: **Alta** = rende falsa una promessa pubblica o cambia la
qualificazione legale · **Media** = da risolvere prima del lancio reale ·
**Bassa** = da documentare.

### C-1 · Alta · I token escono dal pool anche senza pagamento

**Codice.** `HumfiverseCatalogueToken.releaseFromPool` (righe 236-240):
Founder o escrow possono consegnare token del pool a qualsiasi indirizzo senza
incassare nulla. Per i token di una campagna, `createCampaign` controlla che
`releasedOf == 0` solo **al momento della creazione** (riga 233). Dopo, nulla
impedisce al Founder di consegnare token gratis.

**Cosa dicono i documenti.** Whitepaper, cap. 4: *"Tokens only ever leave a
catalogue's pool two ways: a first purchase, or a resale"*.

**Perché conta.**
1. È un'affermazione pubblica falsa: esiste un terzo modo, a discrezione del
   Founder.
2. **Diluizione.** Chi ha contribuito possiede una quota delle royalty future
   proporzionale ai token. Token consegnati gratis riducono la sua quota senza
   il suo consenso.
3. **Campagna impossibile da completare.** Se escono token gratis, `contribute`
   non potrà mai vendere l'intera offerta (`exceeds supply`), quindi l'obiettivo
   non si raggiunge e le ultime tranche non si sbloccano.
4. **AIFMD.** È un potere discrezionale del gestore, contrario all'argomento
   del whitepaper, cap. 5.

**Proposta.** Consentire `releaseFromPool` al Founder solo per i token in
vendita diretta, oppure eliminarlo del tutto per i token legati a una campagna e
lasciare solo l'escrow. In alternativa, dichiararlo nel whitepaper e nei Termini
con lo scopo preciso, per esempio il regolamento di acquisti pagati fuori catena,
e renderlo tracciabile.

### C-2 · Alta · Il Founder può cancellare una campagna in qualunque momento

**Codice.** `cancelCampaign` (righe 425-430): solo `onlyOwner` e `ACTIVE`.
Nessuna condizione su scadenza, obiettivo mancato o disaccordo.

**Cosa dicono i documenti.** Whitepaper, cap. 6: *"No arbitration, no timeout,
no one who can override it"*. Whitepaper, cap. 2 e 8: se artista e studio non
sono d'accordo *"the money just stays locked"*.

**Perché conta.** La cancellazione è di fatto un potere di intervento: il
Founder ferma tutte le tranche future e apre i rimborsi. Il denaro quindi non
resta bloccato per sempre, e la frase "nessuno può intervenire" è inesatta. Il
potere non è limitato da nessuna regola, quindi rafforza l'obiezione AIFMD (C-1,
punto 4). Il **contratto artista** (`refund`) parla di rimborso in caso di
"mancato raggiungimento dell'obiettivo o mancata consegna", ma il codice non
collega la cancellazione a nessuna di queste condizioni.

**Decisione (15 set 2026, note legali §7.10).** Il potere **resta**: il Founder
deve poter annullare una campagna almeno quando contiene contenuti illeciti o
che violano il diritto d'autore o altri diritti di terzi. Gli investitori
ricevono il rimborso pro-quota della parte non rilasciata. Per le tranche già
rilasciate hanno azione contro l'artista, insieme al risarcimento del danno. Il
problema quindi non è il potere, ma il fatto che **oggi non sia scritto da
nessuna parte**.

**Proposta, coerente con la decisione:**
1. **Motivi limitati ed elencati** nel contratto artista, nel contratto
   investitore e nei Termini: contenuto illecito, violazione di diritti di
   terzi, garanzie dell'artista false. Un potere legato a motivi di legge è anche
   il modo più solido per sostenere che sia un atto di conformità e non una
   decisione di investimento (AIFMD). Resta un argomento, da confermare.
2. **Procedura**: avviso motivato all'artista, breve termine per rispondere
   salvo urgenza, decisione scritta e datata. Il DSA (artt. 16-17) potrebbe già
   imporla.
3. **Tracciabilità**: registrare il motivo insieme a `CampaignCancelled`, per
   esempio con un codice nel backend o un parametro `reason` al prossimo
   redeploy.
4. **Correggere il whitepaper** (file 03, W-2) e il contratto artista (T-1,
   T-3). Bozze di clausole nel file 08.
5. Facoltativo: seconda firma (multisig) per la cancellazione, così il potere
   non dipende da una sola chiave (C-9).
6. **Annullare non basta a rimuovere il contenuto** (technical-architecture
   §2.87): pagina, audio su IPFS, metadati e testo on-chain restano. Per
   contenuti illeciti l'atto che conta è la rimozione. Clausola nel file 08,
   A-1-bis; procedura tecnica nel §2.87, non ancora implementata.

### C-3 · Alta · Conferma "doppia" che non sempre è doppia

**Codice.**
- `_tryRelease` (riga 381): se `studioId == 0` basta la conferma dell'artista.
- `createCampaign` non vieta che il wallet dello studio coincida con quello
  dell'artista. Il test `honest-man-595` del 14 set usava proprio artista =
  studio = `0xA646…A38F`.
- Lo studio è registrato dal Founder (`registerStudio`) con il wallet indicato
  dall'artista, che dal §2.88 lo firma nell'autorizzazione di lancio. Nessun
  controllo verifica però che lo studio sia davvero un soggetto diverso
  dall'artista: la firma prova solo che è stato l'artista a sceglierlo.

**Cosa dicono i documenti.** Whitepaper, cap. 2, 3 e 6: il rilascio avviene
*"only once both the artist and the assigned studio confirm, from their own
wallets"*.

**Perché conta.** Nei casi elencati l'artista rilascia da solo tutti i fondi.
Chi ha contribuito si fida di un controllo che in quel caso non esiste. È
un'informazione ingannevole, e per un prodotto finanziario quel tipo di
omissione pesa. La decisione su artista = studio è segnata come aperta nel
SESSION_LOG del 14 set.

**Proposta.** `require(studios[studioId].wallet != artist)` in `createCampaign`.
Per campagne senza studio, dichiararlo in modo esplicito sulla pagina della
campagna ("questa campagna è rilasciata dalla sola conferma dell'artista").

### C-4 · Alta · Nessuna regola "tutto o niente" e nessuna scadenza

**Codice.** `contribute` accetta fondi finché la campagna è `ACTIVE`. `_tryRelease`
rilascia una tranche appena `raised` copre la somma delle tranche rilasciate. La
`deadline` blocca solo i nuovi contributi e non apre rimborsi. Oggi ogni campagna
è creata con `deadline = 0`, cioè senza scadenza.

**Perché conta.**
- Una campagna che raccoglie il 25% e si ferma può comunque pagare la prima
  tranche (20% nel piano predefinito) all'artista. Il brano non verrà mai
  prodotto con quei fondi, ma chi ha contribuito recupera solo il resto e solo se
  il Founder cancella.
- Il contratto artista (`refund`) promette il rimborso in caso di "mancato
  raggiungimento dell'obiettivo". Il codice non lo fa da solo.
- Il crowdfunding regolato (ECSPR) e le aspettative dei consumatori vanno nella
  direzione opposta.

**Decisione (15 set 2026, technical-architecture §2.86).** Niente scadenze:
né rimborsi che si aprono dopo una scadenza, né date per le milestone. Una
campagna finisce solo se vende tutto, se rilascia tutto o se viene annullata. Il
campo `deadline` può sparire al prossimo redeploy.

**Conseguenze legali da gestire, senza reintrodurre scadenze:**
- Va **scritto chiaramente**, prima del pagamento, che una campagna può restare
  aperta senza limiti, che le prime tranche possono essere pagate con una
  raccolta parziale, e che non esiste un rimborso automatico se l'obiettivo non
  si raggiunge. Oggi il contratto artista promette il contrario (T-3).
- È una differenza rispetto al crowdfunding regolato e alle aspettative di un
  consumatore: domanda B3 del file 07.
- Opzione compatibile con la decisione, se l'avvocato la ritiene necessaria:
  una **soglia minima di raccolta** prima della prima tranche. È una regola
  sull'importo, non sul tempo.

### C-5 · Alta · I rimborsi vanno a chi ha contribuito, non a chi possiede i token

**Codice.** `refund` usa `contributions[campaignId][msg.sender]`, cioè chi ha
pagato, e **non tocca i token**: niente burn, niente controllo del saldo.

**Perché conta.**
- Chi ha comprato i token sul marketplace da un contributore non riceve nulla se
  la campagna viene cancellata.
- Chi li ha venduti incassa due volte: il prezzo di vendita e il rimborso.
- Il contratto artista dice che gli importi sono restituiti *"ai token holder"*.
  Il codice fa il contrario.
- I token di una campagna cancellata restano trasferibili e quotabili sul
  marketplace. Solo il sito smette di mostrarli (§2.85-§2.86).

Il problema è già noto ed è pianificato nella "phase 2" (rimborso per token
posseduto, con burn). Fino ad allora va dichiarato.

**Decisione (15 set 2026).** Rimborso e rivalsa spettano **a chi possiede i
token al momento dell'annullamento**. Il contratto in uso fa il contrario, quindi
la decisione richiede il redeploy "phase 2" (rimborso per token posseduto, con
burn). Fino ad allora Termini e avvertenze devono descrivere il comportamento
attuale.

### C-6 · Alta · Il KYC non è applicato dai contratti

**Codice.** `buy`, `contribute`, `buyListing` e i trasferimenti ERC-1155
(`safeTransferFrom`) non controllano nessuna lista di wallet verificati. Il
blocco esiste solo nell'interfaccia (`asset-detail.component.html`).

**Cosa dicono i documenti.** Whitepaper, cap. 5: *"Before buying anything, an
investor completes an identity check"*.

**Perché conta.** Chiunque può comprare chiamando il contratto direttamente o
tramite Etherscan: minori, residenti USA, persone sanzionate. Con valore reale
diventa un problema AML (01, §6), sanzioni (§9) e offerta al pubblico (§2, §10).
Il codice lo dichiara già (commento in testa al token, "not ERC-3643"), ma il
whitepaper no.

**Proposta.** Per il lancio reale: token con trasferimenti permissioned
(ERC-3643 o un controllo di whitelist in `_update`), con la whitelist gestita dal
fornitore KYC. Nel frattempo, correggere la frase nel whitepaper (file 03).

### C-7 · Alta · Il marketplace è una rivendita reale con commissione

**Codice.** `HumfiverseMarketplace`: più venditori e compratori terzi, regole
fisse, esecuzione automatica, 1% alla piattaforma. `list` accetta **qualsiasi**
contratto ERC-1155, non solo quello Humfiverse.

**Perché conta.** Vedi 01, §5: può essere un sistema multilaterale di
negoziazione anche senza prezzo algoritmico. Le note legali §7.8 dicevano
"simulato". Il whitepaper, cap. 2, dice *"Not a trading venue"*. Accettare token
di terzi espone a ospitare vendite di strumenti non verificati sotto il nome
Humfiverse.

**Proposta.** Limitare `list` all'indirizzo del token Humfiverse. Portare la
domanda A4 (file 07) all'avvocato **prima** di pubblicizzare la rivendita.

### C-8 · Media · Il ricavato va direttamente all'artista, non a un veicolo

**Codice.** `buy` trasferisce il 98% a `payoutOf[tokenId]`, il wallet
dell'artista (§2.79).

**Cosa dicono i documenti.** Whitepaper, README e cap. 2: *"a legal entity holds
the real royalty right, and your token is a claim against that entity"*. Il
contratto artista (`assignment`) cede i proventi *"alla SPV"*.

**Perché conta.** Nel flusso reale del codice non c'è nessun veicolo: l'artista
riceve i soldi e diventa di fatto l'emittente, e Humfiverse sembra un
intermediario che colloca. Questo cambia chi deve pubblicare il prospetto o la
scheda, chi risponde verso l'investitore e quali autorizzazioni servono.
Anche la fiscalità cambia.

**Proposta.** Decidere con l'avvocato il flusso giuridico (A1, A5) e poi
allineare il codice: `payoutOf` = wallet del comparto del veicolo, non
dell'artista.

### C-9 · Media · Una sola chiave, sempre online, controlla tutto

**Codice/configurazione.** Il Founder è insieme `owner()` dei tre contratti e
`CHAIN_OPERATOR_PRIVATE_KEY` sul server Render (piano gratuito).

**Perché conta.** Chi ottiene quella chiave può: consegnarsi token gratis (C-1),
cancellare campagne (C-2), registrare studi falsi (C-3), cambiare il wallet
Fees, cambiare i metadati (C-10), cedere o rinunciare alla proprietà dei
contratti. Per un servizio finanziario reale, la gestione delle chiavi fa parte
dei requisiti organizzativi (MiFID II art. 16; DORA, Regolamento (UE) 2022/2554,
per le entità finanziarie **[verificare l'applicabilità]**).

**Proposta.** Separare i ruoli: owner = multisig (per esempio Safe 2-su-3)
offline; chiave operativa del backend con permessi minimi (solo mint e creazione
campagne) tramite `AccessControl`. Documentare chi custodisce cosa.

### C-10 · Media · Metadati e audio modificabili dopo la vendita

**Codice.** `setURI` cambia l'indirizzo base dei metadati. Oggi i metadati sono
serviti dal backend (`/api/token-metadata/{id}.json`), quindi possono cambiare
anche senza transazione. `setTrackAudioUri` può sostituire l'audio. Titolo e
artista on-chain non sono modificabili.

**Perché conta.** Chi ha comprato un token su un brano può trovarsi i metadati
o l'audio cambiati. Serve almeno una regola scritta, per esempio "l'audio si
può collegare una volta sola", oppure un evento pubblico, che già esiste
(`TrackAudioUriUpdated`), unito a una politica dichiarata.

### C-11 · Media · Il 2% sui contributi non è mai rimborsabile

**Codice.** `contribute` trattiene il 2% subito. `refund` restituisce solo
l'importo accreditato.

**Cosa dicono i documenti.** Il whitepaper, cap. 4, lo dichiara. Il **contratto
artista non menziona nessuna commissione**, e l'investitore oggi non ha Termini
da accettare.

**Perché conta.** Una commissione trattenuta anche quando la campagna viene
annullata (C-2) può essere una clausola abusiva verso un consumatore (01, §8).
Va almeno scritta nei Termini, in modo chiaro e prima del pagamento. **Decisione (15 set 2026):** il 2% resta sempre alla piattaforma e viene chiesto
all'artista come parte del danno (file 08, A-2 §2 e A-3). Il codice attuale fa
già così: non serve cambiarlo. Serve scriverlo nei Termini (F2 per la conferma).

### C-12 · Bassa · Il token non paga royalty

La distribuzione non esiste on-chain (README, "Simulated"). Il token oggi dà
solo un saldo. Qualunque testo che parli di "rendimento" (`yield.util.ts`) si
basa su dati inseriti fuori catena e non verificati.

### C-13 · Bassa · Dati personali scritti per sempre

`trackTitle` e `artistName` sono scritti on-chain al mint e nell'evento
`CatalogueMinted`. Se il nome dell'artista è il suo nome anagrafico, è un dato
personale non cancellabile (01, §7). Consigliato: on-chain solo un
identificativo, e il nome solo nel database, cancellabile.

### C-14 · Bassa · Commenti interni superati

Il commento in testa a `HumfiverseMarketplace.sol` dice che il primo acquisto
tramite `releaseFromPool` è "fee-free, owner-gated". Da §2.72 `buy` applica il
2%. Non ha effetti legali, ma i commenti vengono citati come documentazione:
meglio allinearli.

---

## 3. Backend

Le debolezze del backend che decidono chi può usare la chiave del Founder sono
tracciate fuori dal repo pubblico. Chi ha accesso al progetto le trova in locale
in `.claude/legal-private/backend-sicurezza.md`. Riguardano autenticazione degli
endpoint di scrittura, integrità dei dati mostrati agli investitori e
collegamento tra accettazioni, KYC e wallet. Vanno risolte prima di qualsiasi
lancio con valore reale (domande G3 e H1 del file 07).

## 4. Cosa funziona bene (da dire all'avvocato)

- **Commissioni fisse nel codice** (`constant`): non si possono aumentare a chi
  ha già partecipato.
- **Nessuna conferma delle milestone da parte della piattaforma** (§2.27).
- **Nessuna emissione aggiuntiva**: un token id si crea una volta sola e la
  supply non cresce.
- **Prezzo fisso** e uguale per tutti i token di un id (§2.79).
- **Contabilità separata per campagna** nell'escrow, con test che dimostrano
  che una campagna non può spendere i fondi di un'altra (§2.71-§2.72). È una
  separazione *nel codice*, non una separazione giuridica dei patrimoni: tutti i
  fondi stanno nello stesso contratto.
- **Commissioni accumulate e prelevate a parte**: il wallet Fees non può
  bloccare una tranche.
- **Codice verificato su Etherscan** e 94 test automatici.
- **README e whitepaper molto franchi** su testnet, assenza di audit e assenza
  di un'offerta.

---

## 5. Controlli da ripetere a ogni modifica

Questa lista è la parte "meccanica" della skill `legal-review`. Per ogni
contratto modificato:

1. Cerca le funzioni `onlyOwner` e le altre protette: sono cambiati i poteri del
   Founder? Aggiorna la tabella §1 e `CLAUDE.md` → "Wallet names".
2. Commissioni: aliquote, base di calcolo, rimborsabilità. Confronta con
   whitepaper cap. 4, Termini §6 e contratto artista.
3. Uscita dei token dal pool: quali percorsi esistono? (C-1)
4. Rimborsi: a chi, su quale base, con quali condizioni? (C-4, C-5)
5. Trasferibilità: ci sono controlli su chi può ricevere? (C-6)
6. Dati scritti on-chain: ci sono dati personali? (C-13)
7. Indirizzi, numero di test, versione del contratto artista: aggiorna
   l'intestazione di questo file e `legal/README.md`.
8. Ogni nuovo punto: dagli un codice (C-15, B-5, …) e non rinumerare i vecchi,
   perché il file 07 li cita. I punti risolti vanno segnati come **Risolto (data,
   commit)**, senza cancellarli.
