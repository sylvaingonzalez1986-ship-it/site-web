import type { CannabisReferenceArticle, CannabisTopicId } from './kanab-quest-cannabis-reference-types';
import { HEMP_QUIZ_EXPANSION_ARTICLE_SOURCES } from './kanab-quest-hemp-quiz-expansion-sources';

type Section = readonly [title: string, text: string];
function article(id: string, topicId: CannabisTopicId, title: string, lead: string, image: string, sections: readonly Section[], relatedArticleIds: readonly string[]): CannabisReferenceArticle {
  const sourceIds = HEMP_QUIZ_EXPANSION_ARTICLE_SOURCES[id] ?? [];
  return { id, topicId, title, lead,
    image: { src: image, alt: title, caption: 'Illustration de synthèse consacrée au chanvre.' },
    sections: sections.map(([heading, text], index) => ({ id: `${id}-${index + 1}`, title: heading, paragraphs: [text], sourceIds })),
    sourceIds, relatedArticleIds, glossaryIds: [], legacyPassages: [] };
}

/** Short factual companions to the new tournament questions, without course activities. */
export const CANNABIS_EXPANSION_ARTICLES: readonly CannabisReferenceArticle[] = [
  article('ref-histoire-culture', 'history', 'Écrivains, mots et voyages du chanvre',
    'Du Paris de Gautier aux toiles bretonnes, le chanvre a laissé des traces dans les mots, les objets et la littérature.',
    '/placard/school/course-history-v1.webp', [
      ['Le Club des Hachichins', 'Théophile Gautier publie Le Club des Hachichins dans la Revue des Deux Mondes en 1846. Son récit situe les soirées à l’hôtel Pimodan, aujourd’hui hôtel de Lauzun, sur l’île Saint-Louis. Le peintre Boissard et le médecin Moreau de Tours sont associés à ces rencontres. Charles Baudelaire consacre ensuite une partie des Paradis artificiels au haschisch.'],
      ['Le mot « marijuana »', 'Le français a emprunté ce mot à l’anglais des États-Unis, lui-même issu de l’espagnol du Mexique. Marihuana et mariguana sont des graphies attestées. L’origine plus ancienne du mot reste incertaine : le rapprochement populaire avec les prénoms María et Juana n’est pas une étymologie établie.'],
      ['Des toiles aux sépultures', 'Les noyales de Noyal-sur-Vilaine et les olonnes de Locronan sont des toiles de chanvre liées notamment à la marine. D’autres toiles bretonnes, comme les crées, sont en lin. Bien plus à l’est, les tombes de Yanghai ont conservé des restes de cannabis ; à Jirzankal, dans le Pamir, des résidus de cannabis ont été identifiés dans des braseros funéraires en bois.'],
    ], ['ref-histoire-politiques', 'ref-matieres-chanvre']),
  article('ref-histoire-politiques', 'history', 'Prohibition, guerre et changements de lois',
    'Les politiques du cannabis ont changé selon les pays et les époques. Quelques événements permettent de suivre ces changements.',
    '/placard/school/course-law-v1.webp', [
      ['Deux étapes américaines', 'Le Marihuana Tax Act de 1937 impose un dispositif fiscal et administratif aux opérations sur le cannabis. En 1970, le Controlled Substances Act réorganise le contrôle fédéral des substances. Entre ces deux dates, le film agricole Hemp for Victory encourage la production de chanvre pour les besoins de la Seconde Guerre mondiale.'],
      ['Les conventions internationales', 'La Convention unique de 1961 concerne les stupéfiants ; celle de 1971 porte sur les substances psychotropes ; celle de 1988 vise le trafic illicite. En décembre 2020, la Commission des stupéfiants retire le cannabis et sa résine du tableau IV de la Convention de 1961. Ils restent au tableau I : cette décision ne légalise pas le cannabis dans tous les pays.'],
      ['Des réformes nationales datées', 'L’Uruguay adopte en décembre 2013 la loi 19.172 organisant la régulation du cannabis. Au Canada, la Loi sur le cannabis entre en vigueur le 17 octobre 2018. Adoption, publication et entrée en vigueur sont des moments différents ; ces repères historiques ne décrivent pas à eux seuls toutes les règles applicables aujourd’hui.'],
    ], ['ref-histoire-culture', 'ref-decouvertes-cannabinoides']),
  article('ref-decouvertes-cannabinoides', 'cannabinoids', 'Les découvertes du système cannabinoïde',
    'L’identification des molécules végétales a précédé celle de leurs récepteurs et des molécules produites par notre organisme.',
    '/placard/school/course-evidence-v1.webp', [
      ['Du chanvre aux molécules', 'Au XIXe siècle, O’Shaughnessy décrit des préparations de chanvre indien dans ses travaux médicaux. Au XXe siècle, la chimie permet de distinguer plusieurs cannabinoïdes. Gaoni et Mechoulam publient en 1964 l’isolement et la structure du composé aujourd’hui appelé Δ9-THC. Ce travail est une étape de l’histoire du THC, pas la découverte de tous les usages du cannabis.'],
      ['Les récepteurs CB1 et CB2', 'Le clonage du récepteur aujourd’hui appelé CB1 est publié en 1990 ; celui de CB2 en 1993. Un récepteur est une protéine cellulaire, différente de la molécule qui s’y lie. Le système cannabinoïde participe à de nombreuses fonctions et ne se limite pas à une seule zone du corps.'],
      ['Les molécules produites dans le corps', 'L’anandamide est identifiée en 1992. Le 2-AG est décrit comme ligand cannabinoïde dans des publications de 1995. Ces endocannabinoïdes se distinguent des phytocannabinoïdes de la plante. Leur formation et leur dégradation font intervenir des enzymes ; la découverte d’un mécanisme ne signifie pas qu’un produit commercial a démontré un bénéfice médical.'],
    ], ['ref-histoire-politiques', 'ref-aromes-chanvre']),
  article('ref-diversite-chanvre', 'diversity', 'Les particularités du chanvre',
    'Feuilles, fleurs, fruits et variétés : le cannabis possède une diversité que son nom commercial ne résume pas.',
    '/placard/school/course-genetics-v1.webp', [
      ['Une plante, plusieurs organes', 'Le chanvre appartient aux Cannabaceae, comme le houblon. Ses feuilles composées portent des folioles dentées. Les fleurs mâles produisent le pollen ; les fleurs femelles portent les stigmates. Le petit fruit sec contient la graine appelée couramment chènevis.'],
      ['Des surfaces spécialisées', 'Les trichomes sont des structures de surface. Certains sont glandulaires et accumulent des composés aromatiques et des cannabinoïdes ; d’autres ne possèdent pas de tête sécrétrice. Leur forme et leur répartition changent selon l’organe et son développement.'],
      ['Populations et variétés', 'Des populations locales, des lignées sélectionnées et des cultivars répondent à des usages différents : fibres, graines ou autres débouchés autorisés. Un cultivar possède une histoire de sélection ; un clone descend d’une multiplication végétative. Les catégories commerciales indica et sativa ne garantissent ni une généalogie complète ni un effet ressenti.'],
    ], ['ref-aromes-chanvre', 'ref-matieres-chanvre']),
  article('ref-aromes-chanvre', 'terpenes', 'Les notes aromatiques du chanvre',
    'Agrumes, pin, fleurs, épices : plusieurs familles de molécules participent à la diversité des odeurs du cannabis.',
    '/placard/school/course-molecules-v1.webp', [
      ['Reconnaître des notes', 'Le limonène est associé à des notes d’agrumes, les pinènes à des notes de pin et le linalol à des notes florales. Ces descriptions sont des repères sensoriels : l’isomère, la concentration et le mélange modifient la perception. Une note citronnée n’annonce pas automatiquement un effet stimulant.'],
      ['Un bouquet de molécules', 'Le composé le plus abondant n’est pas forcément celui qui marque le plus le nez. Certains composés soufrés, esters et autres molécules minoritaires contribuent aussi au bouquet. Les terpènes restent importants, mais ne sont pas les seuls odorants.'],
      ['Des profils qui changent', 'Le profil d’une fleur dépend notamment de la plante et de son développement. Le séchage et la conservation peuvent modifier les composés volatils. Les cartes de terpènes de l’encyclopédie détaillent leurs notes, leurs familles chimiques et les données disponibles.'],
    ], ['ref-diversite-chanvre', 'ref-decouvertes-cannabinoides']),
  article('ref-matieres-chanvre', 'products', 'Du chanvre aux objets du quotidien',
    'Une même plante fournit plusieurs matières : fibres, chènevotte et graines alimentent des filières différentes.',
    '/placard/school/products/plate-v1.webp', [
      ['Les fibres', 'Les fibres périphériques de la tige servent notamment au textile, au papier et au renforcement de composites. Le rouissage facilite leur séparation ; le défibrage sépare les fractions de la tige. Filer, tisser et fabriquer du papier sont ensuite des transformations différentes.'],
      ['La chènevotte', 'La partie ligneuse intérieure fournit la chènevotte. Elle entre dans des litières et dans des matériaux de construction, notamment avec un liant à base de chaux. Un béton de chanvre courant remplit et isole une ossature : il ne remplace pas automatiquement une structure porteuse.'],
      ['Les graines', 'Le chènevis apporte des lipides et des protéines. Le pressage donne une huile de graines et un tourteau ; le décorticage retire l’enveloppe du fruit. Une huile alimentaire de graines n’est pas un extrait de fleurs enrichi en cannabinoïdes. Chaque matière possède ses propriétés et ses contrôles de qualité.'],
    ], ['ref-histoire-culture', 'ref-diversite-chanvre']),
];
