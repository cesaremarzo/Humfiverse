# Informativa Privacy: bozza

*Bozza del 2026-09-16, commit `cc06a70` con le modifiche dei §2.88 e §2.89; email di registrazione, immagini e video dal §2.93. **Da far rivedere a un avvocato o a un
esperto privacy prima della pubblicazione.** Non è consulenza legale.*

## Note per chi usa questa bozza (da togliere prima di pubblicare)

- È costruita sui dati che il codice **raccoglie davvero** (`server/data/schema.js`,
  `compliance.service.js`, `embedded-wallet.ts`, `webapp/src/index.html`). Se il
  codice cambia, questa informativa diventa falsa: è uno dei file sorvegliati da
  `legal/check.sh`.
- `[TITOLARE]` non esiste ancora (domanda G1). Senza un titolare identificato
  un'informativa non si può pubblicare.
- **Prima ancora di pubblicarla**, conviene ridurre i dati: il KYC dimostrativo
  non dovrebbe salvare dati reali (01, §7). La tabella del §3 va aggiornata di
  conseguenza.
- Adempimenti che non stanno nell'informativa ma servono: registro dei
  trattamenti (art. 30), DPA con i fornitori (art. 28), valutazione dei
  trasferimenti extra-UE, DPIA (art. 35), procedura per i data breach
  (artt. 33-34).

---

# Informativa sul trattamento dei dati personali

**Versione:** 0.1-bozza · **Aggiornata al:** [data]

## 1. Titolare del trattamento

[TITOLARE: denominazione, sede, codice fiscale/partita IVA], email [privacy@…].
[Responsabile della protezione dei dati (DPO), se nominato: contatti.]

## 2. Una premessa importante: blockchain e IPFS

Humfiverse usa una **blockchain pubblica** (Ethereum Sepolia) e **IPFS**. I dati
scritti lì:
- sono **visibili a chiunque**, in tutto il mondo;
- **non possono essere modificati né cancellati**, né da noi né da altri.

Il tuo **indirizzo wallet** e tutte le operazioni collegate (acquisti,
contributi, rivendite, rimborsi, conferme di milestone) sono registrati
pubblicamente. Se colleghi il wallet alla tua identità sulla Piattaforma, per
esempio con il modulo di verifica, quelle operazioni diventano riferibili a te.

**Per gli artisti:** titolo del brano e **nome artista** sono scritti sulla
blockchain al momento della creazione del token, e il **file audio**,
l'**immagine di copertina** e il **video** sono pubblicati su IPFS (§2.93). Un
volto o una voce riconoscibili in un video sono dati personali, anche di chi
compare senza essere l'artista. Usa un nome d'arte se non vuoi che il tuo nome anagrafico
resti pubblico in modo permanente.

## 3. Quali dati trattiamo, perché e per quanto tempo

| Dati | Da dove vengono | Finalità | Base giuridica | Conservazione |
|---|---|---|---|---|
| Indirizzo wallet, saldi e transazioni | Blockchain pubblica, tuo wallet | Mostrare portafoglio, asset, rimborsi; indicizzare i possessori di token | Esecuzione del servizio (art. 6.1.b) | Nel nostro database: finché usi il servizio + [12 mesi]. Sulla blockchain: per sempre, fuori dal nostro controllo |
| Istantanee del valore del portafoglio per wallet (`portfolio_snapshots`) | Calcolate da noi | Grafico dell'andamento del portafoglio | Esecuzione del servizio | [12 mesi] |
| **Modulo di verifica (dimostrativo):** nome completo, data di nascita, nazionalità, classificazione dell'investitore, risposte al questionario e punteggio, origine dei fondi, dichiarazione PEP, wallet | Tu | Dimostrare il flusso di verifica del prototipo | [Consenso (art. 6.1.a)? Da decidere con l'avvocato: vedi nota] | [30 giorni], poi cancellazione |
| **Firma dell'invio della verifica:** il tuo wallet firma un'impronta SHA-256 delle risposte, non le risposte (§2.89) | Tu | Garantire che solo il titolare del wallet possa registrare la propria verifica | Legittimo interesse alla sicurezza (art. 6.1.f) | Non salvata: serve solo a controllare l'invio (`server/routes/compliance.routes.js`) |
| Accettazione del contratto artista: nome artista, titolo, clausole accettate, versione, data e ora | Tu | Prova dell'accettazione | Esecuzione del contratto; legittimo interesse alla prova (art. 6.1.f) | [10 anni dalla fine del rapporto, termine di prescrizione ordinario] **[verificare]** |
| Dati del brano: titolo, nome artista, audio, dichiarazione sull'uso di AI, storico royalty inserito | Tu | Pubblicare l'asset | Esecuzione del servizio | Database: finché l'asset è pubblicato + [12 mesi]. Blockchain e IPFS: per sempre |
| **Autorizzazione di lancio della campagna:** testo firmato con il tuo wallet che contiene id e titolo dell'asset, nome artista, wallet che incassa, numero di token, importo della raccolta, nome e wallet dello studio, milestone, data e ora | Tu | Verificare che la campagna sia lanciata da chi incassa, prima che la piattaforma crei token e campagna | Esecuzione del servizio; legittimo interesse alla sicurezza (art. 6.1.f) | Non salvata nel nostro database (verificato in `server/lib/launch-auth.js` e nelle route che la usano): usata solo per il controllo della richiesta. Nome e wallet dello studio sono dati di un terzo: vanno previsti nell'informativa allo studio **[verificare]** |
| **Email di registrazione** (§2.93): indirizzo, wallet a cui è collegato, data e ora della verifica, firma del wallet, IP della richiesta. Per ogni codice inviato: indirizzo, wallet, impronta SHA-256 del codice (non il codice), tentativi, IP, scadenza | Tu | Registrazione (`legal/08` C-11): contattarti sulle campagne che crei o sostieni, provare quando e da quale wallet l'indirizzo è stato verificato, limitare gli abusi dell'invio | Esecuzione del servizio (art. 6.1.b); legittimo interesse alla prova e alla sicurezza (art. 6.1.f) | Tabelle `registrations` e `email_verifications` (`server/data/schema.js`). Oggi **nessuna cancellazione automatica**: [durata del rapporto + 10 anni per la prova, 12 mesi per i codici non usati] **[verificare]**. L'indirizzo non è mostrato pubblicamente: `GET /api/registration/status/:wallet` dice solo sì/no |
| **Immagine e video del brano** (§2.93) e firma del wallet sull'impronta SHA-256 del file | Tu | Pubblicare l'asset | Esecuzione del servizio | Sul nostro database solo il riferimento IPFS, tipo, dimensione, durata, data e wallet che ha caricato. I file su IPFS: finché restano fissati da Pinata; un file sostituito viene tolto da Pinata, ma copie già distribuite possono restare |
| Login con Google, Apple o email (wallet integrato) | Tu, tramite thirdweb | Creare e ripristinare il tuo wallet integrato | Esecuzione del servizio | Trattati da thirdweb: vedi §5 |
| Indirizzo IP, dati tecnici della richiesta | Il tuo browser | Sicurezza, funzionamento, prevenzione degli abusi | Legittimo interesse | Log dei fornitori: [secondo le loro politiche, di norma pochi giorni o settimane] |

> **Chi vede l'esito della verifica.** Dal §2.89 l'indirizzo pubblico
> `GET /api/kyc/status/:wallet` restituisce solo se il wallet è verificato
> (sì/no). Classificazione, punteggio ed esito del questionario non sono più
> leggibili da chi conosce l'indirizzo (`server/services/compliance.service.js`).
>
> **Nota sul modulo di verifica.** Nel prototipo la base giuridica non può
> essere un obbligo di legge antiriciclaggio, perché non c'è un soggetto
> obbligato né un servizio reale. La soluzione più pulita è **non raccogliere
> dati reali** (campi con valori di prova). Se si mantiene la raccolta: consenso
> esplicito, conservazione breve, e niente origine dei fondi né stato PEP.
>
> **[AL LANCIO]** Il KYC reale avrà come base l'obbligo di legge (art. 6.1.c; D.Lgs.
> 231/2007 o AMLR) e conservazione di [10] anni **[verificare]**, e sarà
> probabilmente affidato a un fornitore specializzato, da aggiungere al §5.

## 4. Dati che non trattiamo

Non usiamo cookie di profilazione, strumenti di analisi o pubblicità. Nessuno è
presente nel codice al commit `82a7a1b`: ricontrollare prima di ogni
aggiornamento. Non vendiamo dati. Non prendiamo decisioni
basate unicamente su trattamenti automatizzati che producano effetti giuridici
su di te (art. 22): il punteggio del questionario mostra un'avvertenza, ma non
blocca l'acquisto.

## 5. A chi comunichiamo i dati

Fornitori che trattano dati per nostro conto (responsabili, art. 28) o come
titolari autonomi:

| Fornitore | Cosa fa | Dati | Paese | Garanzia per il trasferimento |
|---|---|---|---|---|
| Render (Render Services, Inc.) | Hosting del backend | Tutti i dati del database in transito, IP | USA [verificare la regione] | [DPF / SCC] |
| Turso (ChiselStrike, Inc.) | Database | Dati del §3 | [regione da verificare] | [DPF / SCC] |
| thirdweb (Non-Fungible Labs, Inc.) | Login e wallet integrato, sponsorizzazione del gas, firma dei messaggi | Email o account Google/Apple, wallet, IP; **testo dei messaggi firmati con il wallet integrato**, compresa l'autorizzazione di lancio (per la verifica dell'investitore solo l'impronta delle risposte, non le risposte) (la firma avviene sui server di thirdweb: `/api/v1/enclave-wallet/sign-message` nell'SDK) | USA | [DPF / SCC] |
| Google (Google Fonts) | Caratteri tipografici del sito | IP, user agent | USA | [DPF]. **In alternativa, ospitare i font sul nostro dominio ed eliminare questo trasferimento** |
| Alchemy Insights, Inc. | Accesso alla blockchain (RPC) | Wallet, IP del server | USA | [DPF / SCC] |
| Pinata Cloud, Inc. | Pubblicazione su IPFS di audio, immagini e video dei brani | Audio, immagini, video, metadati | USA | [DPF / SCC] |
| Brevo (Sendinblue SAS) | Invio delle email con il codice di verifica (§2.93) | Indirizzo email, testo del messaggio (codice) | Francia (UE) **[verificare la sede dei server]** | Responsabile del trattamento: serve l'accordo art. 28 (DPA di Brevo) |
| GitHub (Pages) e Netlify | Hosting del sito | IP, user agent | USA | [DPF / SCC] |
| Etherscan | Link di verifica delle transazioni (solo se li apri) | IP | [verificare] | Titolare autonomo |

Comunichiamo dati alle autorità solo quando la legge lo richiede.

## 6. Archiviazione nel browser

Il sito salva nel tuo browser (`localStorage`) la lingua scelta
(`humfiverse-locale`), un indicatore di sessione del wallet integrato e i dati di
sessione che l'SDK di thirdweb salva per mantenerti connesso (verificato nel
codice al commit `82a7a1b`). Sono strumenti
tecnici necessari al funzionamento, per cui non serve il consenso (art. 122 del
Codice Privacy; linee guida del Garante sui cookie del 10 giugno 2021). Puoi
cancellarli dalle impostazioni del browser: dovrai rifare l'accesso.

## 7. I tuoi diritti

Puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità e
opposizione (artt. 15-21), e revocare il consenso quando vuoi, senza effetto sul
passato. Scrivi a [privacy@…]: rispondiamo entro un mese.

**Limite tecnico:** la cancellazione e la rettifica non possono riguardare i
dati già scritti sulla blockchain o su IPFS (§2). In quel caso cancelliamo ogni
collegamento tra quei dati e la tua identità nel nostro database e togliamo il
contenuto dalla nostra interfaccia.

Puoi presentare reclamo al **Garante per la protezione dei dati personali**
(garanteprivacy.it) o all'autorità del Paese in cui vivi o lavori.

## 8. Minori

Il servizio non è destinato a persone sotto i 18 anni.

## 9. Sicurezza

Adottiamo misure tecniche e organizzative adeguate. [Da descrivere dopo aver
risolto le debolezze del backend annotate nel file privato indicato in 02, §3.]

## 10. Modifiche

Pubblichiamo le modifiche su questa pagina con la data di aggiornamento. Le
modifiche sostanziali vengono segnalate anche sul sito.
