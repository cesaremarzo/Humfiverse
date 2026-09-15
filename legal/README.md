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
| [CHANGELOG.md](CHANGELOG.md) | Storico degli aggiornamenti di questa cartella | Tutti |

Ordine di lettura consigliato: 01 → 02 → 07. Il 03 serve prima di modificare
il whitepaper. 04, 05, 06 e 08 vanno portati all’avvocato insieme al 07.

## Stato della revisione

| | |
|---|---|
| Ultima revisione | 2026-09-15 |
| Commit rivisto | `d4815b5` (`dev/cesare`), con le correzioni al whitepaper di questo commit |
| Contratti (Sepolia) | Token `0xb45601440308c92D9BC8fd4a95DEE6a4A86aFB41` · Escrow `0x16C8bfE861Ef1B102CD6D6a4FD4e881FdD38721c` · Marketplace `0x755500dEB66169fC605Be8Aa25ACBdAd791F1585` |
| Test contratti | 94 passati (`cd contracts && npm test`) |
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
