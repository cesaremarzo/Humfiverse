"use strict";
/* Contract template — standard milestone-escrow / royalty-assignment
   agreement the artist accepts at upload time, per the "master template
   instead of bespoke drafting" cost-reduction approach discussed in
   planning/legal-regulatory-notes.md §4.1/§7.

   This is DRAFT PROTOTYPE TEXT, in Italian (the agreement is envisioned
   as governed by Italian law / an Italian SPV), NOT reviewed by counsel
   and NOT a binding legal document. Clauses flagged `vessatoria: true`
   are the ones that most plausibly fall under art. 1341, comma 2, c.c.
   (clausole vessatorie) and therefore need separate, specific acceptance
   in a contract of adhesion — each carries a `vessatoriaCategory` note
   on which category it plausibly falls under. This flagging is a
   starting point for counsel to confirm, not a legal determination.
*/

const CONTRACT_TEMPLATE = {
  version: "v0.1-draft",
  title: "Accordo di Cessione Royalty e Escrow a Milestone",
  note: "Bozza per il prototipo — non validata da un legale, non costituisce un contratto vincolante.",
  clauses: [
    {
      id: "assignment",
      title: "Cessione dei proventi royalty alla SPV",
      body: "L'Artista cede alla SPV titolare del catalogo/brano il diritto di incassare i proventi royalty relativi al brano caricato, per la durata e alle condizioni descritte nella documentazione di offerta. La cessione non trasferisce il copyright, che resta in capo all'Artista.",
      vessatoria: false
    },
    {
      id: "milestones",
      title: "Piano milestone e calendario di rilascio delle tranche",
      body: "I fondi raccolti sono custoditi in un conto di escrow a milestone. Ogni tranche è rilasciata all'Artista solo al raggiungimento della milestone corrispondente, secondo il calendario indicato nella pagina della campagna.",
      vessatoria: false
    },
    {
      id: "manager-discretion",
      title: "Potere di conferma e sospensione dell'SPV Manager",
      body: "L'SPV Manager ha la facoltà discrezionale di confermare o meno il raggiungimento di una milestone e, in caso di dubbio, di sospendere il rilascio della tranche corrispondente fino a chiarimento. Tale sospensione non costituisce inadempimento della SPV.",
      vessatoria: true,
      vessatoriaCategory: "facoltà di sospendere l'esecuzione del contratto (art. 1341, comma 2, c.c.)"
    },
    {
      id: "refund",
      title: "Formula di rimborso pro-rata e decadenza sulle tranche non rilasciate",
      body: "In caso di mancato raggiungimento dell'obiettivo di raccolta o mancata consegna di una milestone entro i termini, gli importi non ancora rilasciati come tranche sono restituiti pro-rata ai token holder secondo la formula: importo rimborsabile = totale raccolto − Σ(tranche già rilasciate per milestone confermate). L'Artista non ha diritto a percepire le tranche relative a milestone non raggiunte.",
      vessatoria: true,
      vessatoriaCategory: "decadenze a carico dell'Artista (art. 1341, comma 2, c.c.)"
    },
    {
      id: "liability",
      title: "Limitazione di responsabilità della piattaforma e della SPV",
      body: "Salvo dolo o colpa grave, la responsabilità della piattaforma e della SPV per ritardi, sospensioni o mancato rilascio delle tranche è esclusa o limitata all'importo effettivamente trattenuto in escrow relativo alla campagna interessata.",
      vessatoria: true,
      vessatoriaCategory: "limitazione di responsabilità (art. 1341, comma 2, c.c.)"
    },
    {
      id: "exclusivity",
      title: "Esclusiva sui diritti royalty per la durata della campagna",
      body: "Per la durata della campagna e fino al completamento delle milestone, l'Artista si impegna a non cedere, impegnare o concedere in garanzia a terzi gli stessi proventi royalty oggetto della cessione alla SPV.",
      vessatoria: true,
      vessatoriaCategory: "restrizione alla libertà contrattuale dell'Artista nei rapporti con terzi (art. 1341, comma 2, c.c.)"
    },
    {
      id: "jurisdiction",
      title: "Legge applicabile e foro competente",
      body: "Il presente accordo è regolato dalla legge italiana. Per ogni controversia è competente in via esclusiva il foro della sede legale della SPV, salva la giurisdizione inderogabile del consumatore ove applicabile.",
      vessatoria: true,
      vessatoriaCategory: "deroga alla competenza dell'autorità giudiziaria (art. 1341, comma 2, c.c.)"
    },
    {
      id: "ai-disclosure",
      title: "Dichiarazioni sull'uso di intelligenza artificiale in produzione",
      body: "L'Artista dichiara e garantisce l'accuratezza delle informazioni fornite nella sezione di disclosure AI relative al brano caricato, impegnandosi ad aggiornarle in caso di modifiche rilevanti prima del rilascio.",
      vessatoria: false
    }
  ]
};

module.exports = { CONTRACT_TEMPLATE };
