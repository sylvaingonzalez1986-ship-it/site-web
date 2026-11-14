import type { HistorySource } from './kanab-quest-school-history-types';
export const CULTIVATION_VISUAL_SOURCES: readonly HistorySource[] = [
  { id:'cultivation-visual-humidity',title:'Reducing Humidity in the Greenhouse',author:'UMass Extension, Greenhouse Crops and Floriculture Program',organization:'University of Massachusetts Amherst',published:'Date éditoriale non indiquée dans l’extrait consulté',url:'https://www.umass.edu/agriculture-food-environment/greenhouse-floriculture/fact-sheets/reducing-humidity-in-greenhouse',verifiedAt:'2026-11-12',passage:'Extraits indexés : transpiration dans le couvert, évaporation des surfaces humides, température des feuilles et point de rosée, échange d’air et circulation.',access:'excerpt',documentKind:'Fiche universitaire de vulgarisation technique',limitation:'Accès direct refusé (403) ; extraits indexés consultés. Principes généraux de serre, sans validation d’un réglage pour le chanvre.' },
  { id:'cultivation-visual-ventilation',title:'Greenhouse Ventilation — AE030',author:'UF/IFAS Extension',organization:'University of Florida',published:'Version en ligne consultée le 12 novembre 2026 ; date de révision non confirmée',url:'https://ask.ifas.ufl.edu/publication/AE030',verifiedAt:'2026-11-12',passage:'Extrait indexé : contrôle de la chaleur, de l’humidité et échanges gazeux ; condensation lorsque la surface est sous le point de rosée.',access:'excerpt',documentKind:'Fiche universitaire de vulgarisation technique',limitation:'Redirection empêchant la lecture intégrale ; aucun dimensionnement ni consigne de température n’est repris.' },
];
export const CULTIVATION_ENVIRONMENTS = [
  {id:'outdoor',label:'Plein champ',detail:'Atmosphère extérieure ; lumière et météo locales.'},
  {id:'greenhouse',label:'Serre',detail:'Couverture laissant passer la lumière ; contrôle variable.'},
  {id:'indoor',label:'Intérieur',detail:'Local fermé ; dans nos dossiers, éclairage artificiel principal.'},
] as const;
export const CULTIVATION_MEDIA = [
  {id:'soil',label:'Pleine terre',detail:'Racines en continuité avec le sol du lieu.'},
  {id:'substrate',label:'Hors-sol sur substrat',detail:'Volume de matériau racinaire distinct du sol du lieu.'},
  {id:'water',label:'Sans substrat solide',detail:'Racines dans une solution ou suspendues ; un support de plant reste possible.'},
] as const;
export const CULTIVATION_HOTSPOTS = [
  {id:'plants',label:'Les plantes',x:27,y:54,role:'Source de vapeur',text:'La transpiration des feuilles apporte de la vapeur d’eau. Un couvert dense peut garder une atmosphère plus humide localement.',question:'La mesure de l’air ambiant représente-t-elle aussi le cœur du couvert ?',sourceIds:['cultivation-visual-humidity']},
  {id:'floor',label:'Le sol mouillé',x:49,y:81,role:'Source possible de vapeur',text:'L’eau présente sur une surface peut s’évaporer. Une flaque invite à rechercher son origine ; l’image ne prouve ni une fuite ni un défaut de drainage.',question:'D’où vient l’eau et où peut-elle s’évacuer ?',sourceIds:['cultivation-visual-humidity']},
  {id:'glass',label:'La vitre froide',x:80,y:36,role:'Lieu de condensation',text:'Une surface sous le point de rosée de l’air peut recueillir de l’eau liquide. La vitre n’est pas une source de vapeur par le seul fait d’être froide.',question:'Quelle est la température de la surface, en plus de celle de l’air ?',sourceIds:['cultivation-visual-ventilation']},
  {id:'vent',label:'L’ouvrant',x:57,y:8,role:'Échange avec l’extérieur',text:'L’ouverture permet un renouvellement d’air. Son effet dépend de l’air extérieur et des échanges de chaleur ; ventiler n’assure pas toujours un assèchement.',question:'Connaît-on les conditions de l’air qui entre ?',sourceIds:['cultivation-visual-humidity','cultivation-visual-ventilation']},
  {id:'fan',label:'Le ventilateur',x:55,y:39,role:'Brassage de l’air',text:'Ce ventilateur intérieur redistribue l’air. Brasser et évacuer de la vapeur sont deux actions différentes : le brassage seul ne retire pas l’eau du bâtiment.',question:'L’air est-il seulement brassé ou aussi remplacé ?',sourceIds:['cultivation-visual-humidity','cultivation-visual-ventilation']},
  {id:'barrel',label:'La cuve de pluie',x:11,y:70,role:'Récupération à examiner',text:'La cuve extérieure illustre un stockage. Son volume, sa qualité d’eau et les besoins restent inconnus ; la récupération ne garantit pas une autonomie complète.',question:'Quelle quantité est réellement disponible, à quelle période et pour quel usage ?',sourceIds:[]},
] as const;
