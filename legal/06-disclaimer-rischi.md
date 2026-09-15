# Avvertenze e scheda rischi: bozza

*Bozza del 2026-09-15, commit `82a7a1b`. **Da far rivedere a un avvocato.** Non
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

## 2. Avvertenze nel punto in cui si paga

### 2.1 Acquisto diretto di un token (catalogo)

**IT**
> - Stai usando USDC di test su Sepolia, **senza valore**.
> - Il 98% del prezzo va direttamente al wallet dell'artista; il 2% è la
>   commissione della piattaforma e **non è rimborsabile**.
> - Il token **non paga royalty**: dati di royalty e rendimenti sono dimostrativi
>   e non verificati.
> - La transazione è **irreversibile**.

**EN**
> - You are using Sepolia test USDC, **which has no value**.
> - 98% of the price goes straight to the artist's wallet; 2% is the platform
>   fee and is **non-refundable**.
> - The token **pays no royalties**: royalty figures and yields are
>   illustrative and unverified.
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
> - Il rimborso spetta al wallet che ha contribuito, **non a chi compra i token
>   da te** in seguito.
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
> - The refund goes to the wallet that contributed, **not to anyone who later
>   buys the tokens from you**.
> - The track may never be finished or earn anything. **You can lose
>   everything.**

### 2.3 Rivendita (marketplace)

**IT**
> - Il prezzo lo sceglie il venditore: **non è una valutazione** della
>   piattaforma.
> - Il venditore riceve il 99%; l'1% è la commissione della piattaforma.
> - Se compri token di una campagna che viene poi annullata, **oggi non hai
>   diritto al rimborso**: spetta a chi aveva contribuito.
> - Non c'è garanzia di poter rivendere.

**EN**
> - The seller sets the price: **it is not a valuation** by the platform.
> - The seller receives 99%; 1% is the platform fee.
> - If you buy tokens of a campaign that is later cancelled, **you currently
>   have no refund right**: it belongs to the original contributor.
> - There is no guarantee you can resell.

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
- **Refunds follow contributions, not tokens.** Resale buyers of a cancelled
  campaign's tokens receive nothing.

**Data**
- **What is written on-chain or to IPFS is permanent** — including artist
  names, track titles and audio — and cannot be deleted on request.

## 4. Nota a piè di pagina per la pagina del questionario di adeguatezza

**IT** · Questo questionario è dimostrativo e non è una valutazione di
adeguatezza ai sensi della normativa MiFID II. **Non inserire dati personali
reali.**

**EN** · This questionnaire is illustrative and is not an appropriateness
assessment under MiFID II. **Do not enter real personal data.**
