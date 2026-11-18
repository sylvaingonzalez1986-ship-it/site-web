import json
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
DAY = '2026-11-17'
AUTHOR = 'rebalance_products_sol'
sources = []

def source(key, title, organization, url, author, published, passage, locator, limitation='', kind='institutional-report', access='full-text'):
    sid = 'q2-rp01-' + key
    sources.append(dict(id=sid, title=title, organization=organization, url=url, verifiedAt=DAY,
                        author=author, published=published or 'Date non indiquée sur la page consultée', passage=passage, access=access,
                        documentKind=kind, limitation=limitation or 'Description de catégories de produits ; aucune teneur universelle ni méthode de fabrication n’en est déduite.',
                        consultation=dict(reader=AUTHOR,date=DAY,locator=locator,result='Passages indiqués réellement ouverts et lus ; soutien paraphrasé.')))
    return sid

I = source('inspq-products-2025','Les types de produits du cannabis','Institut national de santé publique du Québec',
    'https://www.inspq.qc.ca/sites/default/files/publications/3673-types-produits-cannabis.pdf',
    'Antoine Fournier, Axelle Marchand et Jacinthe Brisson','2025-06',
    'Typologie : fleurs, extraits, produits dérivés ; descriptions du kief, des résines pressées, des distillats, des isolats et des formes orales.',
    'p. 4 et 6–20, sections 2, 3 et 4',
    'Synthèse institutionnelle. Certaines définitions viennent de sources de marché et de l’OQLF. Les chiffres, règles de vente et généralisations discutables sur les voies ou concentrations ne sont pas repris.')
C = source('ccsa-products-2020','Clearing the Smoke on Cannabis: Edible Cannabis Products, Cannabis Extracts and Cannabis Topicals',
    'Canadian Centre on Substance Use and Addiction',
    'https://ccsa.ca/sites/default/files/2020-05/CCSA-Edible-Cannabis-Extracts-and-Topicals-Report-2020-en.pdf',
    'Robert Gabrys','2020',
    'Le tableau 1 distingue hash, kief, wax/crumble/budder, shatter, live resin et rosin ; la note 3 développe BHO. Un encadré décrit le dabbing comme une forme de vaporisation.',
    'p. 2–3 : encadré What is dabbing?, tableau 1 et note 3',
    'Rapport descriptif de 2020. Les plages de THC et les affirmations sur le prix ou les effets ne sont pas reprises.')
E = source('ccsa-extracts-2019','7 Things You Need to Know about Cannabis Extracts','Canadian Centre on Substance Use and Addiction',
    'https://www.ccsa.ca/sites/default/files/2019-07/CCSA-Things-You-Need-to-Know-about-Cannabis-Extracts-2019-en.pdf',
    'Canadian Centre on Substance Use and Addiction','2019-07',
    'Les extraits peuvent être dominés par le CBD ; les solvants employés peuvent laisser des résidus dans le produit fini.',
    'p. 1, What Are Cannabis Extracts? et point 1',
    'Seules les descriptions de composition sont reprises ; aucun conseil de consommation ni chiffre de dose.')
H = source('hc-cbd','Cannabidiol (CBD)','Health Canada',
    'https://www.canada.ca/en/health-canada/services/drugs-medication/cannabis/about/cannabidiol.html',
    'Health Canada',None,
    'La rubrique The difference between cannabis oil and hemp-seed oil décrit une association entre extrait riche en THC et/ou CBD et huile végétale.',
    'The difference between cannabis oil and hemp-seed oil, liste Cannabis oil is a combination of',
    'La page conserve un classement historique en cinq classes, non repris. Seule la description de formulation est utilisée.',kind='official-page',access='official-page')
L = source('hc-label-consumer','How to read and understand a cannabis product label','Health Canada',
    'https://www.canada.ca/en/health-canada/services/drugs-medication/cannabis/personal-use/how-read-understand-cannabis-product-label.html',
    'Health Canada',None,
    'Distinction entre quantité par unité, quantité totale, concentration et quantité par activation d’un atomiseur.',
    'Information on a cannabis product label, 4. THC and CBD amount',kind='official-page',access='official-page')
G = source('hc-label-guide','Packaging and labelling guide for cannabis products','Health Canada',
    'https://www.canada.ca/en/health-canada/services/cannabis-regulations-licensed-producers/packaging-labelling-guide-cannabis-products.html',
    'Health Canada',None,
    'Le THC total tient compte de la conversion potentielle du THCA ; la section 6.1.3 distingue mg de composé et mg/g de produit.',
    'Tableau 3, notes 1–2 ; section 6.1.3, tableau 5',
    'Guide canadien consulté dans sa version accessible le 17 novembre 2026 ; les questions retiennent le sens des mesures, sans recommander de quantité.',kind='official-page',access='official-page')
N = source('nist-hemp-2024','Characterization of Reference Material 8210: Hemp Plant (NIST SP 260-248)','National Institute of Standards and Technology',
    'https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.260-248.pdf',
    'Colleen E. Bryan Sallee et al.','2024-06',
    'Le THC total conventionnel vaut THC + 0,877 × THCA. La section 6 distingue masse sèche et produit tel que reçu.',
    'p. 22, §3.1.11.2, équation 5 ; p. 56, §6 et tableau 27',
    'Document métrologique original. Le facteur exprime un rapport de masses molaires, pas un rendement réel de fabrication.')
W = source('who-extracts-2018','Extracts and tinctures of cannabis — Critical Review','World Health Organization, Expert Committee on Drug Dependence',
    'https://cdn.who.int/media/docs/default-source/controlled-substances/extracts-and-tinctures.pdf',
    'Giuseppe Cannazza, Cinzia Citti et autres auteurs du rapport','2018',
    'La teinture est définie par un extrait alcoolique ; l’huile essentielle est décrite comme un mélange volatil principalement terpénique distinct des huiles riches en cannabinoïdes.',
    'Section 1 Chemistry, p. 15 note 1 ; p. 22, §3.2.4.3',
    'Rapport d’experts préparatoire : les opinions ne constituent pas les décisions de l’OMS. Les descriptions chimiques sont séparées des indications thérapeutiques.')
Y = source('ny-hemp-definitions','Part 114 — Cannabinoid Hemp, adopted December 2023','New York State Cannabis Control Board / Office of Cannabis Management',
    'https://cannabis.ny.gov/system/files/documents/2024/01/part-114-exprs-trms-adopted-12-2023.pdf',
    'New York State Cannabis Control Board','2023-12',
    'Définitions réglementaires délimitées : full spectrum réunit plusieurs cannabinoïdes, terpènes et autres composés natifs ; broad spectrum retire le THC à un niveau non détectable.',
    '§114.1(b), p. 2 ; §114.1(s), p. 6',
    'Le sens demandé est celui de ce texte identifié, pas une norme mondiale ni une validation des mentions de toutes les marques.',kind='regulation')
F = source('fda-delta8','5 Things to Know about Delta-8 Tetrahydrocannabinol – Delta-8 THC','U.S. Food and Drug Administration',
    'https://www.fda.gov/consumers/consumer-updates/5-things-know-about-delta-8-tetrahydrocannabinol-delta-8-thc',
    'U.S. Food and Drug Administration',None,
    'Le delta-8 THC est naturellement peu abondant et les quantités concentrées commercialisées sont généralement fabriquées à partir de CBD de chanvre ; le mot hemp ne signifie pas absence d’intoxication.',
    'Introduction et points 1, 3–4',
    'Description de produits aux États-Unis ; les alertes chiffrées, conseils sanitaires et règles juridiques ne sont pas repris.',kind='official-page',access='official-page')
U = source('euda-products-2023','EU Drug Market: Cannabis — Production','EMCDDA and Europol (hébergé par EUDA)',
    'https://www.euda.europa.eu/publications/eu-drug-markets/cannabis/production_en',
    'EMCDDA and Europol','2023-11-16',
    'Le marché comprend des cannabinoïdes dits semi-synthétiques issus de cannabinoïdes naturels modifiés ; HHC-O est un ester acétate du HHC.',
    'Encadré Emergence of semi-synthetic cannabinoids: delta-8-THC, HHC and HHC-O',
    'Description historique de catégories chimiques ; aucun statut actuel, protocole ni comparaison d’intensité des effets n’est inféré.',kind='official-page',access='official-page')
T = source('emcdda-hhc-2023','Technical report: Hexahydrocannabinol (HHC) and related substances','European Monitoring Centre for Drugs and Drug Addiction',
    'https://www.euda.europa.eu/system/files/documents/2023-04/emcdda-technical-report-hhc-and-related-substances.pdf',
    'EMCDDA','2023-04',
    'HHC signifie hexahydrocannabinol ; sa structure saturée diffère de celle du THC. Des produits à fleurs pauvres en THC contiennent du HHC ajouté. H4CBD désigne un dérivé entièrement hydrogéné du CBD.',
    'p. 5–6, résumé ; p. 24–25, figures 9–10 ; p. 75, paragraphe H4CBD',
    'Rapport technique de 2023, limité ici à la structure et aux formes observées, sans affirmation de statut ou de bénéfice sanitaire.')
R = source('hc-nano-research','Health Canada: Compilation of research abstracts 2021-2022','Health Canada',
    'https://www.canada.ca/en/health-canada/services/publications/science-research-data/compilation-research-abstracts-2021-2022.html',
    'Lee Ellis et Hanan Abramovici (responsables du projet cité)','2023-08',
    'Un projet de caractérisation a constaté que plusieurs produits vendus comme nanoémulsions ne correspondaient pas à la forme annoncée ou n’étaient pas uniformément dispersés.',
    'Characterization of cannabis nanoemulsions and uptake analysis survey using zebrafish – New',
    'Résumé institutionnel d’un travail préliminaire ; sert à établir une limite de l’étiquette, sans généraliser de fréquence ni d’effet humain.',kind='research-abstract',access='official-page')
B = source('bccs-form-products','The BCCS Guide to Infused Pre-Rolls','BC Cannabis Stores / British Columbia Liquor Distribution Branch',
    'https://www.bccannabisstores.com/blogs/learn/the-bccs-guide-to-infused-pre-rolls',
    'BC Cannabis Stores',None,
    'Le guide nomme les diamants de THCA comme des cristaux solides ; il décrit terp sauce comme un concentré privilégiant les terpènes et bubble hash parmi les formes sans solvant organique.',
    'Types of Concentrates Used : THCA Diamonds, Bubble Hash (Ice Water Hash), Terp Sauce',
    'Source primaire d’un détaillant public : terminologie de son guide explicitement attribuée. Les recommandations, procédés et promesses commerciales ne sont pas repris.',kind='retailer-guide',access='official-page')
NB = source('nci-nabiximols','NCI Drug Dictionary: nabiximols','National Cancer Institute',
    'https://www.cancer.gov/publications/dictionaries/cancer-drug/def/nabiximols',
    'National Cancer Institute',None,
    'Nabiximols est une préparation végétale standardisée contenant notamment THC et CBD, formulée en spray oromucosal.',
    'Définition, premier paragraphe et synonymes',
    'La question porte sur l’identité et la composition, sans indication clinique, promesse ni conseil de dose.',kind='institutional-dictionary',access='official-page')
DR = source('nci-dronabinol','NCI Drug Dictionary: dronabinol','National Cancer Institute',
    'https://www.cancer.gov/publications/dictionaries/cancer-drug/def/dronabinol',
    'National Cancer Institute',None,
    'Dronabinol est également appelé delta-9-THC.',
    'Définition et liste de synonymes',
    'Seule l’identité moléculaire est testée, sans indication clinique, promesse ni conseil de dose.',kind='institutional-dictionary',access='official-page')

questions = []
def q(key, level, prompt, options, explanation, sid, locator, support, subject, subject_key, prop, objective,
      form='identification', category='constituents', article='ref-resines-extraits', topic='evidence', legal=False, health=False):
    # La position de réponse tourne ; les options de saisie commencent par la bonne réponse.
    answer = len(questions) % 4
    options = list(options)
    correct = options.pop(0)
    options.insert(answer, correct)
    ed = dict(domain='active',category=category,subject=subject,subjectKey=subject_key,property=prop,
              expectedAnswer=correct,learningObjective=objective,factKey=key,form=form,
              difficultyRationale={1:'Vocabulaire concret courant des produits, sans calcul ni prérequis chimique avancé.',
              2:'Distingue deux formes ou deux mesures proches ; demande une connaissance spécialisée simple.',
              3:'Demande de lire une convention analytique ou une différence de structure chimique.'}[level],
              sourceEvidence=[dict(sourceId=sid,locator=locator,support=support)])
    if legal or health:
        ed.update(jurisdiction='État de New York, États-Unis' if legal else 'Portée générale ; source institutionnelle québécoise',reviewAfter='2027-05-17')
    questions.append(dict(id='hemp-q2-rp01-'+key,topicId=topic,level=level,prompt=prompt,options=options,answer=answer,
                          explanation=explanation,articleId=article,sourceIds=[sid],editorial=ed))

q('kief-loose-trichome-powder',1,'De quoi le kief est-il principalement constitué ?',
  ['De trichomes détachés sous forme de poudre','De fleurs entières séchées et comprimées','De cristaux de CBD isolé','D’une huile végétale enrichie en cannabinoïdes'],
  'Le kief rassemble surtout des glandes résineuses détachées. Il se distingue de la fleur moulue, qui conserve davantage de tissus végétaux.',
  I,'p. 8, §3.1','Le kief est une fine poudre composée principalement de trichomes.','Kief','cannabis-kief','Matière principale du produit','Distinguer poudre résineuse et fleur simplement fragmentée.')
q('hash-compressed-resinous-material',1,'Quelle description correspond au haschich traditionnel ?',
  ['Une matière résineuse rassemblée en masse compacte','Une huile de graines enrichie en arômes','Une poudre constituée d’un seul cannabinoïde purifié','Des fleurs entières conservant leur forme naturelle'],
  'Le haschich est un produit résineux compact, issu des glandes de la plante. Il ne correspond ni à une fleur entière ni à un cannabinoïde isolé.',
  C,'p. 3, tableau 1, Hash','Le hash est une substance composée de trichomes compressés ou purifiés, généralement solide lorsqu’elle est pressée.','Haschich','cannabis-hashish','Forme compacte de résine glandulaire','Reconnaître le haschich parmi les grandes présentations du cannabis.')
q('rosin-solventless-versus-resin',2,'Dans la terminologie de l’INSPQ, qu’est-ce qui distingue le rosin de la resin ?',
  ['L’absence de solvant organique pour son extraction','La présence obligatoire de CBD plutôt que de THC','L’ajout systématique d’une huile alimentaire','L’absence de terpènes dans le produit fini'],
  'Le rosin, ou résine pressée, relève d’une séparation mécanique. Dans cette terminologie, resin désigne une autre famille d’extraits, obtenus avec un solvant.',
  I,'p. 10, §3.3 et p. 14, Terminologie','L’INSPQ distingue résine pressée mécanique et resin extraite chimiquement.','Rosin et resin','cannabis-rosin','Distinction terminologique entre familles d’extraits','Comprendre que deux termes proches ne désignent pas la même catégorie.',form='comparaison')
q('wax-pen-concentrate-accessory',2,'Au sens précis retenu par l’INSPQ, un « wax pen » est un appareil destiné à quel produit ?',
  ['À des concentrés comme la wax','À des fleurs sèches entières uniquement','À une huile alimentaire au CBD','À une teinture alcoolique orale'],
  'Wax pen désigne un appareil pour des résines concentrées. L’INSPQ signale que ce nom est parfois employé trop largement pour tout dispositif de vapotage du cannabis.',
  I,'p. 15, tableau 11, Autres appellations','Le terme wax pen réfère à une catégorie d’accessoires pour tamponner des résines, dont la wax.','Wax pen','cannabis-wax-pen','Produit auquel correspond le nom de l’accessoire','Distinguer vocabulaire d’un accessoire et nom générique du vapotage.')
q('extract-not-always-concentrate',2,'Pourquoi un extrait de cannabis vendu en huile orale n’est-il pas forcément un concentré ?',
  ['Il peut être dilué dans une huile de support','Il peut avoir été débarrassé de ses cires','Il peut avoir été débarrassé de solvants résiduels','Il peut avoir perdu une partie de ses terpènes'],
  'Un extrait peut entrer dans une formulation diluée. Le mot « extrait » renseigne son origine, alors que « concentré » décrit ici une forte teneur en cannabinoïdes.',
  I,'p. 6, §3, paragraphes 3–4','Les extraits peuvent être dilués et moins concentrés que la plante ; tous les produits de cette catégorie ne sont donc pas des concentrés.','Extraits dilués','cannabis-diluted-extract','Extrait et concentré ne sont pas équivalents','Distinguer matière extraite et concentration finale.',form='deduction')
q('distillate-low-native-terpenes',2,'Comparé à un extrait à spectre complet, un distillat non réaromatisé se caractérise généralement par quoi ?',
  ['Une forte réduction des terpènes d’origine','Une conservation complète des arômes de la fleur','Une prédominance des cannabinoïdes acides','Un rapport THC/CBD proche de l’équilibre'],
  'Le raffinage du distillat appauvrit son profil terpénique. Des terpènes peuvent ensuite être ajoutés à une formulation : le produit vendu peut donc être aromatique.',
  W,'Section 1, p. 10, §1.2.4.6','Les distillats sont pauvres en terpènes, lesquels peuvent être ajoutés après fabrication.','Distillat','cannabis-distillate','Appauvrissement initial en terpènes','Ne pas confondre arôme ajouté et conservation du bouquet initial.',form='comparaison',topic='molecules')
q('isolate-single-cannabinoid',1,'Dans un isolat de cannabis, quelle composante a surtout été purifiée ?',
  ['Un cannabinoïde particulier','L’ensemble des arômes de la fleur','Un mélange complet de résines et de fibres','La totalité des huiles de la plante'],
  'Un isolat vise un cannabinoïde particulier, par exemple le CBD. Il se distingue d’un extrait réunissant plusieurs cannabinoïdes et d’autres constituants de la fleur.',
  I,'p. 13, §3.6','Les isolats sont des produits hautement raffinés composés d’un seul cannabinoïde.','Isolat de cannabinoïde','cannabis-cannabinoid-isolate','Sélection d’un seul cannabinoïde','Reconnaître le principe d’un isolat sans l’assimiler à un spectre complet.')
q('oral-cannabis-oil-carrier',1,'Dans une huile orale au CBD, quel est le rôle d’une huile végétale dite « de support » ?',
  ['Servir de véhicule au CBD dans la formulation','Servir de conservateur antimicrobien principal','Former une enveloppe solide autour de chaque portion','Servir de correcteur de l’acidité du mélange'],
  'Le CBD ou l’extrait riche en CBD est associé à une huile porteuse. La masse totale du liquide n’est donc pas une masse de CBD pur.',
  H,'The difference between cannabis oil and hemp-seed oil','L’huile de cannabis est décrite comme une association d’extrait THC/CBD et d’huile végétale.','Huile orale au CBD','cannabis-oral-carrier-oil','Fonction du véhicule huileux','Distinguer substance active et support d’une formulation.',article='ref-origines-formulations')
q('oral-oil-distinct-vape-liquid',1,'Dans une huile orale au CBD, quel ingrédient distingue notamment sa formulation d’un liquide conçu pour l’inhalation ?',
  ['Une huile alimentaire comme véhicule','Un propulseur gazeux dans le liquide','Des fragments de fleurs gardés en suspension','Une forte proportion d’alcool destinée à s’évaporer'],
  'Les huiles ingérables comportent des huiles alimentaires et ne sont pas conçues pour l’inhalation. La présence de CBD dans les deux produits ne les rend pas interchangeables.',
  I,'p. 16, §4.1.1, paragraphes 1–3','La présence d’huile alimentaire rend les huiles ingérables inappropriées pour l’inhalation.','Huile orale et liquide de vapotage','cannabis-oral-versus-vape-oil','Formulation liée à la destination du produit','Distinguer deux liquides contenant le même actif.',form='comparaison',article='ref-origines-formulations',health=True)
q('pre-roll-already-rolled-flower',1,'Que désigne un préroulé de cannabis ordinaire ?',
  ['Un joint vendu déjà roulé','Une capsule remplie d’huile de cannabis','Un bloc de résine sans papier','Une cartouche de liquide à vapoter'],
  'Le préroulé est une présentation du cannabis séché déjà roulé. Le nom décrit son format ; il n’indique pas à lui seul un taux de THC ou de CBD.',
  I,'p. 4, §2.1','Les joints achetés déjà fabriqués sont connus sous le nom de préroulés.','Préroulé','cannabis-pre-roll','Présentation du produit prêt à l’emploi','Reconnaître un format commercial sans lui attribuer un profil chimique.')
q('infused-pre-roll-added-extract',1,'Qu’a de particulier un préroulé de cannabis dit « infusé » ?',
  ['Il associe de la fleur à un extrait ajouté','Il ne comporte que des fleurs entières','Il contient nécessairement de l’alcool','Il exclut les cannabinoïdes autres que le CBD'],
  'Un préroulé infusé peut associer la fleur à du kief, du haschich ou un autre extrait. Le mot « infusé » ne désigne pas ici une tisane.',
  'q2-rp01-hc-infused','Adding other forms of cannabis to dried cannabis products','Santé Canada donne l’exemple de préroulés contenant surtout de la fleur et du kief ou du haschich ajouté.','Préroulé infusé','cannabis-infused-pre-roll','Ajout d’extrait à la fleur','Comprendre l’emploi du mot infusé dans une présentation de cannabis.')
q('shatter-glasslike-brittle',1,'Quel concentré doit son nom à son aspect vitreux et cassant ?',
  ['Le shatter','Le budder','La teinture','Le kief'],
  'Le shatter est décrit comme ambré et semblable au verre. Ce nom renvoie à sa présentation physique, pas à l’identité d’un cannabinoïde particulier.',
  C,'p. 3, tableau 1, Shatter','Le shatter a une apparence et une consistance vitreuses et ambrées.','Shatter','cannabis-shatter','Aspect physique qui caractérise le shatter','Associer un nom de concentré à une texture.')
q('crumble-dry-crumbly-texture',1,'Quel nom désigne une forme de wax particulièrement sèche et friable ?',
  ['Crumble','Teinture','Live resin','Kief'],
  'Crumble désigne une forme friable de wax, tandis que budder renvoie à une consistance plus humide. Ces noms décrivent des textures de concentrés.',
  C,'p. 3, tableau 1, Wax','Le crumble est la forme de wax plus sèche et plus friable, à la différence du budder.','Crumble et budder','cannabis-crumble','Texture friable du crumble','Reconnaître une distinction de texture entre concentrés.')
q('live-resin-fresh-frozen-origin',2,'Dans « live resin », à quoi renvoie le mot « live » ?',
  ['À une matière végétale fraîche conservée congelée après récolte','À des fleurs toujours attachées à une plante vivante','À des cannabinoïdes produits par fermentation','À l’absence de toute transformation de la résine'],
  'L’appellation renvoie à l’état de la matière de départ, fraîche et congelée après récolte, plutôt qu’à du cannabis vivant dans le produit vendu.',
  C,'p. 3, tableau 1, Live Resin','Live resin renvoie à du cannabis frais congelé immédiatement après la récolte.','Live resin','cannabis-live-resin','Sens de live dans l’appellation','Comprendre une indication descriptive de matière de départ.')
q('bho-expansion-butane-hash-oil',2,'Dans la terminologie des extraits de cannabis, que développe le sigle BHO ?',
  ['Butane hash oil','Broad hemp oil','Botanical hash origin','Balanced hemp oleoresin'],
  'BHO signifie butane hash oil. Ce sigle désigne une famille d’extraits liée au solvant employé ; il ne précise pas à lui seul une texture ou un taux de cannabinoïdes.',
  C,'p. 3, note 3','Les extraits utilisant du butane sont souvent appelés butane hash oils, abrégés BHO.','BHO','cannabis-bho','Développement du sigle de produit','Décoder un terme courant sans en déduire une composition uniforme.')
q('thca-diamonds-crystalline-cannabinoid',1,'Dans le guide de BC Cannabis Stores, les « diamants de THCA » correspondent à quoi ?',
  ['Des cristaux d’un cannabinoïde acide','Des gouttelettes de terpènes sans cannabinoïdes','Des trichomes entiers agglomérés','Des fleurs séchées enrobées de résine'],
  'Le guide décrit des cristaux de THCA, distincts du THC neutre. Le nom « diamant » décrit ici une présentation cristalline, pas une variété botanique.',
  B,'Types of Concentrates Used : THCA Diamonds','Le guide décrit des cristaux solides de THCA.','Diamants de THCA','cannabis-thca-diamonds','Présentation cristalline d’un cannabinoïde acide','Reconnaître un produit cristallin distinct d’une résine glandulaire.')
q('traditional-tincture-alcohol-extract',2,'Au sens pharmaceutique traditionnel, une teinture de cannabis est quel type de préparation ?',
  ['Un extrait alcoolique','Une huile essentielle aromatique','Une poudre de glandes résineuses','Un mélange de fleurs et de résine compacte'],
  'Le sens traditionnel de teinture renvoie à un extrait alcoolique. Certains marchés emploient aujourd’hui ce nom plus largement pour des solutions orales, y compris huileuses.',
  W,'Section 1, p. 15, note 1','Le terme cannabis tinctures y désigne des extractions alcooliques de sommités fleuries ou d’autres parties de la plante.','Teinture de cannabis','cannabis-tincture','Sens traditionnel du terme teinture','Reconnaître un usage précis sans universaliser une appellation commerciale.')
q('dabbing-vaporizing-concentrate',1,'Le mot « dabbing » désigne quoi dans la culture des produits du cannabis ?',
  ['Une manière de vaporiser un concentré','Une manière d’ingérer une huile en capsule','Une application d’extrait sur la muqueuse buccale','Une combustion de fleurs dans du papier à rouler'],
  'Dabbing désigne une méthode d’inhalation de concentrés, et non une molécule ou une variété. Des produits de textures différentes peuvent appartenir à cette catégorie d’usage.',
  C,'p. 2, encadré What is dabbing?','Le dabbing est décrit comme une méthode de vaporisation de concentrés solides.','Dabbing','cannabis-dabbing','Méthode d’usage plutôt que substance','Distinguer un mot d’usage des noms de molécules et de produits.')
q('full-spectrum-native-mixture',1,'Dans le texte new-yorkais de 2023, « full spectrum » décrit quel profil d’extrait de chanvre ?',
  ['Plusieurs cannabinoïdes et d’autres constituants naturels','Un seul cannabinoïde isolé, sans autres constituants','Seulement les molécules aromatiques de la fleur','Un mélange défini uniquement par son rapport THC/CBD'],
  'Dans cette définition, le spectre complet réunit plusieurs cannabinoïdes, des terpènes et d’autres composés natifs, sans retrait complet intentionnel d’un constituant.',
  Y,'§114.1(s), p. 6','Full spectrum contient plusieurs cannabinoïdes, terpènes et autres composés naturels, sans élimination complète intentionnelle.','Extrait à spectre complet','cannabis-full-spectrum','Pluralité de constituants dans le spectre complet','Comprendre ce que décrit une appellation de composition.',legal=True)
q('broad-spectrum-thc-removal',2,'Dans le texte new-yorkais de 2023, qu’est-ce qui distingue « broad spectrum » d’un isolat de CBD ?',
  ['Plusieurs cannabinoïdes, avec le THC retiré au niveau non détectable','Un cannabinoïde unique obtenu à une pureté plus élevée','Seulement des terpènes, sans aucun cannabinoïde','Un rapport fixe d’une part de THC pour une part de CBD'],
  'Broad spectrum conserve plusieurs cannabinoïdes, tout en visant un THC non détectable selon une méthode adaptée. Ce n’est donc pas le synonyme d’un isolat de CBD.',
  Y,'§114.1(b), p. 2','Broad spectrum contient plusieurs cannabinoïdes mais son THC a été retiré à un niveau non détectable avec une méthode adaptée.','Extrait à large spectre','cannabis-broad-spectrum','Plusieurs cannabinoïdes après retrait du THC','Différencier large spectre et cannabinoïde isolé.',form='comparaison',legal=True)
q('ratio-thc-cbd-not-concentration',2,'Deux extraits affichent THC:CBD = 1:1. Quelle propriété partagent-ils, même si leurs concentrations diffèrent ?',
  ['Des proportions égales de THC et de CBD','La même quantité totale de cannabinoïdes par gramme','La même teneur en chacun des terpènes','La même masse d’extrait dans leur emballage'],
  'Le rapport renseigne les proportions relatives des deux cannabinoïdes. Il ne donne ni leur concentration absolue ni la quantité totale contenue dans un emballage.',
  'q2-rp01-hc-medical-products','Choosing a cannabis product, Content of a cannabis product et indications mg/g, mg/ml, mg','Santé Canada distingue les combinaisons THC/CBD des pourcentages, concentrations et quantités de chaque actif.','Rapport THC/CBD','cannabis-thc-cbd-ratio','Proportion relative distincte d’une teneur absolue','Lire un rapport de composition sans lui attribuer une concentration.',form='deduction',article='ref-analyses')
q('terp-sauce-aromatic-concentrate',1,'Quel type de mélange le guide de BC Cannabis Stores appelle-t-il « terp sauce » ?',
  ['Un concentré privilégiant les composés aromatiques','Un isolat cristallin de THCA sans autres composants','Une huile alimentaire diluant un extrait de CBD','Une pâte de fleurs entières mêlées à des fibres'],
  'Le guide décrit terp sauce comme un concentré privilégiant la teneur en terpènes. Il peut accompagner des cristaux de cannabinoïdes, dont il constitue une fraction distincte.',
  B,'Types of Concentrates Used : Terp Sauce','Terp Sauce est décrit comme un concentré mettant l’accent sur les terpènes, parfois associé à des diamants.','Terp sauce','cannabis-terp-sauce','Fraction de concentré privilégiant les terpènes','Identifier le contenu aromatique d’une appellation de produit.',topic='molecules')
q('total-thc-molar-mass-convention',3,'Pour une fleur contenant du THC et du THCA, quelle expression donne le THC total conventionnel ?',
  ['THC + 0,877 × THCA','THC + THCA','0,877 × THC + THCA','THC + 1,14 × THCA'],
  'Les valeurs doivent être dans la même unité. Le facteur 0,877 convertit la masse de THCA en équivalent THC ; il ne mesure pas un rendement réel de transformation.',
  N,'p. 22, §3.1.11.2, équation 5','Le NIST définit le THC total comme THC + 0,877 × THCA, avec un facteur issu du rapport des masses molaires.','THC total analytique','cannabis-total-thc','Convention de calcul en équivalent THC','Lire une teneur totale sans additionner directement deux masses moléculaires différentes.',category='quality',article='ref-analyses')
q('bubble-hash-solventless-family',2,'Dans quelle famille le guide de BC Cannabis Stores classe-t-il le bubble hash, aussi nommé ice water hash ?',
  ['Les concentrés séparés sans solvant organique','Les teintures alcooliques pour la voie orale','Les distillats de cannabinoïdes','Les isolats d’un cannabinoïde unique'],
  'Bubble hash désigne ici une forme de résine séparée avec de l’eau, sans solvant organique ajouté. Cette classification ne correspond ni à un distillat ni à un cannabinoïde isolé.',
  B,'Types of Concentrates Used : Bubble Hash (Ice Water Hash)','Le guide classe Bubble Hash / Ice Water Hash comme un extrait solventless utilisant l’eau.','Bubble hash','cannabis-bubble-hash','Famille de résine sans solvant organique','Reconnaître le classement d’un produit de résine courant.')
q('nabiximols-thc-cbd-formulation',2,'Quels deux cannabinoïdes entrent dans la formulation de nabiximols, l’extrait proposé en spray buccal ?',
  ['THC et CBD','CBD et CBG','THC et CBN','CBG et CBC'],
  'Nabiximols est un extrait végétal standardisé associant notamment THC et CBD. Sa formulation ne correspond pas à du CBD isolé ni à du THC seul.',
  NB,'Définition, premier paragraphe','Le NCI décrit un extrait standardisé contenant THC et CBD formulé en spray oromucosal.','Nabiximols','nabiximols','Association THC/CBD d’un extrait pharmaceutique nommé','Distinguer une formulation végétale standardisée d’un cannabinoïde isolé.',article='ref-origines-formulations')
q('dronabinol-delta9-thc-identity',2,'Quel cannabinoïde est désigné par le nom pharmaceutique « dronabinol » ?',
  ['Le delta-9-THC','Le cannabidiol','Le cannabinol','Le cannabigérol'],
  'Dronabinol est un nom du delta-9-THC employé en pharmacie. Ce nom ne désigne pas un mélange de cannabinoïdes comme un extrait végétal complet.',
  DR,'Définition et liste de synonymes','Le NCI indique que dronabinol est aussi appelé delta-9-THC.','Dronabinol','dronabinol','Identité moléculaire d’un nom pharmaceutique','Relier une dénomination de produit pharmaceutique à son cannabinoïde.',article='ref-origines-formulations')
q('essential-oil-aromatic-volatile-mixture',1,'Pourquoi une huile essentielle de cannabis ne se confond-elle pas avec une huile riche en CBD ?',
  ['Elle rassemble surtout des constituants aromatiques volatils','Elle contient nécessairement un isolat de CBD','Elle est uniquement issue de graines broyées','Elle est définie par une quantité égale de THC et de CBD'],
  'L’huile essentielle rassemble surtout des substances volatiles, notamment des terpènes. L’expression ne désigne pas un extrait concentré en cannabinoïdes.',
  W,'Section 1, p. 22, §3.2.4.3','L’huile essentielle, surtout terpénique et volatile, doit être distinguée des huiles riches en cannabinoïdes.','Huile essentielle de cannabis','cannabis-essential-oil','Mélange aromatique distinct d’une huile cannabinoïde','Distinguer des produits différents malgré le mot huile.',article='ref-origines-formulations',topic='molecules')
q('hhc-name-hexahydrocannabinol',1,'Quel nom développe le sigle HHC rencontré sur certains produits du cannabis ?',
  ['Hexahydrocannabinol','Hydroxycannabidiol','Hydrocannabigérol','Hexahydrocannabiphorol'],
  'HHC signifie hexahydrocannabinol. Le produit appelé HHC-P porte un nom plus long et correspond à une autre substance, pas à une simple présentation du même HHC.',
  T,'p. 26, Common names ; p. 17, Other SSCs in Europe','Le rapport donne HHC comme abréviation de hexahydrocannabinol et distingue hexahydrocannabiphorol.','HHC','hhc','Développement du sigle HHC','Identifier un cannabinoïde transformé sans confondre ses analogues.',article='ref-cannabinoides-transformes')
q('hhc-saturated-thc-analogue',3,'Quelle différence de structure distingue le HHC du Δ9-THC ?',
  ['La double liaison du cycle carboné du THC est saturée','Le HHC porte une chaîne latérale de sept carbones','Le HHC porte le groupe acide caractéristique du THCA','Le HHC est simplement une autre configuration du CBD'],
  'Le HHC possède deux hydrogènes de plus que le THC et un cycle carboné saturé à cet endroit. C’est une différence de structure, pas une différence de concentration du produit.',
  T,'p. 24–25, figures 9–10','Les structures comparées du HHC C21H32O2 et du THC C21H30O2 montrent la saturation de la double liaison cyclique.','Structure du HHC','hhc','Saturation du cycle par rapport au THC','Comprendre pourquoi HHC et THC ne sont pas la même molécule.',form='comparaison',article='ref-cannabinoides-transformes')
q('hhc-o-acetate-derivative',3,'Que désigne HHC-O par rapport au HHC ?',
  ['Un dérivé acétate du HHC','Un isolat de HHC sans aucun autre ingrédient','La forme acide naturelle du HHC','Le même HHC dilué dans une huile végétale'],
  'HHC-O désigne un ester acétate du HHC. Le suffixe correspond à une modification chimique, et non à une marque de pureté ou à une simple dilution huileuse.',
  U,'Emergence of semi-synthetic cannabinoids, paragraphe HHC-O','HHC-O est présenté comme l’ester acétate du HHC.','HHC-O','hhc-o','Nature du lien chimique entre HHC et HHC-O','Décoder une dénomination de dérivé plutôt qu’un format commercial.',article='ref-cannabinoides-transformes')
q('semi-synthetic-natural-cannabinoid-modified',2,'Que signifie « semi-synthétique » pour des cannabinoïdes comme ceux décrits par l’EUDA ?',
  ['Un cannabinoïde naturel sert de départ à une modification chimique','Deux cannabinoïdes sont simplement mélangés dans un flacon','La moitié du produit est constituée de matières végétales','Le cannabinoïde a seulement été séparé des fleurs'],
  'Cette qualification décrit une origine chimique : une molécule naturelle est transformée. Elle ne signifie ni mélange à parts égales ni simple extraction.',
  U,'Encadré Emergence of semi-synthetic cannabinoids, premier paragraphe','L’EUDA qualifie de semi-synthétiques des cannabinoïdes obtenus en transformant des cannabinoïdes présents naturellement.','Cannabinoïdes semi-synthétiques','semi-synthetic-cannabinoids','Sens de l’origine semi-synthétique','Distinguer transformation moléculaire et formulation ou séparation.',article='ref-cannabinoides-transformes')
q('hhc-flower-added-to-low-thc-flower',2,'Comment le rapport européen de 2023 décrit-il certaines « fleurs au HHC » commercialisées ?',
  ['Des fleurs pauvres en THC auxquelles du HHC a été ajouté','Des fleurs dont le THCA a seulement été décarboxylé','Des fleurs classées THC dominantes après leur analyse','Des fleurs dont le CBD a été retiré sans autre modification'],
  'Le rapport décrit des supports végétaux pauvres en THC contenant du HHC ajouté. L’appellation d’une fleur ne révèle donc pas nécessairement ce que la plante a produit elle-même.',
  T,'p. 5–6, résumé, formes vendues','Le HHC est vendu notamment comme fleurs ou résines pauvres en THC pulvérisées ou mélangées avec du HHC.','Fleurs contenant du HHC','hhc-added-flower','Actif ajouté sur un support végétal','Distinguer composition du produit vendu et production native de la fleur.',article='ref-origines-formulations')
q('delta8-products-usually-cbd-conversion',2,'Selon la FDA, d’où provient généralement le delta-8 THC concentré des produits commercialisés ?',
  ['Du CBD de chanvre transformé chimiquement','D’une fleur naturellement dominée par le delta-8 THC','D’une huile de graines riche naturellement en delta-8 THC','Du seul vieillissement d’une huile essentielle de cannabis'],
  'La plante contient naturellement peu de delta-8 THC. La FDA explique que les quantités concentrées commercialisées sont généralement obtenues à partir du CBD du chanvre.',
  F,'Introduction et point 4','Le delta-8 THC est naturellement peu abondant ; des quantités concentrées sont typiquement manufacturées à partir du CBD de chanvre.','Produits au delta-8 THC','delta8-thc-products','Origine habituelle des quantités concentrées du marché','Distinguer présence naturelle minoritaire et origine des produits concentrés.',article='ref-cannabinoides-transformes')
q('hemp-label-not-nonintoxicating-guarantee',1,'Pourquoi « dérivé du chanvre » ne décrit-il pas à lui seul les effets d’un produit au delta-8 THC ?',
  ['L’origine chanvre n’empêche pas la présence d’un actif intoxicant','L’origine chanvre impose une dominante CBD au produit fini','L’origine chanvre indique seulement une faible teneur en terpènes','L’origine chanvre transforme le delta-8 en forme non intoxicante'],
  'Le delta-8 THC possède des effets intoxicants même quand sa matière de départ vient du chanvre. Une origine végétale ne suffit pas à définir les propriétés de la formulation finale.',
  F,'Points 1 et 3','La FDA avertit que hemp peut être associé à tort à non-psychoactive alors que le delta-8 THC est intoxicant.','Appellation dérivé du chanvre','hemp-derived-delta8-labelling','Origine végétale distincte des propriétés de l’actif final','Lire une origine commerciale sans lui attribuer l’absence d’effet.',article='ref-origines-formulations')
q('cannabis-drink-nanoemulsion-droplets',2,'Dans une boisson au cannabis en nanoémulsion, que sont les objets dispersés de très petite taille ?',
  ['Des gouttelettes portant les cannabinoïdes','Des cristaux de cannabinoïdes dispersés directement dans l’eau','Des bulles de gaz transportant les cannabinoïdes','Des fragments de tissu végétal portant les cannabinoïdes'],
  'La formulation disperse l’extrait en minuscules gouttelettes. Elle ne consiste pas à couper la molécule de THC ou de CBD en molécules plus petites.',
  I,'p. 17, §4.1.2','Les boissons peuvent contenir une nanoémulsion dans laquelle l’extrait est réparti en minuscules gouttelettes.','Boisson au cannabis nanoémulsionnée','cannabis-nanoemulsion','Nature physique des petites unités dispersées','Comprendre une formulation de cannabinoïdes dans une boisson.',article='ref-origines-formulations')
q('decarboxylated-flower-powder-oral',2,'L’INSPQ distingue une poudre de cannabis séché décarboxylée de la fleur à inhaler. À quel usage est-elle destinée ?',
  ['À l’ingestion','À l’application transdermique','À l’inhalation par cartouche liquide','À l’application sur les muqueuses nasales'],
  'Il existe des poudres de cannabis décarboxylées destinées à être ingérées. Le mot « poudre » ne suffit donc pas à conclure qu’un produit est du kief ou un isolat.',
  I,'p. 4, §2.1, paragraphe poudre décarboxylée','Le cannabis séché peut être vendu en poudre décarboxylée destinée uniquement à être ingérée.','Poudre de cannabis décarboxylée','cannabis-decarboxylated-flower-powder','Destination d’une forme précise de poudre','Reconnaître une forme commerciale différente du kief et de l’isolat.')
q('oral-cannabis-film-mouth-dissolution',1,'À quoi correspond un film oral contenant un extrait de cannabis ?',
  ['Une fine préparation conçue pour se dissoudre dans la bouche','Un timbre destiné à rester collé sur la peau','Une feuille pour emballer un bloc de haschich','Une cartouche où l’extrait est vaporisé'],
  'Les films ou timbres oraux contiennent un extrait et se dissolvent à l’intérieur de la bouche. Ils se distinguent des timbres transdermiques destinés à la peau.',
  I,'p. 19, §4.1.4','Les pastilles et timbres oraux contiennent de l’extrait de cannabis et sont conçus pour être dissous à l’intérieur de la bouche.','Film oral au cannabis','cannabis-oral-film','Forme buccale dissolvante','Distinguer film oral et timbre cutané.',article='ref-origines-formulations')
q('transdermal-patch-systemic-design',2,'Dans les produits aux cannabinoïdes, que signifie la destination « transdermique » d’un timbre ?',
  ['Faire passer des cannabinoïdes à travers la peau vers le sang','Libérer des cannabinoïdes dans la bouche en se dissolvant','Disperser une huile dans une boisson','Retenir les cannabinoïdes uniquement à la surface de la peau'],
  'Le timbre transdermique vise un passage à travers la peau vers la circulation. Cette destination le distingue d’une préparation conçue pour une application locale.',
  I,'p. 20, §4.2, paragraphes 2–3','Les timbres transdermiques permettent aux cannabinoïdes de pénétrer dans le sang, à la différence de produits destinés à une action locale.','Timbre transdermique','cannabis-transdermal-patch','Destination systémique à travers la peau','Lire une désignation de voie sans la confondre avec une application locale.',article='ref-origines-formulations',health=True)
q('h4cbd-hydrogenated-cbd',3,'Le nom H4CBD désigne quel type de substance ?',
  ['Un dérivé hydrogéné du CBD','Un mélange de CBD, CBG, CBN et CBC','Une forme acide apparentée au CBD','Un extrait contenant quatre parts de CBD pour une de THC'],
  'H4CBD désigne un dérivé hydrogéné du cannabidiol. Le chiffre appartient au nom chimique : il n’indique ni une pureté multipliée ni un rapport entre plusieurs cannabinoïdes.',
  T,'p. 75, paragraphe The fully hydrogenated derivative of CBD','Le rapport identifie H4CBD comme le dérivé entièrement hydrogéné du CBD.','H4CBD','h4cbd','Identité d’un dérivé distinct du CBD','Décoder une désignation de cannabinoïde transformé.',article='ref-cannabinoides-transformes')
q('residual-solvent-origin',1,'Dans l’analyse d’un extrait de cannabis, « solvant résiduel » désigne quoi ?',
  ['Une trace de solvant restée dans le produit après sa fabrication','Un cannabinoïde naturellement présent à faible teneur','Un terpène qui donne une odeur de solvant','L’huile porteuse volontairement ajoutée à une huile orale'],
  'Le terme concerne une substance utilisée pendant la fabrication et qui reste dans le produit. Il ne désigne ni un cannabinoïde minoritaire ni nécessairement un arôme.',
  E,'p. 1, point 1, premières phrases','Certains extraits sont fabriqués avec des solvants dont des traces peuvent rester dans le produit final.','Solvants résiduels des extraits','cannabis-extract-residual-solvents','Origine d’un résidu distinct des constituants natifs','Lire une famille de substances recherchées dans un extrait.',category='quality',article='ref-contaminants')

source('hc-infused','Cannabis Tracking and Licensing System reporting guide: Frequent issues and solutions','Health Canada',
    'https://www.canada.ca/en/health-canada/services/drugs-medication/cannabis/tracking-system/monthly-reporting-guide/frequent-issues-solutions.html',
    'Health Canada',None,
    'Exemple de préroulés composés surtout de fleurs séchées avec kief ou hash ajouté.',
    'Adding other forms of cannabis to dried cannabis products (for example infused pre-rolls)',
    'Le seul fait testé est la composition du préroulé infusé, pas son classement légal canadien.',kind='official-page',access='official-page')
source('hc-medical-products','Information on the use of cannabis for medical purposes','Health Canada',
    'https://www.canada.ca/content/dam/hc-sc/documents/topics/accessing-cannabis-for-medical-purposes/cannabis-medical-purposes/cannabis-medical-purposes.pdf',
    'Health Canada','2026-01',
    'La rubrique Choosing a cannabis product distingue proportions THC/CBD, formes de produits et indications en pourcentages, mg/g, mg/ml ou mg.',
    'p. 7, Choosing a cannabis product, Content of a cannabis product ; crédits janvier 2026',
    'Les considérations cliniques ne servent pas aux questions ; seule la distinction composition relative / concentration est reprise.')

if __name__ == '__main__':
    assert len(questions)==40, len(questions)
    known={s['id'] for s in sources}
    articles={a['id'] for a in json.loads((ROOT.parent/'encyclopedia-revision/baseline-catalog.json').read_text(encoding='utf-8-sig'))['articles']}
    for entry in questions:
        assert len(entry['prompt'])<=150,(entry['id'],'prompt',len(entry['prompt']))
        assert len(entry['explanation'])<=240,(entry['id'],'explanation',len(entry['explanation']))
        assert len(entry['options'])==4 and len(set(entry['options']))==4
        assert all(len(o)<=75 for o in entry['options']),(entry['id'],'options',entry['options'])
        assert entry['articleId'] in articles
        assert set(entry['sourceIds'])<=known
    used_sources={sid for question in questions for sid in question['sourceIds']}
    batch=dict(batchId='r-products-01',author=AUTHOR,role='Produits et formes du cannabis récréatif, CBD et actifs — rééquilibrage du 17 novembre 2026',questions=questions,sources=[s for s in sources if s['id'] in used_sources])
    (ROOT/'batches/r-products-01.json').write_text(json.dumps(batch,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    facts=dict(batchId='r-products-01',author=AUTHOR,date=DAY,status='author_complete_pending_independent_review',
      contract='AUTHORING.md : révision 17 novembre 2026, 800 active / 100 food / 100 materials ; aucun fait du catalogue du site.',
      count=len(questions),levels=dict(Counter(str(q['level']) for q in questions)),
      revisionAfterIndependentReview=dict(review='reviews/r-products-01.json',
        preservedApprovedObjects=30,correctedExistingObjects=5,replacedObjects=5,
        replacements={
          'hemp-q2-rp01-extracts-can-be-cbd-dominant':'hemp-q2-rp01-thca-diamonds-crystalline-cannabinoid',
          'hemp-q2-rp01-mg-per-g-cannabinoid-percent':'hemp-q2-rp01-terp-sauce-aromatic-concentrate',
          'hemp-q2-rp01-dry-basis-excludes-sample-water':'hemp-q2-rp01-bubble-hash-solventless-family',
          'hemp-q2-rp01-edible-per-unit-not-package':'hemp-q2-rp01-nabiximols-thc-cbd-formulation',
          'hemp-q2-rp01-oral-spray-per-activation':'hemp-q2-rp01-dronabinol-delta9-thc-identity'},
        sourceCorrection='q2-rp01-hc-medical-products : date janvier 2026 attestée aux crédits du PDF, relus par l’auteur ; nouvelle empreinte à vérifier par A.',
        status='awaiting_independent_revalidation_no_self_approval'),
      neighbourSearch=dict(index='docs/quiz-2000/fact-index.jsonl',
        terms=['rosin','hash','isolat','spectre','concentr','distillat','trichome','CBD','THC','cannabino','solvant','transderm','nano','HHC','résine','émulsion'],
        openedBatches=['b-01.json (questions sur flos, cut flos et certificat de lot)','e-new-01.json (analyses et étiquetage génériques à éviter)'],
        neighbours=[
          dict(id='hemp-plant-trichome',decision='Pas de nouveau rappel sur la production de cannabinoïdes par les glandes ; le kief teste la matière d’un produit.'),
          dict(id='hemp-q2-c-trichome-cavite-sous-cuticule',decision='Compartiment cellulaire non repris ; hash et kief testent les présentations commerciales.'),
          dict(id='hemp-q2-b01-bedrocan-flos-whole-dried-flower',decision='Identification de flos non reprise ; les préroulés testent un format distinct.'),
          dict(id='hemp-q2-b01-bedrocan-cutflos-reduced-not-powder',decision='Comparaison cut flos/poudre non reprise ; la poudre décarboxylée teste une destination commerciale propre.'),
          dict(id='hemp-q2-b01-bedrocan-average-versus-batch-coa',decision='Pas de nouveau rappel sur le certificat propre au lot.'),
          dict(id='hemp-evidence-decarboxylation',decision='Molécule CO2 libérée non retestée ; le THC total porte sur une convention d’analyse et son facteur massique.'),
          dict(id='hemp-evidence-hhc-epimeres',decision='Aucune nouvelle question sur l’épimérie 9R/9S ; la structure saturée HHC/THC est un autre fait.'),
          dict(id='hemp-q2-en01-below-quantification-not-zero',decision='Pas de nouveau fait général <LQ ; broad spectrum teste une définition de produit à plusieurs cannabinoïdes.'),
          dict(id='hemp-q2-en02-cbd-adulterated-substances',decision='Alerte sanitaire et conduite à tenir non reprises ; fleurs HHC teste une composition de produit explicitement décrite.'),
          dict(id='hemp-q2-a01-lemon-potion-rapport-annonce',decision='Rapport commercial variétal non repris ; la nouvelle question teste ce qu’un rapport 1:1 permet et ne permet pas de comparer.')]),
      actualReadings=[dict(sourceId=s['id'],url=s['url'],locator=s['consultation']['locator'],reader=AUTHOR,date=DAY) for s in sources],
      declinedSources=[
        dict(url='https://www.health.ny.gov/community/cannabis/key_terms.htm',result='403 via web ; connexion locale refusée. Source non utilisée.'),
        dict(url='https://ocs.ca/blogs/cannabis-made-clear/a-guide-to-cannabis-extracts',result='URL non accessible. Source non utilisée.'),
        dict(url='https://pmc.ncbi.nlm.nih.gov/articles/PMC8461879/',result='Page de contrôle navigateur ; non utilisée.'),
        dict(url='https://pubs.rsc.org/en/content/articlepdf/2022/fo/d1fo04433h',result='403 ; non utilisée.'),
        dict(url='https://lcb.wa.gov/education/reading_a_product_label',result='Ouverture ne restituant que le menu ; extrait de recherche insuffisant, non utilisé.')],
      safeguards=['Aucun protocole ni paramètre de fabrication ou de culture','Aucune recommandation de dose ; les unités désignent des étiquettes et des analyses','Aucune promesse thérapeutique','Définitions full/broad explicitement rattachées au texte new-yorkais identifié','Aucune autoapprobation ; aucune revue ni banque active modifiée'],
      finishCondition='40 objets complets, contrôles mécaniques de longueur et références valides ; à soumettre à une lecture indépendante objet par objet.',
      facts=[dict(id=q['id'],domain='active',factKey=q['editorial']['factKey'],subjectKey=q['editorial']['subjectKey'],property=q['editorial']['property'],expectedAnswer=q['editorial']['expectedAnswer']) for q in questions])
    (ROOT/'facts/r-products-01.json').write_text(json.dumps(facts,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(dict(questions=len(questions),sources=len(sources),levels=facts['levels']),ensure_ascii=False))
