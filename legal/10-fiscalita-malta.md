# Società a Malta e il rimborso 6/7

*Scritto il 2026-09-22. Decisione dell'utente: **costituire la società a Malta e
operare da lì**, con l'obiettivo di arrivare a un'imposizione effettiva del 5%
sugli utili tramite il rimborso dei 6/7.*

> **Non è consulenza fiscale.** Come tutta questa cartella, l'ha scritta un
> assistente AI. Le aliquote, le soglie e i termini qui sotto vengono da fonti
> pubbliche consultate il 2026-09-22 e sono segnati **[verificare]** dove non
> sono stati confermati su fonte ufficiale. Il fisco internazionale è la materia
> dove un dettaglio sbagliato costa di più: **questo documento serve ad arrivare
> preparati dal commercialista, non a sostituirlo.** Ne servono due, e vanno
> fatti parlare tra loro: uno maltese e un tributarista italiano.

---

## 1. Il meccanismo, senza giri di parole

Malta **non ha un'aliquota del 5%**. Ha un'aliquota societaria del **35%**, che
è tra le più alte d'Europa. Il 5% è il risultato di un rimborso, e il rimborso
ha tre caratteristiche che cambiano tutto:

1. **Non lo prende la società. Lo prende il socio.**
2. **Arriva dopo.** Prima la società versa il 35% per intero.
3. **Scatta solo quando l'utile viene distribuito.** Utile che resta in società,
   rimborso che non esiste.

Malta applica la *full imputation system*: l'imposta pagata dalla società è un
credito del socio. Quando la società distribuisce un dividendo, il socio chiede
all'amministrazione fiscale maltese (MTCA) il rimborso di una frazione
dell'imposta che la società ha già versato. Per gli utili da **attività
commerciale** quella frazione è **6/7**.

### L'esempio con i numeri

Utile ante imposte: **100.000 €**

| Passaggio | Importo |
|---|---|
| Imposta maltese, 35% | −35.000 € |
| Utile distribuibile | 65.000 € |
| Dividendo al socio | 65.000 € |
| Rimborso al socio: 6/7 × 35.000 | +30.000 € |
| **In mano al socio** | **95.000 €** |
| **Carico fiscale maltese effettivo** | **5.000 € = 5%** |

Il 5% è corretto. Ma è il carico **a Malta**. Quei 95.000 € arrivano a una
persona fisica o a una società, che ha una propria residenza fiscale, e lì la
storia continua. È il §4, ed è la parte che decide se questo piano funziona.

### Il costo di cassa che nessuno menziona

Tra il versamento del 35% e l'incasso del rimborso passano mesi: serve che
l'imposta sia stata pagata, che il **bilancio certificato** sia depositato e che
la dichiarazione sia presentata. Poi il rimborso è dovuto entro **14 giorni
dalla fine del mese** in cui matura **[verificare]**. In pratica: per un anno
intero la società lavora avendo lasciato il 35% degli utili al fisco maltese.
Su 100.000 € di utile sono 30.000 € fermi. Va messo nel piano di cassa.

**L'alternativa:** dal 2019 Malta consente la **fiscal unit** (consolidato), che
fa pagare direttamente il 5% invece di 35%-poi-rimborso, eliminando il problema
di cassa. Richiede una struttura di gruppo (soglia di possesso al 95%
**[verificare]**) e quindi due società invece di una. Va valutata col
commercialista maltese: è una scelta di cassa, non di aliquota.

---

## 2. Non è sempre 6/7: le quattro frazioni

Questo è il punto dove il piano può perdere metà del vantaggio senza che nessuno
se ne accorga.

| Tipo di reddito della società | Rimborso | Effettivo |
|---|---|---|
| Utili da **attività commerciale** (trading income) | **6/7** | **5%** |
| **Interessi e royalty passivi** | 5/7 | ~10% |
| Redditi per cui si è chiesto il credito per imposte estere | 2/3 | variabile |
| **Participating holding** (dividendi e plusvalenze da partecipazioni qualificate) | 100% | 0% |

### Le royalty degli artisti non c'entrano: non sono mai ricavi della società

Va detto subito perché è la confusione naturale, e perché toglie di mezzo un
falso problema. **Il flusso di royalty che parte dagli artisti e arriva ai
possessori dei token non entra mai nei conti della società.** Verificato nel
contratto, non dedotto:

- **Vendita primaria** (`HumfiverseCatalogueToken.buy`, riga 366): il compratore
  paga, e `cost - fee` va **direttamente** dal wallet del compratore a quello
  dell'artista. Alla società arriva solo `fee`.
- **Versamento di royalty** (`depositRoyalties`, righe 456-466): l'intero importo
  entra **nel contratto**, non in società. L'1% si accumula in `accruedFees`, il
  99% resta nel contratto e ogni possessore se lo ritira da solo con
  `claimRoyalties`.

Quindi il lordo non tocca mai il bilancio della società, in nessuno dei due
flussi. Quello che la società incassa sono **soltanto le commissioni**.

### Le commissioni sono tutte trading income

Le cinque commissioni — 6% sulla vendita diretta, 2% sui contributi, 3% sulle
tranche, 1% sulle rivendite, 1% su ogni versamento di royalty (01 §10, §11) —
sono corrispettivi di un servizio, quindi **trading income: 6/7, 5%**. Compreso
l'1% sulle royalty, per due ragioni indipendenti:

1. Nel diritto maltese "royalties" indica il corrispettivo **per l'uso di
   proprietà intellettuale**. La società non concede in uso nessuna IP: i
   diritti restano dell'artista, la piattaforma amministra un meccanismo di
   distribuzione e si fa pagare per quello.
2. Anche ammesso che qualcuno volesse qualificarlo come royalty, il test del
   reddito *passivo* richiede che il reddito **non derivi da un'attività
   d'impresa**. Gestire la piattaforma è l'attività d'impresa. **[verificare]**

Resta vero che quell'1% è l'unica commissione presa su denaro di terzi in
transito, ed è la ragione per cui esistono **02 C-15** e la domanda **07 A13** —
ma quella è una questione di *qualificazione dell'attività* (serve
un'autorizzazione per trasferire quel denaro?), non di aliquota di rimborso. Le
due cose si erano sovrapposte nella prima stesura di questo file.

### Dove il 5/7 potrebbe comparire davvero

Due casi, nessuno dei quali è quello attuale. Vanno tenuti d'occhio perché
dipendono da decisioni che potreste prendere voi:

1. **Rendimento sulla liquidità.** Se un domani la società tiene USDC o euro
   propri e ci guadagna un interesse, *quello* è interesse passivo: 5/7, ≈10%.
   Oggi non succede — i fondi stanno nel contratto, non in società.
2. **Se il modello cambia e la società acquista lei i cataloghi.** Se invece di
   intermediare la società comprasse i diritti e li concedesse in licenza,
   quello sarebbe reddito da royalty vero e proprio, e lì il 5/7 si
   applicherebbe. Non è il piano attuale; se lo diventa, questo paragrafo va
   riletto.

### Una conseguenza utile: il fatturato della società è piccolo

Siccome il lordo non passa dai conti, il **fatturato** della società non è il
volume scambiato sulla piattaforma ma solo la somma delle commissioni. Su un
milione di euro di cataloghi venduti al 6%, il fatturato è 60.000 €, non un
milione. Conta per la soglia di esenzione dalla revisione (§3) e per qualunque
test basato sul fatturato: la società resta "piccola" molto più a lungo di
quanto suggerisca il giro d'affari.

---

## 3. Requisiti per costituire e tenere in piedi la società

Tutto quanto segue è da confermare con un *corporate service provider* maltese;
i numeri sono l'ordine di grandezza con cui ragionare.

### Costituzione
- Forma: **private limited liability company** (Ltd), iscritta al **Malta
  Business Registry** (MBR).
- **Capitale sociale minimo: 1.164,69 €**, interamente sottoscritto, di cui
  almeno il **20% versato** (≈ 233 €).
- Sottoscrittori: di norma **almeno 2**; la società a socio unico esiste ma
  segue regole proprie **[verificare]** — riguarda voi direttamente, visto che
  siete in due (Cesare e Vincenzo).
- Almeno **1 amministratore** e **1 company secretary**. Il secretary deve
  essere una persona fisica, e in genere non può coincidere con l'unico
  amministratore **[verificare]**.
- **Sede legale a Malta.**

### Obblighi ricorrenti
- **Revisione legale del bilancio obbligatoria.** Malta la impone a *tutte* le
  società, non solo alle grandi. Esiste un'esenzione per le micro-imprese che
  non superano due soglie su tre — attivo 46.600 €, fatturato 93.000 €, 2
  dipendenti in media **[verificare]**. Attenzione al fatturato: come spiega il
  §2, è la somma delle **commissioni**, non il volume scambiato, quindi
  l'esenzione può reggere più a lungo del previsto — 93.000 € di commissioni al
  6% vogliono dire circa 1,5 milioni di cataloghi venduti. Ma la sostanza (§4.4)
  spinge verso l'avere dipendenti a Malta, e due dipendenti fanno saltare una
  delle tre soglie. **Nel piano di cassa mettete comunque il revisore.**
- Bilancio e *annual return* all'MBR; dichiarazione dei redditi all'MTCA.
- **Registrazione del socio presso l'MTCA per poter chiedere i rimborsi.** Senza
  questo passaggio il 6/7 non si chiede: la società paga il 35% e basta.
- Registrazione IVA. Aliquota ordinaria **18%**.
- Malta **non applica ritenute in uscita** su dividendi, interessi e royalty
  verso non residenti. È uno dei motivi per cui la struttura funziona.

### Costi, ordine di grandezza **[verificare]**
- Costituzione: **1.500–3.000 €** una tantum tramite un provider.
- Capitale da versare: **233 €**.
- Ricorrenti (sede, secretary, contabilità, **revisione**): realisticamente
  **3.000–8.000 € l'anno** per una società piccola.
- **I costi di sostanza (§4.4) non sono in questa lista e sono il numero vero.**

---

## 4. Il punto che decide tutto: dove siete residenti voi

Il 5% è un numero maltese. Che diventi anche *il vostro* numero dipende da due
cose, e nessuna delle due riguarda Malta: dipende da **dove la società è
davvero amministrata** e da **dove siete residenti voi**.

L'utente ha già detto la cosa giusta — *«poi da lì opero»*. Questo paragrafo
spiega cosa deve voler dire in concreto, perché è la condizione da cui dipende
tutto il resto.

### 4.1 Esterovestizione: la società può essere italiana anche se è maltese

L'**art. 73, comma 3, TUIR**, riscritto dal **D.Lgs. 209/2023** con effetto dal
2024, considera residente in Italia la società che per la maggior parte del
periodo d'imposta ha nel territorio dello Stato, **in alternativa**:

1. la **sede legale**, oppure
2. la **sede di direzione effettiva** — dove si assumono «in via continuativa e
   coordinata le **decisioni strategiche** riguardanti la società nel suo
   complesso», oppure
3. la **gestione ordinaria in via principale** — dove si compiono «in via
   continuativa e coordinata gli **atti di gestione corrente**».

Bastano il secondo o il terzo. La sede legale a Malta non protegge da nulla.

**Tradotto:** se la società è registrata a La Valletta ma le decisioni le
prendete voi dall'Italia, in call, allora per il fisco italiano quella società è
italiana. Conseguenza: **IRES 24% + IRAP sull'utile mondiale**, più sanzioni,
più il fatto che avete comunque pagato il 35% a Malta. Il caso peggiore non è
"niente 5%": è pagare due volte.

Il criterio della *gestione ordinaria* introdotto nel 2024 è il più insidioso
per una società piccola, perché non guarda al consiglio di amministrazione ma a
chi fa il lavoro di tutti i giorni. In una piattaforma di due persone, chi fa il
lavoro di tutti i giorni siete voi due.

### 4.2 La vostra residenza personale

Il rimborso dei 6/7 **arriva al socio**. Se il socio è una persona fisica
residente in Italia, l'Italia tassa quel che riceve, e il 5% maltese diventa
l'acconto di un conto molto più alto.

Per cessare davvero la residenza fiscale italiana (**art. 2 TUIR**, anch'esso
riformato dal D.Lgs. 209/2023) servono, in sostanza: stare fuori dall'Italia per
**più di 183 giorni**, **iscriversi all'AIRE**, e — la parte che conta — non
avere più in Italia il **domicilio**, oggi definito come il luogo in cui si
sviluppano **in via principale le relazioni personali e familiari**.

Due precisazioni che valgono soldi:

- **L'AIRE da sola non basta.** È necessaria, non sufficiente. Le contestazioni
  si vincono o si perdono sul domicilio sostanziale: dove vive la famiglia, dove
  state davvero, dove sono i vostri interessi.
- **Malta non è più in black list per le persone fisiche.** Era nell'elenco del
  **D.M. 4 maggio 1999**, che ribalta l'onere della prova su chi si trasferisce,
  ma ne è stata **esclusa dal D.M. 27 luglio 2010**. Quindi trasferendovi a
  Malta **non scatta la presunzione di residenza fittizia in Italia**: l'onere
  della prova resta a carico dell'Agenzia. È un vantaggio concreto rispetto ad
  altre destinazioni, e va detto perché spesso si dà per scontato il contrario.

### 4.3 CFC, e la trappola dei dividendi

Finché uno di voi resta residente in Italia e controlla la società maltese,
scattano due norme diverse, entrambe sgradevoli:

- **CFC, art. 167 TUIR.** Se la società estera controllata subisce
  un'imposizione effettiva **inferiore alla metà** di quella italiana e più di
  **1/3** dei suoi ricavi è *passivo*, gli utili vengono imputati al socio
  italiano **anche se non distribuiti**. Il 5% contro il 24% dell'IRES fallisce
  il primo test in modo netto. Il secondo probabilmente regge — le commissioni
  di una piattaforma sono reddito attivo — ma va dimostrato. L'esimente
  principale è lo **svolgimento di un'attività economica effettiva, con
  personale, attrezzature, attivi e locali**: di nuovo la sostanza. Il D.Lgs.
  209/2023 ha aggiunto un'opzione per un'**imposta sostitutiva del 15%**
  sull'utile contabile della controllata, in alternativa al test ordinario
  **[verificare]**.
- **Dividendi da regimi privilegiati, art. 47-bis TUIR.** Anche dove la CFC non
  si applica, un dividendo che arriva da una partecipazione controllata con
  tassazione effettiva bassa può essere tassato **integralmente a IRPEF** (fino
  al 43%) invece che con la sostitutiva del 26%, salvo dimostrare l'esimente
  della attività economica effettiva. **[verificare]** — è intricato ed è esattamente
  il genere di dettaglio che va confermato prima di muovere qualcosa.

**La conclusione pratica è una sola:** il 5% non si ottiene spostando la
società. Si ottiene spostando **anche voi**. È quello che l'utente ha già in
mente; qui serviva solo scrivere che è la condizione, non un dettaglio.

### 4.4 Cosa vuol dire "sostanza", in concreto

Non è una lista di cortesia: è la prova che vi verrà chiesta.

- Amministratori realmente residenti a Malta — o voi, residenti lì.
- **Consigli tenuti fisicamente a Malta, verbalizzati.**
- Un **ufficio vero**, non una casella postale presso un provider.
- Funzioni realmente svolte a Malta: lo sviluppo, il supporto, le decisioni.
- Conto corrente della società a Malta, contratti firmati lì.
- Coerenza tra quel che dite e quel che si vede: se il sito, i commit, i
  fornitori e i fusi orari raccontano l'Italia, la sostanza non regge.

**Il problema dei due soci.** Siete in due (`CLAUDE.md`, «Team & branches»). Se
uno si trasferisce e l'altro resta in Italia continuando a co-gestire, la
*gestione ordinaria* rischia di risultare italiana lo stesso, e per chi resta
scattano CFC e art. 47-bis. **Va deciso prima**, non dopo la costituzione: è la
domanda **L5**.

---

## 5. Come si incastra con il resto della cartella

### 5.1 Malta non sostituisce il veicolo lussemburghese: risponde a un'altra domanda

La cartella oggi ipotizza un **veicolo di cartolarizzazione lussemburghese**
(legge 22 marzo 2004) per **emettere** i token — domande **A6** e **A11**.
Quella è una scelta di *regolamentazione dell'emissione*.

Malta è una scelta diversa: riguarda la **società operativa** che gestisce la
piattaforma, incassa le commissioni e assume le persone. Le due cose non sono
alternative. Sono possibili almeno tre configurazioni, e vanno messe sul tavolo
insieme:

| Configurazione | Operativa | Emissione |
|---|---|---|
| A | Malta Ltd | Veicolo LU |
| B | Malta Ltd | Veicolo maltese |
| C | Malta Ltd | Nessun veicolo separato (se A1 conclude che non serve) |

### 5.2 Il motivo per cui Malta potrebbe convenire **oltre** al fisco

Questo è il punto che rende la scelta coerente col progetto invece che solo
fiscale, e che vale la pena portare all'avvocato dei mercati finanziari:

- **MiCA.** Malta è UE, il regolatore è la **MFSA**. Un'autorizzazione **CASP**
  rilasciata dalla MFSA si **passaporta in tutti i 27 Stati UE/SEE** con una
  semplice notifica. Malta è stata la prima giurisdizione europea con una
  disciplina cripto (VFA Act, 2018) e ha una MFSA che ha già istruito pratiche
  di questo tipo; le licenze VFA esistenti transitano a CASP entro il
  **1° luglio 2026** **[verificare]**. Requisiti di capitale a partire da
  **50.000 €** a seconda dei servizi **[verificare]**.
- **ECSPR.** Allo stesso modo, un'autorizzazione come *European Crowdfunding
  Service Provider* rilasciata dalla MFSA si passaporta in tutta l'UE — ed è
  esattamente ciò di cui parla la domanda **B1** per le campagne di
  pre-produzione. **[verificare]** che la MFSA sia autorità competente ECSP.

Messo così, Malta potrebbe **semplificare A12 e A13**: la società che incassa il
denaro dell'artista, la società che lo converte e l'autorità che la vigila
starebbero tutte nello stesso posto, invece di essere sparse tra Italia,
Lussemburgo e un regolatore da scegliere.

### 5.3 Gli svantaggi, detti chiaramente

- **Reputazione e banche.** Malta è stata nella *grey list* del GAFI da giugno
  2021 a giugno 2022 **[verificare]**. L'effetto pratico che resta è che le
  banche estere applicano due diligence rafforzata alle strutture maltesi, e
  che **aprire un conto bancario per una società maltese che tocca cripto è
  difficile**. Non è un problema legale, è un problema operativo che però può
  bloccare tutto: va verificato *prima* di costituire, non dopo.
- **Costo della sostanza.** Trasferirsi davvero costa più di quanto si risparmia
  finché gli utili sono piccoli. Su 50.000 € di utile il risparmio rispetto a
  una SRL italiana è dell'ordine di poche decine di migliaia di euro l'anno;
  ufficio, revisore, provider e trasferimento se li mangiano. **La struttura
  conviene sopra una certa soglia di utile, e sotto quella soglia è una perdita
  secca.** Il commercialista deve dirvi dov'è quella soglia per i vostri numeri.
- **Una società, non un domicilio.** Tutto il §4 si riassume così: se non vi
  trasferite davvero, non solo non ottenete il 5%, ma vi esponete a una
  contestazione di esterovestizione che costa più di quanto avreste risparmiato.

---

## 6. Pillar Two: non vi riguarda, e conviene saperlo dire

È la prima obiezione che sentirete («ma non c'è la tassa minima globale del
15%?»). La risposta:

- La **Direttiva (UE) 2022/2523** e il Pillar Two OCSE impongono un'aliquota
  effettiva minima del 15% **solo ai gruppi con ricavi consolidati ≥ 750 milioni
  di euro** in almeno due dei quattro esercizi precedenti. Humfiverse non è
  nello stesso ordine di grandezza.
- Malta ha recepito la direttiva ma ne ha **differito l'applicazione**
  avvalendosi della deroga, **fino a fine 2029** **[verificare]**.
- Nel 2025 Malta ha introdotto il regime **FITWI** (*Final Income Tax Without
  Imputation*, Legal Notice 188/2025 **[verificare]**): un'imposta finale
  opzionale al 15% senza rimborsi né imputazione, pensata per i gruppi *in
  scope*. **Non vi serve** — e soprattutto: il fatto che sia stato creato come
  regime separato conferma che **il sistema dei rimborsi resta in piedi per
  tutti gli altri**, cioè per voi.

Verificato il 2026-09-22 su fonti pubbliche: **nel 2026 il rimborso dei 6/7 è
ancora in vigore.**

---

## 7. Ordine consigliato delle cose da fare

Nessuno di questi passi richiede di aver già costituito qualcosa.

1. **Prima il conto bancario, poi la società.** Chiedete a due banche maltesi se
   aprirebbero un conto a una società con questo oggetto sociale. Se la risposta
   è no, il resto non serve (§5.3).
2. **Fate fare i numeri.** Sopra quale utile la struttura conviene davvero, coi
   costi di sostanza dentro? Sotto quella soglia, una SRL italiana è più
   economica e infinitamente più semplice.
3. **Decidete chi si trasferisce, e quando** (§4.4, domanda **L5**). È la
   decisione che va presa per prima perché tutto il resto ne dipende.
4. **Portate L4–L9 al commercialista e A15 all'avvocato dei mercati
   finanziari**, possibilmente nello stesso giro: la scelta della giurisdizione
   è fiscale e regolamentare insieme, e decisa da una sola delle due parti viene
   male.
5. **Solo dopo, costituite.**

Nel frattempo resta aperta **G1**: oggi non esiste nessuna società, da nessuna
parte, e il prototipo è pubblico. Quel problema non aspetta Malta — va risolto
comunque, anche con una struttura provvisoria.

---

## 8. Cosa questo documento non fa

- Non dice se Malta sia la scelta giusta. Dice a quali condizioni il 5%
  funziona, e cosa costa rispettarle.
- Non sostituisce due professionisti: un *corporate service provider* o
  tributarista **maltese** e un tributarista **italiano**. Presi separatamente,
  ciascuno vede metà del problema — e il problema, come spiega il §4, sta tutto
  nell'incastro tra le due metà.
- Ogni aliquota, soglia e termine segnato **[verificare]** è esattamente questo:
  da verificare. Le fonti sono pubbliche e datate 2026-09-22, non ufficiali.

## Fonti consultate il 2026-09-22

Nessuna è una fonte ufficiale: sono studi professionali e guide divulgative,
usate per orientarsi e per controllare che il quadro non fosse cambiato.

- MFSA, *VFA Licence and Transition to CASP under the MiCA Act* — <https://www.mfsa.mt/publication/vfa-licence-and-transition-to-casp-under-the-markets-in-crypto-assets-act-mica-act/>
- *Malta Tax Refunds in 2026: How the 6/7 Mechanism Turns 35% Into 5%* — <https://www.1step.eu/malta-tax-refunds-in-2026/>
- *Malta 6/7 Tax Refund (2026)* — <https://www.zunapro.com/malta/en/blog/malta-tax-refund-system-5-percent-effective-rate>
- Ordine dei Commercialisti di Brescia, *Esterovestizione — art. 73, co. 3 e 5-bis TUIR (post D.Lgs. 209/23)* — <https://commercialisti.brescia.it/images/VALENTI_ESTEROVESTIZIONE.pdf>
- Fiscomania, *Residenza fiscale delle società (art. 73 TUIR): nuovi criteri* — <https://fiscomania.com/residenza-fiscale-delle-societa/>
- FISCOeTASSE, *Black list: la mappa aggiornata dei paradisi fiscali* (esclusione di Malta col D.M. 27 luglio 2010) — <https://www.fiscoetasse.com/normativa-prassi/12009-black-list-aggiornata-la-mappa-dei-paradisi-fiscali.html>
- GVZH, *Private Limited Liability Company* (capitale, secretary, organi) — <https://gvzh.mt/services/practice-areas/trustees/company-formation-malta/limited-liabilities-companies/private/>
- Zerafa, *Share capital requirements in Malta* — <https://www.zerafa.com.mt/share-capital-requirements-in-malta/>
