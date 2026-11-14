import { CANNABINOID_COMPOUNDS } from "./kanab-quest-school-cannabinoids-compounds";
import type { CannabinoidNetworkEdge, CannabinoidNetworkNode } from "./kanab-quest-school-cannabinoids-types";

const networkCompoundIds = ["cbga", "delta9-thca-a", "cbda", "cbca", "cbg", "delta9-thc", "cbd", "cbc", "cbgva", "thcva", "cbdva", "cbcva", "thcv", "cbdv", "cbna", "cbn", "hhc", "hhc-o"];

export const CANNABINOID_NETWORK_NODES: readonly CannabinoidNetworkNode[] = [
  { id: "olivetolic-acid", label: "Acide olivétolique", kind: "compound", detail: "Précurseur aromatique ; sa prénylation avec le GPP conduit au CBGA dans la voie étudiée." },
  { id: "geranyl-diphosphate", label: "Géranyl diphosphate (GPP)", kind: "compound", detail: "Cosubstrat apportant le groupe géranyle ; ne se transforme pas seul en CBGA ou CBGVA." },
  { id: "divarinic-acid", label: "Acide divarinique", kind: "compound", detail: "Aussi nommé acide divarinolique (DA dans Luo 2019) ; précurseur à chaîne propyle de la branche CBGVA." },
  ...CANNABINOID_COMPOUNDS.filter(item => networkCompoundIds.includes(item.id)).map(item => ({ id: item.id, label: item.name, compoundId: item.id, kind: "compound" as const, detail: item.identity.statement })),
  { id: "11-hydroxy-thc", label: "11-hydroxy-THC", kind: "metabolite", detail: "Métabolite actif du THC formé dans l’organisme ; ce n’est ni du THCA-A ni le produit d’une synthase végétale." },
  { id: "thc-cooh", label: "THC-COOH", kind: "metabolite", detail: "11-nor-9-carboxy-THC : métabolite en aval du 11-hydroxy-THC, distinct du THCA végétal. Sa détection n’établit pas à elle seule une altération actuelle." },
];

const edge = (id: string, from: string, to: string, kind: CannabinoidNetworkEdge["kind"], label: string, explanation: string, limitation: string, sourceIds: readonly string[], evidenceStatus: CannabinoidNetworkEdge["evidenceStatus"] = "supported"): CannabinoidNetworkEdge => ({ id, from, to, kind, evidenceStatus, label, explanation, limitation, sourceIds });
const decarboxylation = (from: string, to: string, sourceIds: readonly string[] = ["cb-kim-2022"]): CannabinoidNetworkEdge => edge(`decarboxylation-${from}`, from, to, "decarboxylation", "Perte de CO₂", "La fonction acide est perdue sous forme de dioxyde de carbone : la forme neutre correspondante est distincte de l’acide initial.", "Schéma qualitatif, sans rendement, paramètre de transformation ou prédiction de la composition d’un produit. Ce n’est pas une enzyme de cyclisation.", sourceIds);

export const CANNABINOID_NETWORK_EDGES: readonly CannabinoidNetworkEdge[] = [
  edge("oa-cbga", "olivetolic-acid", "cbga", "biosynthesis", "Prényltransférase + GPP", "L’acide olivétolique et le GPP sont deux cosubstrats de la formation du CBGA ; une prényltransférase végétale est caractérisée dans un système reconstitué.", "Les deux liens représentent une même réaction à deux substrats, pas deux voies indépendantes. Modèle reconstitué de Luo, Extended Data figure 2.", ["cb-luo-2019"]),
  edge("gpp-cbga", "geranyl-diphosphate", "cbga", "biosynthesis", "Avec l’acide olivétolique", "Le GPP apporte le groupe géranyle à l’acide olivétolique dans la formation du CBGA.", "Le GPP seul ne produit pas du CBGA ; cette flèche est le second apport à la réaction précédente.", ["cb-luo-2019"]),
  edge("da-cbgva", "divarinic-acid", "cbgva", "biosynthesis", "Prénylation + GPP, modèle reconstitué", "La branche à chaîne propyle associe le précurseur divarinique au GPP pour former le CBGVA dans le réseau reconstitué.", "Luo, Extended Data figure 4 : signaux de masse et rétention attendue pour DA/CBGVA. Ne pas présenter cela comme un flux quantifié dans la plante entière.", ["cb-luo-2019"]),
  edge("gpp-cbgva", "geranyl-diphosphate", "cbgva", "biosynthesis", "Avec l’acide divarinique", "Le GPP est également le cosubstrat géranyle de la branche CBGVA.", "Second apport d’une même réaction ; l’analogie de voie n’établit pas ensuite chaque branche de cyclisation.", ["cb-luo-2019"]),
  edge("cbga-thca", "cbga", "delta9-thca-a", "biosynthesis", "THCA synthase", "Une enzyme végétale caractérisée catalyse la cyclisation oxydative du CBGA en THCA.", "Le substrat est CBGA, pas CBG. Présence de la voie ne signifie pas proportion identique dans toutes les plantes.", ["cb-thcas-2004"]),
  edge("cbga-cbda", "cbga", "cbda", "biosynthesis", "CBDA synthase", "Le CBGA peut être orienté vers le CBDA par une autre synthase.", "Cette réaction ne forme pas directement le CBD neutre.", ["cb-cbdas-2007"]),
  edge("cbga-cbca", "cbga", "cbca", "biosynthesis", "CBCA synthase", "La formation du CBCA à partir du CBGA est documentée par une étude enzymatique.", "La preuve porte sur cette paire de molécules ; elle ne valide pas automatiquement chaque homologue.", ["cb-cbcas-1998"]),
  edge("cbgva-thcva", "cbgva", "thcva", "biosynthesis", "Branche varinique reconstituée", "Des enzymes végétales exprimées en levure permettent la production de THCVA depuis la branche CBGVA.", "Preuve dans un système hétérologue, distincte d’une mesure de flux dans une plante entière.", ["cb-luo-2019"]),
  edge("cbgva-cbdva", "cbgva", "cbdva", "biosynthesis", "Branche varinique reconstituée", "La branche vers le CBDVA est documentée dans le système de levure reconstitué.", "Aucune quantité dans une variété ou dans un Buddy n’en est déduite.", ["cb-luo-2019"]),
  edge("cbgva-cbcva", "cbgva", "cbcva", "biosynthesis", "Voie proposée — preuve directe non vérifiée", "Le CBCVA et le CBGVA ont des identités documentées ; cette liaison représente une hypothèse de voie dans notre carte.", "L’isolement de 1977 ne démontre pas la catalyse. La figure 3 de Luo 2019 ne démontre pas cette branche. Le texte historique de 1984 évoqué dans la littérature n’a pas été accessible : aucune équivalence de preuve avec les branches précédentes.", ["cb-propyl-1977", "cb-luo-2019"], "proposed"),
  decarboxylation("delta9-thca-a", "delta9-thc"),
  decarboxylation("cbda", "cbd"),
  decarboxylation("cbga", "cbg"),
  decarboxylation("cbca", "cbc"),
  decarboxylation("thcva", "thcv"),
  decarboxylation("cbdva", "cbdv"),
  decarboxylation("cbna", "cbn", ["cb-harvey-1990"]),
  edge("thca-cbna", "delta9-thca-a", "cbna", "oxidation", "Transformation oxydative", "La formation de CBNA à partir de THCA est décrite dans une étude chimique sur les cannabinoïdes du cannabis conservé.", "Ce lien n’est pas une biosynthèse démontrée ni une mesure de vitesse de vieillissement.", ["cb-shoyama-1970"]),
  edge("thc-cbn", "delta9-thc", "cbn", "oxidation", "Voie de dégradation", "Le CBN fait partie des produits de dégradation du THC observés dans des matériaux anciens.", "Toutes les pertes de THC ne deviennent pas du CBN ; d’autres produits et intermédiaires existent. Le ratio ne donne pas à lui seul un âge fiable.", ["cb-harvey-1990"]),
  edge("thc-11-oh", "delta9-thc", "11-hydroxy-thc", "metabolism", "Métabolisme dans l’organisme", "L’organisme transforme une partie du THC en 11-hydroxy-THC actif.", "Ce métabolisme est séparé des synthases végétales et des conversions industrielles ; sa contribution dépend notamment de la voie d’exposition.", ["cb-dronabinol"]),
  edge("11-oh-thc-cooh", "11-hydroxy-thc", "thc-cooh", "metabolism", "Oxydations métaboliques ultérieures", "La formation de THC-COOH à partir du 11-hydroxy-THC est suivie dans des préparations hépatiques humaines.", "Schéma simplifié, pas une cartographie de tous les métabolites. Aucun délai universel de détection ni niveau d’altération individuelle n’en est déduit.", ["cb-metabolism-2019"]),
  edge("cbd-hhc-commercial", "cbd", "hhc", "commercial-conversion", "Transformation industrielle — plusieurs étapes", "Le CBD peut être une matière de départ de chaînes de transformation commerciales aboutissant au HHC.", "Relation d’origine industrielle, pas réaction spontanée dans une plante ou dans le corps. Le schéma ne décrit ni procédé ni qualité d’un lot.", ["cb-euda-2023"]),
  edge("hhc-acetate-commercial", "hhc", "hhc-o", "commercial-conversion", "Dérivé acétylé commercial", "Le HHC-O correspond à un dérivé acétylé du HHC identifié sur le marché.", "Ni présence naturelle établie, ni garantie que la composition du produit corresponde exactement à son étiquette.", ["cb-euda-2023", "cb-euda-2026"]),
];
