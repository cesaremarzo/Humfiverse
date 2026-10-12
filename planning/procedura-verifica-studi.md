# Procedura di verifica degli studi — BOZZA

*Bozza del 2026-10-12, da approvare da Cesare e Vincenzo. Non è consulenza
legale: i punti segnati **[avvocato]** vanno confermati con la domanda 07 B5-bis.*

## Perché serve

Dal §2.110 solo il Safe (2 firme su 3) registra uno studio sull'escrow
(`registerStudio(wallet, name)`), e il wizard offre all'artista solo gli studi
registrati. Ogni tranche di una campagna con studio si paga quando **artista e
studio** confermano dai propri wallet. Quella doppia conferma vale solo se lo
studio è davvero **un'altra persona**: se il wallet dello studio è un secondo
wallet dell'artista, l'artista conferma da solo e la protezione per chi
finanzia è finta. Il contratto non può accorgersene. Lo può fare solo questa
verifica, fatta prima della registrazione.

Cosa deve dimostrare la verifica, in ordine di importanza:
1. **Lo studio esiste** ed è un'attività reale di registrazione o produzione.
2. **Il wallet è dello studio**, non di qualcun altro.
3. **Lo studio è indipendente** dagli artisti che lo sceglieranno.

## 1. Richiesta

Lo studio (non l'artista) scrive a Humfiverse, per esempio a
studios@humfiverse.com, con:

| Dato | A cosa serve |
|---|---|
| Ragione sociale o nome dell'attività, e P.IVA o codice equivalente | Controllo nel registro delle imprese |
| Indirizzo della sede e dello studio | Esistenza fisica |
| Sito, profili social, portfolio con crediti di lavori pubblicati | Attività reale |
| Nome, ruolo ed email della persona di riferimento | Chi risponde per lo studio |
| Indirizzo del wallet che riceverà le tranche | Il dato che va sulla catena |
| Nome da mostrare agli artisti (max 80 caratteri) | Il `name` registrato sulla catena |

## 2. Controlli

| # | Controllo | Come | Esito richiesto |
|---|---|---|---|
| C1 | **Esistenza dell'attività** | Visura nel Registro delle imprese (per l'Italia) o nel registro del paese; P.IVA attiva | Attività attiva, con un oggetto compatibile (registrazione, produzione musicale, servizi audio) |
| C2 | **Attività reale** | Sito o social con storico; almeno 2 lavori pubblicati con crediti verificabili (note di copertina, Discogs, crediti sulle piattaforme) | Lavori riconducibili allo studio |
| C3 | **Persona di riferimento** | Documento d'identità e ruolo nell'attività (dalla visura, o delega firmata) **[avvocato: quali dati è lecito chiedere e conservare]** | Persona collegata all'attività |
| C4 | **Controllo del wallet** | Lo studio firma con il wallet un messaggio con nome dello studio, P.IVA e data, che Humfiverse prepara (si può riusare il meccanismo delle azioni firmate del backend, `lib/signed-action.js`) | La firma corrisponde all'indirizzo dichiarato |
| C5 | **Indipendenza dagli artisti** | (a) dichiarazione firmata dalla persona di riferimento: lo studio non è posseduto né controllato da artisti che lo indicheranno, e il wallet non appartiene a un artista; (b) controllo pubblico del wallet su Etherscan: nessun trasferimento diretto da o verso wallet di artisti della piattaforma | Dichiarazione presente; nessun legame evidente sulla catena |
| C6 | **Nome** | Il nome da mostrare corrisponde all'attività verificata; non imita un altro studio | Nome coerente |

Se un controllo non passa, la richiesta si respinge con il motivo, oppure si
chiedono documenti in più. Un controllo non si salta.

## 3. Decisione e registrazione

1. Un firmatario del Safe raccoglie la documentazione in un **fascicolo** (cartella
   privata, non nel repository pubblico) e scrive un breve verbale: dati dello
   studio, esito di C1–C6, data.
2. Un **secondo firmatario** rilegge il fascicolo e approva. È la stessa regola
   della procedura di annullamento (§2.115): nessuno decide da solo.
3. Si calcola lo SHA-256 del verbale e lo si conserva con il fascicolo.
4. Il Safe esegue `registerStudio(wallet, nome)` sull'escrow attuale, con 2 firme
   su 3, dal Transaction Builder.
5. Si annota il numero dello studio sulla catena (`studioId`) e l'hash della
   transazione nel fascicolo.

## 4. Dopo la registrazione

- **Dubbi o segnalazioni:** il Founder (operatore) può **sospendere** subito lo
  studio con `setStudioActive(id, false)`. Così non può più essere scelto per nuove
  campagne, mentre le campagne in corso restano come sono. **Solo il Safe** può
  riattivarlo, dopo aver ripetuto i controlli interessati.
- **Cambio di wallet:** il contratto non lo permette sullo stesso `studioId`. Va
  fatta una nuova verifica (C4 e C5) e una nuova registrazione, e il vecchio id va
  sospeso.
- **Revisione periodica:** una volta l'anno si ripetono C1 e C5 per gli studi con
  campagne aperte.
- **Redeploy dell'escrow:** gli studi non si trasferiscono da soli. Si
  registrano di nuovo sul nuovo escrow solo quelli con un fascicolo valido (come
  Bluehouse il 12 ottobre).

## 5. Conservazione e privacy

- Il fascicolo contiene dati personali (documento della persona di riferimento,
  contatti): accesso solo ai firmatari del Safe; durata di conservazione
  **[avvocato]**; va aggiunto all'informativa privacy (`legal/05`) e
  all'informativa allo studio quando la procedura entra in uso.
- Sulla catena vanno solo **nome e wallet** dello studio, che sono pubblici per
  sempre: allo studio va detto prima.

## 6. Punti aperti per l'avvocato (07 B5-bis)

- Bastano questi controlli, o serve un contratto tra Humfiverse e lo studio
  (anche per T-5: oggi lo studio non è parte di nessun contratto)?
- Che responsabilità ha Humfiverse se uno studio verificato si rivela legato
  all'artista?
- Quali documenti si possono chiedere e per quanto conservarli.

## 7. Primo caso: Analog Sun Studio

Analog Sun era registrato sugli escrow precedenti **sulla parola dell'artista**, e
il suo wallet coincide con quello dell'artista di Honest Man. Con questa
procedura **non passerebbe C5**. Non va registrato sul nuovo escrow finché lo
studio non presenta la richiesta con un wallet suo e supera i controlli.
