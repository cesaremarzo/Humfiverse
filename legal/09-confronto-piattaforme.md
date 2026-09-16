# Come si sono messe in regola le altre piattaforme

*Revisione del 2026-09-16, commit `7765a2d`. Non è consulenza legale.*

Tre piattaforme che vendono al pubblico quote di royalty musicali esistono e
operano da anni: **ANote Music** (Lussemburgo), **SongVest** (USA) e **Royalty
Exchange** (USA). Questo documento ricostruisce come ognuna ha risolto il
problema regolamentare, da fonti dirette (i loro termini e pagine legali, e per
SongVest il documento d'offerta depositato alla SEC), e ne ricava cosa può fare
Humfiverse.

Completa il file 01, che spiega le norme, e il file 07, che raccoglie le
domande. Le note interne (`planning/legal-regulatory-notes.md` §2) trattavano
già JKBX, Royal e anotherblock: queste tre sono diverse e più utili, perché due
sono frazionate e vendute a investitori al dettaglio, e una è europea.

---

## 1. Il quadro in una tabella

| | **ANote Music** (LU) | **SongVest** (USA) | **Royalty Exchange** (USA) |
|---|---|---|---|
| Cosa compra l'investitore | Quote di un *royalty interest*: il diritto contrattuale a percepire proventi futuri | *Royalty Share Units* di una serie di RoyaltyTraders LLC (Delaware) | L'asset di royalty per intero, un solo acquirente |
| Qualifica giuridica scelta | **Non è uno strumento finanziario MiFID**, quindi niente vigilanza CSSF | **Security**, offerta **Reg A+ Tier 2** qualificata dalla SEC (prima qualificazione 28 set 2021) | Compravendita di un bene, non di un titolo (deduzione: non lo dichiarano) |
| Chi tiene i soldi | **Mangopay**, istituto di pagamento vigilato CSSF, e-wallet segregati | **Dalmore Group** (broker-dealer FINRA) per KYC/AML, **North Capital** come escrow agent | Bonifico al closing; poi amministra gli incassi per conto dell'acquirente |
| Diritto d'autore | Resta al titolare | Resta al titolare: le unit non danno proprietà del catalogo | Di regola non compreso nella cessione |
| Durata | 5, 10, 12 anni o "a vita", a scelta di chi lista | Per asset, definita nel Royalty Share Agreement | *Life of rights*, a termine (10 o 30 anni) o a ritorno fisso |
| Mercato secondario | **Sì**: asta iniziale, poi mercato interno (commissioni 4% in asta, 8% sul secondario) | **Nessuno**: "non esiste un mercato di negoziazione" | *Order book*, ma solo asset interi: non si frazionano |
| Filtro sugli asset | Almeno 5 anni di storico, media ≥ 10.000 €/anno, di norma max 50% del catalogo | Cataloghi già affermati, con storico | Storico degli incassi pubblicato nell'annuncio |
| Tutela dell'investitore | *Investor Protection Programme*: avvisi su liquidità e prezzi anomali (funzione di prodotto, non tutela di legge) | Documento d'offerta; per i non accreditati tetto del **10%** del reddito o del patrimonio | Sindacati privati riservati agli **investitori accreditati**; l'order book no |
| Commissioni | 4% / 8% sulle distribuzioni, con tetto allo 0,5% della capitalizzazione | *Sourcing fee* 0–25% del prezzo d'acquisto, *administrative fee* fino al 10% delle distribuzioni | 1% al venditore per l'amministrazione dei pagamenti; 15% di commissione di mercato, 500 $ all'acquirente |

## 2. ANote Music: la tesi europea

ANote S.A. è lussemburghese (registrata il 30 luglio 2018, piattaforma aperta al
pubblico il 28 luglio 2020). La sua posizione è dichiarata nei termini:

> *Neither music royalties nor royalty interests constitute "financial
> instruments" within the meaning of the MiFID (…) and the LFS (the Law of
> financial services of 5 April 1993, as amended).*

Di conseguenza: nessuna autorizzazione CSSF, nessun prospetto, accesso aperto al
pubblico al dettaglio, mercato secondario interno. L'unico pezzo regolato è il
denaro, affidato a Mangopay.

**Cosa regge questa tesi.** L'investitore compra un credito contrattuale verso
ANote, non un titolo emesso da un veicolo; il diritto d'autore non si muove;
non c'è blockchain, quindi MiCA non entra mai in gioco.

**Cosa la indebolisce, per noi.**
- È **una dichiarazione della società**, non una decisione della CSSF né una
  sentenza. Non ho trovato nessun atto dell'autorità che la confermi. Funziona
  da sei anni, il che è un fatto, ma non è un precedente su cui costruire.
- Le quote sono **standardizzate, fungibili e rivendibili su un mercato gestito
  dalla stessa piattaforma**: sono esattamente i tratti che portano verso la
  nozione di valore mobiliare.
- In **Italia** la nozione rilevante è più ampia di quella MiFID: i *prodotti
  finanziari* del TUF (art. 1, comma 1, lett. u) comprendono "ogni altra forma
  di investimento di natura finanziaria", e l'offerta al pubblico di prodotti
  finanziari richiede comunque il prospetto (art. 94 TUF). La CONSOB può far
  oscurare i siti che offrono prodotti finanziari senza titolo (art. 7-octies
  TUF) **[verificare]**. Una piattaforma con base in Italia è esposta qui, anche
  se la tesi MiFID reggesse.

## 3. SongVest: la strada della registrazione

L'emittente è **RoyaltyTraders LLC** (Delaware, costituita il 18 marzo 2021),
dal 2024 controllata da SAJA LLC. Ogni offerta è una **serie** che rappresenta
diritti contrattuali sui flussi di uno specifico asset: comprare le unit "non
conferisce all'investitore alcuna proprietà della nostra società né del catalogo
sottostante". Le royalty incassate finiscono su un conto dedicato e sono
distribuite **ogni trimestre** pro quota, al netto delle commissioni.

Elementi da notare, tutti trasferibili a Humfiverse:
- **Reg A+ Tier 2** invece della registrazione piena: è la via intermedia, aperta
  anche ai non accreditati con il tetto del 10% del reddito o del patrimonio.
- **Il KYC/AML lo fa un soggetto autorizzato**, Dalmore, non la piattaforma: 1%
  di commissione più 15.000 $ di attivazione.
- **Asta "test the waters"** (Rule 255) prima dell'offerta, a secondo prezzo, per
  scoprire quanto sono disposti a pagare gli investitori. Il risultato orienta
  il prezzo ma non vincola l'emittente. È un modo elegante di fare *price
  discovery* senza aprire un mercato secondario.
- **Nessun mercato secondario.** Il documento dice apertamente che non esiste e
  che potrebbe non esistere mai, e avverte sulle restrizioni statali alla
  rivendita. La piattaforma più prudente delle tre è anche quella senza
  secondario.

## 4. Royalty Exchange: evitare il problema vendendo il bene intero

Fondata nel 2011, oggi a Denver. All'asta l'acquirente è **uno solo** e compra
l'asset per intero: non c'è frazionamento, e l'order book stesso non consente di
spezzare un catalogo ("se possiedi un catalogo di 10 opere, le vendi tutte
insieme"). Le durate sono *life of rights* (vita dell'autore più 70 anni), a
termine (10 o 30 anni) o a ritorno fisso.

Su questa base l'acquisto somiglia alla compravendita di un bene, non a un
investimento gestito da altri, e l'order book resta aperto anche ai non
accreditati. Quando invece hanno provato a **frazionare**, sono dovuti passare
dalla SEC: *Royalty Flow*, costituita nel settembre 2017 per acquisire la quota
dei Bass Brothers sul catalogo Eminem 1999-2013, ha depositato una Reg A+ per
raccogliere 11-50 milioni di dollari con quotazione al Nasdaq. **L'IPO è stata
annullata il 9 aprile 2018**, dopo che il Nasdaq ha revocato l'approvazione
condizionata. Le frazioni oggi esistono solo nei *private syndicates*, riservati
agli investitori accreditati.

Lezione secca: **il frazionamento è ciò che fa scattare la disciplina dei
titoli.** Humfiverse è frazionata per costruzione.

## 5. Le tre cose che fanno tutte allo stesso modo

1. **Nessuna vende il diritto d'autore.** Vendono il flusso di proventi. Il
   contratto artista di Humfiverse fa lo stesso: è la scelta giusta.
2. **Nessuna tocca i soldi degli investitori.** C'è sempre un soggetto
   autorizzato in mezzo: istituto di pagamento, broker-dealer, escrow agent.
   In Humfiverse i fondi stanno in un escrow di cui il Founder è `owner`, e il
   ricavato della vendita primaria va **direttamente al wallet dell'artista**.
3. **Nessuna finanzia brani non ancora pubblicati.** Vendono cataloghi che
   incassano da anni, con soglie di ammissione (ANote: 5 anni e 10.000 €/anno).
   Il modello **pre-produzione** di Humfiverse non ha precedenti tra le tre: è
   la parte più innovativa e, dal lato regolamentare, la più esposta, perché
   senza storico non si possono dare agli investitori le informazioni che le
   altre danno.

## 6. Perché Humfiverse non può semplicemente copiare ANote

- **Il token cambia il quadro.** Se il diritto non è uno strumento finanziario
  ma è incorporato in un token, si ricade in **MiCA**: white paper notificato
  all'autorità (notifica, non approvazione), offerente che dev'essere una
  persona giuridica, ed esenzioni strette — meno di 1 milione di euro in 12
  mesi, meno di 150 persone per Stato membro, o soli investitori qualificati.
  Il marketplace diventerebbe gestione di una piattaforma di negoziazione di
  cripto-attività, cioè servizio **CASP** autorizzato. ANote questo problema non
  ce l'ha, perché non usa blockchain. **[verificare]** il coordinamento con la
  nozione italiana di prodotto finanziario.
- **L'Italia** (§2 sopra): i prodotti finanziari del TUF sono più ampi degli
  strumenti finanziari MiFID.
- **Il mercato secondario di Humfiverse è già reale** e trattiene l'1%
  (`HumfiverseMarketplace`), mentre due piattaforme su tre non hanno un
  secondario frazionato e la terza vive sulla tesi non confermata del §2.
- **La pre-produzione** è finanziamento di un progetto: è il terreno tipico del
  crowdfunding (ECSPR), non quello della cessione di cataloghi.

## 7. Cosa dovrebbe fare Humfiverse, in ordine

Conferma la strada già scelta il 28 agosto 2026 (token = strumento finanziario,
veicolo lussemburghese, note §7), e prende dalle tre piattaforme il *come*.

**Fase 0 — prototipo di oggi, costo quasi nullo**
- Solo testnet e nessun valore reale, dichiarato in ogni pagina; via i termini
  promozionali che promettono rendimenti (07 G2).
- **Blocco geografico degli Stati Uniti**: SongVest dimostra che lì lo stesso
  diritto contrattuale è un titolo da registrare (07 E1).
- Chiudere il pregresso sui dati KYC raccolti senza titolare né informativa
  (07 H1) e decidere la società (07 G1).

**Fase 1 — primo pilota con denaro reale, sul modello SongVest/ANote**
- **Solo cataloghi già pubblicati**, con il filtro di ANote (storico minimo e
  soglia di incassi). La pre-produzione resta ferma.
- **Collocamento tramite un soggetto già autorizzato** — una piattaforma ECSP o
  una SIM — invece di prendere una licenza propria (note §7.1: 80-250 K€). È
  l'equivalente di Dalmore per SongVest.
- **I fondi presso un istituto di pagamento autorizzato** (Mangopay, Lemonway o
  simili) o comunque con una struttura di custodia lecita: non un escrow di cui
  il Founder è `owner`.
- **Marketplace spento**, oppure ridotto a **bacheca** di annunci senza
  abbinamento automatico degli ordini (ECSPR art. 25). Evita la licenza di sede
  di negoziazione (MTF/OTF), che è la più pesante di tutte.
- **Token *permissioned*** (ERC-3643 o simili): trasferibile solo tra wallet
  verificati, con un fornitore KYC vero al posto dell'autodichiarazione.
- **Price discovery come SongVest**: asta non vincolante prima dell'offerta,
  invece di un mercato continuo.

**Fase 2 — licenza ECSP propria (CONSOB) e ritorno della pre-produzione**
Ogni campagna diventa un'offerta di crowdfunding. Comporta, sul prodotto:
- **scheda informativa (KIIS)** per ogni campagna;
- **test di ingresso** e simulazione della capacità di sostenere perdite;
- **avvertenza e consenso esplicito** oltre 1.000 € o il 5% del patrimonio netto
  (ECSPR art. 21(7)) **[verificare il testo vigente]**;
- **periodo di riflessione di 4 giorni** (art. 22): `contribute()` non può
  consegnare il token nello stesso istante, o deve restare rimborsabile;
- tetto di **5 milioni di euro per artista** in 12 mesi;
- probabilmente una **soglia minima di raccolta** prima della prima tranche
  (07 B3).

**Fase 3 — mercato secondario vero**
Solo con un MTF partner o dentro il **DLT Pilot Regime**, non da soli.

## 8. Domande nuove che ne derivano

Aggiunte al file 07 come A10, A11, B6 e B7:

- **A10** La tesi di ANote ("il *royalty interest* non è uno strumento
  finanziario") regge in Italia davanti alla nozione di prodotto finanziario del
  TUF? E cambia qualcosa se lo stesso diritto viene incorporato in un token,
  cioè ricade in MiCA?
- **A11** Un veicolo di cartolarizzazione lussemburghese che emette **al
  pubblico in modo continuativo** (più di tre emissioni l'anno) deve essere
  **autorizzato dalla CSSF**. Una campagna per brano supera la soglia subito:
  conviene un veicolo autorizzato, tagli da almeno 100.000 €, solo clienti
  professionali, o collocamenti privati?
- **B6** L'ECSPR ammette veicoli dedicati solo per trasferire un bene illiquido
  o indivisibile: il flusso di royalty di un singolo brano rientra?
- **B7** Detenere USDC degli investitori in un escrow di cui la piattaforma è
  `owner` richiede una licenza di pagamento, di moneta elettronica o CASP?

---

## Fonti

Consultate il 16 settembre 2026.

| Fonte | Cosa se ne ricava |
|---|---|
| [ANote — come funziona](https://www.anotemusic.com/news/articles/how-anote-music-works-a-complete-guide-for-investors) | Definizione di *royalty interest*, asta, secondario, commissioni, Mangopay, tesi MiFID |
| [ANote — per chi detiene i diritti](https://www.anotemusic.com/music-creators) | Durate 5/10/12 anni o a vita, tetto del 50%, requisiti di ammissione, riacquisto |
| [ANote — termini del servizio di pagamento](https://www.anotemusic.com/payment-service-provider-terms-and-conditions) | Testo della dichiarazione MiFID/LFS e segregazione dei fondi |
| [P2P Dash — scheda ANote](https://p2pdash.com/platforms/anote/) | Dati societari, rischi dell'assenza di vigilanza |
| [SEC — RoyaltyTraders LLC, Form 1-A (2024)](https://www.sec.gov/Archives/edgar/data/1855626/000182912624006890/royaltytraders_1a.htm) | Struttura a serie, Reg A+ Tier 2, Dalmore, North Capital, commissioni, asta *test the waters*, assenza di mercato |
| [SongVest — disclaimer](https://www.songvest.com/disclaimers) | Data di qualificazione dell'offerta |
| [Royalty Exchange — il marketplace](https://royaltyexchange.com/blog/how-to-use-the-royalty-exchange-marketplace) | Tipi di asset e durate, aste, commissioni, accreditati |
| [Royalty Exchange — order book](https://royaltyexchange.com/blog/investing-on-the-order-book-webinar-replay) | Asset non frazionabili, accesso ai non accreditati |
| [Royalty Flow — Form 1-A POS](https://www.sec.gov/Archives/edgar/data/0001709847/000147793218000818/royalty_ex132.htm) · [Wikipedia](https://en.wikipedia.org/wiki/Royalty_Exchange) | Tentativo di frazionamento via Reg A+ e annullamento dell'IPO |
| [Maiak — veicoli di cartolarizzazione lussemburghesi](https://maiak.lu/library/securitisation-vehicles-in-luxembourg-structural-and-regulatory-attention-points) | Soglia dell'autorizzazione CSSF: emissione al pubblico e più di tre volte l'anno |
