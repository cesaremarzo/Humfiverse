# Humfiverse: cartella legale

> **Non è consulenza legale.** Questi documenti li ha preparati un assistente AI
> (Claude) leggendo il codice e la documentazione del repo. Non sono stati
> rivisti da un avvocato. Servono a due cose: capire le regole che riguardano
> Humfiverse, e arrivare dall'avvocato con le domande giuste e il materiale già
> in ordine, così la consulenza costa meno e va più a fondo.

## Cosa c'è

| File | A cosa serve | Per chi |
|---|---|---|
| [01-normativa-spiegata.md](01-normativa-spiegata.md) | Le norme che toccano Humfiverse, spiegate in italiano semplice, e come si applicano a *questo* codice | Cesare, Vincenzo |
| [02-controllo-smart-contract.md](02-controllo-smart-contract.md) | Cosa fanno davvero i tre contratti e il backend, confrontato con quello che dicono whitepaper e contratto artista. Rischi con peso legale | Team, avvocato, futuro auditor |
| [03-revisione-documenti-esistenti.md](03-revisione-documenti-esistenti.md) | Frasi di whitepaper, contratto artista e note legali che oggi non corrispondono al codice, con la correzione proposta | Team |
| [04-termini-di-servizio.md](04-termini-di-servizio.md) | Bozza di Termini di Servizio per il prototipo attuale, con le parti da aggiungere al lancio reale | Avvocato (da rivedere) |
| [05-privacy-policy.md](05-privacy-policy.md) | Bozza di informativa privacy (GDPR) basata sui dati che il backend raccoglie davvero | Avvocato / DPO (da rivedere) |
| [06-disclaimer-rischi.md](06-disclaimer-rischi.md) | Testi brevi di avvertenza per sito, pagine asset e campagne, e scheda rischi estesa | Avvocato (da rivedere) |
| [07-domande-per-avvocato.md](07-domande-per-avvocato.md) | Le domande, in ordine di priorità, divise per tipo di avvocato, con il materiale da portare | Cesare, Vincenzo → avvocato |
| [08-bozza-clausole-contratti.md](08-bozza-clausole-contratti.md) | Clausole per Accordo Artista e Accordo Investitore (annullamento, rimborso, rivalsa verso l'artista, garanzie, commissioni) e requisiti per l'accettazione alla registrazione | Avvocato (da rivedere), chi implementa il template |
| [09-confronto-piattaforme.md](09-confronto-piattaforme.md) | Come si sono messe in regola ANote Music, SongVest e Royalty Exchange, e cosa può prendere Humfiverse da ognuna: strategia a fasi | Cesare, Vincenzo → avvocato |
| [10-fiscalita-malta.md](10-fiscalita-malta.md) | La società a Malta e il rimborso dei 6/7: come si arriva al 5%, i requisiti, e le condizioni italiane (esterovestizione, residenza personale, CFC) da cui dipende che il 5% regga | Cesare, Vincenzo → commercialista |
| [CHANGELOG.md](CHANGELOG.md) | Storico degli aggiornamenti di questa cartella | Tutti |

Ordine di lettura consigliato: 01 → 02 → 07. Il 03 serve prima di modificare
il whitepaper. 04, 05, 06, 08 e 09 vanno portati all’avvocato insieme al 07.
Il **10** ha un interlocutore diverso dagli altri — un commercialista, non un
avvocato — e si legge da solo; si incrocia col resto solo su A15 (quale
autorizzazione e quale regolatore) e su G1 (oggi non esiste nessuna società).

## Stato della revisione

| | |
|---|---|
| Ultima revisione | 2026-10-14 (indirizzo di contatto `hello@humfiverse.com` e guida sugli studi, §2.120) · prima 2026-10-14 (tipi di milestone: anticipo e uscita con link, §2.119; template v0.7-draft) · prima 2026-10-13 (Malta confermata, Wyoming escluso: file 10 §5.4, A15) · prima 2026-10-12 (ottavo redeploy: motivo abbandono, marketplace, wallet dell'artista, §2.116-§2.117) · prima 2026-10-12 (scadenza e soglia minima della raccolta, §2.114) · prima 2026-10-12 (governance e clausola di annullamento, §2.113) · prima 2026-10-12 (termini di lancio conservati, §2.112) · prima 2026-10-11 (correzioni dell'audit dei contratti) · prima 2026-10-07 (dominio humfiverse.com) · prima 2026-09-28 (procedura di annullamento) · prima 2026-09-22 (file 10, struttura maltese) · prima 2026-09-17 |
| Commit rivisto | §2.120 (pulsanti di contatto con `mailto:`, testi della pagina studio e della guida automatica sugli studi verificati). §2.119 (escrow con anticipo e uscita con link; template v0.7-draft; nono redeploy, solo escrow, `0xCB57c80fD7ADBBFAADF9938A23D8DACBEfF186e5`). §2.117 (ottavo redeploy di token, escrow e marketplace; template v0.6-draft con il motivo (d) abbandono). §2.116. §2.115. §2.114 (escrow con scadenza e soglia minima; template v0.5-draft: clausole `milestones` e `refund`; settimo redeploy, solo escrow — indirizzo dopo il deploy). §2.113 (template v0.4-draft: `manager-discretion` sostituita da `cancellation`; testi Governance ed escrow della pagina campagna, 2026-10-12). §2.112 (campagna escrow creata nella richiesta del conio; nuova tabella `escrow_launches` con i termini firmati, 2026-10-12). §2.111 (redeploy del 2026-10-11: le correzioni del §2.110 sono sulla catena; indirizzi nuovi, due escrow in sola lettura). §2.110 (correzioni dell'audit dei contratti, 2026-10-11). §2.109 (dominio humfiverse.com, 2026-10-07). §2.105 (procedura di annullamento e rimozione, 2026-09-28). §2.102 (redeploy del 2026-09-27: le commissioni del §2.101 sono ora sulla catena; stesso codice, indirizzi nuovi). §2.100 (guida automatica: nuova tabella `assistant_requests`, Anthropic come fornitore). §2.101 (vendita diretta al 6%, 1% sulla distribuzione delle royalty). Prima `fd7f822` (§2.98: rendiconto royalty come file, chi versa, intervallo per token). Prima il redeploy di fase 2 su `dev/cesare` (technical §2.92, §2.95-§2.97): royalty on-chain, rimborsi per token con burn, motivi di annullamento, operator, proprietà a un Safe 2 su 3. Prima `94ae18f` (§2.94) |
| Contratti (Sepolia) | Token `0x471DE935a7538D67F0E231aaf2768f5C4EB42431` · Escrow `0xCB57c80fD7ADBBFAADF9938A23D8DACBEfF186e5` (nono redeploy, §2.119; il precedente `0xcEb91B21020B6e32643dFD9d596e848c303c7553` non aveva campagne) · Marketplace `0xC684B23492659b224635A5A7C475F50fcADc2E03` (ottavo redeploy, §2.117) · vecchi escrow in sola lettura `0x613c1e658930562a655C0883667034AB92146C16`, `0x0D5232579773e61b898e70866b2160b2B077aDb7`, `0xBAEbC0f24C3528137B2A5DcC13E276E7c652a82A` e `0x16C8bfE861Ef1B102CD6D6a4FD4e881FdD38721c` |
| Proprietario dei contratti | Safe `0xBA2ad0Ca063092E350f1427dd86F7E9C8730245d`, 2 firme su 3 |
| Test contratti | 149 passati (`cd contracts && npm test`) |
| Revisione di un avvocato | **Nessuna** |

## Come si mantiene aggiornata

La piattaforma cambia spesso: quattro redeploy dei contratti in un solo giorno
(14 set). Un documento legale che descrive un contratto vecchio è peggio di
nessun documento. Per questo:

1. **`legal/check.sh`** confronta l'impronta (SHA-256) dei file che hanno peso
   legale con quella registrata all'ultima revisione, in
   `legal/reviewed-files.sha256`. Se qualcosa è cambiato, elenca i file e
   termina con errore.
   ```bash
   ./legal/check.sh            # verifica
   ./legal/check.sh --update   # dopo aver aggiornato i documenti: registra le nuove impronte
   ```
2. **La skill `.claude/skills/legal-review/`** contiene la procedura che Claude
   Code segue per aggiornare questa cartella: cosa rileggere, cosa confrontare
   e dove scrivere.
3. **`CLAUDE.md`** chiede a ogni sessione di Claude Code, di Cesare o di
   Vincenzo, di lanciare il controllo quando tocca contratti, commissioni, dati
   personali, KYC o whitepaper, e di aggiornare `legal/` nella stessa PR.

Il controllo automatico nota i cambiamenti, ma non li capisce. Il criterio per
decidere cosa aggiornare è nella skill.

### File sorvegliati

Sono quelli la cui modifica può cambiare un'analisi legale. L'elenco completo è
in `legal/check.sh`.

- `contracts/contracts/*.sol`: diritti, commissioni, poteri del Founder, rimborsi
- `server/contract-template.js`: il contratto che l'artista accetta
- `server/data/schema.js`, `server/services/compliance.service.js`,
  `server/routes/compliance.routes.js`: quali dati personali si raccolgono
- `webapp/src/app/core/embedded-wallet.ts`: login con Google, Apple o email
  tramite thirdweb (fornitore terzo)
- `webapp/src/app/core/known-wallets.ts`: i wallet Founder e Fees
- `webapp/src/index.html`: risorse esterne caricate dal sito (Google Fonts)
- `whitepaper/*.md`: le promesse pubbliche
