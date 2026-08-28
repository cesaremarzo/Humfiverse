"use strict";
/* Contract template — standard milestone-escrow / royalty-assignment
   agreement the artist accepts at upload time, per the "master template
   instead of bespoke drafting" cost-reduction approach discussed in
   planning/legal-regulatory-notes.md §4.1/§7.

   This is DRAFT PROTOTYPE TEXT, governed by Luxembourg law (decision
   28 Aug 2026 — see legal doc §7.7: Luxembourg securitization-vehicle
   structure chosen over an Italian SPV / Malta), NOT reviewed by counsel
   and NOT a binding legal document. Clauses flagged `vessatoria: true`
   are the ones that most plausibly need separate, specific acceptance in
   a contract of adhesion — the underlying UX principle (flag risky
   clauses, require individual sign-off, not just a general "I accept")
   is jurisdiction-agnostic good practice, but the *legal basis* for it
   is NOT the Italian civil code anymore now that the vehicle is
   Luxembourg-governed. The most likely Luxembourg/EU basis is Directive
   93/13/EEC on unfair terms in consumer contracts (transposed into
   Luxembourg's Code de la consommation) plus general Luxembourg
   principles on contrats d'adhésion — see `legalBasisNote` below. The
   EXACT applicable Luxembourg provision has NOT been confirmed by
   counsel; this flagging reuses the Italian art. 1341 co.2 c.c. category
   list only as a starting heuristic for which clause types are commonly
   treated as needing extra scrutiny, not as an applicable legal citation.

   **French (`fr`) is the authoritative text — Luxembourg civil/commercial
   law is published and practiced primarily in French.** (English is also
   common in Luxembourg fund/securitization documents in practice — worth
   confirming with counsel which the platform should actually use.) The
   it/en/es/de translations below are PROVISIONAL, machine/AI-assisted,
   NOT certified/sworn translations. If the project ever uses this for
   something real, these need replacing with certified legal translations
   per language, not just editing this file's text.
*/

const CONTRACT_TEMPLATE = {
  version: "v0.3-draft",
  title: {
    it: "Accordo di Cessione Royalty e Escrow a Milestone",
    en: "Royalty Assignment & Milestone Escrow Agreement",
    es: "Acuerdo de Cesión de Regalías y Garantía en Depósito por Hitos",
    fr: "Accord de Cession de Redevances et Séquestre par Jalons",
    de: "Vereinbarung über Tantiemenabtretung und Meilenstein-Treuhand"
  },
  note: {
    it: "Bozza per il prototipo — non validata da un legale, non costituisce un contratto vincolante.",
    en: "Draft prototype text — not reviewed by counsel, not a binding contract.",
    es: "Texto borrador para el prototipo — no revisado por un abogado, no es un contrato vinculante.",
    fr: "Texte provisoire pour le prototype — non validé par un juriste, ce n'est pas un contrat contraignant.",
    de: "Entwurfstext für den Prototyp — nicht anwaltlich geprüft, kein bindender Vertrag."
  },
  legalBasisNote: {
    it: "Le clausole contrassegnate sono quelle che, per analogia con l'elenco dell'art. 1341, comma 2, del Codice Civile italiano (usato qui solo come lista di partenza), richiedono probabilmente un'attenzione specifica anche sotto il diritto lussemburghese — verosimilmente tramite la Direttiva UE 93/13/CEE sulle clausole abusive (recepita nel Code de la consommation lussemburghese) e i principi generali lussemburghesi sui contratti di adesione. Il riferimento normativo lussemburghese esatto non è stato confermato da un legale.",
    en: "The flagged clauses are the ones that, by analogy with the list in art. 1341, para. 2, of the Italian Civil Code (used here only as a starting checklist), likely also warrant specific attention under Luxembourg law — most plausibly via EU Directive 93/13/EEC on unfair contract terms (transposed into Luxembourg's Code de la consommation) and general Luxembourg principles on adhesion contracts. The exact applicable Luxembourg provision has not been confirmed by counsel.",
    es: "Las cláusulas marcadas son aquellas que, por analogía con la lista del art. 1341, párrafo 2, del Código Civil italiano (usada aquí solo como punto de partida), probablemente también requieran especial atención conforme al derecho luxemburgués — previsiblemente a través de la Directiva UE 93/13/CEE sobre cláusulas abusivas (transpuesta en el Code de la consommation luxemburgués) y los principios generales luxemburgueses sobre contratos de adhesión. La disposición luxemburguesa exacta aplicable no ha sido confirmada por un abogado.",
    fr: "Les clauses signalées sont celles qui, par analogie avec la liste de l'art. 1341, alinéa 2, du Code civil italien (utilisée ici uniquement comme liste de départ), méritent probablement aussi une attention particulière en droit luxembourgeois — vraisemblablement via la Directive UE 93/13/CEE sur les clauses abusives (transposée dans le Code de la consommation luxembourgeois) et les principes généraux luxembourgeois sur les contrats d'adhésion. La disposition luxembourgeoise exacte applicable n'a pas été confirmée par un juriste.",
    de: "Die markierten Klauseln sind diejenigen, die in Analogie zur Liste in Art. 1341, Abs. 2, des italienischen Zivilgesetzbuchs (hier nur als Ausgangs-Checkliste verwendet) wahrscheinlich auch nach luxemburgischem Recht besondere Aufmerksamkeit erfordern — voraussichtlich über die EU-Richtlinie 93/13/EWG über missbräuchliche Vertragsklauseln (umgesetzt im luxemburgischen Code de la consommation) und allgemeine luxemburgische Grundsätze zu Beitrittsverträgen. Die genau anwendbare luxemburgische Bestimmung wurde noch nicht anwaltlich bestätigt."
  },
  authoritativeLanguage: "fr",
  clauses: [
    {
      id: "assignment",
      vessatoria: false,
      i18n: {
        it: { title: "Cessione dei proventi royalty alla SPV",
          body: "L'Artista cede alla SPV titolare del catalogo/brano il diritto di incassare i proventi royalty relativi al brano caricato, per la durata e alle condizioni descritte nella documentazione di offerta. La cessione non trasferisce il copyright, che resta in capo all'Artista." },
        en: { title: "Assignment of royalty income to the SPV",
          body: "The Artist assigns to the SPV holding the catalogue/track the right to collect royalty income relating to the uploaded track, for the duration and under the conditions described in the offering documentation. The assignment does not transfer copyright, which remains with the Artist." },
        es: { title: "Cesión de los ingresos por regalías a la SPV",
          body: "El Artista cede a la SPV titular del catálogo/tema el derecho a cobrar los ingresos por regalías relativos al tema subido, durante el plazo y en las condiciones descritas en la documentación de la oferta. La cesión no transfiere los derechos de autor, que permanecen en manos del Artista." },
        fr: { title: "Cession des revenus de redevances à la SPV",
          body: "L'Artiste cède à la SPV titulaire du catalogue/titre le droit de percevoir les revenus de redevances relatifs au titre déposé, pour la durée et selon les conditions décrites dans la documentation de l'offre. La cession ne transfère pas le droit d'auteur, qui reste détenu par l'Artiste." },
        de: { title: "Abtretung der Tantiemeneinnahmen an die SPV",
          body: "Der Künstler tritt der SPV, die den Katalog/Titel hält, das Recht ab, die Tantiemeneinnahmen aus dem hochgeladenen Titel einzuziehen, für die Dauer und zu den Bedingungen, die in den Angebotsunterlagen beschrieben sind. Die Abtretung überträgt nicht das Urheberrecht, das beim Künstler verbleibt." }
      }
    },
    {
      id: "milestones",
      vessatoria: false,
      i18n: {
        it: { title: "Piano milestone e calendario di rilascio delle tranche",
          body: "I fondi raccolti sono custoditi in un conto di escrow a milestone. Ogni tranche è rilasciata all'Artista solo al raggiungimento della milestone corrispondente, secondo il calendario indicato nella pagina della campagna." },
        en: { title: "Milestone plan and tranche release schedule",
          body: "Funds raised are held in a milestone escrow account. Each tranche is released to the Artist only when the corresponding milestone is reached, according to the schedule shown on the campaign page." },
        es: { title: "Plan de hitos y calendario de liberación de tramos",
          body: "Los fondos recaudados se mantienen en una cuenta de garantía en depósito por hitos. Cada tramo se libera al Artista solo cuando se alcanza el hito correspondiente, según el calendario indicado en la página de la campaña." },
        fr: { title: "Plan de jalons et calendrier de libération des tranches",
          body: "Les fonds collectés sont conservés sur un compte séquestre par jalons. Chaque tranche n'est versée à l'Artiste qu'une fois le jalon correspondant atteint, selon le calendrier indiqué sur la page de la campagne." },
        de: { title: "Meilensteinplan und Freigabeplan der Tranchen",
          body: "Die eingesammelten Mittel werden auf einem Meilenstein-Treuhandkonto verwahrt. Jede Tranche wird dem Künstler erst freigegeben, wenn der entsprechende Meilenstein erreicht ist, gemäß dem auf der Kampagnenseite angegebenen Zeitplan." }
      }
    },
    {
      id: "manager-discretion",
      vessatoria: true,
      vessatoriaCategory: {
        it: "facoltà di sospendere l'esecuzione del contratto",
        en: "right to suspend performance of the contract",
        es: "facultad de suspender la ejecución del contrato",
        fr: "faculté de suspendre l'exécution du contrat",
        de: "Recht zur Aussetzung der Vertragserfüllung"
      },
      i18n: {
        it: { title: "Potere di conferma e sospensione dell'SPV Manager",
          body: "L'SPV Manager ha la facoltà discrezionale di confermare o meno il raggiungimento di una milestone e, in caso di dubbio, di sospendere il rilascio della tranche corrispondente fino a chiarimento. Tale sospensione non costituisce inadempimento della SPV." },
        en: { title: "SPV Manager's confirmation and suspension power",
          body: "The SPV Manager has sole discretion to confirm or not confirm that a milestone has been reached and, in case of doubt, to suspend release of the corresponding tranche pending clarification. Such a suspension does not constitute a breach by the SPV." },
        es: { title: "Facultad de confirmación y suspensión del SPV Manager",
          body: "El SPV Manager tiene la facultad discrecional de confirmar o no el cumplimiento de un hito y, en caso de duda, de suspender la liberación del tramo correspondiente hasta su aclaración. Dicha suspensión no constituye un incumplimiento por parte de la SPV." },
        fr: { title: "Pouvoir de confirmation et de suspension du SPV Manager",
          body: "Le SPV Manager dispose du pouvoir discrétionnaire de confirmer ou non l'atteinte d'un jalon et, en cas de doute, de suspendre le versement de la tranche correspondante jusqu'à clarification. Cette suspension ne constitue pas un manquement de la SPV." },
        de: { title: "Bestätigungs- und Aussetzungsbefugnis des SPV Managers",
          body: "Der SPV Manager hat das alleinige Ermessen, das Erreichen eines Meilensteins zu bestätigen oder nicht, und kann im Zweifelsfall die Freigabe der entsprechenden Tranche bis zur Klärung aussetzen. Eine solche Aussetzung stellt keine Vertragsverletzung der SPV dar." }
      }
    },
    {
      id: "refund",
      vessatoria: true,
      vessatoriaCategory: {
        it: "decadenze a carico dell'Artista",
        en: "forfeiture provisions against the Artist",
        es: "cláusulas de caducidad a cargo del Artista",
        fr: "clauses de déchéance à la charge de l'Artiste",
        de: "Verwirkungsklauseln zulasten des Künstlers"
      },
      i18n: {
        it: { title: "Formula di rimborso pro-rata e decadenza sulle tranche non rilasciate",
          body: "In caso di mancato raggiungimento dell'obiettivo di raccolta o mancata consegna di una milestone entro i termini, gli importi non ancora rilasciati come tranche sono restituiti pro-rata ai token holder secondo la formula: importo rimborsabile = totale raccolto − Σ(tranche già rilasciate per milestone confermate). L'Artista non ha diritto a percepire le tranche relative a milestone non raggiunte." },
        en: { title: "Pro-rata refund formula and forfeiture of unreleased tranches",
          body: "If the funding goal is not reached, or a milestone is not delivered on time, amounts not yet released as tranches are refunded pro-rata to token holders using the formula: refundable amount = total raised − Σ(tranches already released for confirmed milestones). The Artist has no right to the tranches tied to milestones that were not reached." },
        es: { title: "Fórmula de reembolso prorrateado y caducidad de los tramos no liberados",
          body: "Si no se alcanza el objetivo de financiación o no se cumple un hito dentro del plazo, los importes aún no liberados como tramos se reembolsan de forma prorrateada a los titulares de tokens según la fórmula: importe reembolsable = total recaudado − Σ(tramos ya liberados por hitos confirmados). El Artista no tiene derecho a los tramos correspondientes a hitos no alcanzados." },
        fr: { title: "Formule de remboursement au prorata et déchéance des tranches non versées",
          body: "En cas de non-atteinte de l'objectif de financement ou de non-livraison d'un jalon dans les délais, les montants non encore versés en tranches sont remboursés au prorata aux détenteurs de tokens selon la formule : montant remboursable = total collecté − Σ(tranches déjà versées pour les jalons confirmés). L'Artiste n'a aucun droit sur les tranches liées à des jalons non atteints." },
        de: { title: "Pro-rata-Rückerstattungsformel und Verfall nicht freigegebener Tranchen",
          body: "Wird das Finanzierungsziel nicht erreicht oder ein Meilenstein nicht fristgerecht geliefert, werden noch nicht als Tranchen freigegebene Beträge anteilig an die Token-Inhaber zurückerstattet, nach der Formel: erstattungsfähiger Betrag = Gesamtsumme − Σ(bereits für bestätigte Meilensteine freigegebene Tranchen). Der Künstler hat keinen Anspruch auf Tranchen, die an nicht erreichte Meilensteine geknüpft sind." }
      }
    },
    {
      id: "liability",
      vessatoria: true,
      vessatoriaCategory: {
        it: "limitazione di responsabilità",
        en: "limitation of liability",
        es: "limitación de responsabilidad",
        fr: "limitation de responsabilité",
        de: "Haftungsbeschränkung"
      },
      i18n: {
        it: { title: "Limitazione di responsabilità della piattaforma e della SPV",
          body: "Salvo dolo o colpa grave, la responsabilità della piattaforma e della SPV per ritardi, sospensioni o mancato rilascio delle tranche è esclusa o limitata all'importo effettivamente trattenuto in escrow relativo alla campagna interessata." },
        en: { title: "Limitation of liability of the platform and the SPV",
          body: "Except in cases of willful misconduct or gross negligence, the liability of the platform and the SPV for delays, suspensions or non-release of tranches is excluded or limited to the amount actually held in escrow for the campaign concerned." },
        es: { title: "Limitación de responsabilidad de la plataforma y de la SPV",
          body: "Salvo dolo o culpa grave, la responsabilidad de la plataforma y de la SPV por retrasos, suspensiones o falta de liberación de los tramos queda excluida o limitada al importe efectivamente retenido en garantía en depósito relativo a la campaña en cuestión." },
        fr: { title: "Limitation de responsabilité de la plateforme et de la SPV",
          body: "Sauf dol ou faute lourde, la responsabilité de la plateforme et de la SPV pour les retards, suspensions ou non-versement des tranches est exclue ou limitée au montant effectivement conservé en séquestre pour la campagne concernée." },
        de: { title: "Haftungsbeschränkung der Plattform und der SPV",
          body: "Außer bei Vorsatz oder grober Fahrlässigkeit ist die Haftung der Plattform und der SPV für Verzögerungen, Aussetzungen oder Nichtfreigabe von Tranchen ausgeschlossen oder auf den Betrag beschränkt, der tatsächlich für die betreffende Kampagne treuhänderisch verwahrt wird." }
      }
    },
    {
      id: "exclusivity",
      vessatoria: true,
      vessatoriaCategory: {
        it: "restrizione alla libertà contrattuale dell'Artista nei rapporti con terzi",
        en: "restriction on the Artist's contractual freedom with third parties",
        es: "restricción a la libertad contractual del Artista frente a terceros",
        fr: "restriction à la liberté contractuelle de l'Artiste envers les tiers",
        de: "Einschränkung der Vertragsfreiheit des Künstlers gegenüber Dritten"
      },
      i18n: {
        it: { title: "Esclusiva sui diritti royalty per la durata della campagna",
          body: "Per la durata della campagna e fino al completamento delle milestone, l'Artista si impegna a non cedere, impegnare o concedere in garanzia a terzi gli stessi proventi royalty oggetto della cessione alla SPV." },
        en: { title: "Exclusivity over royalty rights for the duration of the campaign",
          body: "For the duration of the campaign and until the milestones are completed, the Artist agrees not to assign, pledge, or grant as security to any third party the same royalty income that is the subject of the assignment to the SPV." },
        es: { title: "Exclusividad sobre los derechos de regalías durante la campaña",
          body: "Durante la duración de la campaña y hasta la finalización de los hitos, el Artista se compromete a no ceder, pignorar ni ofrecer en garantía a terceros los mismos ingresos por regalías objeto de la cesión a la SPV." },
        fr: { title: "Exclusivité sur les droits de redevances pendant la durée de la campagne",
          body: "Pendant la durée de la campagne et jusqu'à l'achèvement des jalons, l'Artiste s'engage à ne pas céder, nantir ou donner en garantie à des tiers les mêmes revenus de redevances faisant l'objet de la cession à la SPV." },
        de: { title: "Exklusivität der Tantiemenrechte für die Dauer der Kampagne",
          body: "Für die Dauer der Kampagne und bis zum Abschluss der Meilensteine verpflichtet sich der Künstler, dieselben Tantiemeneinnahmen, die Gegenstand der Abtretung an die SPV sind, keinem Dritten abzutreten, zu verpfänden oder als Sicherheit zu gewähren." }
      }
    },
    {
      id: "jurisdiction",
      vessatoria: true,
      vessatoriaCategory: {
        it: "deroga alla competenza dell'autorità giudiziaria",
        en: "derogation from the ordinary courts' jurisdiction",
        es: "excepción a la competencia de la autoridad judicial",
        fr: "dérogation à la compétence de l'autorité judiciaire",
        de: "Abweichung von der Zuständigkeit der ordentlichen Gerichte"
      },
      i18n: {
        it: { title: "Legge applicabile e foro competente",
          body: "Il presente accordo è regolato dalla legge del Granducato di Lussemburgo. Per ogni controversia sono competenti in via esclusiva i tribunali del Lussemburgo-Città, salva la giurisdizione inderogabile del consumatore ove applicabile." },
        en: { title: "Governing law and competent court",
          body: "This agreement is governed by the law of the Grand Duchy of Luxembourg. For any dispute, the courts of Luxembourg City have exclusive jurisdiction, subject to any non-derogable consumer jurisdiction where applicable." },
        es: { title: "Ley aplicable y fuero competente",
          body: "El presente acuerdo se rige por la ley del Gran Ducado de Luxemburgo. Para cualquier controversia serán exclusivamente competentes los tribunales de la ciudad de Luxemburgo, sin perjuicio del fuero imperativo del consumidor cuando sea aplicable." },
        fr: { title: "Loi applicable et juridiction compétente",
          body: "Le présent accord est régi par le droit du Grand-Duché de Luxembourg. Pour tout litige, les tribunaux de la Ville de Luxembourg sont exclusivement compétents, sous réserve de la juridiction impérative du consommateur lorsqu'elle est applicable." },
        de: { title: "Anwendbares Recht und zuständiges Gericht",
          body: "Diese Vereinbarung unterliegt dem Recht des Großherzogtums Luxemburg. Für Streitigkeiten sind ausschließlich die Gerichte der Stadt Luxemburg zuständig, vorbehaltlich zwingender Verbrauchergerichtsstände, soweit anwendbar." }
      }
    },
    {
      id: "ai-disclosure",
      vessatoria: false,
      i18n: {
        it: { title: "Dichiarazioni sull'uso di intelligenza artificiale in produzione",
          body: "L'Artista dichiara e garantisce l'accuratezza delle informazioni fornite nella sezione di disclosure AI relative al brano caricato, impegnandosi ad aggiornarle in caso di modifiche rilevanti prima del rilascio." },
        en: { title: "Representations on the use of artificial intelligence in production",
          body: "The Artist represents and warrants the accuracy of the information provided in the AI disclosure section relating to the uploaded track, and agrees to update it in the event of material changes before release." },
        es: { title: "Declaraciones sobre el uso de inteligencia artificial en la producción",
          body: "El Artista declara y garantiza la exactitud de la información proporcionada en la sección de divulgación de IA relativa al tema subido, comprometiéndose a actualizarla en caso de cambios relevantes antes del lanzamiento." },
        fr: { title: "Déclarations relatives à l'utilisation de l'intelligence artificielle en production",
          body: "L'Artiste déclare et garantit l'exactitude des informations fournies dans la section de divulgation IA relative au titre déposé, et s'engage à les mettre à jour en cas de modification substantielle avant la sortie." },
        de: { title: "Erklärungen zum Einsatz künstlicher Intelligenz bei der Produktion",
          body: "Der Künstler erklärt und gewährleistet die Richtigkeit der Angaben im Abschnitt zur KI-Offenlegung bezüglich des hochgeladenen Titels und verpflichtet sich, diese vor der Veröffentlichung bei wesentlichen Änderungen zu aktualisieren." }
      }
    }
  ]
};

module.exports = { CONTRACT_TEMPLATE };
