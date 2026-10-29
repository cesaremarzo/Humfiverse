# Avvertenze e scheda rischi: bozza

*§2.5 nuovo il 2026-10-29 (calcolatore delle royalty master, §2.121). §2.2 aggiornato il 2026-10-14 (anticipo, §2.119). §2.2 e §3 aggiornati il 2026-10-12 (scadenza e soglia minima, §2.114). Bozza del 2026-10-11 per §2.2, §2.3-bis e §3 (studi verificati, royalty in proporzione al tempo di possesso, §2.110: in vigore sulla catena dal redeploy dello stesso giorno, §2.111); prima 2026-09-17, commit `fd7f822` + §2.101 (§2.1 vendita diretta al 6%, §2.3-bis commissione sulle royalty), prima `94ae18f` (§2.4 storico prezzi) e `82a7a1b`. **Da far rivedere a un avvocato.** Non
è consulenza legale.*

Testi pronti da inserire nel sito, in italiano e in inglese. Sono pensati per il
prototipo attuale. I testi per un'offerta reale dipendono dal regime scelto:
ECSPR e prospetto hanno formati obbligatori per le avvertenze.

Le chiavi di traduzione vanno aggiunte in tutte le 9 lingue (`REPO_MAP.md`:
parità di chiavi obbligatoria). Le traduzioni diverse da italiano e inglese
richiedono una revisione umana.

---

## 1. Banner di sito (sempre visibile)

**IT** · Prototipo su rete di test. Nessun token ha valore o dà diritto a royalty.
Nulla su questo sito è un'offerta di investimento o una consulenza.
[Termini](…) · [Privacy](…)

**EN** · Testnet prototype. No token has value or entitles you to royalties.
Nothing on this site is an investment offer or advice. [Terms](…) · [Privacy](…)

*In uso dal 2026-09-16 (tecnico §2.91) nelle 9 lingue, sulle pagine interne e in fondo
alla landing, con in più la frase del §2.1 "cifre e rendimenti mostrati sono
dimostrativi e non verificati". Mancano ancora i link a Termini e Privacy: le
pagine non esistono.*

## 2. Avvertenze nel punto in cui si paga

### 2.1 Acquisto diretto di un token (catalogo)

**IT**
> - Stai usando USDC di test su Sepolia, **senza valore**.
> - Il 94% del prezzo va direttamente al wallet dell'artista; il 6% è la
>   commissione della piattaforma e **non è rimborsabile**.
> - Le royalty si pagano solo se qualcuno le versa sul contratto, e **nessuno
>   verifica** che corrispondano agli incassi reali. Dati di royalty e rendimenti
>   sono dimostrativi e non verificati.
> - La transazione è **irreversibile**.

**EN**
> - You are using Sepolia test USDC, **which has no value**.
> - 94% of the price goes straight to the artist's wallet; 6% is the platform
>   fee and is **non-refundable**.
> - Royalties are paid only if someone deposits them on the contract, and **no
>   one checks** that they match the track's real income. Royalty figures and
>   yields are illustrative and unverified.
> - The transaction is **irreversible**.

### 2.2 Contributo a una campagna di pre-produzione

**IT**
> - I fondi restano nel contratto escrow e vengono pagati a tranche quando
>   artista e uno studio verificato dalla piattaforma confermano le milestone.
>   **[Se la campagna non ha uno studio: ogni tranche si rilascia con la sola
>   conferma dell'artista, e nessun terzo controlla la milestone.]**
> - **[Se la campagna ha un anticipo: il X% della raccolta va all'artista appena
>   i fondi lo coprono, senza nessuna conferma. Quella parte non è protetta
>   dalla doppia conferma e, se la campagna viene annullata, non ti viene
>   rimborsata.]**
> - **Scadenza e soglia minima.** Se entro la data indicata la campagna non
>   raccoglie la soglia minima, fallisce e puoi recuperare quanto hai versato
>   meno il 2%. Raggiunta la soglia, la campagna resta aperta senza scadenza e
>   le tranche si pagano man mano che i fondi le coprono, anche se l'obiettivo
>   pieno non viene mai raggiunto.
> - Il 2% del contributo è la commissione della piattaforma e **non viene
>   restituito, neanche se la campagna è annullata**.
> - La piattaforma può **annullare la campagna** se contiene contenuti illeciti
>   o che violano diritti di terzi. In quel caso ricevi la tua quota della parte
>   non ancora pagata. Per il resto conservi i tuoi diritti verso l'artista, ma
>   recuperarlo può richiedere tempo, costi e un'azione legale e **non è
>   garantito**.
> - Il rimborso spetta a **chi possiede i token** al momento della richiesta, e i
>   token restituiti vengono **distrutti**. Se vendi i tuoi token, il rimborso
>   passa a chi li compra.
> - Il brano potrebbe non essere mai completato né guadagnare nulla. **Puoi
>   perdere tutto.**

**EN**
> - Funds stay in the escrow contract and are paid out in tranches when the
>   artist and a studio verified by the platform confirm each milestone. **[If
>   the campaign has no studio: each tranche is released on the artist's
>   confirmation alone, and no third party checks the milestone.]**
> - **[If the campaign has an advance: X% of the raise goes to the artist as
>   soon as funds cover it, with no confirmation. That part is not protected by
>   the double confirmation and is not refunded if the campaign is cancelled.]**
> - **Deadline and minimum.** If the campaign does not raise its minimum by the
>   date shown, it fails and you can reclaim what you paid, less 2%. Once the
>   minimum is in, the campaign stays open with no deadline and tranches are
>   paid as funds cover them, even if the full goal is never reached.
> - 2% of your contribution is the platform fee and is **not returned, even if
>   the campaign is cancelled**.
> - The platform can **cancel the campaign** if it contains unlawful content or
>   infringes third-party rights. You then receive your share of what hasn't
>   been paid out. For the rest you keep your claims against the artist, but
>   recovering it may take time, cost money and require legal action, and **is
>   not guaranteed**.
> - The refund goes to **whoever holds the tokens** when claiming it, and the
>   returned tokens are **destroyed**. If you sell your tokens, the refund right
>   goes with them.
> - The track may never be finished or earn anything. **You can lose
>   everything.**

### 2.3 Rivendita (marketplace)

**IT**
> - Il prezzo lo sceglie il venditore: **non è una valutazione** della
>   piattaforma.
> - Il venditore riceve il 99%; l'1% è la commissione della piattaforma.
> - Se compri token di una campagna che viene poi annullata, hai diritto alla
>   stessa quota di rimborso per token di chi aveva contribuito, restituendo i
>   token. **Il prezzo che hai pagato non conta**: potresti ricevere meno.
> - Non c'è garanzia di poter rivendere.

**EN**
> - The seller sets the price: **it is not a valuation** by the platform.
> - The seller receives 99%; 1% is the platform fee.
> - If you buy tokens of a campaign that is later cancelled, you get the same
>   refund per token as the original contributor, by handing the tokens back.
>   **The price you paid does not matter**: you may receive less.
> - There is no guarantee you can resell.

### 2.3-bis Versamento di royalty (modulo dell'artista)

**IT**
> - La piattaforma trattiene l'**1%** di quanto versi come commissione di
>   distribuzione; il resto è diviso fra chi ha posseduto i token dal
>   versamento precedente, in proporzione ai token e al tempo.
> - **Versa ogni rendiconto appena arriva**: un versamento in ritardo è diviso
>   anche con chi ha comprato nel frattempo.
> - L'1% si applica anche alla quota dei token **invenduti**, che torna al tuo
>   stesso wallet.
> - Un versamento **non si può ritirare** e nessuno verifica che corrisponda
>   agli incassi reali del brano.

**EN**
> - The platform keeps **1%** of what you deposit as a distribution fee; the
>   rest goes to whoever held the tokens since the previous deposit, by tokens
>   and time held.
> - **Deposit each statement as soon as it arrives**: a late deposit is also
>   shared with whoever bought in the meantime.
> - The 1% applies to the **unsold** tokens' share too, which comes back to your
>   own wallet.
> - A deposit **cannot be taken back**, and no one checks that it matches the
>   track's real income.

### 2.4 Storico prezzi del token (pagina asset)

Accanto al grafico (§2.94). Il testo nel sito è già questo.

**IT**
> Ogni giorno mostra il prezzo più basso a cui il token è passato di mano a
> pagamento (raccolta, acquisto diretto o rivendita); nei giorni senza scambi
> resta l'ultimo. I prezzi passati non indicano quelli futuri.

**EN**
> Each day shows the lowest price the token changed hands at for payment
> (campaign, direct purchase or resale); days without trades keep the last one.
> Past prices do not indicate future ones.

Da valutare con l'avvocato (07 A4): con pochi scambi un solo acquisto a prezzo
alto sposta tutto il grafico, e il grafico può sembrare una quotazione. Il
prezzo della rivendita lo sceglie il venditore (§2.3), non la piattaforma.

### 2.5 Calcolatore delle royalty master (pagina della campagna)

Pubblico, sulla pagina di ogni campagna lanciata (§2.121). Sotto il calcolo il
sito mostra la formula, i numeri usati e questi testi, già in uso nelle 9 lingue.

**IT**
> Per token al mese = Σ (stream × USD per stream) × (1 − commissione
> distributore) × (1 − 1% Humfiverse) ÷ token totali.
>
> Gli USD per stream di partenza sono medie di pagamenti passati, tratte da
> stime di settore pubblicate: nessuno store pubblica una tariffa fissa. Il
> pagamento reale cambia con paese, tipo di abbonamento e mese.
>
> Conta solo le royalty master, pagate dal distributore: sono quelle cedute ai
> possessori dei token. Le royalty di diritto d'autore (SIAE o altre società di
> collecting) restano agli autori e non fanno parte del token.
>
> **È un calcolo matematico su medie passate, non una previsione. I risultati
> passati non garantiscono i guadagni futuri che la formula mostra: stream,
> tariffe e commissioni possono cambiare, anche in peggio.**

**EN**
> This is arithmetic on past averages, not a forecast. Past results do not
> guarantee the future earnings the formula shows: streams, rates and
> commissions can change, including for the worse.

Da valutare con l'avvocato (07 A16): il calcolatore mostra anche il risultato
annuo come % del prezzo del token, che un lettore può leggere come rendimento
atteso.

## 3. Rischi da aggiungere al whitepaper, cap. 8

Punti presenti nel codice e non ancora nel capitolo sui rischi (file 03, W-14).
Testo in inglese, come il whitepaper.

**Platform powers**
- **The operator can release pool tokens without payment.** Until this power is
  restricted, it could dilute existing holders' share, or leave a campaign
  unable to sell its full supply.
- **The operator can cancel a campaign** on stated legal grounds (unlawful or
  infringing content). Contributors are then refunded only the unreleased part;
  recovering released tranches from the artist is a legal claim, not an
  on-chain guarantee.
- **One key controls the operator role today.** If it were compromised,
  everything that role can do could be done by someone else.
- **Token metadata can be changed** by the platform after tokens are sold. The
  linked audio can be replaced by the owner multisig; the operator can only
  link it the first time or remove it (from the next contract deploy, §2.110).

**Campaign mechanics**
- **A minimum, not all-or-nothing.** Each campaign must raise the minimum the
  artist set by its deadline, or it fails and refunds holders (less the 2% fee).
  Above the minimum, a partly funded campaign can pay out its first tranches and
  stay open indefinitely.
- **A campaign without a studio is released by the artist alone.** With a
  studio, the studio is one the platform verified; the check is made off
  chain, and the contract cannot tell two wallets of one person apart.
- **When a royalty deposit is made decides who shares it.** A deposit pays for
  the time since the previous one, split by tokens and time held; a late
  deposit is also shared with whoever bought in the meantime.
- **Refunds follow tokens and burn them.** The refund per token is the same for
  everyone, whatever they paid; tokens handed back stop earning royalties.
- **Royalty deposits are not verified.** The artist, or the platform on the
  artist's behalf, deposits them; nothing on chain obliges anyone to deposit or
  to keep to the agreed schedule. Each deposit carries the fingerprint of a
  statement file, which the artist may choose to publish, but no one checks that
  the statement is genuine or matches the track's real income.

**Data**
- **What is written on-chain or to IPFS is permanent** — including artist
  names, track titles and audio — and cannot be deleted on request.

## 4. Nota a piè di pagina per la pagina del questionario di adeguatezza

**IT** · Questo questionario è dimostrativo e non è una valutazione di
adeguatezza ai sensi della normativa MiFID II. **Non inserire dati personali
reali.**

**EN** · This questionnaire is illustrative and is not an appropriateness
assessment under MiFID II. **Do not enter real personal data.**
