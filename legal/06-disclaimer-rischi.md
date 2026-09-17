# Avvertenze e scheda rischi: bozza

*Bozza del 2026-09-17, commit `fd7f822` (§3 versamenti di royalty), prima `94ae18f` (§2.4 storico prezzi) e `82a7a1b`. **Da far rivedere a un avvocato.** Non
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
> - Il 98% del prezzo va direttamente al wallet dell'artista; il 2% è la
>   commissione della piattaforma e **non è rimborsabile**.
> - Le royalty si pagano solo se qualcuno le versa sul contratto, e **nessuno
>   verifica** che corrispondano agli incassi reali. Dati di royalty e rendimenti
>   sono dimostrativi e non verificati.
> - La transazione è **irreversibile**.

**EN**
> - You are using Sepolia test USDC, **which has no value**.
> - 98% of the price goes straight to the artist's wallet; 2% is the platform
>   fee and is **non-refundable**.
> - Royalties are paid only if someone deposits them on the contract, and **no
>   one checks** that they match the track's real income. Royalty figures and
>   yields are illustrative and unverified.
> - The transaction is **irreversible**.

### 2.2 Contributo a una campagna di pre-produzione

**IT**
> - I fondi restano nel contratto escrow e vengono pagati a tranche quando
>   artista e studio confermano le milestone. **[Se la campagna non ha uno
>   studio: basta la conferma dell'artista.]**
> - **La campagna non ha scadenza.** Le prime tranche possono essere pagate
>   anche se l'obiettivo non viene raggiunto, e non esiste un rimborso
>   automatico.
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
>   artist and the studio confirm each milestone. **[If the campaign has no
>   studio: the artist's confirmation alone is enough.]**
> - **The campaign has no deadline.** Early tranches can be paid even if the
>   goal is never reached, and there is no automatic refund.
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
- **Token metadata and the linked audio can be changed** by the operator after
  tokens are sold.

**Campaign mechanics**
- **Campaigns have no deadline and no all-or-nothing rule.** A partly funded
  campaign can pay out its first tranches and stay open indefinitely.
- **A campaign without a studio is released by the artist alone.**
- **Refunds follow tokens and burn them.** The refund per token is the same for
  everyone, whatever they paid; tokens handed back stop earning royalties.
- **Royalty deposits are not verified.** The artist, or the platform on the
  artist's behalf, deposits them; nothing on chain obliges anyone to deposit or
  to keep to the agreed schedule. Each deposit points to a published statement
  file, but no one checks that the statement is genuine or matches the track's
  real income.

**Data**
- **What is written on-chain or to IPFS is permanent** — including artist
  names, track titles and audio — and cannot be deleted on request.

## 4. Nota a piè di pagina per la pagina del questionario di adeguatezza

**IT** · Questo questionario è dimostrativo e non è una valutazione di
adeguatezza ai sensi della normativa MiFID II. **Non inserire dati personali
reali.**

**EN** · This questionnaire is illustrative and is not an appropriateness
assessment under MiFID II. **Do not enter real personal data.**
