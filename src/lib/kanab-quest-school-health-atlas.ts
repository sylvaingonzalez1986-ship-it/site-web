import type { HistorySource } from "./kanab-quest-school-history-types";

export type HealthAtlasKind = "arthropod" | "mollusc" | "vertebrate" | "fungus" | "oomycete" | "virus" | "viroid" | "beneficial";
export type HealthAtlasEvidence = Readonly<{
  level: "extension" | "observational" | "experimental" | "molecular";
  context: string; finding: string; limitation: string; sourceIds: readonly string[];
}>;
export type HealthAtlasEntry = Readonly<{
  id: string; commonName: string; scientificName: string; kind: HealthAtlasKind;
  role: "pest" | "pathogen" | "beneficial" | "contextual";
  organs: readonly string[]; signs: readonly string[]; conditions: readonly string[];
  lifeCycle: string; spread: readonly string[]; confusions: readonly string[];
  confirmation: readonly string[]; prevention: readonly string[]; management: readonly string[];
  limits: readonly string[]; taxonomyNote: string; regionNote: string;
  evidence: readonly HealthAtlasEvidence[]; sourceIds: readonly string[];
}>;
export type HealthAtlasCorpus = Readonly<{
  id: string; version: string; checkedAt: string; scope: string;
  rules: readonly string[]; limitations: readonly string[];
}>;

const source = (key: string, title: string, author: string, organization: string, published: string, url: string, passage: string, access: HistorySource["access"], limitation: string): HistorySource => ({
  id: `health-atlas-${key}`, title, author, organization, published, url, passage, access, limitation,
  verifiedAt: "2026-11-12", documentKind: "Document original universitaire, scientifique ou institutionnel",
});

export const HEALTH_ATLAS_SOURCES: readonly HistorySource[] = [
  source("tetranychus", "Twospotted Spider Mite in Industrial Hemp", "Melissa Pulkoski et Hannah Burrack", "NC State Extension", "2020-08-05", "https://content.ces.ncsu.edu/twospotted-spider-mite-in-industrial-hemp", "Overview, Sampling and Thresholds, Biology : identité, signes, stades et absence de seuil validé dans ce contexte.", "full-text", "Caroline du Nord ; la fiche ne fournit pas de seuil universel transférable à la France. Aucun produit ou calendrier de traitement repris."),
  source("aculops", "Hemp russet mite", "Colorado State University, programme d’entomologie", "Colorado State University", "Page sans date explicite, consultée en 2026", "https://agsci.colostate.edu/agbio/ipm-pests/29895-2/", "Description, Quick Facts : acarien ériophyide, petites dimensions et absence de toile.", "full-text", "Fiche régionale ; la présence ou la gravité dans une parcelle française ne se déduisent pas de ce document."),
  source("aculops-name", "Aculops cannibicola (ACUPCN)", "Organisation européenne et méditerranéenne pour la protection des plantes", "EPPO Global Database", "Code créé le 2022-08-24 ; page courante", "https://gd.eppo.int/taxon/ACUPCN", "Preferred name : Aculops cannibicola ; autre nom : Aculops cannabicola.", "official-page", "Référence de nomenclature ; ce seul enregistrement n’est pas un relevé de présence en France."),
  source("broad-mite", "Broad Mite — Polyphagotarsonemus latus", "Équipe Utah Pests", "Utah State University Extension", "Collection Pests of Hemp in Utah, 2022 ; page courante", "https://extension.usu.edu/planthealth/ipm/notes_ag/hemp-broad-mite", "Hosts, Description, Life Cycle, Damage Symptoms et Occurrence in Utah : non détecté dans l’enquête locale.", "full-text", "Espèce présentée comme risque possible sous abri en Utah, pas comme observation locale confirmée. Les traitements de la page sont exclus de l’atlas."),
  source("florida-2023", "An initial list of arthropods on hemp (Cannabis sativa L.; Cannabaceae) in Florida", "Eileen A. Buss et Paul E. Skelley", "Florida Department of Agriculture and Consumer Services", "2023-11", "https://ccmedia.fdacs.gov/content/download/114776/file/FDACS-P-02203_2023-11(Arthropods-on-Hemp-Circular).pdf", "Circular 445, sections mites, aphids, whiteflies et tableau 1 : identifications de prélèvements soumis au service.", "full-text", "Inventaire floridien non aléatoire ; distingue ravageurs, prédateurs et présences incidentes. Les introductions historiques et affirmations réglementaires ne sont pas utilisées."),
  source("thrips-unh", "Hemp Pests in New Hampshire", "UNH Extension", "University of New Hampshire", "Page sans date éditoriale explicite, consultée en 2026", "https://extension.unh.edu/resource/hemp-pests-new-hampshire", "Sections Thrips et Corn Earworm : espèces rapportées sur chanvre, cicatrices et contexte de culture.", "full-text", "Synthèse universitaire nord-américaine ; les seuils économiques et distributions locales ne sont pas extrapolés."),
  source("aphids", "Cannabis Aphid in Industrial Hemp", "Melissa Pulkoski et Hannah Burrack", "NC State Extension", "2020-07-03", "https://content.ces.ncsu.edu/cannabis-aphid-in-industrial-hemp", "Biology, identification de Phorodon et liste des autres pucerons rapportés, dont Myzus persicae ; exuvies, miellat et fumagine.", "full-text", "Les exemples de transmission virale et d’auxiliaires ne sont pas des diagnostics ni une garantie d’efficacité pour tout puceron ou virus."),
  source("purdue-greenhouse", "Management Strategies for Common Arthropod Pests of Greenhouse Hemp in Indiana", "Zachary Serber et Elizabeth Y. Long", "Purdue University Extension", "2021-12", "https://www.extension.entm.purdue.edu/publications/E-275/E-275.html", "Greenhouse Whitefly, figure 2 sur chanvre ; Predatory Mites et réserve sur les preuves disponibles, surtout pour Aculops.", "full-text", "Contexte Indiana. Une légende confond les parasitoïdes de pucerons et d’aleurodes : elle n’est pas reprise. Aucune liste de pesticides ni lâcher prescrit."),
  source("cranshaw-2019", "Developing Insect Pest Management Systems for Hemp in the United States: A Work in Progress", "Whitney Cranshaw, Melissa Schreiner, Kadie Britt, Thomas P. Kuhar, John McPartland et Jerome Grant", "Journal of Integrated Pest Management", "2019 ; 10(1):26", "https://webdoc.agsci.colostate.edu/hempinsects/PDFs/JIPM_2019.pdf", "DOI 10.1093/jipm/pmz023 ; sections mites, stem/stalk borers et flower/seed insects : observations et lacunes de connaissances.", "full-text", "Synthèse de recherches et observations américaines, parfois non publiées séparément. Les relations présence/dégât et leur importance économique ne sont pas systématiquement établies."),
  source("ostrinia", "Insects that Feed on Hemp — European Corn Borer", "Whitney Cranshaw, programme Hemp Insects", "Colorado State University", "Fiche sans date imprimée explicite", "https://webdoc.agsci.colostate.edu/hempinsects/PDFs/European%20corn%20borer%20with%20photos.pdf", "Description, cycle et galeries dans les tiges ; référence aux observations historiques sur chanvre.", "full-text", "Phénologie et distribution décrites pour les États-Unis. Les photos de larves sur maïs ne constituent pas des photos d’attaque sur chanvre."),
  source("grapholita", "Insects that Feed on Hemp — Eurasian Hemp Borer", "Whitney Cranshaw, programme Hemp Insects", "Colorado State University", "2018-09, version révisée", "https://webdoc.agsci.colostate.edu/hempinsects/PDFs/Eurasian%20hemp%20borer%20September%202018%20rewrite(1).pdf", "Pages 1–4 : Grapholita delineana, galeries, flétrissement et comparaison avec Ostrinia ; hôtes alternatifs discutés.", "full-text", "État des connaissances du Colorado en 2018 ; nombre de générations et hôtes sauvages demeurent incertains. Pas d’affirmation de monophagie stricte."),
  source("hemp-france", "Chanvre — Guide de culture 2026", "Louis-Marie Allard et contributeurs ; coordination I. Lartigot", "Terres Inovia", "2026-01", "https://www.terresinovia.fr/sites/default/files/2026-01/guide_culture_chanvre_2026.pdf", "Pages 19–20 : maladies, fonte, altises, limaces et oiseaux ; symptômes de Botrytis et Sclerotinia.", "full-text", "Contexte français fibre/graine. On ne reprend ni produits conseillés, ni seuils climatiques simplifiés, ni l’assimilation de Pythium à un vrai champignon, ni une immunité générale des variétés."),
  source("punja-2019", "Pathogens and Molds Affecting Production and Quality of Cannabis sativa L.", "Zamir K. Punja et collaborateurs", "Frontiers in Plant Science", "2019 ; 10:1120", "https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2019.01120/full", "DOI 10.3389/fpls.2019.01120 ; Results, figures 2–4, Discussion : isolements, confirmations et essais de pathogénicité.", "full-text", "Principalement Canada, plusieurs systèmes. Isolement et pathogénicité ne sont pas équivalents ; celle de Pythium catenulatum reste non confirmée. Ancien nom d’oïdium à interpréter avec les travaux récents."),
  source("powdery-2024", "The co-occurrence of two powdery mildew species on Cannabis sativa in the Czech Republic", "Barbora Mieslerová et Aleš Lebeda", "Journal of Phytopathology", "2024-06-25", "https://doi.org/10.1111/jph.13348", "Résumé, Methods et Discussion : deux prélèvements de jardin en 2022–2023, microscopie, séquences ITS, G. ambrosiae et P. macularis.", "excerpt", "Texte original indexé consulté. Petit nombre d’échantillons ; la co-infection de 2022 est surtout documentée microscopiquement, la lecture moléculaire étant limitée par le mélange."),
  source("viruses-wa-2023", "First Reports of Beet Curly Top Virus, Citrus Yellow Vein-Associated Virus, and Hop Latent Viroid in Industrial Hemp (Cannabis sativa) in Washington State", "Sridhar Jarugula, Camille Wagstaff, Arunabha Mitra, David W. Crowder, David R. Gang et Rayapati A. Naidu", "Plant Disease", "2023-09-08 ; 107:2897", "https://apsjournals.apsnet.org/doi/10.1094/PDIS-12-22-2981-PDN", "Note originale : plantes symptomatiques de deux champs en 2021–2022 ; PCR/RT-PCR, séquençage et infections multiples.", "excerpt", "Note originale indexée consultée ; échantillonnage ciblé, non estimation de prévalence. Ne démontre pas séparément la causalité de chaque agent dans les co-infections."),
  source("hlvd-warren", "Occurrence of Hop Latent Viroid Causing Disease in Cannabis sativa in California", "J. G. Warren, J. Mercado et D. Grace", "Plant Disease", "2019-08-21 ; 103(10)", "https://apsjournals.apsnet.org/doi/abs/10.1094/PDIS-03-19-0530-PDN", "Note : détection et comparaison de groupes inoculés avec ARN infectieux et témoins ; symptômes et RT-PCR.", "excerpt", "Note originale indexée consultée. Petite expérience contrôlée étayant la causalité ; elle ne mesure pas la gravité ni l’origine de chaque cas individuel."),
  source("hlvd-punja", "Symptomology, prevalence, and impact of Hop latent viroid on greenhouse-grown cannabis (Cannabis sativa L.) plants in Canada", "Zamir K. Punja, K. Wang, S. Lung et L. Buirs", "Canadian Journal of Plant Pathology", "2023 en ligne ; volume 46, 2024", "https://doi.org/10.1080/07060661.2023.2279184", "Résumé et passages de méthodes indexés : soumissions à un laboratoire canadien en 2020–2022 et plantes parfois asymptomatiques.", "excerpt", "Échantillons envoyés au diagnostic, pas échantillon représentatif de tous les producteurs. Le taux de positifs n’est pas une prévalence nationale."),
  source("viroids-ictv", "Viroids", "International Committee on Taxonomy of Viruses", "ICTV", "Rapport courant, révision 2026", "https://ictv.global/report/chapter/viroids/viroids", "Définition : petits ARN circulaires non codants, absence de capside ; distinction des virus.", "official-page", "Référence de classification, pas diagnostic de la santé d’une plante."),
  source("beneficial-purdue", "Beneficial Insects", "Purdue Hemp Project", "Purdue University", "Page sans date explicite", "https://ag.purdue.edu/hemp-project/insects/beneficial-insects.html", "Lacewing Larvae, Lady Beetles et Parasitoids ; organismes observés sur chanvre du centre-nord des États-Unis.", "full-text", "Présence et fonctions écologiques générales ; pas démonstration que tout lâcher commercial assure un contrôle sur chanvre."),
  source("lacewings-csu", "Natural Enemies of Insects — Green Lacewings", "Whitney Cranshaw, programme Hemp Insects", "Colorado State University", "Fiche sans date imprimée explicite", "https://webdoc.agsci.colostate.edu/hempinsects/PDFs/Green%20Lacewings%20with%20Photos.pdf", "Larves prédatrices et Chrysopa oculata régulièrement observée dans les champs de chanvre, associée aux pucerons.", "full-text", "Observation régionale ; les espèces, stades et régimes alimentaires ne sont pas interchangeables."),
  source("diagnostic", "Industrial Hemp Sampling", "Mike Munster", "NC State Plant Disease and Insect Clinic", "Mise à jour le 2024-11-14", "https://pdic.ces.ncsu.edu/industrial-hemp-sampling/", "Contexte du problème, vues d’ensemble et détails, intérêt des racines et des transitions entre tissus sains et atteints.", "official-page", "Les exigences de prélèvement et d’envoi dépendent du laboratoire et du droit local ; aucun protocole de transport n’est reproduit."),
  source("bemisia-name", "Bemisia tabaci — Datasheet", "Organisation européenne et méditerranéenne pour la protection des plantes", "EPPO Global Database", "Fiche courante consultée en 2026", "https://gd.eppo.int/taxon/BEMITA/datasheet", "Identity : diversité génétique et complexe d’espèces cryptiques ; limites de l’identification morphologique.", "official-page", "La classification ne prouve pas l’identité d’une population sur une photo ni sa présence sur chanvre dans un pays donné."),
  source("pythium-name", "Pythium ultimum (PYTHUL)", "Organisation européenne et méditerranéenne pour la protection des plantes", "EPPO Global Database", "Page courante consultée en 2026", "https://gd.eppo.int/taxon/PYTHUL", "Nomenclature : Globisporangium ultimum indiqué parmi les autres noms scientifiques.", "official-page", "Les usages nomenclaturaux varient selon les références ; toutes les espèces historiques de Pythium ne deviennent pas Globisporangium."),
];

export const HEALTH_ATLAS_CORPUS: HealthAtlasCorpus = {
  id: "health-atlas-2026-11-12", version: "2026-11-12.health1", checkedAt: "2026-11-12",
  scope: "Atlas non exhaustif d’organismes documentés sur Cannabis sativa ou d’auxiliaires pertinents, avec contexte et limites des preuves.",
  rules: ["Une image illustre un signe ; elle ne confirme pas seule une espèce ni la cause d’un dépérissement.", "Présence, association et causalité expérimentale sont trois niveaux distincts.", "Une observation américaine ou canadienne n’établit pas une fréquence en France.", "Les mesures proposées relèvent de l’observation, de la prévention et d’une gestion encadrée ; aucun produit ni dosage n’est recommandé."],
  limitations: ["Les groupes gardent leur niveau d’identification : aucun nom d’espèce n’est déduit d’une simple photo.", "Les symptômes abiotiques et plusieurs agents peuvent se combiner.", "La présence d’un auxiliaire ne garantit pas la régulation d’un ravageur.", "Une matière moisie ne redevient pas sûre parce qu’un organisme a été nommé ; aucune méthode de récupération ou d’assainissement n’est proposée."],
};

const ids = (...keys: string[]) => keys.map((key) => `health-atlas-${key}`);
const evidence = (level: HealthAtlasEvidence["level"], context: string, finding: string, limitation: string, ...keys: string[]): HealthAtlasEvidence => ({ level, context, finding, limitation, sourceIds: ids(...keys) });
const entry = (value: Omit<HealthAtlasEntry, "sourceIds">): HealthAtlasEntry => ({ ...value, sourceIds: [...new Set(value.evidence.flatMap((item) => item.sourceIds).concat(ids("diagnostic")))] });

export const HEALTH_ATLAS_ENTRIES: readonly HealthAtlasEntry[] = [
  entry({
    id: "tetranychus-urticae", commonName: "Tétranyque à deux points", scientificName: "Tetranychus urticae", kind: "arthropod", role: "pest",
    organs: ["Feuilles"], signs: ["Ponctuations pâles ; jaunissement possible.", "Acariens et parfois fines toiles au revers."], conditions: ["Multiplication favorisée par chaleur et air sec ; présence possible sous abri ou dehors."],
    lifeCycle: "Œuf, larve à six pattes, nymphes puis adulte à huit pattes ; générations pouvant se chevaucher.", spread: ["Plantes porteuses et déplacements entre végétaux."], confusions: ["Thrips, autres acariens, stress non parasitaire."],
    confirmation: ["Observer plusieurs feuilles à la loupe ; identification morphologique si nécessaire."], prevention: ["Inspecter les végétaux entrants et conserver l’historique des foyers."], management: ["Documenter présence, progression et auxiliaires avant une décision encadrée."],
    limits: ["Pas de seuil d’intervention universel établi par la fiche chanvre consultée."], taxonomyNote: "Un acarien, pas un insecte ; les points et la couleur seuls ne suffisent pas toujours.", regionNote: "Fiche chanvre de Caroline du Nord ; fréquence française non estimée.",
    evidence: [evidence("extension", "Chanvre en serre et au champ, Caroline du Nord", "Signes et biologie décrits sur chanvre.", "Ne prédit pas la gravité d’un foyer particulier.", "tetranychus")],
  }),
  entry({
    id: "aculops-cannibicola", commonName: "Acarien russet du chanvre", scientificName: "Aculops cannibicola", kind: "arthropod", role: "pest",
    organs: ["Feuilles", "Jeunes tissus", "Inflorescences"], signs: ["Bronzage ou déformation parfois discrets.", "Aucune toile produite par cet acarien."], conditions: ["Foyers rapportés en intérieur et au champ ; signe variable selon la plante."],
    lifeCycle: "Acarien minuscule dont les stades se développent sur l’hôte ; plusieurs aspects du cycle au champ restent mal décrits.", spread: ["Transport de végétaux porteurs ; dispersion entre plantes."], confusions: ["Stress, forme naturelle du feuillage, tarsonèmes et tétranyques."],
    confirmation: ["Examen grossi des tissus atteints ; deux paires de pattes près de l’avant chez les formes mobiles."], prevention: ["Contrôle des introductions et traçabilité des mouvements de végétaux."], management: ["Faire confirmer le foyer ; ne pas attribuer toute feuille enroulée à ce taxon."],
    limits: ["L’absence de toile ne confirme pas à elle seule Aculops."], taxonomyNote: "EPPO préfère cannibicola ; cannabicola est un autre nom rencontré dans les publications.", regionNote: "Observations américaines ; aucune prévalence française déduite.",
    evidence: [evidence("extension", "Colorado et autres observations américaines", "Ériophyide documenté sur Cannabis, signes peu spécifiques.", "Cycle et importance économique dépendants du contexte.", "aculops", "cranshaw-2019", "aculops-name")],
  }),
  entry({
    id: "polyphagotarsonemus-latus", commonName: "Tarsonème des serres", scientificName: "Polyphagotarsonemus latus", kind: "arthropod", role: "pest",
    organs: ["Jeunes feuilles", "Bourgeons"], signs: ["Jeunes tissus déformés, durcis ou bronzés."], conditions: ["Hôtes variés ; contexte protégé particulièrement à examiner."],
    lifeCycle: "Œuf, larve, stade de transition puis adulte ; plusieurs générations possibles selon le milieu.", spread: ["Végétaux infestés et déplacements associés aux plantes."], confusions: ["Aculops, autres tarsonèmes, dommages physiologiques."],
    confirmation: ["Examen microscopique d’acariens et d’œufs ; les déformations seules restent insuffisantes."], prevention: ["Observer le matériel entrant et localiser les premiers symptômes."], management: ["Demander une identification avant de choisir une réponse adaptée au contexte."],
    limits: ["Une fiche de risque n’est pas une observation locale."], taxonomyNote: "Tarsonemidae ; ne pas confondre avec les ériophyides.", regionNote: "Répertorié dans les collectes floridiennes ; non détecté dans l’enquête Utah citée.",
    evidence: [evidence("observational", "Échantillons de chanvre soumis au service de Floride", "P. latus figure au tableau des identifications.", "Collectes non représentatives d’un pays entier.", "florida-2023"), evidence("extension", "Utah", "La fiche décrit un risque possible et annonce l’absence de détection locale.", "Ne pas transformer un risque en présence confirmée.", "broad-mite")],
  }),
  entry({
    id: "thrips", commonName: "Thrips du feuillage", scientificName: "Frankliniella occidentalis ; Thrips tabaci", kind: "arthropod", role: "pest",
    organs: ["Feuilles", "Jeunes pousses"], signs: ["Cicatrices argentées ou ponctuations ; petits points fécaux sombres possibles."], conditions: ["Espèces et importance différentes selon région et protection de la culture."],
    lifeCycle: "Œufs, larves actives, stades préadultes puis adultes ; tous les stades ne vivent pas au même endroit.", spread: ["Adultes ailés et végétaux porteurs."], confusions: ["Tétranyques, cicatrices mécaniques ou taches foliaires."],
    confirmation: ["Observer l’animal ; déterminer l’espèce au grossissement approprié si la décision en dépend."], prevention: ["Surveillance du feuillage et des introductions."], management: ["Distinguer captures, présence sur la plante et lésions réellement associées."],
    limits: ["La capacité vectorielle d’un thrips ne prouve pas un virus dans la plante."], taxonomyNote: "Fiche regroupant deux espèces rapportées ; un thrips photographié n’est pas automatiquement l’une d’elles.", regionNote: "Rapports nord-américains ; composition floridienne différente dans l’inventaire consulté.",
    evidence: [evidence("extension", "Synthèse sur chanvre du New Hampshire", "Les deux espèces et leurs lésions sont décrites.", "Pas de fréquence française ni de gravité universelle.", "thrips-unh")],
  }),
  entry({
    id: "phorodon-cannabis", commonName: "Puceron du chanvre", scientificName: "Phorodon cannabis", kind: "arthropod", role: "pest",
    organs: ["Feuilles", "Tiges", "Inflorescences"], signs: ["Colonies, exuvies claires, miellat et parfois fumagine."], conditions: ["Hôte disponible et conditions favorables peuvent permettre une augmentation rapide."],
    lifeCycle: "Formes ailées et non ailées ; reproduction et stade hivernant varient avec le contexte saisonnier.", spread: ["Adultes ailés ; déplacement de plantes porteuses."], confusions: ["Phorodon humuli et autres pucerons, notamment Myzus."],
    confirmation: ["Examiner les caractères de la tête et des antennes ; identification spécialisée si nécessaire."], prevention: ["Observer les colonies et leurs ennemis naturels, pas seulement les symptômes."], management: ["Évaluer l’évolution du foyer et le contexte avant toute intervention autorisée."],
    limits: ["Miellat et fumagine n’identifient pas l’espèce de puceron."], taxonomyNote: "P. cannabis et le puceron du houblon P. humuli sont distincts.", regionNote: "Fiche Caroline du Nord et identifications en Floride ; pas d’estimation française.",
    evidence: [evidence("extension", "Chanvre en Caroline du Nord", "Biologie, signes et caractères distinctifs décrits.", "Une colonie visible ne démontre pas une transmission virale.", "aphids")],
  }),
  entry({
    id: "myzus-persicae", commonName: "Puceron vert du pêcher", scientificName: "Myzus persicae", kind: "arthropod", role: "pest",
    organs: ["Feuilles", "Jeunes pousses"], signs: ["Pucerons, miellat ou jaunissement possible ; signes partagés avec d’autres espèces."], conditions: ["Puceron polyphage, contexte local et hôtes voisins à documenter."],
    lifeCycle: "Alternance possible de formes et de modes de reproduction ; le cycle observé dépend du milieu et de la saison.", spread: ["Vol des formes ailées ; déplacement de matériel végétal."], confusions: ["Puceron du chanvre et autres pucerons verts."],
    confirmation: ["Faire identifier les individus ; la couleur verte ne suffit pas."], prevention: ["Contrôle des introductions et observation des colonies."], management: ["Vérifier l’espèce et les dégâts associés ; conserver les auxiliaires identifiés."],
    limits: ["Aucune affirmation d’espèce dominante sur chanvre français."], taxonomyNote: "Le nom vernaculaire lié au pêcher ne limite pas l’espèce à cet hôte.", regionNote: "Rapporté sur chanvre dans la synthèse NC State ; non présenté comme collecte nouvelle de Floride.",
    evidence: [evidence("extension", "Liste universitaire de pucerons rapportés sur chanvre", "Myzus persicae est explicitement cité.", "Pas de série quantitative ni d’essai de nuisibilité propre à cette fiche.", "aphids", "florida-2023")],
  }),
  entry({
    id: "trialeurodes-vaporariorum", commonName: "Aleurode des serres", scientificName: "Trialeurodes vaporariorum", kind: "arthropod", role: "pest",
    organs: ["Revers des feuilles"], signs: ["Petits adultes blancs et stades immobiles aplatis ; miellat possible."], conditions: ["Maintien possible sous abri avec des plantes hôtes présentes."],
    lifeCycle: "Œuf, premier stade mobile, stades suivants fixés, puis adulte ailé.", spread: ["Vol local et végétaux portant des stades immatures."], confusions: ["Bemisia, cochenilles ou marques foliaires prises pour des stades immobiles."],
    confirmation: ["Comparer adultes et stades immatures ; une capture blanche seule ne suffit pas."], prevention: ["Inspection du revers des feuilles et des introductions."], management: ["Relier observations, évolution et conditions de l’abri avant une réponse encadrée."],
    limits: ["La présence d’aleurodes ne prouve pas une virose."], taxonomyNote: "Aleyrodidae : hémiptère, pas une mouche vraie.", regionNote: "Documenté sur chanvre dans la fiche Purdue Indiana ; non trouvé sur chanvre dans l’inventaire floridien 2023.",
    evidence: [evidence("extension", "Chanvre de serre, Indiana", "Figure et section consacrées à T. vaporariorum sur chanvre.", "Pas d’extrapolation à tous les abris français.", "purdue-greenhouse", "florida-2023")],
  }),
  entry({
    id: "bemisia-tabaci", commonName: "Aleurode du tabac", scientificName: "Bemisia tabaci, complexe d’espèces", kind: "arthropod", role: "pest",
    organs: ["Feuilles"], signs: ["Adultes blancs, stades fixés, miellat ; signes non spécifiques du complexe."], conditions: ["Hôtes, climat et systèmes de culture modifient la présence et le risque."],
    lifeCycle: "Œuf puis plusieurs stades immatures et adulte ailé ; générations pouvant se chevaucher.", spread: ["Adultes et plantes porteuses."], confusions: ["Trialeurodes et autres aleurodes."],
    confirmation: ["Identification morphologique et, si nécessaire, moléculaire pour préciser la population."], prevention: ["Surveillance des introductions et traçabilité des observations."], management: ["Faire préciser l’identité et le contexte local ; toute mesure doit respecter le cadre applicable."],
    limits: ["Le comportement d’une population ne se transfère pas automatiquement à toutes les autres."], taxonomyNote: "Complexe cryptique ; l’inventaire de Floride mentionne notamment MEAM1.", regionNote: "Identification sur chanvre en Floride ; fréquence et statut d’un foyer français non déduits.",
    evidence: [evidence("observational", "Prélèvements floridiens sur chanvre", "Bemisia tabaci figure dans les identifications.", "Inventaire local, non essai de transmission virale.", "florida-2023", "bemisia-name")],
  }),
  entry({
    id: "helicoverpa-zea", commonName: "Noctuelle américaine du maïs", scientificName: "Helicoverpa zea", kind: "arthropod", role: "pest",
    organs: ["Inflorescences", "Tissus voisins"], signs: ["Chenille, morsures et déjections ; blessures pouvant accompagner des pourritures."], conditions: ["Risque dépendant des populations régionales et de l’organe visé."],
    lifeCycle: "Œuf, chenille, chrysalide puis papillon ; la chenille consomme les tissus.", spread: ["Vol des papillons ; présence de plantes hôtes dans le paysage."], confusions: ["Autres noctuelles, dont H. armigera ; pourriture seule sans chenille retrouvée."],
    confirmation: ["Identifier la chenille ou l’adulte ; les dégâts seuls ne séparent pas les espèces."], prevention: ["Observer dégâts et organismes associés dans leur contexte."], management: ["Documenter les foyers sans conclure qu’une blessure rend une matière atteinte récupérable."],
    limits: ["Une attaque américaine n’est pas un diagnostic européen."], taxonomyNote: "H. zea et H. armigera sont deux espèces distinctes.", regionNote: "Attaques sur chanvre documentées aux États-Unis ; aucune présence locale française affirmée.",
    evidence: [evidence("observational", "Observations américaines rassemblées en 2019", "Dégâts sur inflorescences de chanvre rapportés.", "Importance variable selon produit et lieu.", "cranshaw-2019", "thrips-unh")],
  }),
  entry({
    id: "ostrinia-nubilalis", commonName: "Pyrale du maïs", scientificName: "Ostrinia nubilalis", kind: "arthropod", role: "pest",
    organs: ["Tiges"], signs: ["Galeries et affaiblissement possible de la tige."], conditions: ["Présence régionale de la pyrale et stades de la plante à documenter."],
    lifeCycle: "Œuf, chenille foreuse, chrysalide puis papillon ; survie larvaire possible dans des débris végétaux.", spread: ["Papillons ; végétaux ou résidus porteurs."], confusions: ["Grapholita, autres foreurs, casse mécanique."],
    confirmation: ["Relier la galerie à un insecte identifié, pas seulement à la casse."], prevention: ["Consigner historique et observations locales avec les organismes de conseil."], management: ["Évaluer la réalité des dégâts ; ne pas transposer un calendrier du maïs."],
    limits: ["La présence d’une galerie ne démontre pas une perte économique."], taxonomyNote: "Crambidae ; distincte de la petite tordeuse du chanvre.", regionNote: "Fiche et observations sur chanvre américaines, dont des données historiques ; aucun niveau actuel de risque français établi ici.",
    evidence: [evidence("extension", "Chanvre aux États-Unis", "Tige reconnue comme support de développement larvaire.", "Les conséquences sur la récolte sont variables et les observations récentes limitées dans la synthèse 2019.", "ostrinia", "cranshaw-2019")],
  }),
  entry({
    id: "grapholita-delineana", commonName: "Petite tordeuse du chanvre", scientificName: "Grapholita delineana", kind: "arthropod", role: "pest",
    organs: ["Tiges", "Base des inflorescences", "Graines"], signs: ["Petites galeries ; renflement ou flétrissement local parfois discret."], conditions: ["Risque lié à la présence locale et aux stades ; pas de nombre universel de générations."],
    lifeCycle: "Chenille d’abord exposée puis foreuse ; derniers stades pouvant hiverner dans des tissus végétaux.", spread: ["Papillons et transport de végétaux porteurs."], confusions: ["Pyrale du maïs et autres causes de flétrissement."],
    confirmation: ["Examiner la galerie et identifier l’insecte associé."], prevention: ["Traçabilité des végétaux et surveillance des signes localisés."], management: ["Faire évaluer le foyer régional ; aucune recette culturale déduite d’une fiche étrangère."],
    limits: ["La source discute encore certains hôtes et effets sur la récolte."], taxonomyNote: "Tortricidae ; les formes larvaires changent d’apparence avec leur développement.", regionNote: "Fiche fondée sur observations du Colorado ; ne mesure pas le risque en France.",
    evidence: [evidence("observational", "Est du Colorado, fiche révisée 2018", "Galeries et dégâts sur chanvre décrits et illustrés.", "Phénologie locale non transposable directement.", "grapholita")],
  }),
  entry({
    id: "psylliodes-attenuata", commonName: "Altise du chanvre", scientificName: "Psylliodes attenuata", kind: "arthropod", role: "pest",
    organs: ["Cotylédons", "Premières feuilles"], signs: ["Petites morsures ou perforations ; coléoptères pouvant sauter."], conditions: ["Jeunes stades ; observations favorisées par temps chaud et sec."],
    lifeCycle: "Coléoptère à métamorphose complète ; la fiche française décrit surtout les adultes observés sur jeunes feuilles.", spread: ["Déplacement des adultes."], confusions: ["Autres petits coléoptères, limaces et perforations d’autres origines."],
    confirmation: ["Associer les morsures à l’observation d’adultes identifiés."], prevention: ["Suivi des jeunes plantes et comparaison avec les zones indemnes."], management: ["Évaluer l’étendue réelle des lésions ; ne pas déduire un traitement de chaque perforation."],
    limits: ["Pas de seuil ni de produit recommandé par cette fiche."], taxonomyNote: "Le guide utilise aussi Psylliodes apicalis comme synonyme ; garder le nom de la référence lors d’une comparaison.", regionNote: "Ravageur décrit dans le guide français du chanvre 2026.",
    evidence: [evidence("extension", "France, chanvre fibre/graine", "Adultes et morsures sur jeunes feuilles rapportés.", "Importance dépendante du contexte, pas de nuisance automatique.", "hemp-france")],
  }),
  entry({
    id: "slugs", commonName: "Limaces", scientificName: "Gastropoda — plusieurs espèces terrestres", kind: "mollusc", role: "pest",
    organs: ["Plantules", "Cotylédons"], signs: ["Tissus consommés ; traces de mucus parfois visibles."], conditions: ["Humidité, abris au sol et jeunes plantes fragiles."],
    lifeCycle: "Mollusques issus d’œufs ; cycles variables selon l’espèce, sans stade d’insecte.", spread: ["Déplacement au sol ; transport accidentel avec matériaux."], confusions: ["Chenilles, altises ou disparition de plantules d’origine différente."],
    confirmation: ["Rechercher l’animal et des indices concordants ; l’absence de mucus n’exclut pas une limace."], prevention: ["Observer les bordures et les zones à symptômes comparables."], management: ["Faire apprécier la pression réelle ; protections physiques seulement si adaptées au contexte."],
    limits: ["Aucune espèce déduite du seul qualificatif grise ou noire."], taxonomyNote: "Groupe fonctionnel, pas une espèce unique.", regionNote: "Signalement dans le guide français du chanvre ; gravité variable.",
    evidence: [evidence("extension", "France, jeunes cultures de chanvre", "Limaces grises et noires décrites parmi les causes de dégâts possibles.", "Aucun classement spécifique ou taux de perte repris.", "hemp-france")],
  }),
  entry({
    id: "birds", commonName: "Oiseaux consommateurs de graines", scientificName: "Aves — notamment Columbidae et Corvidae", kind: "vertebrate", role: "contextual",
    organs: ["Graines", "Jeunes peuplements"], signs: ["Graines consommées, manques localisés ; traces ou oiseaux parfois observés."], conditions: ["Accessibilité des graines et contexte paysager."],
    lifeCycle: "Cycles propres aux espèces d’oiseaux ; leur présence a aussi des fonctions écologiques.", spread: ["Déplacements et rassemblements locaux."], confusions: ["Mauvaise germination, fonte, limaces ou autres consommateurs."],
    confirmation: ["Croiser observations directes et répartition des manques."], prevention: ["Documenter les épisodes et les espèces avec les acteurs locaux."], management: ["Examiner des moyens de protection ou dissuasion adaptés et autorisés ; aucune destruction proposée."],
    limits: ["Une présence d’oiseau n’est pas une preuve de dommage ; règles propres aux espèces et au lieu."], taxonomyNote: "Groupe regroupant plusieurs familles, sans identification depuis une trace seule.", regionNote: "Colombidés et corvidés cités dans le guide français du chanvre.",
    evidence: [evidence("extension", "France, graines au semis", "Consommation de graines rapportée.", "Pas d’attribution automatique de toute absence de levée aux oiseaux.", "hemp-france")],
  }),
  entry({
    id: "golovinomyces-ambrosiae", commonName: "Oïdium à Golovinomyces", scientificName: "Golovinomyces ambrosiae", kind: "fungus", role: "pathogen",
    organs: ["Feuilles", "Autres tissus aériens selon les observations"], signs: ["Colonies poudreuses blanches sur les tissus."], conditions: ["Plante hôte et microclimat favorables ; les besoins ne se résument pas à toute humidité visible."],
    lifeCycle: "Champignon biotrophe vivant aux dépens de tissus vivants ; production de spores assurant de nouvelles infections.", spread: ["Spores aériennes et végétaux porteurs."], confusions: ["Podosphaera, dépôts, poussière, trichomes ou autres moisissures."],
    confirmation: ["Microscopie et analyse moléculaire adaptées ; conserver les limites des séquences et références."], prevention: ["Observation des introductions et des premiers foyers."], management: ["Faire confirmer l’agent ; distinguer gestion de la plante et conformité du produit atteint."],
    limits: ["Une poudre blanche ne permet pas de nommer l’espèce."], taxonomyNote: "Des publications anciennes emploient G. cichoracearum sensu lato ou G. spadiceus ; ne pas assimiler tous les usages de cichoracearum à cette espèce.", regionNote: "Documenté en Amérique du Nord et dans le jardin tchèque étudié ; pas de prévalence française déduite.",
    evidence: [evidence("molecular", "Jardin tchèque, prélèvement 2023", "Microscopie et ITS concordants pour G. ambrosiae.", "Observation locale, non enquête nationale.", "powdery-2024")],
  }),
  entry({
    id: "podosphaera-macularis", commonName: "Oïdium à Podosphaera", scientificName: "Podosphaera macularis", kind: "fungus", role: "pathogen",
    organs: ["Feuilles"], signs: ["Colonies poudreuses ressemblant à celles d’autres oïdiums."], conditions: ["Conditions favorables sur une plante sensible ; écologie à distinguer de Golovinomyces."],
    lifeCycle: "Biotrophe produisant des spores ; relation à une plante vivante nécessaire à son développement.", spread: ["Spores et tissus végétaux infectés."], confusions: ["Golovinomyces et dépôts non biologiques."],
    confirmation: ["Caractères microscopiques et séquences ; rechercher une infection mixte si les résultats divergent."], prevention: ["Traçabilité des observations et des végétaux entrants."], management: ["Faire préciser l’agent avant d’extrapoler une mesure étudiée sur un autre oïdium."],
    limits: ["Le nom oïdium ne désigne pas un seul organisme."], taxonomyNote: "Espèce connue aussi sur houblon ; sa présence sur chanvre est documentée séparément.", regionNote: "Prélèvement tchèque 2022, avec deux oïdiums observés ; pas de fréquence européenne établie.",
    evidence: [evidence("molecular", "Jardin tchèque, prélèvement 2022", "P. macularis confirmé ; co-occurrence avec Golovinomyces observée au microscope.", "Séquençage du mélange limité ; pas deux identifications moléculaires complètes indépendantes pour ce même prélèvement.", "powdery-2024")],
  }),
  entry({
    id: "botrytis-cinerea", commonName: "Pourriture grise", scientificName: "Botrytis cinerea", kind: "fungus", role: "pathogen",
    organs: ["Tiges", "Inflorescences"], signs: ["Tissus brunis ou flétris, feutrage gris parfois visible ; début interne possible."], conditions: ["Humectation et microclimat favorables ; blessures ou tissus fragilisés peuvent intervenir."],
    lifeCycle: "Champignon nécrotrophe : tissus colonisés et spores peuvent entretenir le foyer.", spread: ["Spores aériennes et tissus contaminés."], confusions: ["Autres pourritures, vieillissement des tissus ou lésions de chenilles."],
    confirmation: ["Examen des tissus et identification de laboratoire si nécessaire ; couleur grise seule insuffisante."], prevention: ["Suivi des zones humides et de l’intégrité des tissus, avec historique."], management: ["Séparer le diagnostic végétal de la décision sur une matière suspecte ; aucune méthode de récupération."],
    limits: ["L’absence de feutrage extérieur n’exclut pas une atteinte interne."], taxonomyNote: "B. cinerea est un agent documenté ; toute moisissure grise n’est pas automatiquement Botrytis.", regionNote: "Rapports français et étude canadienne, dans des systèmes différents.",
    evidence: [evidence("observational", "France et cultures canadiennes étudiées", "Atteintes de tiges et inflorescences documentées.", "Ne permet pas d’attribuer une photographie isolée à cet agent.", "hemp-france", "punja-2019")],
  }),
  entry({
    id: "sclerotinia-sclerotiorum", commonName: "Sclérotiniose", scientificName: "Sclerotinia sclerotiorum", kind: "fungus", role: "pathogen",
    organs: ["Tiges"], signs: ["Lésions, dépérissement ; mycélium blanc et sclérotes possibles."], conditions: ["Contexte humide favorable ; antécédents de la parcelle importants."],
    lifeCycle: "Les sclérotes servent de structures de survie ; le cycle dépasse la plante visible.", spread: ["Inoculum conservé dans le milieu et voies de dissémination à préciser localement."], confusions: ["Autres pourritures blanches ou dépérissements."],
    confirmation: ["Examiner structures et tissus ; confirmer au laboratoire si l’identification conditionne la décision."], prevention: ["Conserver l’historique des foyers et des hôtes concernés."], management: ["Évaluation agronomique et sanitaire du foyer, sans recette de traitement."],
    limits: ["Des tissus blancs ne suffisent pas à nommer Sclerotinia."], taxonomyNote: "Les sclérotes sont des structures du champignon, pas des graines de chanvre.", regionNote: "Maladie décrite dans le guide français du chanvre.",
    evidence: [evidence("extension", "France, chanvre", "Lésions de tige, mycélium et sclérotes décrits.", "Pas de mesure de fréquence nationale fournie par cette fiche.", "hemp-france")],
  }),
  entry({
    id: "fusarium", commonName: "Fusarioses et isolements de Fusarium", scientificName: "Fusarium spp., dont groupes F. oxysporum et F. solani", kind: "fungus", role: "pathogen",
    organs: ["Racines", "Collet", "Tiges", "Inflorescences"], signs: ["Brunissement, jaunissement, retard ou dépérissement ; aucun signe exclusif."], conditions: ["État des racines, blessures, milieu et historique sanitaire à documenter."],
    lifeCycle: "Des propagules et tissus colonisés peuvent persister et alimenter de nouvelles infections ; espèces et isolats diffèrent.", spread: ["Milieu, eau ou végétaux porteurs selon le système."], confusions: ["Oomycètes, autres agents racinaires et asphyxie non infectieuse."],
    confirmation: ["Associer contexte, isolement et identification ; pathogénicité à distinguer d’une simple présence."], prevention: ["Traçabilité des milieux et plantes, limitation des transferts entre foyers."], management: ["Faire caractériser la cause ; un isolement de Fusarium n’implique pas automatiquement le même risque."],
    limits: ["Tous les Fusarium ne sont pas pathogènes dans toutes les situations."], taxonomyNote: "Noms rapportés par l’étude ; groupes complexes, pas une espèce unique identifiable par couleur.", regionNote: "Essais et observations canadiennes, avec références françaises au syndrome de fonte.",
    evidence: [evidence("experimental", "Cannabis, étude canadienne de 2019", "Des isolats de F. oxysporum et F. solani ont reproduit des symptômes et ont été réisolés.", "Preuve propre aux isolats testés ; pas à tous les membres du genre.", "punja-2019")],
  }),
  entry({
    id: "pythium-globisporangium", commonName: "Oomycètes des racines et des fontes", scientificName: "Pythium spp. ; Globisporangium spp.", kind: "oomycete", role: "pathogen",
    organs: ["Plantules", "Racines", "Collet"], signs: ["Fonte, racines brunies, flétrissement ou croissance ralentie."], conditions: ["Eau et milieu racinaire à examiner ; symptômes non spécifiques d’un excès d’eau."],
    lifeCycle: "Oomycètes à structures de survie et de propagation variables selon l’espèce ; distincts des vrais champignons.", spread: ["Eau, milieux et végétaux porteurs selon l’agent."], confusions: ["Fusarium, autres pourritures, manque d’oxygène aux racines."],
    confirmation: ["Identification de laboratoire et interprétation de son lien avec les tissus atteints."], prevention: ["Observer racines, eau et historique du milieu ensemble."], management: ["Faire confirmer le diagnostic ; ne pas déduire une mesure de la seule étiquette fonte."],
    limits: ["P. catenulatum isolé dans l’étude 2019 n’avait pas sa pathogénicité confirmée sur cannabis."], taxonomyNote: "Une partie des anciens Pythium est classée dans Globisporangium, par exemple G. ultimum ; pas toutes les espèces.", regionNote: "Isolements canadiens ; syndrome de fonte décrit aussi en France.",
    evidence: [evidence("observational", "Racines de cannabis, Canada", "Plusieurs Pythium identifiés ; portée causale différente selon l’espèce.", "Un isolement seul ne démontre pas une cause.", "punja-2019", "pythium-name")],
  }),
  entry({
    id: "rhizoctonia", commonName: "Rhizoctones", scientificName: "Rhizoctonia spp., notamment le complexe R. solani", kind: "fungus", role: "pathogen",
    organs: ["Racines", "Collet", "Tiges"], signs: ["Pourriture ou dépérissement non spécifique."], conditions: ["Historique du sol, présence d’hôtes et conditions racinaires."],
    lifeCycle: "Persistance possible sous forme de mycélium ou structures de survie, selon le taxon.", spread: ["Contact avec le milieu porteur et transfert de matières contaminées."], confusions: ["Fusarium, oomycètes et autres causes de dépérissement."],
    confirmation: ["Identification des tissus et isolats ; préciser le niveau taxonomique réellement obtenu."], prevention: ["Documenter l’historique et les mouvements de milieu ou de matériel végétal."], management: ["Analyse du foyer avec un service compétent ; pas de diagnostic sur flétrissement seul."],
    limits: ["La fiche traite un groupe ; elle ne donne pas une identification d’isolat."], taxonomyNote: "Le nom rhizoctone recouvre plusieurs taxons ; R. solani comprend lui-même des groupes distincts.", regionNote: "Rhizoctones rapportés dans le guide français du chanvre.",
    evidence: [evidence("extension", "France, chanvre", "Atteintes racinaires et dépérissement décrits.", "La synthèse technique ne caractérise pas tous les isolats français.", "hemp-france")],
  }),
  entry({
    id: "beet-curly-top-virus", commonName: "Virus de l’enroulement de la betterave", scientificName: "Beet curly top virus (BCTV)", kind: "virus", role: "pathogen",
    organs: ["Feuilles", "Ensemble de la plante"], signs: ["Enroulement, chlorose et retard possibles ; signes partagés avec d’autres causes."], conditions: ["Épidémiologie régionale et infections multiples à examiner."],
    lifeCycle: "Virus dépendant des cellules de l’hôte pour se multiplier ; une détection n’indique pas à elle seule la dynamique de la maladie.", spread: ["Transmission vectorielle connue ; le vecteur et la situation locale doivent être vérifiés."], confusions: ["Autres infections, dommages d’acariens ou causes abiotiques."],
    confirmation: ["PCR adaptée et confirmation moléculaire interprétées avec les symptômes et le contexte."], prevention: ["Surveillance et traçabilité des observations, sans attribuer tout insecte au rôle de vecteur."], management: ["Diagnostic spécialisé avant décision ; aucune guérison déduite d’un changement de climat."],
    limits: ["Une série de plantes choisies parce qu’elles sont malades n’est pas un sondage de prévalence."], taxonomyNote: "BCTV est le nom usuel du virus ; plusieurs souches sont distinguées dans l’étude.", regionNote: "Détections dans deux champs de l’État de Washington ; pas de présence française affirmée.",
    evidence: [evidence("molecular", "Washington, plantes symptomatiques 2021–2022", "BCTV détecté et séquences de souches confirmées.", "Échantillonnage ciblé et présence d’autres agents dans le corpus.", "viruses-wa-2023")],
  }),
  entry({
    id: "citrus-yellow-vein-associated-virus", commonName: "CYVaV, agent associé aux nervures jaunes", scientificName: "Citrus yellow vein-associated virus (CYVaV)", kind: "virus", role: "contextual",
    organs: ["Feuilles", "Plante entière à évaluer"], signs: ["Aucun symptôme exclusif du chanvre attribué ici à cet agent."], conditions: ["Contexte d’infections multiples dans la note consultée."],
    lifeCycle: "Agent viral à ARN détecté dans les tissus ; le corpus ne décrit pas un cycle épidémiologique complet sur chanvre.", spread: ["Voies et importance relative sur chanvre non établies par la note utilisée."], confusions: ["Attribuer des symptômes communs à l’unique résultat positif disponible."],
    confirmation: ["RT-PCR et séquençage spécifiques ; rechercher les autres explications compatibles."], prevention: ["Traçabilité des plantes et communication du contexte au laboratoire."], management: ["Interprétation spécialisée, sans mesure prétendument ciblée depuis la seule photo."],
    limits: ["Présence moléculaire documentée ; causalité séparée des symptômes non établie par cette note."], taxonomyNote: "Le mot citrus dans le nom ne réserve pas les détections aux agrumes.", regionNote: "Signalé sur chanvre au Washington ; aucune prévalence française affirmée.",
    evidence: [evidence("molecular", "Washington, 2021–2022", "Séquences puis RT-PCR confirment la présence de CYVaV.", "Co-infections : la note ne reproduit pas séparément une maladie due à CYVaV seul.", "viruses-wa-2023")],
  }),
  entry({
    id: "hop-latent-viroid", commonName: "Viroïde latent du houblon", scientificName: "Hop latent viroid (HLVd, aussi HpLVd)", kind: "viroid", role: "pathogen",
    organs: ["Plusieurs tissus", "Plante entière"], signs: ["Retard, déformations ou tiges fragiles possibles ; plantes positives parfois sans symptômes."], conditions: ["Expression variable selon la plante et le contexte ; symptômes non exclusifs."],
    lifeCycle: "Petit ARN circulaire non codant utilisant l’hôte ; sans capside et distinct d’un virus.", spread: ["Matériel végétal infecté et transmissions mécaniques documentées ; importance des voies à préciser selon le contexte."], confusions: ["Stress, autres infections ou attribution automatique de tout retard à HLVd."],
    confirmation: ["Analyse RT-PCR/RT-qPCR interprétée avec le laboratoire ; prélèvement, témoins et contexte comptent."], prevention: ["Traçabilité sanitaire et limitation des transferts entre végétaux suspects et autres lots."], management: ["Faire confirmer et évaluer le lot dans un cadre professionnel ; aucun procédé de guérison proposé."],
    limits: ["Un résultat positif n’évalue pas seul la gravité ; un échantillon de laboratoire n’est pas une prévalence nationale."], taxonomyNote: "Viroïde, pas virus ni champignon ; les deux abréviations désignent le même agent.", regionNote: "Expérience californienne et données canadiennes ; pas de taux français déduit.",
    evidence: [evidence("experimental", "Californie, note 2019", "Groupes inoculés par ARN infectieux : symptômes et RT-PCR positifs, contrairement aux témoins.", "Petite expérience : ne diagnostique pas une photographie individuelle.", "hlvd-warren"), evidence("observational", "Soumissions canadiennes au diagnostic, 2020–2022", "Plantes positives avec expression variable.", "Biais de recrutement des échantillons.", "hlvd-punja", "viroids-ictv")],
  }),
  entry({
    id: "ladybirds", commonName: "Coccinelles prédatrices", scientificName: "Coccinellidae — espèces prédatrices", kind: "beneficial", role: "beneficial",
    organs: ["Feuillage où se trouvent les proies"], signs: ["Adultes, larves allongées et parfois prédation observable."], conditions: ["Ressources alimentaires et habitat compatibles avec l’espèce."],
    lifeCycle: "Œuf, larve, nymphe puis adulte ; larve et adulte ne se ressemblent pas.", spread: ["Déplacements et vol des adultes."], confusions: ["Larves prises pour des ravageurs ; toute coccinelle supposée prédatrice."],
    confirmation: ["Identifier le groupe et, si nécessaire, l’espèce ; observer le comportement."], prevention: ["Préserver les organismes utiles identifiés et éviter les interventions indifférenciées."], management: ["Suivre proies et auxiliaires ensemble ; présence ne signifie pas contrôle suffisant."],
    limits: ["Aucun lâcher ni espèce importée recommandé."], taxonomyNote: "La famille comprend des régimes alimentaires différents ; la fiche vise les formes prédatrices.", regionNote: "Présence sur chanvre décrite par Purdue dans le centre-nord des États-Unis.",
    evidence: [evidence("extension", "Chanvre, centre-nord américain", "Coccinelles prédatrices décrites parmi les ennemis naturels observés.", "Pas une évaluation d’efficacité d’un achat d’auxiliaires.", "beneficial-purdue")],
  }),
  entry({
    id: "lacewings", commonName: "Chrysopes prédatrices", scientificName: "Chrysopidae ; notamment Chrysopa oculata dans l’observation citée", kind: "beneficial", role: "beneficial",
    organs: ["Feuilles et colonies de proies"], signs: ["Larves munies de mandibules courbes ; adultes à ailes nervurées."], conditions: ["Présence de proies et ressources adaptées aux stades."],
    lifeCycle: "Œuf, larve prédatrice, cocon puis adulte ; régime des adultes variable selon l’espèce.", spread: ["Déplacements larvaires et vol des adultes."], confusions: ["Autres larves prédatrices ; régime de tous les adultes supposé identique."],
    confirmation: ["Observer stade, caractères et comportement, sans nommer une espèce depuis un œuf seul."], prevention: ["Conserver les auxiliaires identifiés dans l’observation du foyer."], management: ["Évaluer leur présence avec celle des proies ; aucun résultat de régulation garanti."],
    limits: ["Observation naturelle ne signifie pas qu’un lâcher commercial réussira."], taxonomyNote: "Chrysopa oculata est l’exemple documenté au Colorado, pas le nom de toute chrysope française.", regionNote: "Association avec pucerons sur chanvre observée au Colorado.",
    evidence: [evidence("observational", "Champs de chanvre du Colorado", "Chrysopa oculata régulièrement observée près de foyers de pucerons.", "Pas de taux de contrôle démontré dans cette fiche.", "lacewings-csu")],
  }),
  entry({
    id: "aphid-parasitoids", commonName: "Parasitoïdes des pucerons", scientificName: "Hymenoptera parasitoïdes — plusieurs taxons", kind: "beneficial", role: "beneficial",
    organs: ["Colonies de pucerons"], signs: ["Pucerons momifiés ; orifice de sortie parfois visible."], conditions: ["Hôte et stade compatibles ; interaction dépendant du parasitoïde."],
    lifeCycle: "La descendance se développe aux dépens de l’hôte et finit par le tuer ; adulte distinct de la momie.", spread: ["Déplacement des adultes et présence d’hôtes."], confusions: ["Exuvies vides, pucerons desséchés ou infectés par un autre agent."],
    confirmation: ["Examiner la momie et, si nécessaire, l’adulte émergé avec un spécialiste."], prevention: ["Ne pas supprimer indistinctement tous les petits insectes observés."], management: ["Distinguer activité de parasitisme et maîtrise effective du foyer."],
    limits: ["Une momie ne permet pas d’identifier précisément le parasitoïde."], taxonomyNote: "Les parasitoïdes de pucerons et ceux d’aleurodes ne sont pas interchangeables.", regionNote: "Indices de parasitisme sur chanvre décrits dans les ressources universitaires américaines.",
    evidence: [evidence("extension", "Chanvre du centre-nord des États-Unis", "Momies et orifices d’émergence présentés comme indices d’activité.", "Ni espèce unique ni efficacité universelle déduite.", "beneficial-purdue")],
  }),
  entry({
    id: "predatory-mites", commonName: "Acariens prédateurs", scientificName: "Phytoseiidae — notamment Phytoseiulus et Neoseiulus", kind: "beneficial", role: "beneficial",
    organs: ["Feuillage, au voisinage des proies"], signs: ["Petits acariens mobiles ; le comportement et les caractères nécessitent un grossissement."], conditions: ["Proies, humidité et température compatibles avec l’espèce."],
    lifeCycle: "Œuf puis stades immatures et adulte ; préférences alimentaires différentes selon les espèces.", spread: ["Déplacements entre tissus ou plantes ; introduction éventuelle encadrée."], confusions: ["Acariens phytophages ; vitesse de déplacement prise pour une identification suffisante."],
    confirmation: ["Identification de l’auxiliaire et de la proie avant de conclure à une interaction utile."], prevention: ["Observer les interactions et préserver les auxiliaires reconnus."], management: ["Toute option de biocontrôle exige adéquation espèce–proie–milieu et cadre local ; aucun lâcher prescrit."],
    limits: ["Preuves d’efficacité sur chanvre encore limitées dans la fiche, surtout contre Aculops."], taxonomyNote: "Un prédateur de tétranyques n’est pas automatiquement adapté à tous les acariens.", regionNote: "Guide de serre de l’Indiana ; efficacité française non déduite.",
    evidence: [evidence("extension", "Chanvre sous abri, Indiana", "Prédateurs et spécialisation alimentaire décrits.", "Le guide demande explicitement davantage de données sur leur efficacité contre certains ravageurs du chanvre.", "purdue-greenhouse")],
  }),
];
