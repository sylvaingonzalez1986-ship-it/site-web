/** Conceptual teaching aids. Numerical examples are fictitious, never recipes. */
export const PRODUCTS_GROUPS = [
  { id:'a', label:'Graines, fibres et matériaux', letter:'A', chapterIds:['seeds','fibres','materials'], question:'Quelle partie devient quel produit ?', next:'Une matière ou un produit formulé demande des contrôles adaptés.' },
  { id:'b', label:'Résines et produits formulés', letter:'B', chapterIds:['resins','labels'], question:'Que sépare ou transforme le procédé ?', next:'Le nom du procédé ne garantit ni composition ni innocuité.' },
  { id:'c', label:'Alimentation et inhalation', letter:'C', chapterIds:['food','exposure','quality'], question:'Pour quelle voie et avec quelles preuves ?', next:'L’identité, le lot et la voie doivent correspondre aux documents.' },
  { id:'d', label:'Origine des molécules et traçabilité', letter:'D', chapterIds:['origins','traceability'], question:'Que sait-on de cette molécule et de ce lot ?', next:'Revenir aux matières, aux transformations et aux contrôles pour décider.' },
] as const;
export const PRODUCTS_PLATE_POINTS = [
  {id:'seed',x:18,y:27,label:'Chènevis',text:'Le chènevis fournit une matière première pour des aliments, de l’huile et des fractions protéiques. Cette filière se distingue des extraits de cannabinoïdes.',lesson:'products-seeds-1',sourceIds:['products-tool-dgal-2026','products-tool-seed-protein']},
  {id:'oil',x:50,y:27,label:'Huile et tourteau',text:'La séparation d’une fraction huileuse laisse une matière solide : le tourteau. Ni une couleur dorée ni un nom ne donnent une teneur en cannabinoïdes.',lesson:'products-seeds-2',sourceIds:['products-tool-seed-protein']},
  {id:'stem',x:83,y:27,label:'Tige et fibres',text:'Les fibres libériennes proviennent de la partie externe de la tige. La partie ligneuse fournit notamment la chènevotte ; ce ne sont pas les mêmes fractions.',lesson:'products-fibres-1',sourceIds:['products-tool-fibres']},
  {id:'textile',x:18,y:73,label:'Fil et tissu',text:'La filature forme un fil à partir de fibres préparées. Le tissage entrecroise des fils. Toutes les qualités de fibres ne conviennent pas au même textile.',lesson:'products-fibres-2',sourceIds:['products-tool-textile']},
  {id:'material',x:50,y:73,label:'Chènevotte et matériau',text:'Des fragments ligneux peuvent entrer dans un matériau associé à un liant. La performance dépend de l’ensemble et de son emploi, pas du seul mot chanvre.',lesson:'products-materials-1',sourceIds:['products-tool-hempcrete']},
  {id:'control',x:83,y:73,label:'Échantillon et dossier',text:'Un échantillon et un rapport doivent être reliés au bon lot. Leur apparence ne suffit pas à établir la qualité, la traçabilité ou une voie d’usage.',lesson:'products-quality-2',sourceIds:['products-tool-analysis','products-tool-food-law']},
] as const;
export const PRODUCTS_PROCESS_CARDS = [
  {id:'separation',title:'Séparation mécanique',input:'Une matière contenant plusieurs fractions',change:'Distinguer des fractions par leurs propriétés physiques.',result:'Des fractions séparées, pas automatiquement pures.',limit:'Un procédé sans solvant ajouté ne retire pas nécessairement tous les contaminants.',examples:'Défibrage d’une tige ; séparation de particules riches en trichomes.',sourceIds:['products-tool-fibres','products-tool-concentrates']},
  {id:'extraction',title:'Extraction',input:'Une matière et des constituants à transférer',change:'Transférer sélectivement certains constituants dans une autre phase.',result:'Un extrait dont la composition dépend de la matière et du procédé.',limit:'L’extraction n’est pas une preuve d’élimination des contaminants ni d’identité avec la plante entière.',examples:'Notion générale appliquée aux extraits, sans méthode opératoire.',sourceIds:['products-tool-concentrates']},
  {id:'purification',title:'Purification',input:'Un mélange déjà obtenu',change:'Enrichir une fraction ou écarter des constituants.',result:'Une composition différente, à caractériser.',limit:'Distillat et isolat désignent des catégories de produits ; la pureté doit être mesurée.',examples:'Lire la composition d’un distillat ou d’un isolat.',sourceIds:['products-tool-concentrates','products-tool-extract-terms']},
  {id:'conversion',title:'Transformation chimique',input:'Une ou plusieurs molécules de départ',change:'Modifier l’identité ou la structure des molécules.',result:'Des produits attendus, avec des sous-produits possibles.',limit:'L’identité visée ne décrit pas toutes les impuretés ou tous les stéréoisomères réellement présents.',examples:'Conversions industrielles étudiées dans le parcours Cannabinoïdes, au niveau des principes.',sourceIds:['products-tool-hhc']},
  {id:'formulation',title:'Formulation',input:'Des ingrédients identifiés',change:'Associer des constituants pour un produit et une voie définis.',result:'Un mélange dont homogénéité et stabilité doivent être étudiées.',limit:'Une formulation orale n’est pas validée pour l’inhalation par simple changement d’étiquette.',examples:'Comparer une huile de graines, une préparation orale et une formulation inhalée.',sourceIds:['products-tool-inhalation','products-tool-oral']},
] as const;
export const PRODUCTS_LABEL_CLAIMS = [
  {id:'solvent',claim:'« Sans solvant ajouté, donc aucun contaminant »',conclusion:'La seconde proposition ne découle pas de la première.',why:'L’absence de solvant ajouté décrit un aspect du procédé. Pesticides, métaux, microorganismes ou autres contaminants demandent leurs propres contrôles.',sourceIds:['products-tool-concentrates','products-tool-analysis']},
  {id:'spectrum',claim:'« Full spectrum : composition identique dans tous les lots »',conclusion:'Cette étiquette ne remplace pas une composition mesurée.',why:'Les usages commerciaux de full spectrum et broad spectrum varient. Il faut préciser substances recherchées, concentrations, limites de mesure et lot.',sourceIds:['products-tool-label-study','products-tool-analysis']},
  {id:'live',claim:'« Live : qualité supérieure et sécurité garanties »',conclusion:'Le terme n’établit pas ces deux garanties.',why:'Il renvoie généralement à une matière végétale fraîche congelée après récolte. Une performance sensorielle, une stabilité et une sécurité demandent des preuves distinctes ; le label commercial ne les garantit pas.',sourceIds:['products-tool-product-terms']},
  {id:'route',claim:'« Huile de graines alimentaire : convient aussi à l’inhalation »',conclusion:'La sécurité ne se transpose pas automatiquement entre voies.',why:'Les tissus exposés, la formulation et les transformations lors de l’usage diffèrent. Un dossier alimentaire n’évalue pas à lui seul une exposition pulmonaire.',sourceIds:['products-tool-inhalation','products-tool-oral']},
  {id:'natural',claim:'« Molécule naturelle : produit commercial forcément extrait et pur »',conclusion:'Présence naturelle, fabrication et pureté sont trois informations différentes.',why:'Une même identité peut être obtenue par plusieurs voies. La composition du produit commercial, ses stéréoisomères et impuretés doivent être caractérisés.',sourceIds:['products-tool-hhc']},
  {id:'opinion',claim:'« Avis scientifique publié : produit autorisé et efficacité prouvée »',conclusion:'Un avis, une autorisation et une allégation ont des fonctions distinctes.',why:'Il faut lire l’objet de l’avis, la décision applicable au produit et les conditions de l’allégation. Une évaluation ne vaut pas automatiquement autorisation.',sourceIds:['products-tool-novel-food','products-tool-claims']},
] as const;
export const PRODUCTS_IDENTITY_AXES = [
  {id:'identity',title:'Identité chimique',question:'Quelle structure, quel isomère ?',limit:'Un nom abrégé ne décrit pas nécessairement tous les isomères.'},
  {id:'occurrence',title:'Présence dans la plante',question:'Quelle identification documentée ?',limit:'Une trace identifiée ne prouve pas l’origine d’un produit commercial.'},
  {id:'process',title:'Fabrication commerciale',question:'Extraction, hémisynthèse ou synthèse ?',limit:'Une déclaration de fabrication doit être documentée et traçable.'},
  {id:'composition',title:'Composition réelle',question:'Quels constituants et impuretés mesurés ?',limit:'La pureté annoncée dépend du périmètre et des méthodes analytiques.'},
  {id:'evidence',title:'Preuves d’usage',question:'Quelle formulation, voie et population ?',limit:'Ni l’origine ni une liaison à un récepteur ne prouvent un bénéfice clinique.'},
] as const;
export const PRODUCTS_CERTIFICATE = {
 id:'LAB-F01',title:'Certificat d’analyse fictif',reportDate:'10 novembre 2026',sampleReceived:'6 novembre 2026',sample:'Huile de graines de chanvre',lot:'H-A-261102',supplier:'Opérateur fictif A',sampling:'Échantillon fourni par l’opérateur ; plan de prélèvement et représentativité non documentés.',method:'Méthode LC-MS/MS fictive adaptée à cette matrice pour les cannabinoïdes indiqués. Aucun protocole opératoire fourni.',
 rows:[
  {id:'thc',analyte:'Équivalents Δ9-THC',result:'0,8 ± 0,2',unit:'mg/kg',status:'measured',note:'Δ9-THC + 0,877 × Δ9-THCA. Incertitude élargie fictive U = 0,2 mg/kg, k = 2 ; elle ne comprend pas une incertitude de prélèvement évaluée.'},
  {id:'cbd',analyte:'CBD',result:'< 0,10',unit:'mg/kg',status:'below-loq',note:'LQ fictive = 0,10 mg/kg : résultat inférieur à la limite de quantification. Cela ne signifie ni zéro ni absence.'},
  {id:'pesticides',analyte:'Pesticides',result:'Non analysés',unit:'—',status:'not-tested',note:'Aucun résultat disponible ; ne pas remplacer une absence de mesure par zéro.'},
  {id:'metals',analyte:'Métaux et métalloïdes',result:'Non analysés',unit:'—',status:'not-tested',note:'Le certificat n’apporte aucune conclusion sur ces contaminants.'},
  {id:'micro',analyte:'Critères microbiologiques',result:'Non analysés',unit:'—',status:'not-tested',note:'Le document ne vérifie pas les critères pertinents pour l’usage envisagé.'},
  {id:'stability',analyte:'Stabilité et homogénéité du lot',result:'Non étudiées',unit:'—',status:'not-tested',note:'Un résultat ponctuel sur un échantillon ne décrit pas automatiquement tout le lot ni son évolution.'},
 ],
 limits:['Aucun organisme réel, logo d’accréditation ou autorisation n’est représenté.','Les chiffres servent à lire un document, sans recommandation de dose ou d’usage.','Le rapport porte sur l’échantillon reçu du lot A ; il ne certifie pas le lot B.'],
 sourceIds:['products-tool-analysis','products-tool-metrology','products-tool-contaminants'],
} as const;
export const PRODUCTS_TRACE_DOCUMENTS = [
 {id:'receipt',title:'Bon de réception',kind:'Matières entrantes',text:'Deux huiles de graines reçues : H-A-261102 et H-D-261104. Le registre indique leurs fournisseurs. Seul le dossier analytique du lot A est joint.',reveals:'Le lot D existe dans la chaîne ; son dossier manque.',sourceIds:['products-tool-food-law']},
 {id:'batch',title:'Registre du lot B',kind:'Lien entre les lots',text:'Le 9 novembre 2026, les lots A et D sont assemblés et conditionnés sous H-B-261109. Aucun relevé d’homogénéité ou contrôle du produit fini n’est joint.',reveals:'Le produit final B n’est pas identique au seul lot A.',sourceIds:['products-tool-food-law','products-tool-analysis']},
 {id:'report',title:'Rapport LAB-F01',kind:'Portée analytique',text:'Le rapport du 10 novembre porte sur l’échantillon du lot H-A-261102 reçu le 6 novembre. Il comporte les deux résultats de cannabinoïdes présentés dans le certificat fictif ; d’autres contrôles ne sont pas réalisés.',reveals:'La date récente du rapport ne change pas l’identité de l’échantillon analysé.',sourceIds:['products-tool-analysis']},
 {id:'label',title:'Projet d’étiquette B',kind:'Affirmations à vérifier',text:'« Huile de graines — sans solvant ajouté, donc aucun contaminant — convient à la cuisine comme à l’inhalation. Analyse récente disponible. » Ce texte est volontairement trompeur.',reveals:'Le certificat ne justifie ni l’absence de tout contaminant ni la transposition vers l’inhalation.',sourceIds:['products-tool-inhalation','products-tool-analysis']},
] as const;
export const PRODUCTS_TRACE_QUESTIONS = [
 {id:'scope',question:'Que permet de conclure le dossier actuel ?',choices:[
  {id:'limited',text:'Le lot final B n’est pas suffisamment documenté.',correct:true,feedback:'Exact : le rapport porte sur A ; D et le produit fini B restent insuffisamment documentés.'},
  {id:'safe',text:'Tous les lots sont conformes puisque le rapport est récent.',correct:false,feedback:'Une date récente ne transfère pas le résultat à un autre échantillon ou à toutes les exigences.'},
  {id:'poisoned',text:'B est nécessairement contaminé.',correct:false,feedback:'Une information manquante n’est pas une preuve de contamination.'},
 ],reasons:[
  {id:'lot',text:'A est analysé, tandis que B contient A et D ; la portée des contrôles est limitée.',correct:true,feedback:'Les identifiants et les constituants suivis établissent cette limite.'},
  {id:'name',text:'Le mot chanvre devrait suffire à identifier toute la composition.',correct:false,feedback:'Un nom de plante ne décrit pas la composition d’un lot transformé.'},
 ]},
 {id:'action',question:'Quelle réponse proportionnée choisir avant la mise à disposition ?',choices:[
  {id:'hold',text:'Mettre le lot en attente, compléter la traçabilité et les contrôles pertinents, corriger les allégations.',correct:true,feedback:'Cette réponse traite les lacunes sans inventer une contamination ni autoriser une voie d’usage.'},
  {id:'release',text:'Libérer B en joignant le certificat A.',correct:false,feedback:'Joindre ce certificat ne résout ni la discordance de lot ni les contrôles manquants.'},
  {id:'recipe',text:'Modifier la préparation pour essayer de rendre le lot sûr.',correct:false,feedback:'Une modification improvisée ne remplace pas l’identification du problème et un cadre de contrôle adapté.'},
 ],reasons:[
  {id:'proportion',text:'Il faut établir le lien matières–lot–analyses et l’adéquation à l’usage avant de décider.',correct:true,feedback:'Si l’opérateur a des raisons de penser que la sécurité n’est pas respectée, les obligations d’information et de retrait ou rappel doivent être examinées sans attendre une preuve définitive.'},
  {id:'natural',text:'Une origine naturelle dispense des contrôles après transformation.',correct:false,feedback:'L’origine naturelle ne dispense pas de vérifier la composition et la sécurité.'},
 ]},
] as const;
