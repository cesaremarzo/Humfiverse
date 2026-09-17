# Termini di Servizio: bozza

*Bozza del 2026-09-15, commit `82a7a1b`; §5.3 aggiornato il 2026-09-17 (ordine delle milestone); §5.7 il 2026-09-17 (chi versa le royalty e rendiconto, pubblicazione facoltativa, §2.98); §12 il 2026-09-17 (guida automatica, §2.100). **Da far rivedere a un avvocato prima
della pubblicazione.** Non è consulenza legale.*

## Note per chi usa questa bozza (da togliere prima di pubblicare)

- Descrive il servizio **com'è oggi**: un prototipo su testnet senza valore
  economico. È quindi pubblicabile presto, dopo la revisione, ed è il documento
  che manca adesso.
- I riquadri **[AL LANCIO]** indicano le parti da scrivere o sostituire quando
  ci sarà un'offerta reale. Dipendono dalle risposte alle domande A1–A6 del
  file 07.
- I segnaposto `[…]` vanno riempiti. Il più importante è `[GESTORE]`: oggi non
  esiste una società. Senza un soggetto identificato questi Termini non hanno
  una controparte (domanda G1).
- La lingua: pubblicare in italiano e inglese, indicando quale prevale.
- Numerazione: non cambiarla dopo la pubblicazione, perché i file 05 e 06 la
  citano.

---

# Termini di Servizio di Humfiverse

**Versione:** 0.1-bozza · **In vigore dal:** [data]

## 1. Chi siamo

Il sito [URL: cesaremarzo.github.io/Humfiverse e altri domini] e i servizi
collegati ("**Humfiverse**" o la "**Piattaforma**") sono gestiti da
[GESTORE: denominazione, forma giuridica, sede, codice fiscale/partita IVA,
numero REA, PEC, email di contatto] ("**noi**").

## 2. Cosa è oggi Humfiverse: un prototipo senza valore economico

2.1. Humfiverse è un **prototipo dimostrativo**. Gli smart contract girano su
**Ethereum Sepolia, una rete di test**. Gli USDC e gli ETH usati su Sepolia
**non hanno valore economico** e non si possono convertire in denaro tramite la
Piattaforma.

2.2. **Nessun token presente sulla Piattaforma è un'offerta di strumenti
finanziari, di cripto-attività o di prodotti di investimento**. Il contratto dei
token permette di versare e riscuotere royalty (§5.7), ma su questa rete di test
si usano solo USDC di test **senza valore**: nessun token dà diritto a pagamenti
con valore economico. Le cifre di rendimento e i dati di royalty mostrati sono
inseriti dagli utenti a scopo dimostrativo e non sono verificati.

2.3. Non esiste oggi alcuna entità che detenga diritti su royalty per conto dei
possessori di token. Le strutture descritte nel whitepaper sono **progetti**,
non ancora realizzati.

2.4. Non siamo autorizzati da alcuna autorità di vigilanza (CONSOB, Banca
d'Italia, CSSF o altre) a prestare servizi di investimento, servizi per le
cripto-attività, servizi di crowdfunding o di pagamento, e con il prototipo non
li prestiamo.

> **[AL LANCIO]** Sostituire l'intera sezione 2 con: la natura giuridica del
> token, l'emittente, il riferimento al prospetto, al documento informativo o
> alla scheda (KIIS), l'autorizzazione ottenuta o il soggetto autorizzato che
> colloca, e il diritto di recesso o il periodo di riflessione applicabile.

## 3. Chi può usare la Piattaforma

3.1. Per usare la Piattaforma devi avere almeno 18 anni e la capacità di
concludere contratti.

3.2. Non puoi usare la Piattaforma se sei soggetto a sanzioni dell'Unione
Europea, delle Nazioni Unite o [degli Stati Uniti], o se risiedi in un Paese in
cui l'uso è vietato.

> **[AL LANCIO]** Elenco dei Paesi esclusi (almeno Stati Uniti e Paesi
> sanzionati, domande D1 e E1), obbligo di KYC reale, classificazione
> dell'investitore (MiFID o ECSPR) e blocco dei trasferimenti a wallet non
> verificati.

## 4. Wallet e accesso

4.1. Puoi accedere con un wallet tuo (per esempio MetaMask) o con un **wallet
integrato** creato tramite login con Google, Apple o email e fornito da un
servizio terzo, **thirdweb**. Il wallet integrato è gestito secondo i termini di
thirdweb: [link].

4.2. **Noi non custodiamo le tue chiavi private** e non possiamo recuperare un
wallet perso, annullare una transazione o riportare indietro token inviati a un
indirizzo sbagliato.

4.3. Le transazioni sulla blockchain sono **pubbliche e irreversibili**. Il tuo
indirizzo wallet, i tuoi saldi e le tue operazioni sono visibili a chiunque.

4.4. Sul wallet integrato, il costo del gas su Sepolia può essere pagato da un
servizio di sponsorizzazione di thirdweb. Possiamo sospendere la
sponsorizzazione in qualsiasi momento.

## 5. Come funzionano i contratti (in sintesi)

Questa sezione riassume il comportamento degli smart contract alla versione
indicata in testa. **In caso di differenza prevale il codice del contratto
verificato**, pubblicato su Etherscan agli indirizzi indicati nell'app.

5.1. **Token.** Ogni brano o catalogo corrisponde a un token con un numero di
unità fisso, deciso alla creazione, e un prezzo fisso. Nessuno può creare nuove
unità dello stesso token.

5.2. **Poteri del gestore.** I contratti hanno due ruoli della Piattaforma.
Il **proprietario** ("**Owner**", [indirizzo]) è un wallet multifirma che agisce
solo con 2 firme su 3 e può, tra l'altro:
(a) **consegnare token del pool a un indirizzo senza pagamento**;
(b) **annullare una campagna** per i motivi e con la procedura del §5.6,
bloccando i rilasci futuri e aprendo i rimborsi;
(c) cambiare l'indirizzo dei metadati dei token e gli indirizzi che ricevono le
commissioni e i ricavi.
L'**operatore** ("**Founder**", [indirizzo]), usato dai nostri sistemi, può
soltanto:
(d) creare token e campagne;
(e) registrare, disattivare e rinominare gli studi;
(f) collegare o cambiare il file audio di un token.

> Nota per l'avvocato: 5.2(a) descrive un potere che il team intende limitare
> (file 02, C-1). Dichiararlo qui è la scelta onesta finché esiste. 5.2(b) è un
> potere mantenuto per decisione (note legali §7.10), limitato ai motivi del
> §5.6. Il contratto registra motivo e hash della decisione, ma accetta ancora un
> annullamento senza motivo finché resta una tranche da pagare: il limite ai soli
> motivi di legge è contrattuale (file 02, C-2).

5.3. **Campagne di pre-produzione (escrow).** I contributi restano nel contratto
escrow e vengono rilasciati a tranche quando sia l'artista sia lo studio
confermano la milestone. Se la campagna non ha uno studio, basta la conferma
dell'artista. Le milestone si confermano **nell'ordine fissato dall'artista alla
creazione della campagna**: una milestone non può essere pagata prima di quella
precedente. Una tranche si rilascia appena i fondi raccolti coprono lei e quelle
già pagate, **anche se l'obiettivo complessivo non è stato raggiunto**.
> *Nota per il team:* dal 2026-09-17 l'ordine lo verifica anche il contratto
> escrow (technical §2.96-§2.97).

**Le campagne non hanno
scadenza**: una campagna si chiude solo quando tutti i token sono venduti, quando
tutte le tranche sono rilasciate o quando viene annullata. Non esiste un rimborso
automatico se l'obiettivo non viene raggiunto. Se artista e studio non
confermano, i fondi restano nel contratto finché la campagna non viene annullata.

5.4. **Rimborsi.** Se una campagna viene annullata, **chi possiede i token**
della campagna può restituirli e ricevere la loro quota di quanto non era ancora
stato rilasciato al momento dell'annullamento. La quota è uguale per ogni token,
anche per chi li ha comprati da un altro utente. **I token restituiti vengono
distrutti** e non danno più diritto a royalty future; le royalty maturate prima
della restituzione restano riscuotibili. La commissione di contribuzione non è
rimborsata.

> Nota: le due campagne concluse prima del 2026-09-17 restano sul vecchio
> contratto, dove il rimborso spetta a chi ha contribuito. Sono rilasciate per
> intero e non hanno nulla da rimborsare.

5.6. **Annullamento di una campagna.**
(a) Possiamo annullare una campagna solo se: (i) contiene contenuti illeciti;
(ii) viola diritti d'autore, diritti connessi, diritti all'immagine, marchi o
altri diritti di terzi, come risulta da una segnalazione circostanziata del
titolare, da un ordine di un'autorità o da una decisione giudiziaria; oppure
(iii) le dichiarazioni e garanzie dell'artista su questi aspetti risultano false.
(b) Prima di annullare informiamo l'artista dei motivi e gli diamo 5 giorni
per rispondere, salvo i casi in cui il contenuto deve essere rimosso subito per
legge o per ordine di un'autorità. La decisione è motivata, datata e conservata,
e comunicata agli investitori della campagna.
(c) Con l'annullamento gli investitori ricevono il rimborso pro-quota della
parte non ancora rilasciata (§5.4).
(d) **Il rimborso non estingue i diritti degli investitori verso l'artista**:
l'artista resta responsabile della restituzione delle tranche già rilasciate e
del risarcimento del danno, secondo l'Accordo Artista e l'Accordo Investitore.
(e) Un annullamento per questi motivi non costituisce inadempimento nostro.
(f) Negli stessi casi possiamo rimuovere dalla Piattaforma pagina, audio e
metadati della campagna, secondo il §8.4 e il §10. Il tuo portafoglio continua a
mostrare i token e l'eventuale rimborso.

(g) La commissione di contribuzione del 2% resta a noi anche in caso di
annullamento; quando l'annullamento dipende dall'artista, è compresa nel danno
che l'artista deve risarcire.

> **[AL LANCIO]** Dal redeploy "phase 2" (2026-09-17) il rimborso spetta a chi
> possiede i token (decisione del 2026-09-15). Ancora da decidere con l'avvocato (file 07, C2, C5): chi esercita l'azione
> contro l'artista (ogni investitore o un soggetto per tutti, con mandato o
> cessione del credito); se lo studio che ha ricevuto tranche in buona fede è
> esposto.

5.5. **Rivendita.** Puoi mettere in vendita i tuoi token a un prezzo che scegli.
Noi non garantiamo che esista un compratore né un prezzo.

5.7. **Royalty.** Chiunque può versare USDC come royalty di un token tramite il
contratto. Ogni versamento è diviso subito in parti uguali su tutti i token
esistenti in quel momento, compresi quelli non ancora venduti, la cui quota
spetta all'artista. Ogni possessore riscuote la propria quota quando vuole;
quanto maturato prima di una vendita resta a chi ha venduto. Un versamento non si
può ritirare. La Piattaforma non trattiene commissioni sulle royalty.

5.7.1. **Chi versa e quando.** Le royalty sono versate dall'artista, che le
incassa e le converte in USDC, oppure dalla Piattaforma dopo averle ricevute
dall'artista. La frequenza varia, entro l'intervallo fissato per ogni token
nell'accordo con l'artista [indicato nella pagina dell'asset]. **Il contratto non
obbliga nessuno a versare né a rispettare l'intervallo**: se l'artista non versa,
resta solo un'azione contrattuale verso di lui.

5.7.2. **Rendiconto.** Ogni versamento indica l'impronta SHA-256 del file del
rendiconto da cui proviene. Chi versa **può** pubblicare il file su IPFS, collegato
nello storico dei versamenti; in quel caso chiunque può verificare che l'impronta
coincida. Se il file non è pubblicato, l'impronta resta e permette di verificarlo
quando viene mostrato. La pubblicazione non incide sul pagamento delle royalty. **Né il
contratto né la Piattaforma verificano che il rendiconto sia vero o che i
versamenti corrispondano agli incassi reali del brano.**

> Nota per l'avvocato: servono l'intervallo per token nel wizard (08 C-12), il
> ruolo della Piattaforma quando riceve e converte il denaro (07 A12).

## 6. Commissioni

6.1. Le commissioni sono fissate nel codice dei contratti e **trattenute
dall'importo pagato**, non aggiunte:

| Operazione | Commissione | Rimborsabile? |
|---|---|---|
| Acquisto diretto di un token dal pool | 2% del prezzo | No |
| Contributo a una campagna | 2% del contributo | **No, neanche se la campagna viene annullata** |
| Rilascio di una tranche all'artista o allo studio | 3% della tranche | Non applicabile |
| Rivendita tra utenti | 1% del prezzo, a carico del venditore | No |

6.2. Le commissioni sono inviate all'indirizzo "**Fees**" ([indirizzo]), che il
gestore può cambiare.

6.3. Il gas della rete è a tuo carico, salvo la sponsorizzazione del §4.4.

> **[AL LANCIO]** Da confrontare con le regole su recesso, periodo di
> riflessione e clausole abusive (domanda F2). Una commissione trattenuta
> quando è la Piattaforma ad annullare potrebbe non reggere.

## 7. Verifica dell'identità (KYC) nel prototipo

7.1. Il modulo di verifica e il questionario di adeguatezza sono
**dimostrativi**: non verificano documenti e non controllano liste. **Non
inserire dati personali reali**: usa dati di prova.

7.2. Se inserisci comunque dati reali, li trattiamo come descritto
nell'Informativa Privacy ([link]).

7.3. Il completamento del modulo è richiesto dall'app, ma **non è verificato
dagli smart contract**.

## 8. Artisti, studi e contenuti caricati

8.1. Chi carica un brano, crea un catalogo o una campagna dichiara e garantisce:
(a) di essere titolare di tutti i diritti necessari sul brano (composizione,
testo, registrazione) o di avere l'autorizzazione dei titolari;
(b) che il brano non viola diritti di terzi;
(c) che le informazioni fornite, compresa la dichiarazione sull'uso di
intelligenza artificiale, sono vere;
(d) che il wallet indicato per gli incassi è sotto il suo controllo.

8.2. L'artista ci manleva da pretese di terzi derivanti dalla violazione di
queste garanzie.

8.3. Gli artisti accettano inoltre l'Accordo di Cessione Royalty ed Escrow a
Milestone ([link]). Nel prototipo quell'accordo è **una bozza non vincolante**.

8.4. **I file audio, le immagini e i video dei brani sono pubblicati su IPFS** e titolo e nome artista sono
**scritti sulla blockchain**. Anche se rimuoviamo un contenuto dalla
Piattaforma, **non possiamo cancellarlo da IPFS o dalla blockchain**. Non
caricare contenuti che potresti voler cancellare, e non usare come nome
d'artista dati personali che non vuoi rendere permanenti.

8.5. Ci concedi, per la durata della presenza del brano sulla Piattaforma, una
licenza non esclusiva e gratuita per ospitarlo, riprodurlo in streaming di
anteprima e mostrarlo sulla Piattaforma.

## 9. Usi vietati

È vietato: usare la Piattaforma per riciclaggio o per eludere sanzioni;
inserire dati di altre persone; inserire dati di royalty falsi o fuorvianti;
caricare contenuti che violano diritti di terzi o la legge; interferire con il
funzionamento della Piattaforma o delle sue API; creare asset o campagne a nome
di altri.

## 10. Segnalazione di contenuti illeciti

10.1. Puoi segnalare contenuti che ritieni illeciti, compresa la violazione del
diritto d'autore, scrivendo a [email] con: l'indirizzo del contenuto, la
spiegazione del motivo, il tuo nome e email (salvo i casi previsti dalla legge)
e una dichiarazione di buona fede.

10.2. Esaminiamo le segnalazioni in modo tempestivo e ti comunichiamo la
decisione. Se rimuoviamo un contenuto informiamo chi l'ha caricato, con i
motivi, e indichiamo come contestare la decisione (Regolamento (UE) 2022/2065,
artt. 16-17).

10.3. Punto di contatto unico per autorità e utenti: [email].

## 11. Responsabilità

11.1. Il prototipo è fornito **"così com'è"**. Gli smart contract **non sono
stati sottoposti a un audit di sicurezza indipendente** e possono contenere
errori.

11.2. Nei limiti consentiti dalla legge non rispondiamo di: perdite derivanti
dall'uso di reti di test; malfunzionamenti della blockchain, di thirdweb, di
Pinata, di Alchemy o di altri servizi terzi; perdita delle chiavi del tuo
wallet; decisioni prese sulla base dei dati simulati.

11.3. **Nulla in questi Termini limita la nostra responsabilità per dolo o colpa
grave**, né i diritti che la legge riconosce ai consumatori e che non si
possono derogare.

> **[AL LANCIO]** Limitazioni di responsabilità verso investitori
> consumatori: da riscrivere con l'avvocato (Codice del Consumo, art. 33 e 36;
> Direttiva 93/13/CEE).

## 12. Nessuna consulenza

12.1. Nulla sulla Piattaforma, whitepaper compreso, è consulenza finanziaria,
legale o fiscale, né una raccomandazione a comprare o vendere.

12.2. **Guida automatica.** Il pulsante in basso a destra apre una guida
automatica. Non è una persona e non è assistenza clienti: risponde con testi
scritti da noi e, dove è attivata, con risposte generate da un sistema di
intelligenza artificiale (Claude di Anthropic PBC). Lo dichiara nella propria
intestazione e sotto ogni risposta generata. Vale il §12.1: non dà consulenza,
non consiglia cosa comprare e non promette rendimenti. Le risposte generate
possono essere **incomplete o sbagliate**: fanno testo la pagina dell'asset, i
contratti on-chain e questi Termini, non la guida. La guida non compie
operazioni al posto tuo e non ti chiederà mai la chiave privata, la seed phrase
o una password: nessuno di Humfiverse lo farà mai.

12.3. Quando la guida risponde in modalità generata, il testo della tua domanda
e delle risposte precedenti è inviato ad Anthropic per produrre la risposta
(informativa privacy, §3 e §5). Non scrivere nella guida dati personali,
credenziali o informazioni riservate: per quel che serve al servizio ci sono i
moduli, non la chat.

## 13. Modifiche, sospensione e chiusura

13.1. Possiamo modificare questi Termini. Le modifiche sostanziali sono
comunicate sul sito con almeno [15] giorni di anticipo, salvo quelle richieste
dalla legge o dalla sicurezza.

13.2. I contratti possono essere sostituiti con nuove versioni (redeploy). In
quel caso i token e le campagne dei contratti precedenti **possono non essere più
visibili nell'app**, pur restando sulla blockchain.

13.3. Possiamo sospendere o chiudere il prototipo in qualsiasi momento.

## 14. Legge applicabile e foro

14.1. Questi Termini sono regolati dalla legge [italiana].

14.2. Se sei un consumatore, è competente il giudice del luogo in cui risiedi
o hai il domicilio. Puoi anche usare la piattaforma europea di risoluzione delle
controversie online, se ancora disponibile **[verificare: la piattaforma ODR
UE è stata dismessa nel 2025]**.

14.3. Negli altri casi è competente in via esclusiva il Foro di [città].

## 15. Accettazione

15.1. Accetti questi Termini **al momento della registrazione**: il primo
accesso con Google, Apple o email, o il primo collegamento di un wallet. Il
pulsante di accettazione si attiva solo dopo che hai **scorso l'intero testo**.

15.2. Chi investe accetta anche l'**Accordo Investitore**; chi carica brani
accetta l'**Accordo Artista**. Le clausole indicate come "da approvare
specificamente" richiedono una spunta separata (art. 1341, comma 2, e art. 1342
c.c.).

15.3. Registriamo la versione accettata, data e ora, l'account o il wallet e
un'impronta (hash) del testo, e puoi scaricarne una copia.

> Nota per l'avvocato e per chi implementa: lo scorrimento obbligatorio è una
> prova utile che il testo è stato visualizzato, ma non sostituisce
> l'approvazione specifica delle clausole vessatorie né la chiarezza richiesta
> per i consumatori (file 08, §C).

## 16. Contatti

[GESTORE], [indirizzo], [email], [PEC].
