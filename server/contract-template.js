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
  version: "v0.5-draft",
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
        it: { title: "Piano milestone e rilascio delle tranche",
          body: "I fondi raccolti sono custoditi nel contratto di escrow della campagna. Ogni tranche è rilasciata, al netto della commissione del 3% della Piattaforma, all'Artista o allo Studio secondo quanto indicato per ciascuna milestone nella pagina della campagna, solo quando l'Artista e lo Studio hanno entrambi confermato quella milestone, nell'ordine stabilito, e solo dopo che la campagna ha raccolto la soglia minima prevista dalla clausola sui rimborsi. In una campagna senza Studio basta la conferma dell'Artista." },
        en: { title: "Milestone plan and tranche release",
          body: "Funds raised are held in the campaign's escrow contract. Each tranche is released, less the Platform's 3% fee, to the Artist or to the Studio as indicated for each milestone on the campaign page, only once the Artist and the Studio have both confirmed that milestone, in the order set, and only after the campaign has raised the minimum set out in the refund clause. In a campaign without a Studio, the Artist's confirmation is enough." },
        es: { title: "Plan de hitos y liberación de los tramos",
          body: "Los fondos recaudados se custodian en el contrato de depósito en garantía de la campaña. Cada tramo se libera, descontada la comisión del 3% de la Plataforma, al Artista o al Estudio según lo indicado para cada hito en la página de la campaña, solo cuando el Artista y el Estudio han confirmado ambos ese hito, en el orden establecido, y solo después de que la campaña haya recaudado el mínimo previsto en la cláusula de reembolso. En una campaña sin Estudio basta la confirmación del Artista." },
        fr: { title: "Plan de jalons et versement des tranches",
          body: "Les fonds collectés sont conservés dans le contrat de séquestre de la campagne. Chaque tranche est versée, déduction faite de la commission de 3 % de la Plateforme, à l'Artiste ou au Studio selon ce qui est indiqué pour chaque jalon sur la page de la campagne, uniquement lorsque l'Artiste et le Studio ont tous deux confirmé ce jalon, dans l'ordre fixé, et uniquement après que la campagne a collecté le minimum prévu par la clause de remboursement. Dans une campagne sans Studio, la confirmation de l'Artiste suffit." },
        de: { title: "Meilensteinplan und Freigabe der Tranchen",
          body: "Die eingesammelten Mittel werden im Treuhandvertrag der Kampagne verwahrt. Jede Tranche wird, abzüglich der Gebühr der Plattform von 3 %, an den Künstler oder an das Studio freigegeben, wie für jeden Meilenstein auf der Kampagnenseite angegeben, erst wenn der Künstler und das Studio diesen Meilenstein beide bestätigt haben, in der festgelegten Reihenfolge, und erst nachdem die Kampagne den in der Erstattungsklausel vorgesehenen Mindestbetrag eingesammelt hat. Bei einer Kampagne ohne Studio genügt die Bestätigung des Künstlers." }
      }
    },
    {
      // Was "manager-discretion": an SPV Manager with sole discretion to
      // confirm or suspend milestones — the power the escrow removed (§2.27).
      // Only the artist and the studio confirm on chain; the Owner Safe can
      // only cancel. Text from legal/08 A-1 (§2.113).
      id: "cancellation",
      vessatoria: true,
      vessatoriaCategory: {
        it: "facoltà di recedere dal contratto",
        en: "right to withdraw from the contract",
        es: "facultad de desistir del contrato",
        fr: "faculté de résilier le contrat",
        de: "Recht zur Beendigung des Vertrags"
      },
      i18n: {
        it: { title: "Conferma delle milestone e annullamento della campagna",
          body: "Le milestone sono confermate esclusivamente dall'Artista e dallo Studio, ciascuno con il proprio wallet, sul contratto di escrow: la tranche si rilascia quando entrambi hanno confermato. La Piattaforma non ha il potere di confermare, rilasciare o sospendere una tranche. Può soltanto annullare la Campagna, anche dopo il rilascio di una o più tranche, ed esclusivamente se: (a) il Brano o i materiali hanno contenuto illecito; (b) violano diritti di terzi, come risulta da una segnalazione circostanziata del titolare dei diritti, da un provvedimento di un'autorità o da una decisione giudiziaria; (c) una dichiarazione o garanzia dell'Artista risulta falsa o inesatta. Prima dell'annullamento la Piattaforma comunica all'Artista i motivi e gli concede 5 giorni per presentare osservazioni o rimuovere la violazione, salvo che la legge o un'autorità impongano la rimozione immediata. La decisione è scritta, motivata e datata, ed è comunicata all'Artista e agli Investitori. Con l'annullamento gli importi non ancora rilasciati sono rimborsati ai possessori dei token. L'annullamento in questi casi non costituisce inadempimento della Piattaforma o della SPV." },
        en: { title: "Milestone confirmation and campaign cancellation",
          body: "Milestones are confirmed only by the Artist and the Studio, each with their own wallet, on the escrow contract: a tranche is released once both have confirmed. The Platform has no power to confirm, release or suspend a tranche. It may only cancel the Campaign, including after one or more tranches have been released, and only if: (a) the Track or its materials have unlawful content; (b) they infringe third-party rights, as shown by a substantiated notice from the rights holder, an order of an authority or a court decision; (c) a representation or warranty of the Artist proves false or inaccurate. Before cancelling, the Platform tells the Artist the reasons and gives 5 days to respond or remove the infringement, unless the law or an authority requires immediate removal. The decision is written, reasoned and dated, and is communicated to the Artist and the Investors. On cancellation, amounts not yet released are refunded to the token holders. Cancellation in these cases is not a breach by the Platform or the SPV." },
        es: { title: "Confirmación de los hitos y cancelación de la campaña",
          body: "Los hitos los confirman únicamente el Artista y el Estudio, cada uno con su propio wallet, en el contrato de garantía en depósito: el tramo se libera cuando ambos han confirmado. La Plataforma no tiene facultad para confirmar, liberar o suspender un tramo. Solo puede cancelar la Campaña, incluso después de la liberación de uno o más tramos, y únicamente si: (a) el Tema o los materiales tienen contenido ilícito; (b) vulneran derechos de terceros, según resulte de una notificación fundamentada del titular de los derechos, de una resolución de una autoridad o de una decisión judicial; (c) una declaración o garantía del Artista resulta falsa o inexacta. Antes de la cancelación, la Plataforma comunica al Artista los motivos y le concede 5 días para presentar observaciones o eliminar la infracción, salvo que la ley o una autoridad impongan la retirada inmediata. La decisión es escrita, motivada y fechada, y se comunica al Artista y a los Inversores. Con la cancelación, los importes aún no liberados se reembolsan a los titulares de los tokens. La cancelación en estos casos no constituye un incumplimiento de la Plataforma ni de la SPV." },
        fr: { title: "Confirmation des jalons et annulation de la campagne",
          body: "Les jalons sont confirmés exclusivement par l'Artiste et par le Studio, chacun avec son propre wallet, sur le contrat de séquestre : la tranche est versée lorsque les deux ont confirmé. La Plateforme n'a pas le pouvoir de confirmer, de verser ou de suspendre une tranche. Elle peut seulement annuler la Campagne, y compris après le versement d'une ou plusieurs tranches, et uniquement si : (a) le Titre ou les supports ont un contenu illicite ; (b) ils portent atteinte aux droits de tiers, tel qu'il ressort d'une notification circonstanciée du titulaire des droits, d'une décision d'une autorité ou d'une décision judiciaire ; (c) une déclaration ou garantie de l'Artiste s'avère fausse ou inexacte. Avant l'annulation, la Plateforme communique à l'Artiste les motifs et lui accorde 5 jours pour présenter ses observations ou faire cesser l'atteinte, sauf si la loi ou une autorité impose un retrait immédiat. La décision est écrite, motivée et datée, et elle est communiquée à l'Artiste et aux Investisseurs. En cas d'annulation, les montants non encore versés sont remboursés aux détenteurs de tokens. L'annulation dans ces cas ne constitue pas un manquement de la Plateforme ou de la SPV." },
        de: { title: "Bestätigung der Meilensteine und Annullierung der Kampagne",
          body: "Meilensteine werden ausschließlich vom Künstler und vom Studio bestätigt, jeweils mit ihrem eigenen Wallet, auf dem Treuhandvertrag: Die Tranche wird freigegeben, sobald beide bestätigt haben. Die Plattform hat keine Befugnis, eine Tranche zu bestätigen, freizugeben oder auszusetzen. Sie kann die Kampagne nur annullieren, auch nach der Freigabe einer oder mehrerer Tranchen, und ausschließlich wenn: (a) der Titel oder die Materialien rechtswidrige Inhalte haben; (b) sie Rechte Dritter verletzen, wie sich aus einer begründeten Meldung des Rechteinhabers, einer behördlichen Anordnung oder einer gerichtlichen Entscheidung ergibt; (c) eine Zusicherung oder Gewährleistung des Künstlers sich als falsch oder unzutreffend erweist. Vor der Annullierung teilt die Plattform dem Künstler die Gründe mit und gewährt ihm 5 Tage, um Stellung zu nehmen oder die Verletzung zu beseitigen, es sei denn, das Gesetz oder eine Behörde verlangen die sofortige Entfernung. Die Entscheidung ist schriftlich, begründet und datiert und wird dem Künstler und den Investoren mitgeteilt. Mit der Annullierung werden die noch nicht freigegebenen Beträge an die Token-Inhaber zurückerstattet. Die Annullierung in diesen Fällen stellt keine Vertragsverletzung der Plattform oder der SPV dar." }
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
        it: { title: "Soglia minima, scadenza della raccolta e rimborsi",
          body: "Ogni campagna ha una scadenza e una soglia minima di raccolta, scelte dall'Artista al lancio e registrate nel contratto di escrow. Finché la soglia non è raggiunta nessuna tranche è rilasciata. Se alla scadenza la soglia non è raggiunta, la campagna fallisce automaticamente, senza decisione di nessuno, e ogni possessore di token può restituirli in cambio della propria quota di quanto raccolto. Raggiunta la soglia, la scadenza non ha più effetto. Se la campagna è annullata secondo la clausola di annullamento, i possessori ricevono pro-rata gli importi non ancora rilasciati. In entrambi i casi la commissione del 2% sui contributi non è rimborsata. L'Artista non ha diritto alle tranche non rilasciate." },
        en: { title: "Minimum raise, raise deadline and refunds",
          body: "Each campaign has a raise deadline and a minimum raise, chosen by the Artist at launch and recorded in the escrow contract. Until the minimum is reached, no tranche is released. If the minimum is not reached by the deadline, the campaign fails automatically, without anyone's decision, and every token holder may return their tokens for their share of what was raised. Once the minimum is reached, the deadline has no further effect. If the campaign is cancelled under the cancellation clause, holders receive the amounts not yet released, pro rata. In both cases the 2% contribution fee is not refunded. The Artist has no right to unreleased tranches." },
        es: { title: "Mínimo de recaudación, plazo y reembolsos",
          body: "Cada campaña tiene un plazo y un mínimo de recaudación, elegidos por el Artista en el lanzamiento y registrados en el contrato de depósito en garantía. Hasta alcanzar el mínimo no se libera ningún tramo. Si el mínimo no se alcanza en el plazo, la campaña fracasa automáticamente, sin decisión de nadie, y cada titular de tokens puede devolverlos a cambio de su parte de lo recaudado. Una vez alcanzado el mínimo, el plazo deja de tener efecto. Si la campaña se cancela conforme a la cláusula de cancelación, los titulares reciben a prorrata los importes aún no liberados. En ambos casos la comisión del 2% sobre las aportaciones no se reembolsa. El Artista no tiene derecho a los tramos no liberados." },
        fr: { title: "Collecte minimale, échéance et remboursements",
          body: "Chaque campagne a une échéance et un minimum de collecte, choisis par l'Artiste au lancement et enregistrés dans le contrat de séquestre. Tant que le minimum n'est pas atteint, aucune tranche n'est versée. Si le minimum n'est pas atteint à l'échéance, la campagne échoue automatiquement, sans décision de quiconque, et chaque détenteur de tokens peut les restituer contre sa part de ce qui a été collecté. Une fois le minimum atteint, l'échéance n'a plus d'effet. Si la campagne est annulée en vertu de la clause d'annulation, les détenteurs reçoivent au prorata les montants non encore versés. Dans les deux cas, la commission de 2 % sur les contributions n'est pas remboursée. L'Artiste n'a aucun droit sur les tranches non versées." },
        de: { title: "Mindestbetrag, Finanzierungsfrist und Erstattungen",
          body: "Jede Kampagne hat eine Finanzierungsfrist und einen Mindestbetrag, die der Künstler beim Start wählt und die im Treuhandvertrag festgehalten werden. Bis der Mindestbetrag erreicht ist, wird keine Tranche freigegeben. Wird der Mindestbetrag bis zur Frist nicht erreicht, scheitert die Kampagne automatisch, ohne Entscheidung von irgendjemandem, und jeder Token-Inhaber kann seine Token gegen seinen Anteil am Eingesammelten zurückgeben. Ist der Mindestbetrag erreicht, hat die Frist keine Wirkung mehr. Wird die Kampagne nach der Annullierungsklausel annulliert, erhalten die Inhaber anteilig die noch nicht freigegebenen Beträge. In beiden Fällen wird die Gebühr von 2 % auf die Beiträge nicht erstattet. Der Künstler hat keinen Anspruch auf nicht freigegebene Tranchen." }
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
