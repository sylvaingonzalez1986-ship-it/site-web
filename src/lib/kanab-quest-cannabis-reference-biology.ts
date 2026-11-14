import type { CannabisReferenceArticle, CannabisReferenceImage } from "./kanab-quest-cannabis-reference-types";

const BOTANY_IMAGE: CannabisReferenceImage = {
  "src": "/placard/school/course-plant-v1.webp",
  "alt": "Planche botanique de chanvre : plante, racines, feuille composée et structures florales.",
  "caption": "Illustration de synthèse des organes du chanvre."
};

const TERPENE_IMAGE: CannabisReferenceImage = {
  "src": "/placard/school/course-molecules-v1.webp",
  "alt": "Planche illustrée de chanvre, loupe et évocations aromatiques.",
  "caption": "Illustration de synthèse du chanvre et de notes aromatiques."
};

const CANNABINOID_IMAGE: CannabisReferenceImage = {
  "src": "/placard/school/course-evidence-v1.webp",
  "alt": "Planche de chanvre et documents d’observation scientifique.",
  "caption": "Illustration de synthèse du chanvre et de documents scientifiques."
};

/** Factual reference articles. Bibliographic reuse and targeted checks are documented in
 * docs/bete-de-concours/cannabis-reference-biology-provenance.json.
 */
export const CANNABIS_BIOLOGY_ARTICLES: readonly CannabisReferenceArticle[] = [
  {
    "id": "ref-cannabis-sativa",
    "topicId": "botany",
    "title": "Cannabis sativa",
    "lead": "Cannabis sativa L. est une plante à fleurs de la famille des Cannabaceae. Le chanvre cultivé pour ses fibres ou ses graines et les formes sélectionnées pour leurs composés appartiennent à la diversité du genre Cannabis.",
    "image": BOTANY_IMAGE,
    "sections": [
      {
        "id": "ref-cannabis-sativa-description",
        "title": "Une plante herbacée",
        "paragraphs": [
          "Le cannabis est généralement annuel. Ses racines alimentent une tige dressée et ramifiée qui porte les feuilles puis les structures reproductrices. Les grandes feuilles sont souvent composées de folioles dentées disposées en éventail. Leur nombre et leur forme changent avec la position sur la plante et son développement."
        ],
        "sourceIds": [
          "bf-cfia-2021",
          "bf-kew-1975",
          "bf-morphology-2023"
        ]
      },
      {
        "id": "ref-cannabis-sativa-organes",
        "title": "Des organes aux usages",
        "paragraphs": [
          "Les fibres du liber se trouvent dans les tissus périphériques de la tige, autour d’une partie plus ligneuse. Le chènevis est le fruit sec contenant la graine. Des trichomes glandulaires produisent et accumulent des métabolites spécialisés, notamment des cannabinoïdes et des terpènes, particulièrement étudiés sur les organes floraux."
        ],
        "sourceIds": [
          "bf-fibres-2016",
          "bf-kew-1975",
          "bf-trichomes-2020"
        ]
      },
      {
        "id": "ref-cannabis-sativa-diversite",
        "title": "Une espèce très variable",
        "paragraphs": [
          "Plants of the World Online, le référentiel de Kew, accepte le nom Cannabis sativa. D’autres traitements taxonomiques subdivisent différemment le genre. Les caractères d’une population cultivée, son usage et sa composition chimique ne constituent donc pas trois classements équivalents. Les plantes férales proviennent de cultures dont elles se sont échappées."
        ],
        "sourceIds": [
          "botany-diversity-kew",
          "botany-diversity-cfia"
        ]
      }
    ],
    "sourceIds": [
      "bf-cfia-2021",
      "bf-kew-1975",
      "bf-morphology-2023",
      "bf-fibres-2016",
      "bf-trichomes-2020",
      "botany-diversity-kew",
      "botany-diversity-cfia"
    ],
    "relatedArticleIds": [
      "ref-organes-vegetatifs",
      "ref-cycle-vie",
      "ref-taxonomie-cannabis"
    ],
    "glossaryIds": [
      "botany-leaflet",
      "botany-inflorescence",
      "botany-feral"
    ],
    "legacyPassages": [
      {
        "courseId": "plant",
        "passageId": "botany-observation-1"
      },
      {
        "courseId": "plant",
        "passageId": "plant-4"
      }
    ]
  },
  {
    "id": "ref-organes-vegetatifs",
    "topicId": "botany",
    "title": "Racines, tige et feuilles",
    "lead": "Les organes végétatifs du cannabis assurent l’ancrage, les échanges et la croissance de la plante. Ils comprennent le système racinaire, les tiges et les feuilles, chacun composé de plusieurs tissus spécialisés.",
    "image": BOTANY_IMAGE,
    "sections": [
      {
        "id": "ref-organes-vegetatifs-racines",
        "title": "Le système racinaire",
        "paragraphs": [
          "Les racines ancrent la plante et absorbent de l’eau ainsi que des éléments minéraux. Elles constituent la partie souterraine de l’appareil végétatif et communiquent avec les organes aériens par les tissus conducteurs. Une racine est un organe entier ; elle ne correspond ni à une fibre textile ni à un poil glandulaire."
        ],
        "sourceIds": [
          "bf-body-2018",
          "bf-stems-2018"
        ]
      },
      {
        "id": "ref-organes-vegetatifs-tige",
        "title": "La tige et ses tissus",
        "paragraphs": [
          "La tige porte les feuilles et les ramifications. Les nœuds sont leurs points d’insertion ; les entre-nœuds sont les portions qui les séparent. Les fibres du liber, associées au phloème, occupent une position périphérique par rapport au bois. Cette organisation distingue les fibres utilisées dans les textiles du cœur ligneux de la tige."
        ],
        "sourceIds": [
          "bf-stems-2018",
          "bf-fibres-2016"
        ]
      },
      {
        "id": "ref-organes-vegetatifs-feuilles",
        "title": "Une feuille, plusieurs folioles",
        "paragraphs": [
          "Le pétiole relie la feuille à la tige. Chez le cannabis, plusieurs folioles dentées peuvent partager ce même pétiole. Les stipules sont de petites pièces situées près de sa base. La feuille participe à la photosynthèse et aux échanges gazeux ; la variation de ses folioles accompagne notamment le développement et la position sur l’individu."
        ],
        "sourceIds": [
          "bf-leaves-2018",
          "bf-kew-1975",
          "bf-morphology-2023"
        ]
      }
    ],
    "sourceIds": [
      "bf-body-2018",
      "bf-stems-2018",
      "bf-fibres-2016",
      "bf-leaves-2018",
      "bf-kew-1975",
      "bf-morphology-2023"
    ],
    "relatedArticleIds": [
      "ref-cannabis-sativa",
      "ref-fleurs-fruits-graines",
      "ref-cycle-vie"
    ],
    "glossaryIds": [
      "botany-root",
      "botany-node",
      "botany-leaflet",
      "botany-stipule",
      "botany-bast-fibre"
    ],
    "legacyPassages": [
      {
        "courseId": "plant",
        "passageId": "botany-anatomy-1"
      },
      {
        "courseId": "plant",
        "passageId": "plant-1"
      }
    ]
  },
  {
    "id": "ref-fleurs-fruits-graines",
    "topicId": "botany",
    "title": "Fleurs, fruits et graines",
    "lead": "Le cannabis porte de petites fleurs regroupées dans des structures ramifiées. L’inflorescence, la fleur, le fruit et la graine correspondent à des niveaux d’organisation différents, souvent réunis sous des noms courants moins précis.",
    "image": BOTANY_IMAGE,
    "sections": [
      {
        "id": "ref-fleurs-fruits-graines-fleurs",
        "title": "Les structures florales",
        "paragraphs": [
          "Les fleurs staminales possèdent des étamines dont les anthères produisent le pollen. Les fleurs pistillées comportent un ovaire et deux branches stigmatiques réceptrices du pollen. Ces deux filaments appartiennent à l’appareil pistillé : ils ne représentent pas deux pistils entiers. Une « tête » de cannabis rassemble plusieurs fleurs et leurs axes."
        ],
        "sourceIds": [
          "bf-kew-1975",
          "bf-florogenesis-2019"
        ]
      },
      {
        "id": "ref-fleurs-fruits-graines-enveloppes",
        "title": "Bractées et enveloppes",
        "paragraphs": [
          "Des bractées, feuilles modifiées associées aux fleurs, participent à l’organisation de l’inflorescence. L’enveloppe verte entourant la fleur pistillée est décrite comme une bractéole ou une bractée périgonale. Le périanthe propre à cette fleur est très réduit. Ces structures ne sont pas toutes des sépales, malgré certaines appellations courantes."
        ],
        "sourceIds": [
          "bf-kew-1975",
          "bf-upov-2025"
        ]
      },
      {
        "id": "ref-fleurs-fruits-graines-chenevis",
        "title": "Le chènevis",
        "paragraphs": [
          "Le chènevis entier est un petit fruit sec, couramment appelé akène. Sa paroi provient de l’ovaire ; il renferme une graine issue de l’ovule après la reproduction sexuée. La graine contient un embryon à deux cotylédons. Dans la filière semencière, le mot semence désigne aussi l’unité entière utilisée, sans effacer ces distinctions botaniques."
        ],
        "sourceIds": [
          "bf-kew-1975",
          "bf-reproduction-2018",
          "bf-geves-2021"
        ]
      }
    ],
    "sourceIds": [
      "bf-kew-1975",
      "bf-florogenesis-2019",
      "bf-upov-2025",
      "bf-reproduction-2018",
      "bf-geves-2021"
    ],
    "relatedArticleIds": [
      "ref-reproduction",
      "ref-cycle-vie",
      "ref-trichomes"
    ],
    "glossaryIds": [
      "botany-anther",
      "botany-stigma",
      "botany-bract",
      "botany-achene",
      "botany-cotyledon"
    ],
    "legacyPassages": [
      {
        "courseId": "plant",
        "passageId": "botany-anatomy-2"
      }
    ]
  },
  {
    "id": "ref-trichomes",
    "topicId": "botany",
    "title": "Les trichomes du cannabis",
    "lead": "Les trichomes sont des structures issues de l’épiderme des organes végétaux. Le cannabis possède des trichomes non glandulaires et des trichomes glandulaires, ces derniers étant associés à la production de nombreux composés spécialisés.",
    "image": BOTANY_IMAGE,
    "sections": [
      {
        "id": "ref-trichomes-formes",
        "title": "Des structures différentes",
        "paragraphs": [
          "Les trichomes non glandulaires ont un aspect pileux. Les trichomes glandulaires comprennent des cellules sécrétrices et une tête, portée ou non par un pédoncule nettement visible. Une surface végétale peut donc porter plusieurs types de structures. Les filaments stigmatiques des fleurs appartiennent à l’appareil reproducteur et ne sont pas des trichomes."
        ],
        "sourceIds": [
          "bf-cfia-2021",
          "bf-leaves-2018",
          "bf-kew-1975"
        ]
      },
      {
        "id": "ref-trichomes-metabolites",
        "title": "Des sites de production",
        "paragraphs": [
          "Des cannabinoïdes et des terpènes sont produits ou accumulés dans les structures glandulaires étudiées. Les cellules sécrétrices et les voies enzymatiques contribuent à cette spécialisation. La présence d’une glande décrit toutefois une organisation anatomique ; elle ne correspond pas à une quantité fixe de chaque composé dans la plante."
        ],
        "sourceIds": [
          "bf-trichomes-2020",
          "terpenes-lesson-booth2017"
        ]
      },
      {
        "id": "ref-trichomes-developpement",
        "title": "Une organisation qui évolue",
        "paragraphs": [
          "Les recherches sur les fleurs montrent des changements de morphologie et de contenu métabolique au cours de leur maturation. La forme d’un trichome et son nombre de cellules sécrétrices sont ainsi liés au développement. Une couleur ou une densité apparente, isolée de ces données, n’indique pas une concentration précise en THC ou en terpènes."
        ],
        "sourceIds": [
          "bf-trichomes-2020",
          "terpenes-lesson-livingston2020"
        ]
      }
    ],
    "sourceIds": [
      "bf-cfia-2021",
      "bf-leaves-2018",
      "bf-kew-1975",
      "bf-trichomes-2020",
      "terpenes-lesson-booth2017",
      "terpenes-lesson-livingston2020"
    ],
    "relatedArticleIds": [
      "ref-biosynthese-terpenes",
      "ref-biosynthese-cannabinoides",
      "ref-fleurs-fruits-graines"
    ],
    "glossaryIds": [
      "botany-trichome",
      "botany-epidermis",
      "terpenes-term-enzyme"
    ],
    "legacyPassages": [
      {
        "courseId": "plant",
        "passageId": "botany-observation-2"
      },
      {
        "courseId": "molecules",
        "passageId": "terpenes-trichomes-1"
      }
    ]
  },
  {
    "id": "ref-cycle-vie",
    "topicId": "botany",
    "title": "Le cycle de vie du cannabis",
    "lead": "Le cannabis est généralement une plante annuelle. Son développement relie la germination, la croissance végétative, la formation des structures reproductrices et la sénescence ; les organes d’un même individu ne progressent pas tous au même rythme.",
    "image": BOTANY_IMAGE,
    "sections": [
      {
        "id": "ref-cycle-vie-germination",
        "title": "De l’embryon à la plantule",
        "paragraphs": [
          "La graine contient déjà un embryon. La germination correspond à la reprise de son développement, avec l’apparition de la jeune racine et de l’axe aérien. Les deux cotylédons sont des pièces foliaires embryonnaires. Les feuilles produites ensuite se différencient progressivement et n’ont pas toutes d’emblée la forme palmée des feuilles développées."
        ],
        "sourceIds": [
          "bf-reproduction-2018",
          "bf-geves-2021",
          "bf-morphology-2023"
        ]
      },
      {
        "id": "ref-cycle-vie-croissance",
        "title": "Croissance et développement floral",
        "paragraphs": [
          "Tiges, feuilles et ramifications se développent pendant la croissance végétative. La formation d’une première fleur isolée et celle d’une inflorescence ramifiée sont des étapes distinctes. Leur succession dépend notamment du génotype et des conditions du milieu. Les durées observées sur un cultivar ne constituent pas un calendrier identique pour tous les cannabis."
        ],
        "sourceIds": [
          "bf-cfia-2021",
          "bf-florogenesis-2019",
          "bf-morphology-2023"
        ]
      },
      {
        "id": "ref-cycle-vie-reproduction",
        "title": "Reproduction et sénescence",
        "paragraphs": [
          "Après une reproduction sexuée aboutie, les ovules donnent les graines et les ovaires forment les fruits. La sénescence correspond au vieillissement des organes puis à la fin du cycle de l’individu. La dispersion des fruits contenant les graines prolonge le cycle à l’échelle de la population ; elle est différente du transport du pollen."
        ],
        "sourceIds": [
          "bf-reproduction-2018",
          "bf-cfia-2021"
        ]
      }
    ],
    "sourceIds": [
      "bf-reproduction-2018",
      "bf-geves-2021",
      "bf-morphology-2023",
      "bf-cfia-2021",
      "bf-florogenesis-2019"
    ],
    "relatedArticleIds": [
      "ref-photoperiode",
      "ref-reproduction",
      "ref-fleurs-fruits-graines"
    ],
    "glossaryIds": [
      "botany-germination",
      "botany-cotyledon",
      "botany-senescence"
    ],
    "legacyPassages": [
      {
        "courseId": "plant",
        "passageId": "botany-life-cycle-1"
      }
    ]
  },
  {
    "id": "ref-reproduction",
    "topicId": "botany",
    "title": "La reproduction du cannabis",
    "lead": "La reproduction sexuée du cannabis repose sur les fleurs, le transport du pollen et la fécondation des ovules. Le genre présente plusieurs organisations florales, dont la dioécie et la monoécie.",
    "image": BOTANY_IMAGE,
    "sections": [
      {
        "id": "ref-reproduction-organisation",
        "title": "Dioécie et monoécie",
        "paragraphs": [
          "Dans une population dioïque, les fleurs staminales et pistillées se trouvent sur des individus distincts. Une plante monoïque porte les deux types de fleurs, qui restent séparées. Une fleur bisexuée réunit au contraire les deux ensembles d’organes dans une même fleur. Ces organisations ne se déduisent ni de la taille d’une plante ni de la forme de ses feuilles."
        ],
        "sourceIds": [
          "bf-cfia-2021",
          "bf-kew-1975",
          "bf-reproduction-2018"
        ]
      },
      {
        "id": "ref-reproduction-pollinisation",
        "title": "Pollinisation et fécondation",
        "paragraphs": [
          "Le vent joue un rôle majeur dans le transport du pollen. La pollinisation correspond à son arrivée sur un stigmate. La fécondation intervient ensuite à l’intérieur de l’ovule, par l’union des cellules reproductrices. Elle conduit notamment à la formation de l’embryon. Un grain de pollen est donc distinct d’une graine et d’un fruit."
        ],
        "sourceIds": [
          "bf-cfia-2021",
          "bf-reproduction-2018"
        ]
      },
      {
        "id": "ref-reproduction-expression",
        "title": "L’expression sexuelle",
        "paragraphs": [
          "Dans de nombreuses populations dioïques étudiées, la constitution XX est associée aux fleurs pistillées et XY aux fleurs staminales. L’expression florale présente aussi une plasticité liée aux processus de développement. L’activité des gènes, la constitution chromosomique et les organes effectivement formés représentent des aspects reliés, mais distincts, de cette biologie."
        ],
        "sourceIds": [
          "bf-sex-2025",
          "bf-cfia-2021"
        ]
      }
    ],
    "sourceIds": [
      "bf-cfia-2021",
      "bf-kew-1975",
      "bf-reproduction-2018",
      "bf-sex-2025"
    ],
    "relatedArticleIds": [
      "ref-fleurs-fruits-graines",
      "ref-genetique-heredite",
      "ref-cycle-vie"
    ],
    "glossaryIds": [
      "botany-dioecy",
      "botany-monoecy",
      "botany-bisexual-flower",
      "botany-pollination",
      "botany-fertilization"
    ],
    "legacyPassages": [
      {
        "courseId": "plant",
        "passageId": "botany-sexual-expression-1"
      },
      {
        "courseId": "plant",
        "passageId": "botany-sexual-expression-2"
      },
      {
        "courseId": "plant",
        "passageId": "plant-2"
      }
    ]
  },
  {
    "id": "ref-photoperiode",
    "topicId": "botany",
    "title": "Photopériode et floraison",
    "lead": "La photopériode est la durée quotidienne d’éclairement dans l’alternance jour–nuit. Chez de nombreuses formes de cannabis, elle intervient dans le développement floral, avec une réponse variable selon le génotype et le stade considéré.",
    "image": BOTANY_IMAGE,
    "sections": [
      {
        "id": "ref-photoperiode-rythme",
        "title": "Le rythme jour–nuit",
        "paragraphs": [
          "La durée du jour constitue un signal biologique distinct de la quantité totale de lumière reçue. Beaucoup de formes de cannabis sont décrites comme répondant aux jours courts. Cette expression résume une relation entre l’alternance lumineuse et le développement ; elle ne correspond pas à une date de floraison commune à toutes les populations."
        ],
        "sourceIds": [
          "bf-cfia-2021",
          "bf-florogenesis-2019"
        ]
      },
      {
        "id": "ref-photoperiode-stades",
        "title": "Plusieurs étapes florales",
        "paragraphs": [
          "L’apparition d’une fleur solitaire, la ramification des axes et le développement d’inflorescences compactes sont des phénomènes différents. Les travaux sur la florogenèse du cannabis montrent que leur relation à la photopériode peut différer. Une première fleur et un ensemble floral développé ne décrivent donc pas le même stade de la plante."
        ],
        "sourceIds": [
          "bf-florogenesis-2019",
          "bf-morphology-2023"
        ]
      },
      {
        "id": "ref-photoperiode-variation",
        "title": "Les formes autoflorissantes",
        "paragraphs": [
          "Certaines formes présentent une floraison moins dépendante de la photopériode, souvent qualifiée d’autofloraison. Ce caractère concerne le calendrier floral. Il est indépendant du sens du mot autofécondation, qui décrit l’origine des gamètes, et de la féminisation, qui désigne une catégorie de semences visant une descendance principalement femelle."
        ],
        "sourceIds": [
          "botany-diversity-cfia",
          "botany-diversity-cfia-seeds"
        ]
      }
    ],
    "sourceIds": [
      "bf-cfia-2021",
      "bf-florogenesis-2019",
      "bf-morphology-2023",
      "botany-diversity-cfia",
      "botany-diversity-cfia-seeds"
    ],
    "relatedArticleIds": [
      "ref-cycle-vie",
      "ref-reproduction",
      "ref-genetique-heredite"
    ],
    "glossaryIds": [
      "botany-photoperiod",
      "botany-autoflowering",
      "botany-selfing"
    ],
    "legacyPassages": [
      {
        "courseId": "plant",
        "passageId": "botany-life-cycle-2"
      }
    ]
  },
  {
    "id": "ref-taxonomie-cannabis",
    "topicId": "diversity",
    "title": "La classification du genre Cannabis",
    "lead": "La taxonomie du cannabis décrit les noms scientifiques et les subdivisions du genre. Le traitement adopté par Plants of the World Online reconnaît Cannabis sativa L. dans la famille des Cannabaceae.",
    "image": BOTANY_IMAGE,
    "sections": [
      {
        "id": "ref-taxonomie-cannabis-noms",
        "title": "Le nom botanique",
        "paragraphs": [
          "Un nom scientifique associe un genre et une épithète d’espèce ; le « L. » de Cannabis sativa L. renvoie à Linné. Les synonymes scientifiques et les subdivisions dépendent du référentiel taxonomique. Ils appartiennent à un système de nomenclature différent de celui des noms commerciaux, qui désignent souvent des sélections ou des familles cultivées."
        ],
        "sourceIds": [
          "botany-diversity-kew"
        ]
      },
      {
        "id": "ref-taxonomie-cannabis-debats",
        "title": "Des délimitations discutées",
        "paragraphs": [
          "Les classifications du genre ont retenu une espèce très variable ou plusieurs unités distinctes. Les caractères morphologiques, l’histoire géographique et les données génétiques interviennent dans ces propositions. Les déplacements et croisements des populations domestiquées compliquent leurs frontières. Les noms sativa, indica et ruderalis n’ont donc pas partout la même portée taxonomique."
        ],
        "sourceIds": [
          "botany-diversity-cfia",
          "botany-diversity-sawler"
        ]
      },
      {
        "id": "ref-taxonomie-cannabis-etiquettes",
        "title": "Les catégories du commerce",
        "paragraphs": [
          "Dans les études de matériels commerciaux, les catégories indica, sativa et hybride ne correspondent pas de manière constante à l’ensemble de la structure génétique. Cette discordance n’efface pas la diversité biologique de la plante. Une silhouette, un profil chimique et une appellation commerciale décrivent des caractéristiques différentes, même lorsqu’ils sont associés sur une étiquette."
        ],
        "sourceIds": [
          "botany-diversity-sawler",
          "botany-diversity-schwabe"
        ]
      }
    ],
    "sourceIds": [
      "botany-diversity-kew",
      "botany-diversity-cfia",
      "botany-diversity-sawler",
      "botany-diversity-schwabe"
    ],
    "relatedArticleIds": [
      "ref-cannabis-sativa",
      "ref-populations-domestication",
      "ref-noms-lignees"
    ],
    "glossaryIds": [
      "botany-taxonomy",
      "botany-phenotype",
      "botany-genotype"
    ],
    "legacyPassages": [
      {
        "courseId": "plant",
        "passageId": "botany-taxonomy-1"
      }
    ]
  },
  {
    "id": "ref-populations-domestication",
    "topicId": "diversity",
    "title": "Populations cultivées et férales",
    "lead": "La diversité du cannabis résulte d’histoires de culture, de sélection et de circulation des plantes. Une population rassemble plusieurs individus et peut conserver une diversité génétique interne importante.",
    "image": BOTANY_IMAGE,
    "sections": [
      {
        "id": "ref-populations-domestication-locales",
        "title": "Les populations locales",
        "paragraphs": [
          "Une population locale, souvent appelée landrace, s’inscrit dans une histoire agricole et un territoire. Ses caractères reflètent des transmissions, des sélections et des conditions de milieu. Le terme ne désigne pas nécessairement une lignée génétiquement uniforme : des échanges de graines ou de pollen peuvent participer à son histoire, même lorsque son nom géographique demeure stable."
        ],
        "sourceIds": [
          "botany-diversity-cfia",
          "botany-diversity-lynch2025"
        ]
      },
      {
        "id": "ref-populations-domestication-ferales",
        "title": "Les populations férales",
        "paragraphs": [
          "Les plantes férales descendent de matériel cultivé puis échappé des cultures. Leur maintien spontané ne les transforme pas en ancêtres sauvages demeurés sans contact humain. Les formes cultivées et férales représentent ainsi des histoires différentes, susceptibles de se rencontrer. Leur distribution actuelle résulte aussi des transports anciens et récents de matériel végétal."
        ],
        "sourceIds": [
          "botany-diversity-cfia",
          "botany-diversity-lynch2025"
        ]
      },
      {
        "id": "ref-populations-domestication-genomes",
        "title": "La diversité génomique",
        "paragraphs": [
          "Les comparaisons de génomes documentent des différences de séquence et d’organisation chromosomique entre les matériels étudiés. Les pangénomes rassemblent cette diversité au-delà d’un unique génome de référence. Les collections disponibles restent géographiquement incomplètes ; les travaux de Lynch et collègues signalent notamment un sous-échantillonnage de certaines origines asiatiques."
        ],
        "sourceIds": [
          "botany-diversity-lynch2025"
        ]
      }
    ],
    "sourceIds": [
      "botany-diversity-cfia",
      "botany-diversity-lynch2025"
    ],
    "relatedArticleIds": [
      "ref-taxonomie-cannabis",
      "ref-cultivars-clones",
      "ref-genetique-heredite"
    ],
    "glossaryIds": [
      "botany-landrace",
      "botany-feral",
      "botany-accession",
      "botany-pangenome"
    ],
    "legacyPassages": [
      {
        "courseId": "plant",
        "passageId": "plant-3"
      }
    ]
  },
  {
    "id": "ref-cultivars-clones",
    "topicId": "diversity",
    "title": "Cultivars, lignées et clones",
    "lead": "Un cultivar, une lignée et un clone désignent des formes différentes d’organisation du matériel cultivé. Ces mots ne représentent ni des degrés de qualité ni des garanties identiques d’uniformité génétique.",
    "image": BOTANY_IMAGE,
    "sections": [
      {
        "id": "ref-cultivars-clones-cultivar",
        "title": "Le cultivar",
        "paragraphs": [
          "Un cultivar est un ensemble cultivé reconnu par des caractères et une histoire de sélection. Sa description peut rester stable tout en comprenant une diversité entre individus. Dans les systèmes officiels de description variétale, la distinction, l’homogénéité et la stabilité portent sur des caractères définis et sur le matériel représentatif de la variété."
        ],
        "sourceIds": [
          "botany-diversity-geves",
          "botany-diversity-geves-diversity"
        ]
      },
      {
        "id": "ref-cultivars-clones-clone",
        "title": "La descendance clonale",
        "paragraphs": [
          "Un clone correspond à une descendance obtenue par multiplication végétative d’un individu. Il conserve en principe le patrimoine génétique de cet individu, sous réserve de mutations. Des différences d’environnement ou de développement peuvent néanmoins modifier son apparence. Une population issue de semences n’est pas, par définition, l’équivalent d’un clone."
        ],
        "sourceIds": [
          "botany-diversity-geves-diversity",
          "botany-diversity-phenotype"
        ]
      },
      {
        "id": "ref-cultivars-clones-lignee",
        "title": "Lignées et diversité interne",
        "paragraphs": [
          "Une lignée renvoie à une continuité de descendance, dont la structure dépend de son histoire et de son maintien. L’homogénéité d’un caractère visible n’implique pas une identité de toutes les séquences d’ADN. De même, une accession de collection représente un matériel identifié ; elle ne résume pas nécessairement toute la diversité d’un cultivar ou d’une région."
        ],
        "sourceIds": [
          "botany-diversity-geves-diversity",
          "botany-diversity-lynch2025"
        ]
      }
    ],
    "sourceIds": [
      "botany-diversity-geves",
      "botany-diversity-geves-diversity",
      "botany-diversity-phenotype",
      "botany-diversity-lynch2025"
    ],
    "relatedArticleIds": [
      "ref-genetique-heredite",
      "ref-populations-domestication",
      "ref-noms-lignees"
    ],
    "glossaryIds": [
      "botany-cultivar",
      "botany-clone",
      "botany-accession",
      "botany-phenotype"
    ],
    "legacyPassages": [
      {
        "courseId": "plant",
        "passageId": "botany-diversity-1"
      }
    ]
  },
  {
    "id": "ref-genetique-heredite",
    "topicId": "diversity",
    "title": "Génétique et hérédité du cannabis",
    "lead": "Les caractères du cannabis résultent de son patrimoine génétique, de son développement et de son environnement. La génétique décrit à la fois les versions des séquences, leur transmission et la diversité des génomes.",
    "image": BOTANY_IMAGE,
    "sections": [
      {
        "id": "ref-genetique-heredite-alleles",
        "title": "Allèles, génotype et phénotype",
        "paragraphs": [
          "Un allèle est une version d’une séquence à une position du génome. À un locus diploïde ordinaire, deux copies identiques correspondent à l’homozygotie et deux copies différentes à l’hétérozygotie. Le génotype décrit la composition génétique considérée ; le phénotype rassemble les caractères observables, auxquels l’environnement contribue également."
        ],
        "sourceIds": [
          "botany-diversity-allele",
          "botany-diversity-genotype",
          "botany-diversity-phenotype"
        ]
      },
      {
        "id": "ref-genetique-heredite-generations",
        "title": "Générations et recombinaison",
        "paragraphs": [
          "F1 désigne une première génération filiale issue de parents définis ; F2 désigne la génération suivante selon le dispositif de reproduction. La ségrégation et la recombinaison redistribuent les combinaisons génétiques. L’introgression correspond à l’incorporation durable de matériel génétique d’une population dans une autre après des hybridations et des transmissions."
        ],
        "sourceIds": [
          "botany-diversity-f1f2",
          "botany-diversity-introgression"
        ]
      },
      {
        "id": "ref-genetique-heredite-pangenome",
        "title": "Du génome au pangénome",
        "paragraphs": [
          "Un génome de référence ne contient pas toutes les variations présentes dans une espèce. Un pangénome réunit des séquences partagées et variables provenant de plusieurs matériels. Les assemblages, individus et haplotypes sont des unités différentes : un individu diploïde peut fournir deux versions d’une région. Les pangénomes du cannabis décrivent notamment une importante diversité structurale."
        ],
        "sourceIds": [
          "botany-diversity-lynch2025",
          "botany-diversity-pike2026"
        ]
      }
    ],
    "sourceIds": [
      "botany-diversity-allele",
      "botany-diversity-genotype",
      "botany-diversity-phenotype",
      "botany-diversity-f1f2",
      "botany-diversity-introgression",
      "botany-diversity-lynch2025",
      "botany-diversity-pike2026"
    ],
    "relatedArticleIds": [
      "ref-cultivars-clones",
      "ref-reproduction",
      "ref-populations-domestication"
    ],
    "glossaryIds": [
      "botany-allele",
      "botany-genotype",
      "botany-phenotype",
      "botany-heterozygosity",
      "botany-f1",
      "botany-f2",
      "botany-introgression",
      "botany-pangenome",
      "botany-haplotype"
    ],
    "legacyPassages": [
      {
        "courseId": "plant",
        "passageId": "botany-genetics-1"
      },
      {
        "courseId": "plant",
        "passageId": "botany-genetics-2"
      },
      {
        "courseId": "plant",
        "passageId": "botany-diversity-2"
      }
    ]
  },
  {
    "id": "ref-noms-lignees",
    "topicId": "diversity",
    "title": "Les noms et lignées du cannabis cultivé",
    "lead": "Haze, Skunk, Kush, White Widow ou Cookies sont des noms associés à des histoires de sélection et de circulation. Un même nom peut désigner plusieurs versions commerciales dont les origines déclarées diffèrent.",
    "image": BOTANY_IMAGE,
    "sections": [
      {
        "id": "ref-noms-lignees-appellations",
        "title": "Des noms à plusieurs usages",
        "paragraphs": [
          "Une appellation peut renvoyer à un clone, à une population, à une sélection particulière ou à une famille de produits. Les études génétiques de matériels commerciaux constatent une cohérence variable entre les noms et les échantillons. La répétition d’un nom ne correspond donc pas toujours à une identité génétique constante, ni à une composition chimique unique."
        ],
        "sourceIds": [
          "botany-diversity-sawler",
          "botany-diversity-schwabe"
        ]
      },
      {
        "id": "ref-noms-lignees-pedigrees",
        "title": "Des filiations attribuées",
        "paragraphs": [
          "Le pedigree représente une descendance. En novembre 2015, Resin Seeds a corrigé la parenté annoncée de Cannatonic : Reina Madre × NYCD remplaçait MK-Ultra × G13. Cette déclaration documente la version de l’obtenteur. Elle demeure distincte d’une analyse indépendante de parentage réalisée sur des échantillons identifiés."
        ],
        "sourceIds": [
          "botany-diversity-cannatonic"
        ]
      },
      {
        "id": "ref-noms-lignees-versions",
        "title": "Les versions d’une sélection",
        "paragraphs": [
          "La White Widow de Trikoma est présentée comme Widow Bilbo × Widow BCN. Cette filiation concerne une version nommée, et non tous les matériels appelés White Widow. Les catégories commerciales indica, sativa et hybride ont également une correspondance génétique variable. Une parenté déclarée ne fixe pas à elle seule les caractères ou les concentrations d’un lot."
        ],
        "sourceIds": [
          "botany-diversity-widow",
          "botany-diversity-schwabe"
        ]
      }
    ],
    "sourceIds": [
      "botany-diversity-sawler",
      "botany-diversity-schwabe",
      "botany-diversity-cannatonic",
      "botany-diversity-widow"
    ],
    "relatedArticleIds": [
      "ref-cultivars-clones",
      "ref-taxonomie-cannabis",
      "ref-genetique-heredite"
    ],
    "glossaryIds": [
      "botany-pedigree",
      "botany-cultivar",
      "botany-genotype"
    ],
    "legacyPassages": [
      {
        "courseId": "plant",
        "passageId": "botany-taxonomy-2"
      },
      {
        "courseId": "plant",
        "passageId": "botany-modern-lineages-1"
      },
      {
        "courseId": "plant",
        "passageId": "botany-modern-lineages-2"
      }
    ]
  },
  {
    "id": "ref-terpenes-terpenoides",
    "topicId": "terpenes",
    "title": "Terpènes et terpénoïdes",
    "lead": "Les terpènes constituent une grande famille de composés organiques dont les squelettes carbonés sont liés à des unités à cinq carbones. Plusieurs de ces molécules participent aux profils volatils du cannabis.",
    "image": TERPENE_IMAGE,
    "sections": [
      {
        "id": "ref-terpenes-terpenoides-familles",
        "title": "Les principales classes",
        "paragraphs": [
          "Les monoterpènes possèdent un squelette à dix carbones et les sesquiterpènes un squelette à quinze carbones. Le limonène et les pinènes appartiennent aux monoterpènes ; le β-caryophyllène et l’humulène sont des sesquiterpènes. Ces catégories décrivent une organisation chimique, et non une famille d’odeurs ou un effet pharmacologique."
        ],
        "sourceIds": [
          "terpenes-lesson-terpenes",
          "terpenes-lesson-booth2017"
        ]
      },
      {
        "id": "ref-terpenes-terpenoides-oxygenes",
        "title": "Les dérivés oxygénés",
        "paragraphs": [
          "Dans la convention chimique retenue par l’IUPAC, les terpènes sont des hydrocarbures, tandis que les terpénoïdes comprennent des dérivés oxygénés ou autrement modifiés. Le linalol, de formule C10H18O, est un monoterpénoïde portant une fonction alcool. La seule présence d’oxygène ne suffit toutefois pas à rattacher une molécule à cette famille."
        ],
        "sourceIds": [
          "terpenes-lesson-terpenoids",
          "terpenes-lesson-linalool"
        ]
      },
      {
        "id": "ref-terpenes-terpenoides-isomeres",
        "title": "Les isomères",
        "paragraphs": [
          "Deux molécules peuvent partager une formule brute tout en différant par leurs liaisons ou leur arrangement spatial. Les formes α et β du pinène ne sont pas interchangeables ; les énantiomères correspondent à des configurations images l’une de l’autre dans un miroir. Ces différences structurales peuvent modifier les propriétés des composés, y compris leurs interactions avec les systèmes sensoriels."
        ],
        "sourceIds": [
          "terpenes-lesson-enantiomer",
          "terpenes-lesson-booth2017",
          "terpenes-lesson-rice2015"
        ]
      }
    ],
    "sourceIds": [
      "terpenes-lesson-terpenes",
      "terpenes-lesson-booth2017",
      "terpenes-lesson-terpenoids",
      "terpenes-lesson-linalool",
      "terpenes-lesson-enantiomer",
      "terpenes-lesson-rice2015"
    ],
    "relatedArticleIds": [
      "ref-biosynthese-terpenes",
      "ref-odeur-cannabis",
      "ref-volatils-non-terpeniques"
    ],
    "glossaryIds": [
      "terpenes-term-terpene",
      "terpenes-term-terpenoid",
      "terpenes-term-monoterpene",
      "terpenes-term-sesquiterpene",
      "terpenes-term-isomer",
      "terpenes-term-enantiomer"
    ],
    "legacyPassages": [
      {
        "courseId": "molecules",
        "passageId": "terpenes-vocabulary-2"
      },
      {
        "courseId": "molecules",
        "passageId": "terpenes-chemistry-1"
      },
      {
        "courseId": "molecules",
        "passageId": "terpenes-chemistry-2"
      },
      {
        "courseId": "molecules",
        "passageId": "terpenes-classes-1"
      },
      {
        "courseId": "molecules",
        "passageId": "molecules-1"
      }
    ]
  },
  {
    "id": "ref-biosynthese-terpenes",
    "topicId": "terpenes",
    "title": "La biosynthèse des terpènes",
    "lead": "La biosynthèse des terpènes repose sur des voies enzymatiques qui transforment des précurseurs carbonés en molécules spécialisées. Chez le cannabis, plusieurs terpène synthases ont été caractérisées dans des matériels végétaux identifiés.",
    "image": TERPENE_IMAGE,
    "sections": [
      {
        "id": "ref-biosynthese-terpenes-precurseurs",
        "title": "Des précurseurs communs",
        "paragraphs": [
          "Le géranyl diphosphate est un précurseur des monoterpènes et le farnésyl diphosphate de nombreux sesquiterpènes. Les terpène synthases transforment ces substrats en structures différentes. La diversité des squelettes produits résulte ainsi de réactions enzymatiques, et non d’une simple accumulation de molécules déjà présentes dans l’air environnant."
        ],
        "sourceIds": [
          "terpenes-lesson-booth2017",
          "tp-booth2017"
        ]
      },
      {
        "id": "ref-biosynthese-terpenes-enzymes",
        "title": "Des enzymes à plusieurs produits",
        "paragraphs": [
          "Une terpène synthase ne produit pas nécessairement une seule substance. Certaines enzymes caractérisées chez Cannabis sativa donnent plusieurs produits à partir d’un même substrat. Inversement, des voies différentes peuvent contribuer à un profil chimique. La présence d’un gène de synthase ne correspond donc pas à une proportion fixe du composé dans tous les organes."
        ],
        "sourceIds": [
          "terpenes-lesson-booth2017",
          "tp-booth2020"
        ]
      },
      {
        "id": "ref-biosynthese-terpenes-glandes",
        "title": "Production et développement",
        "paragraphs": [
          "Les trichomes glandulaires participent à la production et à l’accumulation des métabolites spécialisés. L’expression des gènes, l’activité enzymatique et l’accumulation finale représentent des étapes distinctes. Les études du cannabis documentent des variations entre matériels et au cours du développement floral, associées à des changements de morphologie des glandes et de contenu chimique."
        ],
        "sourceIds": [
          "terpenes-lesson-livingston2020",
          "tp-zager2019",
          "tp-booth2020"
        ]
      }
    ],
    "sourceIds": [
      "terpenes-lesson-booth2017",
      "tp-booth2017",
      "tp-booth2020",
      "terpenes-lesson-livingston2020",
      "tp-zager2019"
    ],
    "relatedArticleIds": [
      "ref-trichomes",
      "ref-terpenes-terpenoides",
      "ref-profils-aromatiques"
    ],
    "glossaryIds": [
      "terpenes-term-biosynthesis",
      "terpenes-term-enzyme",
      "terpenes-term-trichome"
    ],
    "legacyPassages": [
      {
        "courseId": "molecules",
        "passageId": "terpenes-trichomes-2"
      },
      {
        "courseId": "molecules",
        "passageId": "molecules-2"
      }
    ]
  },
  {
    "id": "ref-odeur-cannabis",
    "topicId": "terpenes",
    "title": "L’odeur du cannabis",
    "lead": "L’odeur du cannabis résulte de la perception d’un mélange de molécules volatiles. Les terpènes y contribuent, aux côtés d’autres familles chimiques, et leur abondance ne suffit pas à déterminer l’impression olfactive.",
    "image": TERPENE_IMAGE,
    "sections": [
      {
        "id": "ref-odeur-cannabis-perception",
        "title": "La perception d’un mélange",
        "paragraphs": [
          "Les molécules odorantes interagissent avec le système olfactif. Une note citronnée, florale ou boisée est un descripteur de perception, pas l’identité d’une substance unique. Dans un mélange, les constituants peuvent être difficiles à reconnaître séparément ; une impression globale peut apparaître sans qu’une nouvelle molécule ait été formée."
        ],
        "sourceIds": [
          "terpenes-lesson-olfaction",
          "terpenes-lesson-laing1989",
          "terpenes-lesson-jinks2001"
        ]
      },
      {
        "id": "ref-odeur-cannabis-seuils",
        "title": "Concentration et seuil olfactif",
        "paragraphs": [
          "Le seuil olfactif est une concentration repère de détection dans des conditions définies. Une substance peu abondante peut contribuer fortement à l’odeur si son seuil est faible. Le rapport entre concentration et seuil, appelé valeur d’activité odorante, dépend du milieu et des unités utilisés. Il ne résume pas toutes les interactions sensorielles du mélange."
        ],
        "sourceIds": [
          "terpenes-lesson-rice2015"
        ]
      },
      {
        "id": "ref-odeur-cannabis-pharmacologie",
        "title": "Odeur et effets pharmacologiques",
        "paragraphs": [
          "Une odeur d’agrumes ne constitue pas un effet anxiolytique. Dans un essai humain publié en 2024, le d-limonène associé au THC a atténué certains effets anxieux aigus dans les conditions étudiées. Un essai de 2025 sur l’α-pinène n’a pas retrouvé la protection cognitive attendue contre le THC. Ces résultats ne caractérisent pas automatiquement les fleurs portant une description olfactive comparable."
        ],
        "sourceIds": [
          "terpenes-lesson-spindle2024",
          "terpenes-lesson-kumar2025"
        ]
      }
    ],
    "sourceIds": [
      "terpenes-lesson-olfaction",
      "terpenes-lesson-laing1989",
      "terpenes-lesson-jinks2001",
      "terpenes-lesson-rice2015",
      "terpenes-lesson-spindle2024",
      "terpenes-lesson-kumar2025"
    ],
    "relatedArticleIds": [
      "ref-volatils-non-terpeniques",
      "ref-profils-aromatiques",
      "ref-terpenes-terpenoides"
    ],
    "glossaryIds": [
      "terpenes-term-odor",
      "terpenes-term-mixture",
      "terpenes-term-threshold",
      "terpenes-term-oav",
      "terpenes-term-masking"
    ],
    "legacyPassages": [
      {
        "courseId": "molecules",
        "passageId": "terpenes-vocabulary-1"
      },
      {
        "courseId": "molecules",
        "passageId": "terpenes-mixtures-1"
      },
      {
        "courseId": "molecules",
        "passageId": "terpenes-mixtures-2"
      },
      {
        "courseId": "molecules",
        "passageId": "terpenes-claims-1"
      },
      {
        "courseId": "molecules",
        "passageId": "terpenes-claims-2"
      },
      {
        "courseId": "molecules",
        "passageId": "molecules-4"
      }
    ]
  },
  {
    "id": "ref-profils-aromatiques",
    "topicId": "terpenes",
    "title": "Les profils de composés volatils",
    "lead": "Un profil chimique décrit les composés retrouvés dans un échantillon et leurs quantités ou proportions. Le profil des volatils du cannabis dépend du matériel, de sa préparation et de la fraction analysée.",
    "image": TERPENE_IMAGE,
    "sections": [
      {
        "id": "ref-profils-aromatiques-quantites",
        "title": "Quantités et proportions",
        "paragraphs": [
          "Une concentration exprime une quantité de composé rapportée à une masse ou à un volume. Une proportion relative décrit sa place dans un ensemble choisi. Deux échantillons peuvent conserver les mêmes proportions tout en présentant des concentrations différentes. Un total normalisé à 100 % représente uniquement les composés inclus dans ce calcul."
        ],
        "sourceIds": [
          "terpenes-lesson-sumner2007",
          "terpenes-lesson-rice2015"
        ]
      },
      {
        "id": "ref-profils-aromatiques-matrices",
        "title": "Matière et espace de tête",
        "paragraphs": [
          "L’espace de tête est la phase gazeuse située au-dessus d’un échantillon. Sa composition reflète le passage des substances vers l’air et n’est pas une copie directe de leurs proportions dans la matière. Une fleur séchée, un extrait et son espace de tête constituent ainsi des matrices distinctes pour les composés volatils."
        ],
        "sourceIds": [
          "terpenes-lesson-rice2015",
          "tp-ovidi2022",
          "tp-janta2024"
        ]
      },
      {
        "id": "ref-profils-aromatiques-variations",
        "title": "Des profils variables",
        "paragraphs": [
          "Les études du cannabis décrivent des variations de terpènes entre matériels végétaux et entre stades de développement. Les réseaux de gènes et les activités des synthases participent à ces différences. Un nom de cultivar ne correspond donc pas à un profil immuable : les constituants d’un échantillon restent liés à son identité biologique et à son histoire."
        ],
        "sourceIds": [
          "tp-booth2020",
          "tp-zager2019",
          "terpenes-lesson-livingston2020"
        ]
      }
    ],
    "sourceIds": [
      "terpenes-lesson-sumner2007",
      "terpenes-lesson-rice2015",
      "tp-ovidi2022",
      "tp-janta2024",
      "tp-booth2020",
      "tp-zager2019",
      "terpenes-lesson-livingston2020"
    ],
    "relatedArticleIds": [
      "ref-odeur-cannabis",
      "ref-evolution-aromes",
      "ref-terpenes-terpenoides"
    ],
    "glossaryIds": [
      "terpenes-term-profile",
      "terpenes-term-concentration",
      "terpenes-term-relative",
      "terpenes-term-headspace"
    ],
    "legacyPassages": [
      {
        "courseId": "molecules",
        "passageId": "terpenes-profiles-1"
      },
      {
        "courseId": "molecules",
        "passageId": "terpenes-profiles-2"
      },
      {
        "courseId": "molecules",
        "passageId": "terpenes-identification-1"
      },
      {
        "courseId": "molecules",
        "passageId": "terpenes-identification-2"
      },
      {
        "courseId": "molecules",
        "passageId": "molecules-3"
      }
    ]
  },
  {
    "id": "ref-volatils-non-terpeniques",
    "topicId": "terpenes",
    "title": "Les composés odorants non terpéniques",
    "lead": "Les terpènes ne constituent qu’une partie des composés volatils associés au cannabis. Des molécules soufrées, des esters et d’autres familles chimiques contribuent également aux différences d’odeur entre les échantillons.",
    "image": TERPENE_IMAGE,
    "sections": [
      {
        "id": "ref-volatils-non-terpeniques-soufre",
        "title": "Les composés soufrés",
        "paragraphs": [
          "Des recherches ont identifié une famille de composés soufrés prénylés, dont le 3-méthylbut-2-ène-1-thiol, associé à une note dite skunk dans les matériels étudiés. Un thiol porte une fonction contenant du soufre. La présence d’un fragment prénylé ne transforme pas cette molécule en hydrocarbure terpénique : sa fonction chimique reste distincte."
        ],
        "sourceIds": [
          "terpenes-lesson-sulfur2021",
          "terpenes-lesson-terpenes"
        ]
      },
      {
        "id": "ref-volatils-non-terpeniques-autres",
        "title": "Esters et autres familles",
        "paragraphs": [
          "Les travaux sur certains extraits de cannabis décrivent notamment l’hexanoate de propyle, un ester, ainsi que le skatole, appartenant à la famille des indoles. Des aldéhydes et d’autres volatils figurent aussi dans les analyses. Une description fruitée ou soufrée peut résulter de plusieurs substances ou de leur combinaison."
        ],
        "sourceIds": [
          "terpenes-lesson-nonterpenes2023",
          "terpenes-lesson-rice2015"
        ]
      },
      {
        "id": "ref-volatils-non-terpeniques-melange",
        "title": "Une contribution parfois importante",
        "paragraphs": [
          "Une faible concentration n’implique pas une contribution olfactive négligeable, car les seuils de perception diffèrent entre molécules. Des profils ne portant que sur quelques terpènes laissent donc une partie du mélange non décrite. Les associations observées dans certains extraits ne constituent pas un marqueur universel d’une variété, et n’annulent pas le rôle des terpènes dans d’autres mélanges."
        ],
        "sourceIds": [
          "terpenes-lesson-nonterpenes2023",
          "terpenes-lesson-rice2015"
        ]
      }
    ],
    "sourceIds": [
      "terpenes-lesson-sulfur2021",
      "terpenes-lesson-terpenes",
      "terpenes-lesson-nonterpenes2023",
      "terpenes-lesson-rice2015"
    ],
    "relatedArticleIds": [
      "ref-odeur-cannabis",
      "ref-terpenes-terpenoides",
      "ref-profils-aromatiques"
    ],
    "glossaryIds": [
      "terpenes-term-thiol",
      "terpenes-term-ester",
      "terpenes-term-aldehyde",
      "terpenes-term-indole"
    ],
    "legacyPassages": [
      {
        "courseId": "molecules",
        "passageId": "terpenes-classes-2"
      },
      {
        "courseId": "molecules",
        "passageId": "terpenes-non-terpenes-1"
      },
      {
        "courseId": "molecules",
        "passageId": "terpenes-non-terpenes-2"
      }
    ]
  },
  {
    "id": "ref-evolution-aromes",
    "topicId": "terpenes",
    "title": "L’évolution des composés aromatiques",
    "lead": "Le profil volatil d’une matière végétale peut évoluer par transfert vers l’air et par réactions chimiques. L’évaporation, l’ébullition et l’oxydation correspondent à des phénomènes différents qui peuvent contribuer à ces changements.",
    "image": TERPENE_IMAGE,
    "sections": [
      {
        "id": "ref-evolution-aromes-evaporation",
        "title": "Le passage dans l’air",
        "paragraphs": [
          "L’évaporation se produit à la surface d’une matière liquide sans nécessiter son ébullition. La volatilité décrit sa tendance à passer dans la phase gazeuse. La composition de l’air au-dessus d’un échantillon dépend ainsi des substances présentes et de leurs transferts, pas seulement de leur proportion dans la matière d’origine."
        ],
        "sourceIds": [
          "terpenes-lesson-phase",
          "terpenes-lesson-rice2015"
        ]
      },
      {
        "id": "ref-evolution-aromes-oxydation",
        "title": "Les transformations chimiques",
        "paragraphs": [
          "Une oxydation modifie l’identité chimique et peut former de nouvelles espèces. Des travaux sur le d-limonène exposé à l’air ont identifié des produits d’oxydation, dont certains étaient sensibilisants dans les expériences animales réalisées. Cette transformation se distingue d’une simple perte de limonène par évaporation : les produits formés deviennent eux-mêmes des constituants du mélange."
        ],
        "sourceIds": [
          "terpenes-lesson-oxidation1992"
        ]
      },
      {
        "id": "ref-evolution-aromes-temperature",
        "title": "Température et composition",
        "paragraphs": [
          "Le point d’ébullition d’une substance pure décrit une propriété physique dans des conditions déterminées. Dans un mélange, les transferts et les réactions ne se réduisent pas à cette valeur. Des expériences de chauffage de terpènes ont observé des produits de dégradation ; une analyse de la matière initiale ne décrit donc pas nécessairement toutes les substances présentes après transformation."
        ],
        "sourceIds": [
          "terpenes-lesson-phase",
          "terpenes-lesson-thermal2017"
        ]
      }
    ],
    "sourceIds": [
      "terpenes-lesson-phase",
      "terpenes-lesson-rice2015",
      "terpenes-lesson-oxidation1992",
      "terpenes-lesson-thermal2017"
    ],
    "relatedArticleIds": [
      "ref-profils-aromatiques",
      "ref-odeur-cannabis",
      "ref-terpenes-terpenoides"
    ],
    "glossaryIds": [
      "terpenes-term-volatility",
      "terpenes-term-evaporation",
      "terpenes-term-boiling",
      "terpenes-term-oxidation",
      "terpenes-term-degradation"
    ],
    "legacyPassages": [
      {
        "courseId": "molecules",
        "passageId": "terpenes-transformation-1"
      },
      {
        "courseId": "molecules",
        "passageId": "terpenes-transformation-2"
      }
    ]
  },
  {
    "id": "ref-phytocannabinoides",
    "topicId": "cannabinoids",
    "title": "Les phytocannabinoïdes",
    "lead": "Les phytocannabinoïdes sont des cannabinoïdes associés au règne végétal, particulièrement étudiés chez Cannabis sativa. Ils constituent un ensemble de molécules distinctes comprenant notamment les familles THC, CBD, CBG et CBC.",
    "image": CANNABINOID_IMAGE,
    "sections": [
      {
        "id": "ref-phytocannabinoides-plante",
        "title": "Des métabolites spécialisés",
        "paragraphs": [
          "Les tissus glandulaires du cannabis participent à la formation et à l’accumulation de cannabinoïdes. Dans les voies végétales caractérisées, plusieurs composés sont produits sous une forme acide, comme le THCA ou le CBDA. Les proportions diffèrent selon le matériel et les transformations survenues après sa formation ; tous les organes ne présentent pas une composition identique."
        ],
        "sourceIds": [
          "bf-trichomes-2020",
          "cb-kim-2022"
        ]
      },
      {
        "id": "ref-phytocannabinoides-structures",
        "title": "Des identités chimiques distinctes",
        "paragraphs": [
          "THC, THCA et THCP ne sont pas des noms interchangeables. Ils diffèrent notamment par des fonctions chimiques ou la longueur d’une chaîne latérale. Les isomères se distinguent par l’organisation de leurs atomes, tandis que les homologues présentent une parenté structurale avec des variations de leur squelette. Ces différences peuvent modifier leurs propriétés biologiques."
        ],
        "sourceIds": [
          "cb-kim-2022",
          "cb-citti-2019",
          "cb-thcab-1975"
        ]
      },
      {
        "id": "ref-phytocannabinoides-origines",
        "title": "Molécule et origine",
        "paragraphs": [
          "Le terme phytocannabinoïde décrit une relation à une présence végétale. Une même identité chimique peut aussi être obtenue par synthèse. À l’inverse, les endocannabinoïdes sont des messagers produits par l’organisme, comme l’anandamide. L’identité d’une substance et le procédé dont provient un produit sont donc deux caractéristiques différentes."
        ],
        "sourceIds": [
          "cb-dronabinol",
          "cb-anandamide-1992",
          "cb-euda-2023"
        ]
      }
    ],
    "sourceIds": [
      "bf-trichomes-2020",
      "cb-kim-2022",
      "cb-citti-2019",
      "cb-thcab-1975",
      "cb-dronabinol",
      "cb-anandamide-1992",
      "cb-euda-2023"
    ],
    "relatedArticleIds": [
      "ref-biosynthese-cannabinoides",
      "ref-formes-acides-neutres",
      "ref-systeme-endocannabinoide"
    ],
    "glossaryIds": [
      "cannabinoids-term-phyto",
      "cannabinoids-term-isomer",
      "cannabinoids-term-homologue",
      "cannabinoids-term-endo"
    ],
    "legacyPassages": [
      {
        "courseId": "evidence",
        "passageId": "cannabinoids-origins-1"
      },
      {
        "courseId": "evidence",
        "passageId": "cannabinoids-identity-1"
      },
      {
        "courseId": "evidence",
        "passageId": "cannabinoids-identity-2"
      },
      {
        "courseId": "evidence",
        "passageId": "evidence-1"
      }
    ]
  },
  {
    "id": "ref-biosynthese-cannabinoides",
    "topicId": "cannabinoids",
    "title": "La biosynthèse des cannabinoïdes",
    "lead": "La plante forme ses cannabinoïdes par un réseau de réactions enzymatiques. Le CBGA, acide cannabigérolique, constitue un point de branchement majeur vers plusieurs familles de cannabinoïdes acides.",
    "image": CANNABINOID_IMAGE,
    "sections": [
      {
        "id": "ref-biosynthese-cannabinoides-carrefour",
        "title": "Le rôle du CBGA",
        "paragraphs": [
          "Le CBGA sert de substrat commun à plusieurs synthases caractérisées chez Cannabis sativa. Il est distinct du CBG, sa forme neutre obtenue par décarboxylation. Le CBG n’est donc pas un précurseur neutre universel à partir duquel tous les autres cannabinoïdes apparaîtraient directement. Les transformations végétales portent sur des molécules et des fonctions chimiques précises."
        ],
        "sourceIds": [
          "cb-thcas-2004",
          "cb-cbdas-2007",
          "cannabinoids-lesson-decarb2016"
        ]
      },
      {
        "id": "ref-biosynthese-cannabinoides-branches",
        "title": "Trois branches principales",
        "paragraphs": [
          "La THCA synthase conduit au THCA, la CBDA synthase au CBDA et la CBCA synthase au CBCA. Ces relations constituent des branches parallèles, et non une succession obligatoire THCA, puis CBDA, puis CBCA. Les enzymes ne jouent pas le même rôle que les transformations ultérieures qui retirent le groupe carboxyle."
        ],
        "sourceIds": [
          "cb-thcas-2004",
          "cb-cbdas-2007",
          "cb-cbcas-1998"
        ]
      },
      {
        "id": "ref-biosynthese-cannabinoides-diversite",
        "title": "Biosynthèse et diversité chimique",
        "paragraphs": [
          "Les profils de cannabinoïdes varient entre matériels végétaux. Les gènes correspondants, leur expression et l’accumulation des produits participent à cette diversité. D’autres branches concernent les homologues variniques. Des voies reconstruites dans une levure ont notamment produit THCVA et CBDVA, dans un contexte biologique différent de celui d’une plante intacte."
        ],
        "sourceIds": [
          "cb-kim-2022",
          "cb-luo-2019",
          "cb-propyl-1977"
        ]
      }
    ],
    "sourceIds": [
      "cb-thcas-2004",
      "cb-cbdas-2007",
      "cannabinoids-lesson-decarb2016",
      "cb-cbcas-1998",
      "cb-kim-2022",
      "cb-luo-2019",
      "cb-propyl-1977"
    ],
    "relatedArticleIds": [
      "ref-trichomes",
      "ref-formes-acides-neutres",
      "ref-cannabinoides-mineurs"
    ],
    "glossaryIds": [
      "cannabinoids-term-biosynthesis",
      "cannabinoids-term-precursor",
      "cannabinoids-term-enzyme"
    ],
    "legacyPassages": [
      {
        "courseId": "evidence",
        "passageId": "cannabinoids-biosynthesis-1"
      }
    ]
  },
  {
    "id": "ref-formes-acides-neutres",
    "topicId": "cannabinoids",
    "title": "Formes acides, formes neutres et transformations",
    "lead": "Les formes acides et neutres des cannabinoïdes sont des identités chimiques différentes. La décarboxylation relie plusieurs paires, notamment THCA–THC, CBDA–CBD et CBGA–CBG.",
    "image": CANNABINOID_IMAGE,
    "sections": [
      {
        "id": "ref-formes-acides-neutres-decarboxylation",
        "title": "La décarboxylation",
        "paragraphs": [
          "Cette réaction retire un groupe carboxyle sous forme de dioxyde de carbone. Elle modifie donc la structure et la masse de la molécule : elle ne correspond pas à une simple concentration du même composé. Des réactions concurrentes ou des pertes peuvent accompagner la transformation, si bien que la disparition d’un acide ne produit pas nécessairement une récupération complète de son homologue neutre."
        ],
        "sourceIds": [
          "cannabinoids-lesson-decarb2016"
        ]
      },
      {
        "id": "ref-formes-acides-neutres-activite",
        "title": "Des propriétés distinctes",
        "paragraphs": [
          "Le mot neutre décrit ici l’absence de la fonction acide considérée ; il ne signifie pas inoffensif. Les formes acides ne sont pas non plus toutes biologiquement inertes. Le THCA a notamment montré une activité sur PPARγ dans des cellules et dans un modèle murin, sans que cela constitue une indication thérapeutique humaine."
        ],
        "sourceIds": [
          "cannabinoids-lesson-thca2017",
          "cannabinoids-lesson-decarb2016"
        ]
      },
      {
        "id": "ref-formes-acides-neutres-vieillissement",
        "title": "Le vieillissement chimique",
        "paragraphs": [
          "Le THC peut participer à des transformations oxydatives conduisant au CBN. Ce phénomène est différent de la décarboxylation du THCA. La composition initiale et l’histoire de conservation influencent les quantités observées : le rapport CBN/THC n’est pas une horloge universelle. Le métabolisme humain du THC constitue encore une autre série de transformations."
        ],
        "sourceIds": [
          "cannabinoids-lesson-aging2019",
          "cannabinoids-lesson-metabolism2017"
        ]
      }
    ],
    "sourceIds": [
      "cannabinoids-lesson-decarb2016",
      "cannabinoids-lesson-thca2017",
      "cannabinoids-lesson-aging2019",
      "cannabinoids-lesson-metabolism2017"
    ],
    "relatedArticleIds": [
      "ref-biosynthese-cannabinoides",
      "ref-thc",
      "ref-cbd"
    ],
    "glossaryIds": [
      "cannabinoids-term-carboxyl",
      "cannabinoids-term-decarboxylation",
      "cannabinoids-term-neutral",
      "cannabinoids-term-oxidation"
    ],
    "legacyPassages": [
      {
        "courseId": "evidence",
        "passageId": "cannabinoids-acid-forms-1"
      },
      {
        "courseId": "evidence",
        "passageId": "cannabinoids-acid-forms-2"
      },
      {
        "courseId": "evidence",
        "passageId": "cannabinoids-aging-1"
      }
    ]
  },
  {
    "id": "ref-thc",
    "topicId": "cannabinoids",
    "title": "Le Δ9-THC",
    "lead": "Le Δ9-tétrahydrocannabinol, généralement abrégé THC, est un cannabinoïde associé aux effets intoxicants du cannabis. Le signe Δ9 précise la position d’une double liaison dans sa structure.",
    "image": CANNABINOID_IMAGE,
    "sections": [
      {
        "id": "ref-thc-identite",
        "title": "Identité et origine",
        "paragraphs": [
          "Le Δ9-THC est une forme neutre qui peut provenir de la décarboxylation du THCA. Il est distinct du Δ8-THC, du THCP et des formes acides. Le dronabinol désigne une substance pharmaceutique définie correspondant au Δ9-THC ; cette désignation ne décrit pas indistinctement tous les extraits ou préparations de cannabis."
        ],
        "sourceIds": [
          "cb-dronabinol",
          "cb-kim-2022",
          "cb-citti-2019"
        ]
      },
      {
        "id": "ref-thc-effets",
        "title": "Action et effets",
        "paragraphs": [
          "Le THC interagit avec les récepteurs cannabinoïdes, notamment CB1, important dans le système nerveux. Ses effets dépendent de l’exposition et du contexte individuel. Les notices pharmaceutiques décrivent notamment des altérations cognitives et motrices, des effets psychiatriques et des effets cardiovasculaires. Ces risques ne sont pas déterminés par le seul nom d’une variété."
        ],
        "sourceIds": [
          "cannabinoids-lesson-iuphar",
          "cb-dronabinol"
        ]
      },
      {
        "id": "ref-thc-metabolisme",
        "title": "Le métabolisme du THC",
        "paragraphs": [
          "L’organisme transforme le THC en plusieurs métabolites. Le 11-hydroxy-THC conserve une activité biologique ; le THC-COOH est une autre identité, différente du THCA végétal. La voie d’exposition et la matrice biologique influencent les concentrations mesurées. Une concentration dans le sang ou le liquide oral ne représente donc pas à elle seule l’ensemble des effets ressentis ou fonctionnels."
        ],
        "sourceIds": [
          "cb-dronabinol",
          "cannabinoids-lesson-metabolism2017",
          "cb-metabolism-2019"
        ]
      }
    ],
    "sourceIds": [
      "cb-dronabinol",
      "cb-kim-2022",
      "cb-citti-2019",
      "cannabinoids-lesson-iuphar",
      "cannabinoids-lesson-metabolism2017",
      "cb-metabolism-2019"
    ],
    "relatedArticleIds": [
      "ref-formes-acides-neutres",
      "ref-systeme-endocannabinoide",
      "ref-cbd"
    ],
    "glossaryIds": [
      "cannabinoids-term-metabolism",
      "cannabinoids-term-metabolite",
      "cannabinoids-term-receptor",
      "cannabinoids-term-pharmacokinetics"
    ],
    "legacyPassages": [
      {
        "courseId": "evidence",
        "passageId": "cannabinoids-metabolism-1"
      },
      {
        "courseId": "evidence",
        "passageId": "cannabinoids-metabolism-2"
      }
    ]
  },
  {
    "id": "ref-cbd",
    "topicId": "cannabinoids",
    "title": "Le cannabidiol ou CBD",
    "lead": "Le cannabidiol, ou CBD, est un phytocannabinoïde distinct du THC. Il partage avec lui une formule brute, mais possède une organisation moléculaire et des propriétés pharmacologiques différentes.",
    "image": CANNABINOID_IMAGE,
    "sections": [
      {
        "id": "ref-cbd-structure",
        "title": "Structure et forme acide",
        "paragraphs": [
          "Le CBDA est la forme acide apparentée au CBD. La CBDA synthase produit ce précurseur à partir du CBGA dans la voie végétale caractérisée ; sa décarboxylation conduit au CBD. Le CBD, le CBDA et le CBDP ne sont pas des identités interchangeables. Une préparation peut contenir plusieurs de ces composés et d’autres constituants."
        ],
        "sourceIds": [
          "cb-cbdas-2007",
          "cb-kim-2022",
          "cb-citti-2019"
        ]
      },
      {
        "id": "ref-cbd-medicament",
        "title": "Le CBD pharmaceutique",
        "paragraphs": [
          "Dans l’Union européenne, Epidyolex est un médicament à cannabidiol utilisé en complément d’autres traitements pour certaines épilepsies à partir de deux ans. Les indications comprennent les syndromes de Lennox–Gastaut et de Dravet, en association avec le clobazam, ainsi que la sclérose tubéreuse de Bourneville. Ces indications concernent une formulation pharmaceutique précise."
        ],
        "sourceIds": [
          "cb-epidyolex"
        ]
      },
      {
        "id": "ref-cbd-risques",
        "title": "Effets indésirables",
        "paragraphs": [
          "Le CBD ne produit pas l’intoxication caractéristique du THC, mais il n’est pas dépourvu d’effets ni de risques. Les données pharmaceutiques décrivent notamment somnolence, troubles digestifs, interactions médicamenteuses et atteintes hépatiques. La composition d’une huile ou d’un extrait commercial peut différer du médicament, y compris par la présence de THC ou d’autres constituants."
        ],
        "sourceIds": [
          "cb-epidyolex",
          "cb-kim-2022"
        ]
      }
    ],
    "sourceIds": [
      "cb-cbdas-2007",
      "cb-kim-2022",
      "cb-citti-2019",
      "cb-epidyolex"
    ],
    "relatedArticleIds": [
      "ref-biosynthese-cannabinoides",
      "ref-formes-acides-neutres",
      "ref-thc"
    ],
    "glossaryIds": [
      "cannabinoids-term-formulation",
      "cannabinoids-term-neutral",
      "cannabinoids-term-decarboxylation"
    ],
    "legacyPassages": [
      {
        "courseId": "evidence",
        "passageId": "cannabinoids-clinical-evidence-1"
      },
      {
        "courseId": "evidence",
        "passageId": "cannabinoids-clinical-evidence-2"
      },
      {
        "courseId": "evidence",
        "passageId": "evidence-2"
      },
      {
        "courseId": "evidence",
        "passageId": "evidence-3"
      }
    ]
  },
  {
    "id": "ref-systeme-endocannabinoide",
    "topicId": "cannabinoids",
    "title": "Le système endocannabinoïde",
    "lead": "Le système endocannabinoïde est un ensemble de messagers, de récepteurs et de voies métaboliques présents dans l’organisme. Son existence ne dépend pas de la présence de cannabis.",
    "image": CANNABINOID_IMAGE,
    "sections": [
      {
        "id": "ref-systeme-endocannabinoide-messagers",
        "title": "L’anandamide et le 2-AG",
        "paragraphs": [
          "L’anandamide, ou arachidonoyléthanolamide, et le 2-arachidonoylglycérol, abrégé 2-AG, sont deux messagers endogènes majeurs. L’anandamide a été isolée et décrite en 1992 ; des travaux de 1995 ont caractérisé le 2-AG dans des tissus animaux. Ce sont des médiateurs produits par l’organisme, et non des noms alternatifs du THC végétal."
        ],
        "sourceIds": [
          "cb-anandamide-1992",
          "cb-2ag-1995",
          "cb-2ag-gut-1995"
        ]
      },
      {
        "id": "ref-systeme-endocannabinoide-recepteurs",
        "title": "Les récepteurs CB1 et CB2",
        "paragraphs": [
          "CB1 et CB2 sont des récepteurs cannabinoïdes importants. CB1 joue notamment un rôle dans le système nerveux, tandis que CB2 est très étudié dans les cellules immunitaires. Ces localisations ne sont pas des frontières absolues entre organes. Les voies de formation et de dégradation des messagers participent également au fonctionnement du système."
        ],
        "sourceIds": [
          "cannabinoids-lesson-iuphar",
          "cannabinoids-lesson-cb11990",
          "cannabinoids-lesson-cb21993"
        ]
      },
      {
        "id": "ref-systeme-endocannabinoide-cibles",
        "title": "Des interactions diverses",
        "paragraphs": [
          "Les cannabinoïdes ne produisent pas tous la même activation d’une même cible. L’affinité de liaison et la réponse fonctionnelle sont des propriétés distinctes. D’autres cibles peuvent intervenir, notamment des canaux et des récepteurs nucléaires. L’activité du THCA étudiée sur PPARγ illustre cette diversité au-delà de CB1 et CB2."
        ],
        "sourceIds": [
          "cannabinoids-lesson-iuphar",
          "cannabinoids-lesson-thca2017"
        ]
      }
    ],
    "sourceIds": [
      "cb-anandamide-1992",
      "cb-2ag-1995",
      "cb-2ag-gut-1995",
      "cannabinoids-lesson-iuphar",
      "cannabinoids-lesson-cb11990",
      "cannabinoids-lesson-cb21993",
      "cannabinoids-lesson-thca2017"
    ],
    "relatedArticleIds": [
      "ref-thc",
      "ref-cbd",
      "ref-phytocannabinoides"
    ],
    "glossaryIds": [
      "cannabinoids-term-endo",
      "cannabinoids-term-receptor",
      "cannabinoids-term-affinity",
      "cannabinoids-term-agonist"
    ],
    "legacyPassages": [
      {
        "courseId": "evidence",
        "passageId": "cannabinoids-receptors-1"
      },
      {
        "courseId": "evidence",
        "passageId": "cannabinoids-receptors-2"
      }
    ]
  },
  {
    "id": "ref-cannabinoides-mineurs",
    "topicId": "cannabinoids",
    "title": "Les cannabinoïdes minoritaires",
    "lead": "L’expression cannabinoïdes minoritaires regroupe des composés souvent moins abondants ou moins étudiés que le THC et le CBD. Elle ne constitue pas une famille structurale unique et dépend du matériel considéré.",
    "image": CANNABINOID_IMAGE,
    "sections": [
      {
        "id": "ref-cannabinoides-mineurs-cbg-cbc",
        "title": "CBG et CBC",
        "paragraphs": [
          "Le CBG et le CBC sont des molécules distinctes appartenant à des familles présentes dans le cannabis. Leurs formes acides correspondantes sont le CBGA et le CBCA. Le CBGA joue un rôle de branchement dans plusieurs voies végétales ; le CBCA est notamment formé par la CBCA synthase. Ces relations ne rendent pas les propriétés des formes acides et neutres identiques."
        ],
        "sourceIds": [
          "cb-cbcas-1998",
          "cb-kim-2022",
          "cannabinoids-lesson-decarb2016"
        ]
      },
      {
        "id": "ref-cannabinoides-mineurs-variniques",
        "title": "Les homologues variniques",
        "paragraphs": [
          "Les cannabinoïdes variniques possèdent une chaîne latérale propyle, plus courte que la chaîne pentyle des homologues courants. Ils comprennent notamment THCV, CBDV, CBGV et CBCV, ainsi que des formes acides. Quatre acides variniques ont été isolés du matériel thaïlandais étudié par Shoyama et ses collègues en 1977."
        ],
        "sourceIds": [
          "cb-propyl-1977",
          "cb-propyl-1975"
        ]
      },
      {
        "id": "ref-cannabinoides-mineurs-chaines",
        "title": "THCP et CBDP",
        "paragraphs": [
          "Le THCP et le CBDP, identifiés dans un matériel végétal étudié en 2019, possèdent une chaîne latérale plus longue que celle du THC et du CBD. Les essais de liaison et les expériences animales publiés sur le THCP décrivent des propriétés particulières. Ils ne constituent pas une mesure de puissance clinique chez l’humain, ni une description des produits vendus sous ces noms."
        ],
        "sourceIds": [
          "cb-citti-2019"
        ]
      }
    ],
    "sourceIds": [
      "cb-cbcas-1998",
      "cb-kim-2022",
      "cannabinoids-lesson-decarb2016",
      "cb-propyl-1977",
      "cb-propyl-1975",
      "cb-citti-2019"
    ],
    "relatedArticleIds": [
      "ref-biosynthese-cannabinoides",
      "ref-phytocannabinoides",
      "ref-cannabinoides-transformes"
    ],
    "glossaryIds": [
      "cannabinoids-term-varinic",
      "cannabinoids-term-homologue",
      "cannabinoids-term-precursor"
    ],
    "legacyPassages": [
      {
        "courseId": "evidence",
        "passageId": "cannabinoids-biosynthesis-2"
      },
      {
        "courseId": "evidence",
        "passageId": "cannabinoids-reading-studies-1"
      },
      {
        "courseId": "evidence",
        "passageId": "cannabinoids-reading-studies-2"
      }
    ]
  },
  {
    "id": "ref-cannabinoides-transformes",
    "topicId": "cannabinoids",
    "title": "Les cannabinoïdes issus de transformations",
    "lead": "Des cannabinoïdes commercialisés sont obtenus par transformations chimiques ou par synthèse. Le nom de la molécule ne précise pas à lui seul l’origine de la matière première ni la composition du produit final.",
    "image": CANNABINOID_IMAGE,
    "sections": [
      {
        "id": "ref-cannabinoides-transformes-origine",
        "title": "Hémisynthèse et synthèse",
        "paragraphs": [
          "L’hémisynthèse transforme chimiquement un précurseur d’origine naturelle. Elle se distingue d’une extraction, qui transfère des constituants sans avoir pour objet de modifier leur identité moléculaire. Une substance également présente dans une plante peut donc provenir d’un procédé industriel. Le statut de phytocannabinoïde ne décrit pas automatiquement le parcours de chaque produit."
        ],
        "sourceIds": [
          "cb-euda-2023",
          "cb-unodc-2023"
        ]
      },
      {
        "id": "ref-cannabinoides-transformes-hydrogenes",
        "title": "HHC et dérivés hydrogénés",
        "paragraphs": [
          "Le HHC est apparenté au THC par une modification d’hydrogénation. Ses épimères présentent des activités différentes dans les systèmes expérimentaux étudiés. Le H4CBD est un autre dérivé hydrogéné, apparenté au CBD. Les proportions de stéréoisomères et les autres constituants peuvent différer entre produits portant un même nom générique."
        ],
        "sourceIds": [
          "cb-hhc-2023",
          "cb-h4cbd-2023",
          "cb-euda-2023"
        ]
      },
      {
        "id": "ref-cannabinoides-transformes-acetates",
        "title": "Les dérivés acétates",
        "paragraphs": [
          "Les acétates, comme le HHC-O, possèdent une modification chimique supplémentaire. Des expériences sur des acétates de Δ8-THC, de CBN et de CBD ont observé une formation de cétène dans certaines conditions de chauffage. Ce résultat concerne les composés testés ; il ne quantifie pas le risque individuel de chaque produit ni de tous les autres acétates."
        ],
        "sourceIds": [
          "cb-euda-2023",
          "cb-acetates-2022"
        ]
      }
    ],
    "sourceIds": [
      "cb-euda-2023",
      "cb-unodc-2023",
      "cb-hhc-2023",
      "cb-h4cbd-2023",
      "cb-acetates-2022"
    ],
    "relatedArticleIds": [
      "ref-phytocannabinoides",
      "ref-cannabinoides-mineurs",
      "ref-formes-acides-neutres"
    ],
    "glossaryIds": [
      "cannabinoids-term-hemisynthesis",
      "cannabinoids-term-synthesis",
      "cannabinoids-term-isomer"
    ],
    "legacyPassages": [
      {
        "courseId": "evidence",
        "passageId": "cannabinoids-origins-2"
      },
      {
        "courseId": "evidence",
        "passageId": "cannabinoids-aging-2"
      },
      {
        "courseId": "evidence",
        "passageId": "cannabinoids-emerging-products-1"
      },
      {
        "courseId": "evidence",
        "passageId": "cannabinoids-emerging-products-2"
      },
      {
        "courseId": "evidence",
        "passageId": "evidence-4"
      }
    ]
  }
];

