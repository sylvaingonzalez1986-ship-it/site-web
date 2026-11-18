import json
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
DAY = '2026-11-17'
AUTHOR = 'rebalance_products_sol'
sources = []
questions = []

def source(key, title, org, url, passage, locator, published=None, author=None, access='official-page', limitation=None):
    sid = 'q2-rp02-' + key
    sources.append(dict(id=sid,title=title,organization=org,url=url,verifiedAt=DAY,
        author=author or org,published=published or 'Date non indiquée sur la page consultée',
        passage=passage,access=access,documentKind='institutional-document',
        limitation=limitation or 'Seuls les passages descriptifs indiqués sont repris ; aucune méthode de fabrication ou recommandation de consommation.',
        consultation=dict(reader=AUTHOR,date=DAY,locator=locator,result='Passages originaux indiqués effectivement ouverts et lus ; soutien paraphrasé.')))
    return sid

O=source('ofdt-glossaire','Cannabis, données essentielles — Annexes : glossaire','OFDT',
 'https://www.ofdt.fr/sites/ofdt/files/2023-08/field_media_document-480-cdeannex.pdf',
 'Sinsemilla signifie sans graine ; space-cake désigne un gâteau contenant du cannabis.',
 'Glossaire, PDF p. 19, entrées SINSEMILLA et SPACE-CAKE',access='full-text',
 limitation='Document ancien : seules deux définitions de vocabulaire sont retenues. Ni les règles juridiques historiques ni les conseils de culture du glossaire ne sont repris.')
E=source('euda-charas','Changes in Europe’s cannabis resin market','EMCDDA, hébergé par EUDA',
 'https://www.euda.europa.eu/changes-europe%E2%80%99s-cannabis-resin-market_en',
 'Le premier paragraphe de l’analyse donne hashish et charas comme noms de résine de cannabis.',
 '1. Analysis: the European market for cannabis resin, premier paragraphe','2017-06-06')
M=source('michigan-moonrocks','Compliant Creation and Testing of Inhalable Compound Concentrate Products and Pre-Rolls','Michigan Cannabis Regulatory Agency',
 'https://www.michigan.gov/cra/-/media/Project/Websites/cra/bulletin/5Technical/Marihuana_Sampling_and_Testing_-Combination_Products_732964_7.pdf?hash=192A8E7AECDEB28EB165011852DAFAE1&rev=ebed2017f31e40b5b44285c6863fca4b',
 'Les moon rocks réunissent fleur, concentré et kief dans un même produit fini.',
 'p. 1, Inhalable Compound Concentrate Products, Moon rocks','2022-09-19',access='full-text')
A=source('ats-terminology','Effects of Inhaled Tobacco and Cannabis Co-Use on Respiratory Health and Tobacco Cessation: An Official ATS Research Statement','American Thoracic Society',
 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12618986/',
 'Le tableau 1 distingue blunt, spliff et vaporisateur de fleurs sèches.',
 'Tableau 1, Devices and methods of use ; Inhaled co-use methods','2025-08-22','Erin A. McClure et al.',access='full-text',
 limitation='Terminologie située dans un rapport anglophone ; les noms de joints peuvent changer selon les pays. Aucun effet clinique du mélange n’est extrapolé.')
H=source('hc-accessories','Cannabis accessories for inhalation: Minimizing your risk when smoking, vaping and dabbing','Health Canada',
 'https://www.canada.ca/en/health-canada/services/drugs-medication/cannabis/personal-use/accessories-inhalation.html',
 'L’eau d’une pipe peut refroidir la fumée sans la rendre sans danger ; le vapotage produit un aérosol et des métaux peuvent contaminer le liquide puis cet aérosol.',
 'Smoking accessories, Pipes ; Vaping, deux premiers paragraphes')
R=source('hc-vape-byproducts','Health Canada: Compilation of research abstracts 2021-2022','Health Canada',
 'https://www.canada.ca/en/health-canada/services/publications/science-research-data/compilation-research-abstracts-2021-2022.html',
 'Des sous-produits oxydatifs ou de dégradation peuvent se former lorsque certains ingrédients de liquides de vapotage du cannabis sont chauffés.',
 'Investigation of degradation by-products from cannabis vaping liquid ingredients via thermal desorption – New','2023-08','Jiping Zhu et Hanan Abramovici (responsables du projet cités)',
 limitation='Résumé d’un travail préliminaire : méthode de laboratoire ne reproduisant pas parfaitement la consommation. Aucune fréquence ni toxicité précise n’est inférée.')
C=source('cdc-evali','Evaluation of Bronchoalveolar Lavage Fluid from Patients in an Outbreak of EVALI — 10 States, August–October 2019','Centers for Disease Control and Prevention',
 'https://www.cdc.gov/mmwr/volumes/68/wr/mm6845e2.htm',
 'L’acétate de vitamine E, épaississant possible des liquides au THC, a été retrouvé dans les prélèvements pulmonaires étudiés pendant l’épidémie EVALI.',
 'MMWR 68(45), p. 1040–1041, paragraphes sur les additifs et les résultats des lavages','2019-11-15','Benjamin C. Blount et al.',access='full-text',
 limitation='Étude historique sur un échantillon de convenance ; ce rapport ne prouve pas à lui seul une causalité ni une présence dans toutes les cartouches. Erratum du 31 janvier 2020 lu : ajout de noms de contributeurs, sans correction de ces résultats.')
D=source('dea-spice','Spice/K2, Synthetic Marijuana','U.S. Drug Enforcement Administration',
 'https://www.dea.gov/factsheets/spice-k2-synthetic-marijuana',
 'Spice et K2 sont des noms commerciaux de produits à cannabinoïdes de synthèse visant à imiter le THC, parfois présentés comme encens végétaux.',
 'What is Spice/K2, Synthetic Marijuana? ; How is it abused?',
 limitation='Identification d’une famille de produits, sans reprendre les généralisations sur la puissance ni les listes d’effets.')
L=source('hc-label','How to read and understand a cannabis product label','Health Canada',
 'https://www.canada.ca/en/health-canada/services/drugs-medication/cannabis/personal-use/how-read-understand-cannabis-product-label.html',
 'Le symbole standardisé signale la présence de THC au-delà du seuil indiqué ; le timbre d’accise indique une provenance auprès d’un titulaire de licence de Santé Canada.',
 'Information on a cannabis product label, 1. Standardized cannabis symbol ; 3. Excise stamp',
 limitation='Règles canadiennes consultées le 17 novembre 2026 ; certaines catégories de produits sont exemptées du timbre. Aucun marquage n’est présenté comme garantie d’innocuité.')
F=source('maasa-cbd-foods-2026','Denrées alimentaires contenant du cannabidiol (CBD) : des produits illégaux qui doivent être retirés du marché','Ministère de l’Agriculture, de l’Agro-alimentaire et de la Souveraineté alimentaire',
 'https://agriculture.gouv.fr/node/110883',
 'Les denrées incluant du CBD comme ingrédient ne sont pas autorisées ; les feuilles exclusivement destinées à une infusion aqueuse, sans enrichissement, sont distinguées des nouveaux aliments.',
 'Communiqué du 20 mai 2026, paragraphes 1 et 3–6','2026-05-20',
 limitation='État juridique annoncé en mai 2026 et revérifié en novembre ; l’exception sur les feuilles reste soumise aux limites de THC et aux autres conditions du communiqué.')
Q=source('quebec-products-2026','Règlement déterminant d’autres catégories de cannabis et certaines normes de composition et caractéristiques — C-5.3, r. 0.1','Légis Québec',
 'https://www.legisquebec.gouv.qc.ca/fr/document/rc/C-5.3,%20r.%200.1',
 'L’article 3 fixe 30 % p/p de THC hors comestibles ; l’article 4 exclut notamment confiseries, desserts et chocolat des comestibles vendus par la SQDC.',
 'Articles 3 et 4 ; texte officiel à jour au 1er juillet 2026','2026-07-01',
 limitation='Règlement québécois, pas limite mondiale ni règle fédérale générale. Les quantités juridiques ne sont pas des recommandations de dose.')
G=source('hc-composition','Guide on composition requirements for cannabis products','Health Canada',
 'https://www.canada.ca/en/services/health/publications/drugs-health-products/composition-requirements-cannabis-products.html',
 'La nicotine est interdite dans les extraits. Les comestibles ont une limite de THC par contenant ; leur caféine doit provenir d’ingrédients qui en contiennent naturellement et respecter une limite.',
 'Cannabis extracts, Prohibited ingredients ; Edible cannabis, Caffeine et Maximum quantities',
 limitation='Règles canadiennes consultées le 17 novembre 2026. Les limites de conditionnement et d’ingrédients ne sont pas des doses conseillées.')
P=source('fda-drug-identities','FDA and Cannabis: Research and Drug Approval Process','U.S. Food and Drug Administration',
 'https://www.fda.gov/news-events/public-health-focus/fda-and-cannabis-research-and-drug-approval-process',
 'La FDA distingue le nabilone synthétique non naturellement présent dans la plante et Epidiolex, médicament contenant du CBD purifié.',
 'Cannabis-related compounds, Examples ; paragraphes FDA has approved Epidiolex et Another FDA-approved drug',
 limitation='Seules l’identité et l’origine des substances sont retenues. La page contient une ancienne limite d’âge d’indication d’Epidiolex, non reprise ici.')
U=source('unodc-shake-trim','World Drug Report 2019, Booklet 5: Cannabis and hallucinogens','United Nations Office on Drugs and Crime',
 'https://www.minjusticia.gov.co/programas-co/ODC/Publicaciones/Publicaciones/WDR19_Booklet_5_CANNABIS_HALLUCINOGENS.pdf',
 'Shake correspond à des fragments détachés des fleurs ; trim aux feuilles retirées autour des fleurs.',
 'p. 31 (PDF p. 32), encadré Understanding cannabis products','2019-06',access='full-text',
 limitation='Rapport original UNODC hébergé par le ministère colombien de la Justice. Seule la distinction de matière végétale est reprise, sans données de consommation ni extraction.')
V=source('mildeca-product-categories-2026','L’indispensable sur le cannabidiol — catégories de produits','Mildeca',
 'https://www.drogues.gouv.fr/sites/default/files/2026-10/CBD_flyer_2026.pdf',
 'La page 2 distingue CBD cosmétique, alimentation animale, liquides de vapotage et déclaration des produits à fumer sans tabac.',
 'p. 2, Produits alimentaires et vétérinaires ; Produits cosmétiques ; Produits de vapotage','2026-10',access='full-text',
 limitation='Notice distincte de q2-en02-mildeca-2026 pour des passages supplémentaires effectivement relus. Les affirmations sur les fleurs/feuilles et sur l’autorité autorisant un nouvel aliment ne sont pas reprises.')
T=source('euda-flower-thca-heating','EU Drug Market: Cannabis — Production, transformation du THCA au fumage','EMCDDA and Europol, hébergé par EUDA',
 'https://www.euda.europa.eu/publications/eu-drug-markets/cannabis/production_en',
 'Lors du fumage des produits naturels, le THCA de la plante contribue au THC par sa conversion avec la chaleur.',
 'Biosynthesis of cannabinoids in cannabis, paragraphe When natural cannabis products are smoked','2023-11-16',
 limitation='Nouvelle notice pour un passage distinct de q2-rp01-euda-products-2023. Aucun paramètre ni méthode de transformation n’est repris.')

def q(key, level, prompt, opts, explanation, sid, locator, support, subject, sk, prop, objective,
      category='constituents', article='ref-resines-extraits', topic='evidence', jurisdiction=None, form='identification'):
    answer=len(questions)%4
    options=list(opts)
    correct=options.pop(0)
    options.insert(answer,correct)
    ed=dict(domain='active',category=category,subject=subject,subjectKey=sk,property=prop,expectedAnswer=correct,
      learningObjective=objective,factKey=key,form=form,
      difficultyRationale=('Reconnaissance d’une forme concrète ou d’un repère de produit, sans détail chimique avancé.' if level==1 else 'Connaissance spécifique du vocabulaire, d’une composition ou d’une règle de commercialisation du cannabis.'),
      sourceEvidence=[dict(sourceId=sid,locator=locator,support=support)])
    if jurisdiction: ed.update(jurisdiction=jurisdiction,reviewAfter='2027-05-17')
    questions.append(dict(id='hemp-q2-rp02-'+key,topicId=topic,level=level,prompt=prompt,options=options,
      answer=answer,explanation=explanation,articleId=article,sourceIds=[sid],editorial=ed))

q('sinsemilla-seedless-flower',1,'Que signifie « sinsemilla » lorsqu’on décrit des fleurs de cannabis ?',
 ['Sans graines','Sans résine','Sans parfum','Sans THC'],
 'Sinsemilla signifie littéralement « sans graine ». Le terme décrit des fleurs dépourvues de graines ; il ne signifie ni absence de résine ni absence de THC.',
 O,'Glossaire, entrée SINSEMILLA','Le terme espagnol signifie sans graine et s’applique aux sommités florales.','Sinsemilla','cannabis-sinsemilla','Sens de l’appellation','Lire un terme de présentation des fleurs sans en déduire un profil cannabinoïde.',topic='plant',category='botany')
q('charas-resin-name',2,'Dans le vocabulaire des produits du cannabis, à quelle famille appartient le charas ?',
 ['Aux résines de cannabis','Aux huiles de graines de chanvre','Aux boissons contenant du cannabis','Aux fleurs séchées entières'],
 'Charas est un nom de résine de cannabis, cité avec hashish par l’EMCDDA. Il ne désigne pas une variété précise ni une huile de graines.',
 E,'1. Analysis, premier paragraphe','La résine de cannabis est aussi connue sous les noms hashish et charas.','Charas','cannabis-charas','Famille de produit désignée','Reconnaître un nom de résine rencontré dans la culture du cannabis.')
q('moonrocks-flower-concentrate-kief',2,'Quelle composition caractérise les « moonrocks » de cannabis décrites par l’agence du Michigan ?',
 ['Fleur, concentré et couche de kief','Kief seul sous forme de bloc compact','Cristaux d’un seul cannabinoïde purifié','Fleur séchée sans ajout d’extrait'],
 'Dans cette définition, les moonrocks sont des produits composites : la fleur s’associe à un concentré et à du kief. Le nom ne désigne donc pas une fleur simplement très résineuse.',
 M,'p. 1, Moon rocks','Le produit fini combine une fleur, un concentré et du kief.','Moonrocks','cannabis-moonrocks','Composition composite du produit','Distinguer une fleur enrichie d’une fleur sans extrait ajouté.')
q('spliff-cannabis-tobacco',1,'Dans le vocabulaire anglophone décrit par l’ATS, que contient un spliff ?',
 ['Du cannabis mélangé à du tabac','Du cannabis mélangé à du kief uniquement','Du haschich sans fleur ni tabac','Des fleurs de cannabis sans aucun ajout'],
 'Le spliff associe cannabis et tabac dans du papier à rouler. Les usages du mot « joint » varient davantage selon les pays : il ne permet pas toujours la même distinction.',
 A,'Tableau 1, Inhaled co-use methods, Spliff','Spliff désigne cannabis et tabac en feuilles roulés ensemble.','Spliff','cannabis-spliff','Présence de tabac dans une forme roulée','Reconnaître un terme signalant une association avec le tabac.',topic='prevention')
q('traditional-blunt-tobacco-wrapper',1,'Dans sa définition traditionnelle, qu’est-ce qui distingue le blunt d’un joint au papier ordinaire ?',
 ['Une enveloppe de cigare faite de tabac','Une enveloppe en feuilles de chanvre','Un papier à rouler en fibres de lin','Une enveloppe en feuilles de bananier'],
 'Le blunt traditionnel utilise une enveloppe de cigare, donc du tabac et de la nicotine. Des produits modernes appelés blunts emploient toutefois des enveloppes sans tabac.',
 A,'Tableau 1, Blunt','Le blunt utilise une enveloppe de cigare faite de tabac ; cette enveloppe contient de la nicotine.','Blunt traditionnel','cannabis-blunt','Nature de l’enveloppe traditionnelle','Identifier une source de tabac distincte du contenu de cannabis.',topic='prevention')
q('dry-herb-vaporizer-flower',1,'Quel produit un vaporisateur dit « à herbes sèches » est-il conçu pour chauffer ?',
 ['Des fleurs de cannabis séchées','Une résine concentrée de type shatter','Un liquide de vapotage de cartouche','Une pâte concentrée de type wax'],
 'Le vaporisateur à herbes sèches chauffe les fleurs sans les brûler. Il se distingue d’un appareil destiné aux liquides ; certains modèles acceptent aussi des accessoires pour extraits.',
 A,'Tableau 1, Dry-herb vaporizer','Les fleurs sont chauffées sans combustion afin de produire un aérosol des composés actifs.','Vaporisateur de fleurs','cannabis-dry-herb-vaporizer','Matière destinée à un appareil à herbes sèches','Distinguer vaporisateur de fleurs et appareil à liquide.',topic='prevention')
q('bong-water-cools-smoke',1,'Dans un bong, quel élément est spécialement lié au refroidissement de la fumée décrit par Santé Canada ?',
 ['L’eau traversée par la fumée','Le foyer contenant les fleurs','L’embout par lequel on inhale','La tige reliant le foyer à la chambre'],
 'L’eau peut abaisser la température de la fumée et retenir certaines substances. Elle ne rend pas la fumée inoffensive et ne supprime pas la combustion du cannabis.',
 H,'Smoking accessories, Pipes','L’eau peut refroidir la fumée et filtrer certaines substances, sans rendre ce mode sûr.','Pipe à eau','cannabis-water-pipe','Refroidissement de la fumée par l’eau','Comprendre une fonction du bong sans la confondre avec une absence de risque.',topic='prevention',category='prevention',jurisdiction='Portée générale ; source Santé Canada')
q('cannabis-vaping-aerosol',1,'Que produit un appareil lorsqu’il vapote un extrait de cannabis ?',
 ['Un aérosol formé par le chauffage de l’extrait','Une fumée formée par la combustion de l’extrait','Un brouillard d’extrait nébulisé par ultrasons','Un aérosol expulsé à l’aide d’un gaz propulseur'],
 'Le vapotage forme un aérosol, qui peut contenir cannabinoïdes et autres substances. Le mot « vapeur » ne signifie donc pas que l’on inhale seulement de l’eau.',
 H,'Vaping, premier et deuxième paragraphes','Le vapotage est l’inhalation d’un aérosol produit par chauffage d’un extrait liquide ou solide.','Aérosol de cannabis','cannabis-vaping-aerosol','Nature de ce qui est inhalé','Distinguer aérosol de vapotage, vapeur d’eau et fumée.',topic='prevention')
q('cartridge-metals-device-source',2,'Santé Canada mentionne quel type de contamination pouvant migrer du matériel vers le liquide d’une cartouche de cannabis ?',
 ['Une contamination par des métaux','Une contamination par des mycotoxines','Une contamination par des résidus de pesticides','Une contamination par des bactéries intestinales'],
 'Des métaux peuvent migrer depuis le dispositif vers l’extrait, puis être inhalés dans l’aérosol. La composition de la fleur ne décrit donc pas à elle seule celle d’une cartouche.',
 H,'Vaping, deuxième paragraphe et notes 3–4','Des métaux peuvent migrer dans l’extrait et être inhalés dans l’aérosol.','Métaux des cartouches','cannabis-vape-cartridge-metals','Contribution du matériel à la contamination','Distinguer contaminants de la plante et contaminants provenant du dispositif.',topic='prevention',category='quality',article='ref-contaminants',jurisdiction='Portée générale ; source Santé Canada')
q('vape-heating-new-byproducts',2,'Quel phénomène peut former des composés absents du liquide initial dans l’aérosol d’une vapoteuse de cannabis ?',
 ['La dégradation thermique de certains ingrédients','Le transfert inchangé du liquide dans l’air','La simple dilution de l’aérosol dans l’air','La condensation de molécules inchangées en gouttelettes'],
 'Des travaux de Santé Canada ont observé des sous-produits lors du chauffage de certains ingrédients. Leur méthode de laboratoire ne reproduisait pas parfaitement un usage réel.',
 R,'Investigation of degradation by-products..., résultats et limite méthodologique','Certains ingrédients testés ont produit des sous-produits oxydatifs ou de dégradation.','Transformation du liquide de vapotage','cannabis-vaping-byproducts','Formation de composés absents de la formulation initiale','Comprendre pourquoi liquide initial et aérosol peuvent différer.',topic='prevention',category='quality',article='ref-contaminants',jurisdiction='Portée générale ; recherche Santé Canada')
q('evali-vitamin-e-acetate-2019',2,'Quel additif de certains liquides au THC a été associé à l’épidémie américaine de lésions pulmonaires EVALI en 2019 ?',
 ['L’acétate de vitamine E','L’huile de triglycérides à chaîne moyenne','Le propylène glycol','Les terpènes utilisés comme diluants'],
 'Le CDC a retrouvé cet épaississant dans les prélèvements pulmonaires étudiés. Ce résultat historique ne signifie pas que toutes les cartouches en contiennent ni qu’il explique chaque cas.',
 C,'p. 1040–1041, résultats des lavages et discussion','L’acétate de vitamine E a été identifié au site des lésions chez les patients de l’étude.','EVALI et additif de vape','evali-2019-vitamin-e-acetate','Additif impliqué dans un épisode de toxicité','Associer une alerte sur des produits au THC à la substance identifiée.',topic='prevention',category='prevention',article='ref-contaminants',jurisdiction='États-Unis, épidémie de 2019')
q('spice-k2-synthetic-cannabinoid-products',1,'Que désignent notamment les noms Spice et K2 sur le marché des substances psychoactives ?',
 ['Des produits à cannabinoïdes de synthèse','Deux catégories de fleurs de CBD naturelles','Des résines traditionnelles sans autre substance','Des huiles alimentaires de graines de chanvre'],
 'Spice et K2 sont des noms de produits destinés à imiter le THC avec des cannabinoïdes de synthèse. Une présentation « végétale » ou « encens » ne décrit pas leur substance active.',
 D,'What is Spice/K2, Synthetic Marijuana?','Spice et K2 sont des noms commerciaux de drogues de synthèse de la classe des cannabinoïdes.','Spice et K2','synthetic-cannabinoid-spice-k2','Nature des substances actives','Distinguer un produit de synthèse d’une fleur ou d’une résine traditionnelle.',topic='prevention',category='prevention')
q('thca-flower-heating-thc',2,'Lorsqu’une fleur riche en THCA est fumée, quelle conversion peut contribuer à ses effets intoxicants ?',
 ['Du THCA en THC','Du THCA en CBD','Du CBD en CBDA','Du THC en THCA'],
 'La chaleur peut convertir le THCA de la fleur en THC. Une faible quantité de THC mesurée avant chauffage ne suffit donc pas à décrire ce produit lorsqu’il est fumé.',
 T,'Biosynthesis of cannabinoids in cannabis, paragraphe When natural cannabis products are smoked','Lors du fumage, le THCA présent dans la plante est converti en THC.','Fleur riche en THCA','cannabis-thca-flower','Transformation du profil à la consommation avec chauffage','Relier le THCA d’un produit floral à son potentiel après chauffage.',topic='prevention',category='prevention',article='ref-thc',jurisdiction='Portée générale ; source EUDA')
q('canada-excise-stamp-license-holder',1,'Au Canada, que signale le timbre d’accise sur un emballage de cannabis ?',
 ['Une provenance auprès d’un titulaire de licence de Santé Canada','Une autorisation de prescrire ce produit comme médicament','Une absence de THC et de tout autre cannabinoïde','Une origine exclusivement biologique de la culture'],
 'Le timbre indique cette provenance réglementée. Certains produits à très faible THC et les médicaments sur ordonnance en sont exemptés ; le timbre n’est pas une promesse d’innocuité.',
 L,'3. Excise stamp','Le timbre indique une provenance auprès d’un titulaire de licence, avec certaines exemptions.','Timbre d’accise canadien','canada-cannabis-excise-stamp','Sens du timbre sur le produit','Reconnaître un repère de provenance du marché réglementé.',topic='prevention',category='quality',article='ref-reglementation-produits',jurisdiction='Canada, règles consultées en novembre 2026')
q('canada-standard-symbol-thc',1,'Au Canada, quelle substance le symbole standardisé du cannabis signale-t-il sur un emballage ?',
 ['Le THC','Le CBD seul','La nicotine','L’alcool éthylique'],
 'Le symbole est requis lorsque le produit dépasse le seuil canadien de THC indiqué par Santé Canada. Il ne constitue pas un logo de qualité, une marque ou un symbole propre au CBD.',
 L,'1. Standardized cannabis symbol','Le symbole est exigé au-delà de 10 microgrammes de THC par gramme.','Symbole canadien du cannabis','canada-standard-cannabis-symbol','Substance signalée par le symbole','Comprendre un repère spécifique d’étiquetage du cannabis.',topic='prevention',category='quality',article='ref-reglementation-produits',jurisdiction='Canada, règles consultées en novembre 2026')
q('france-cbd-foods-not-authorised-2026',1,'En France en novembre 2026, quel est le statut des bonbons auxquels du CBD a été ajouté comme ingrédient ?',
 ['Ils ne sont pas autorisés comme denrées alimentaires','Ils sont autorisés dès qu’ils ont moins de 0,3 % de THC','Ils sont autorisés sous la seule condition d’être réservés aux adultes','Ils sont autorisés s’ils sont vendus comme compléments alimentaires'],
 'Le communiqué français rappelle l’absence d’autorisation du CBD comme nouvel aliment. Une mention « naturel » ne remplace pas cette autorisation, y compris pour les compléments alimentaires.',
 F,'Communiqué, paragraphes 1 et 3','Les denrées incluant du CBD parmi leurs ingrédients ne sont pas autorisées au titre des nouveaux aliments.','Aliments à CBD ajouté en France','france-cbd-foods-novel-food','Statut des denrées enrichies en CBD','Distinguer un ingrédient commercialisé d’un ingrédient alimentaire autorisé.',topic='prevention',category='quality',article='ref-reglementation-produits',jurisdiction='France et Union européenne, novembre 2026')
q('france-leaf-water-infusion-exception',2,'En France en 2026, quel produit de feuilles de chanvre est distingué des aliments enrichis en CBD dans le communiqué officiel ?',
 ['Des feuilles pour infusion aqueuse, sans enrichissement','Des feuilles additionnées d’isolat de CBD','Des bonbons enrichis d’extrait de feuilles','Des boissons enrichies de cannabinoïdes de synthèse'],
 'Les feuilles exclusivement destinées à une infusion aqueuse ne sont pas classées comme nouvel aliment. Cette exception exige notamment l’absence d’enrichissement et le respect des limites de THC.',
 F,'Communiqué, paragraphes Seules les graines... et Elles peuvent donc...','Les feuilles pour infusion aqueuse ne sont pas nouveaux aliments ; l’enrichissement en extraits de cannabinoïdes est exclu.','Feuilles pour infusion aqueuse','france-hemp-leaf-water-infusion','Exception sans enrichissement dans le régime alimentaire','Ne pas confondre feuilles pour infusion et aliment enrichi en CBD.',topic='prevention',category='quality',article='ref-reglementation-produits',jurisdiction='France et Union européenne, novembre 2026')
q('france-pure-cbd-cosmetic-ingredient',1,'Selon la Mildeca en 2026, dans quelle catégorie le CBD pur peut-il être autorisé comme ingrédient en France ?',
 ['Les produits cosmétiques','Les bonbons alimentaires enrichis en CBD','Les aliments pour animaux enrichis en CBD','Les compléments alimentaires au CBD sans autorisation'],
 'Le flyer distingue l’emploi de CBD pur en cosmétique de son ajout aux aliments. Il rappelle aussi une limite de THC : l’autorisation d’un ingrédient ne vaut pas pour toute formulation.',
 V,'p. 2, Produits cosmétiques','Le CBD pur est autorisé comme ingrédient cosmétique ; la teneur en THC ne doit pas dépasser 0,3 %.','CBD actif en cosmétique','france-cbd-cosmetic-ingredient','Destination cosmétique autorisée du CBD pur','Distinguer les règles du CBD actif selon la destination du produit.',topic='prevention',category='quality',article='ref-reglementation-produits',jurisdiction='France, octobre–novembre 2026')
q('eu-cbd-animal-feed-unauthorised-additive',2,'En 2026, quel statut la Mildeca indique-t-elle pour le CBD ajouté aux aliments pour animaux dans l’Union européenne ?',
 ['Un additif non autorisé','Un additif réservé à la prescription vétérinaire','Un additif autorisé pour les chiens et chats','Un additif interdit car classé comme stupéfiant'],
 'Le CBD est décrit comme additif non autorisé dans l’alimentation animale. Ce statut ne se déduit pas de celui des graines de chanvre : un actif ajouté et une matière première diffèrent.',
 V,'p. 2, Produits alimentaires et vétérinaires','Le CBD est un additif non autorisé par la réglementation européenne des aliments pour animaux.','CBD dans les aliments pour animaux','eu-cbd-animal-feed','Absence d’autorisation comme additif alimentaire animal','Distinguer chanvre alimentaire et ajout de CBD destiné à l’animal.',topic='prevention',category='quality',article='ref-reglementation-produits',jurisdiction='Union européenne, octobre–novembre 2026')
q('france-vape-cbd-chemical-or-extracted',2,'Quelles origines du CBD la Mildeca mentionne-t-elle explicitement pour les liquides de vapotage autorisés en France en 2026 ?',
 ['Extraction du chanvre ou synthèse chimique','Fermentation ou extraction du chanvre','Transformation du THC ou fermentation','Synthèse chimique ou transformation du THC'],
 'Le flyer mentionne les deux origines. La conformité du liquide reste soumise aux obligations applicables, notamment REACH et la limite de THC : l’origine du CBD n’est pas le seul critère.',
 V,'p. 2, Produits de vapotage','Le CBD d’origine chimique ou extrait du chanvre est admis sous réserve des obligations REACH et de la limite de THC.','Origine du CBD de vapotage','france-cbd-vape-origin','Deux origines possibles du CBD d’un liquide','Ne pas assimiler conformité et origine exclusivement végétale.',topic='prevention',category='quality',article='ref-reglementation-produits',jurisdiction='France, octobre–novembre 2026')
q('france-smoking-hemp-anses-declaration',2,'En France en 2026, à quel organisme les fabricants déclarent-ils les produits à fumer au chanvre sans tabac ?',
 ['À l’Anses','À l’Agence nationale de sécurité du médicament','À l’Autorité européenne de sécurité des aliments','À l’Agence européenne des produits chimiques'],
 'La Mildeca rappelle la déclaration à l’Anses des produits à fumer à base de plantes autres que le tabac. Cette démarche de déclaration n’est pas une autorisation de médicament.',
 V,'p. 2, Produits de vapotage, phrase sur les produits à fumer','Les fabricants et distributeurs doivent déclarer à l’Anses les produits à fumer à base de plantes hors tabac.','Déclaration des produits à fumer','france-herbal-smoking-products','Organisme de déclaration d’un produit à fumer au chanvre','Identifier le cadre de déclaration de cette catégorie de produits.',topic='prevention',category='quality',article='ref-reglementation-produits',jurisdiction='France, octobre–novembre 2026')
q('quebec-nonedible-thc-cap-30-percent',2,'Au Québec, quelle concentration maximale de THC le règlement fixe-t-il au cannabis hors produits comestibles vendus par la SQDC ?',
 ['30 % en masse','3 % en masse','60 % en masse','90 % en masse'],
 'L’article 3 fixe ce plafond à 30 % poids par poids. Il explique pourquoi les concentrés très riches en THC proposés ailleurs ne correspondent pas tous à l’offre réglementaire québécoise.',
 Q,'Article 3','La concentration de THC du cannabis hors comestibles ne doit pas dépasser 30 % p/p.','Plafond québécois de THC','quebec-cannabis-thc-concentration-cap','Limite de concentration hors comestibles','Comprendre une différence concrète entre marchés réglementés.',topic='prevention',category='quality',article='ref-reglementation-produits',jurisdiction='Québec, texte à jour au 1er juillet 2026')
q('quebec-edible-chocolate-ban',1,'Au Québec en 2026, quelle catégorie de comestibles au cannabis le règlement exclut-il explicitement de la vente par la SQDC ?',
 ['Les chocolats et les confiseries','Les boissons au cannabis','Les huiles alimentaires au cannabis','Les bouchées salées au cannabis'],
 'Le règlement exclut explicitement chocolat, friandises, confiseries et desserts. La catégorie des comestibles existe au Québec, mais son offre autorisée ne se confond pas avec celle d’autres provinces.',
 Q,'Article 4','Le produit comestible ne peut être notamment une friandise, une confiserie, un dessert ou du chocolat.','Formats comestibles au Québec','quebec-cannabis-edible-formats','Exclusion explicite du chocolat','Reconnaître une différence de formes autorisées entre marchés.',topic='prevention',category='quality',article='ref-reglementation-produits',jurisdiction='Québec, texte à jour au 1er juillet 2026')
q('canada-edible-thc-container-limit',2,'Au Canada, quel plafond fédéral de THC total s’applique au contenant immédiat d’un produit comestible au cannabis ?',
 ['10 mg','100 mg','500 mg','1 000 mg'],
 'La limite s’applique au total du contenant immédiat, même s’il comprend plusieurs morceaux. C’est une règle de conditionnement du marché légal, pas une quantité conseillée à consommer.',
 G,'Edible cannabis, Maximum quantities','Le comestible est limité à 10 mg de THC total par contenant immédiat, sous les tolérances réglementaires.','Contenant de comestibles canadien','canada-edible-thc-immediate-container','Plafond réglementaire du conditionnement','Distinguer limite de produit et recommandation de consommation.',topic='prevention',category='quality',article='ref-reglementation-produits',jurisdiction='Canada, règles consultées en novembre 2026')
q('canada-extract-no-nicotine',1,'Au Canada, quelle substance est expressément interdite dans les extraits de cannabis ?',
 ['La nicotine','Le CBD','Les terpènes du cannabis','Une huile de support conforme'],
 'Santé Canada exclut la nicotine des extraits de cannabis. Une cartouche de cannabis et un liquide nicotiné ne relèvent donc pas d’une même formule réglementaire interchangeable.',
 G,'Cannabis extracts, Prohibited ingredients, Note that nicotine...','La nicotine n’est pas permise dans les extraits de cannabis.','Nicotine dans les extraits','canada-cannabis-extract-nicotine','Ingrédient explicitement exclu','Distinguer produits au cannabis et produits nicotinés dans le cadre canadien.',topic='prevention',category='quality',article='ref-reglementation-produits',jurisdiction='Canada, règles consultées en novembre 2026')
q('canada-edible-caffeine-natural-ingredients',2,'Au Canada, comment un comestible au cannabis peut-il légalement contenir de la caféine ?',
 ['Par des ingrédients naturellement caféinés, sous plafond','Par ajout de caféine purifiée, sous le même plafond','Par ajout de caféine, si le produit est une boisson','Par ajout de caféine, si le produit est à dominante CBD'],
 'La caféine peut venir, par exemple, du chocolat ou du thé. Le guide impose une limite par contenant et interdit l’emploi de caféine ou de citrate de caféine comme additif.',
 G,'Edible cannabis, Caffeine','La caféine doit être naturellement apportée par les ingrédients et rester sous le plafond ; l’ajout de caféine ou de citrate est interdit.','Caféine des comestibles','canada-edible-caffeine','Origine admise de la caféine','Comprendre une exception de composition des comestibles.',topic='prevention',category='quality',article='ref-reglementation-produits',jurisdiction='Canada, règles consultées en novembre 2026')
q('nabilone-synthetic-not-native',2,'Comment la FDA décrit-elle l’origine du nabilone, actif du médicament Cesamet ?',
 ['Un cannabinoïde de synthèse non naturellement présent dans la plante','Du delta-9-THC directement isolé des fleurs','Du CBD purifié provenant des fleurs','Du CBN naturellement présent dans une résine vieillie'],
 'Le nabilone est un composé synthétique apparenté au THC. « Médicament lié au cannabis » n’implique donc pas que son actif provienne directement d’une extraction de la plante.',
 P,'Cannabis-related compounds, Examples ; Another FDA-approved drug','La FDA décrit le nabilone comme synthétique et non naturellement présent dans la plante.','Nabilone / Cesamet','nabilone-drug-identity','Origine synthétique distincte d’un extrait','Distinguer médicament apparenté au cannabis et extrait végétal.',article='ref-origines-formulations')
q('epidiolex-purified-cbd',2,'Quel actif caractérise la formulation du médicament Epidiolex décrite par la FDA ?',
 ['Du cannabidiol purifié','De la résine complète non standardisée','Du nabilone de synthèse','Un mélange équilibré de THC et de CBD'],
 'Epidiolex contient une forme purifiée de CBD. Cette formulation de médicament se distingue d’une huile commerciale de composition variable et d’un produit associant THC et CBD.',
 P,'Paragraphe FDA has approved Epidiolex','Epidiolex contient une forme purifiée de cannabidiol.','Epidiolex','epidiolex-purified-cbd','Identité de l’actif de la formulation','Reconnaître une formulation de médicament au CBD sans généraliser son autorisation aux autres huiles.',article='ref-cbd')
q('shake-flower-fragments-versus-trim-leaves',2,'Dans le lexique des produits anglophones, quelle différence sépare « shake » et « trim » ?',
 ['Shake : fragments de fleurs ; trim : feuilles retirées autour','Shake : feuilles retirées ; trim : fragments de fleurs','Shake : fleurs entières ; trim : fleurs broyées','Shake : fleurs matures ; trim : fleurs immatures'],
 'Le rapport UNODC distingue les petits fragments détachés des fleurs des feuilles retirées autour de celles-ci. Ces mots décrivent la matière végétale, pas une variété ou un taux de THC.',
 U,'p. 31, encadré Understanding cannabis products','Shake correspond à de petits morceaux de fleurs détachés ; trim aux feuilles retirées de la fleur.','Shake et trim','cannabis-shake-trim','Distinction entre fragments floraux et feuilles','Lire des descriptions de matière première végétale.',form='comparaison')
q('spacecake-cannabis-cake',1,'Dans la culture des produits du cannabis, que désigne un « space-cake » ?',
 ['Un gâteau contenant du cannabis','Un bloc de haschich moulé en gâteau','Un mélange de fleurs vendu pour être fumé','Un comprimé de cannabinoïde de synthèse'],
 'Space-cake désigne un gâteau intégrant du cannabis. Le nom décrit un produit à ingérer ; il ne précise ni sa composition cannabinoïde ni la quantité de THC qu’il contient.',
 O,'Glossaire, entrée SPACE-CAKE','Le space-cake est un gâteau intégrant du cannabis dans sa préparation.','Space-cake','cannabis-space-cake','Forme alimentaire désignée','Reconnaître un terme de culture des produits sans y lire une composition garantie.',topic='prevention')

if __name__ == '__main__':
    assert len(questions)==30
    for item in questions:
        assert len(item['id'])<=75
        assert len(item['prompt'])<=150,(item['id'],'prompt',len(item['prompt']))
        assert len(item['explanation'])<=240,(item['id'],'explanation',len(item['explanation']))
        assert len(set(item['options']))==4
        assert all(len(o)<=75 for o in item['options']),(item['id'],'options',[(len(o),o) for o in item['options']])
    article_ids={a['id'] for a in json.loads((ROOT.parent/'encyclopedia-revision/baseline-catalog.json').read_text(encoding='utf-8'))['articles']}
    assert all(q['articleId'] in article_ids for q in questions)
    assert len({q['id'] for q in questions})==len(questions)
    assert all(set(q['sourceIds'])<=set(s['id'] for s in sources) for q in questions)
    batch=dict(batchId='r-products-02',author=AUTHOR,role='Formes, composition et commercialisation des produits à actifs',questions=questions,sources=sources)
    (ROOT/'batches/r-products-02.json').write_text(json.dumps(batch,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    facts=dict(batchId='r-products-02',author=AUTHOR,date=DAY,status='author_complete_pending_independent_review',
      count=len(questions),levels=dict(Counter(str(q['level']) for q in questions)),domain='active',
      revisionAfterIndependentReview=dict(review='reviews/r-products-02.json',correctedObjects=9,preservedApprovedObjects=21,sourceObjectsUnchanged=True,status='awaiting_coordinator_arbitration_no_self_approval'),
      contract='AUTHORING.md, correction du 17 novembre 2026 ; 800 active / 100 food / 100 materials.',
      neighbourSearch=dict(index='docs/quiz-2000/fact-index.jsonl',
        terms=['sinsemilla','charas','moonrock','spliff','blunt','spacecake','nabilone','Epidiolex','shake','trim','aérosol','adulter','infusion','FDA','nicotine','caféine'],
        neighbours=[
          dict(id='hemp-q2-en02-cannabinoid-supportive-care',decision='Indication antiémétique existante non reprise : nabilone teste son origine synthétique.'),
          dict(id='hemp-q2-en02-cbd-adulterated-substances',decision='Nature des substances non déclarées et conduite à tenir non reprises : Spice/K2 teste des appellations de produits spécifiques.'),
          dict(id='hemp-q2-rp01-dronabinol-delta9-thc-identity',decision='Dronabinol non repris : nabilone est un autre actif et Epidiolex une formulation au CBD.'),
          dict(id='hemp-q2-rp01-total-thc-molar-mass-convention',decision='Formule analytique non reprise : la fleur THCA teste la transformation du produit au fumage.'),
          dict(id='hemp-evidence-decarboxylation',decision='La molécule CO2 libérée n’est pas retestée ; application au produit floral et à la faiblesse du THC initial.'),
          dict(id='hemp-q2-rp01-oral-oil-distinct-vape-liquid',decision='L’huile alimentaire et le liquide de vape ne sont pas comparés à nouveau ; ici aérosol, matériel et sous-produits.'),
          dict(id='hemp-q2-rp01-wax-pen-concentrate-accessory',decision='La destination concentrés du waxpen n’est pas reprise : le vaporisateur à herbes sèches teste la fleur.'),
          dict(id='hemp-q2-rp01-infused-pre-roll-added-extract',decision='Les moonrocks sont une présentation composite distincte, fleur entière/concentré/kief, pas un préroulé.')]),
      actualReadings=[dict(sourceId=s['id'],url=s['url'],locator=s['consultation']['locator'],reader=AUTHOR,date=DAY) for s in sources]+[
        dict(sourceId='q2-en02-mildeca-2026',url='https://www.drogues.gouv.fr/sites/default/files/2026-10/CBD_flyer_2026.pdf',locator='p. 2, produits alimentaires/vétérinaires, cosmétiques et vapotage',reader=AUTHOR,date=DAY,limitation='Passage fleurs/feuilles non repris ; communiquer alimentaire MAASA plus précis sur infusions et autorité.'),
        dict(sourceId='q2-rp01-euda-products-2023',url='https://www.euda.europa.eu/publications/eu-drug-markets/cannabis/production_en',locator='Biosynthesis of cannabinoids in cannabis, paragraphe sur le fumage',reader=AUTHOR,date=DAY)],
      safeguards=['Aucun protocole de fabrication, dosage conseillé ni recette psychoactive','Limite de 10 mg explicitement juridique et liée au contenant','Cosmétique limité au CBD actif, aucune question sur huile de graines cosmétique','Aucune inspiration de cultivar ou producteur du site','Lot complet de 30, aucun brouillon dans batches/','Aucune autoapprobation, revue et banque active non modifiées'],
      facts=[dict(id=x['id'],domain=x['editorial']['domain'],factKey=x['editorial']['factKey'],expectedAnswer=x['editorial']['expectedAnswer']) for x in questions])
    (ROOT/'facts/r-products-02.json').write_text(json.dumps(facts,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(dict(questions=len(questions),sources=len(sources),levels=facts['levels'])))
