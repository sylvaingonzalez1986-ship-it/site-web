import json
from pathlib import Path
from collections import Counter

ROOT=Path(__file__).resolve().parents[1]
DAY='2026-11-17'
AUTHOR='rebalance_products_sol'
sources=[]
questions=[]

def source(key,title,org,url,locator,support,published=None,author=None,access='full-text',limitation=None):
    sid='q2-rm01-'+key
    sources.append(dict(id=sid,title=title,organization=org,url=url,verifiedAt=DAY,author=author or org,
      published=published or 'Date non indiquée sur la page consultée',passage=support,access=access,
      documentKind='original-research' if access in ['full-text','abstract'] else 'institutional-document',
      limitation=limitation or 'Passages indiqués effectivement lus ; pas de promesse thérapeutique ni de généralisation des résultats à tous produits.',
      consultation=dict(reader=AUTHOR,date=DAY,locator=locator,result='Texte original ou document institutionnel ouvert et passage indiqué lu.')))
    return sid

G=source('galasso16','Variability in Seed Traits in a Collection of Cannabis sativa L. Genotypes','Frontiers in Plant Science',
 'https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2016.00688/full',
 'Introduction ; Results, Table 4 ; Discussion, paragraphes phytic acid et TI',
 'Présence des acides aminés essentiels ; huile contenant du GLA oméga-6 ; phytates mesurés dans les tourteaux, limitant la disponibilité de minéraux.',
 '2016-05-20','I. Galasso, R. Russo, S. Mapelli, E. Ponzoni, I. M. Brambilla, G. Battelli et R. Reggiani',
 limitation='Étude de vingt génotypes, une année. Pas de classement universel de cultivars, ratio idéal ou bénéfice clinique déduit de la composition.')
T=source('tang06','Physicochemical and functional properties of hemp protein isolate','Journal of Agricultural and Food Chemistry / PubMed',
 'https://pubmed.ncbi.nlm.nih.gov/17090145/','Résumé, premières phrases',
 'L’édestine est le composant protéique majeur de l’isolat de graines étudié.',
 '2006-11-15','Chuan-He Tang, Zi Ten, Xian-Sheng Wang et Xiao-Quan Yang',access='abstract',
 limitation='Résumé original intégral lu ; pas d’accès revendiqué au texte payant. Aucune promesse nutritionnelle relative aux enfants reprise.')
B=source('bhatia18','Marijuana and Stoned Fruit','Annals of Allergy, Asthma & Immunology / UC San Diego',
 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5936671/','Observation clinique, paragraphes 2–4 et Discussion',
 'Anaphylaxie documentée après ingestion de graines de chanvre ; tests cutanés positifs ; cas clinique ne mesurant pas la fréquence dans la population.',
 '2018-02-02','Prerana Bhatia, Meng Chen et Sandra Christiansen',
 limitation='Cas individuel. Le rôle des réactions croisées est discuté comme possibilité ; aucune prévalence ni diagnostic individuel déduit.')
I=source('inrae-hazelnut','Research and Innovation 2024 — TRANSFORM','INRAE',
 'https://www.inrae.fr/sites/default/files/pdf/rapport_fm_2024-eng.pdf','p. 54 imprimée, Results et Future outlook',
 'L’équipe rapporte une réaction croisée IgE entre protéines de noisette et de graines de chanvre au laboratoire. Des évaluations cliniques restent nécessaires.',
 '2024','INRAE TRANSFORM, résultats de P. Beriziky et collaborateurs',
 limitation='Compte rendu institutionnel de l’équipe de recherche ; ne démontre pas que toute personne allergique à la noisette réagit cliniquement au chanvre.')
M=source('mihoc12','Nutritive quality of Romanian hemp varieties with special focus on oil and metal contents of seeds','Chemistry Central Journal',
 'https://link.springer.com/article/10.1186/1752-153X-6-122','Résumé, Conclusion ; Background, risque de métaux dans les graines',
 'Du cadmium a été mesuré dans les graines des plantes étudiées sur sols concernés ; les graines ne sont donc pas nécessairement épargnées par les contaminants du sol.',
 '2012-10-23','Marcela Mihoc, Georgeta Pop, Ersilia Alexa et Isidora Radulov',
 limitation='Résultats situés sur des sols étudiés, pas des concentrations représentatives des aliments du commerce. Conseils nutritionnels et affirmations de santé de l’introduction exclus.')
C=source('china-bama','广西·休养天堂 栖游巴马 — Spécialités culinaires de Bama','Ministère de la Culture et du Tourisme de Chine',
 'https://zhuanti.mct.gov.cn/xczgshsh2023/syxj/detail_shi/3817.html','Rubrique 五, 特色美食, entrée 火麻',
 'À Bama dans le Guangxi, la présentation officielle cite une soupe et un tofu préparés à partir de graines de chanvre moulues.',
 '2023-07-17',access='official-page',limitation='Source touristique officielle utilisée pour l’usage culinaire seulement ; allégations de longévité et de santé exclues.')
F=source('fda-gras2018','FDA Responds to Three GRAS Notices for Hemp Seed-Derived Ingredients for Use in Human Food','FDA',
 'https://www.fda.gov/food/hfp-constituent-updates/fda-responds-three-gras-notices-hemp-seed-derived-ingredients-use-human-food',
 'Constituent Update, 20 décembre 2018, premier paragraphe',
 'Les trois notifications sans questions concernent les graines décortiquées, la poudre protéique de graines et l’huile de graines, sous leurs conditions d’usage prévues.',
 '2018-12-20',access='official-page',limitation='Décision datée de 2018 sur trois ingrédients de graines, pas autorisation générale du cannabis, de cannabinoïdes ajoutés ou de toute formulation.')
Q=source('queensland-seed-food','Low THC Hemp foods','Queensland Government',
 'https://www.qld.gov.au/health/staying-healthy/food-pantry/food-safety-for-consumers/food-warnings-and-advice/low-thc-hemp-foods',
 'Legal hemp seed foods ; The plant, dernier paragraphe',
 'Les graines vendues au détail comme aliment doivent être décortiquées et non viables. Les graines entières viables peuvent servir à fabriquer certains aliments.',
 access='official-page',limitation='Règle australienne de vente au détail consultée en novembre 2026. Ne pas l’étendre à la vente de semences ni aux graines destinées à la transformation.')
N=source('beran20','Extraction and Micronization of Edestin from Hemp Seed','Food Research Institute Prague / NANOCON 2020',
 'https://www.confer.cz/nanocon/2020/download/3724-extraction-and-micronization-of-edestin-from-hemp-seed.pdf',
 'p. 1, Abstract et Introduction ; p. 2, §2.2',
 'La fraction albumine des protéines de graines est soluble dans l’eau ; l’édestine globuline est soluble dans une solution saline.',
 '2020-10','Milos Beran, Ondrej Vltavsky et Josef Drahorad',limitation='Recherche sur des protéines alimentaires de graines. Aucun paramètre de procédé ni avantage clinique de peptides repris.')
R=source('bai25-seed-oil-flavour','Characterization of Key Odorants in Hemp Seed Oil Extracted from the Hemp Seeds Roasted Under Various Conditions','Processes',
 'https://www.mdpi.com/2227-9717/13/2/530','Abstract, paragraphes odorants et reconstitution aromatique ; Introduction',
 'Des pyrazines identifiées dans l’huile de graines torréfiées contribuent aux notes grillées ; les pinènes, myrcène et ocimène sont liés à des notes fraîches/herbacées.',
 '2025-02-13','Yuchen Bai, Ningke You, Hongyu Tian et Xuebing Zhao',limitation='Analyse et évaluations sensorielles sur les huiles étudiées. Pas de réglage culinaire conseillé ; affirmations promotionnelles nutritionnelles de l’introduction exclues.')
J=source('mijas25-cottonization','Valorization of agricultural industrial hemp by-products for textile applications','Cellulose',
 'https://link.springer.com/article/10.1007/s10570-025-06557-0','Introduction, paragraphes lignin et cottonization ; Abstract',
 'La cotonisation divise les fibres techniques en agrégats plus fins pour les équipements de type coton. La lignine contribue à la rigidité et à la rugosité des fibres de chanvre.',
 '2025-05-10','Gabriela Mijas, Anke Golla, Remedios Prieto, Francesc Cano, Inés Algaba, Marta Riba-Moliner et Diana Cayuela',
 limitation='Propriétés et objectif textile du traitement ; allégations générales UV, antibactériennes et écologiques de l’introduction exclues.')
S=source('sankari00-bast','Comparison of bast fibre yield and mechanical fibre properties of hemp cultivars','Industrial Crops and Products / MTT Finland',
 'https://www.votehemp.com/wp-content/uploads/2018/09/381.pdf','p. 74, Introduction, paragraphes primary and secondary fibres',
 'Les fibres libériennes primaires sont bien plus longues que les secondaires et fournissent les faisceaux longs recherchés pour les textiles.',
 '2000','Hannele S. Sankari',limitation='PDF de l’article original Elsevier, copie hébergée par Vote Hemp ; titre/auteur/pagination vérifiés. Pas de comparaison de rendement ni conseil de culture repris.')
A=source('rissanen23-recycling','Chemical recycling of hemp waste textiles via ionic liquid based dry-jet-wet spinning','Textile Research Journal / Aalto University',
 'https://acris.aalto.fi/ws/portalfiles/portal/115488051/CHEM_Rissanen_et_al_Chemical_recycling_2023_Textile_Research_Journal.pdf',
 'p. 2545, Abstract ; p. 2546, Chemical recycling',
 'Du tissu de chanvre a été dissous, puis sa cellulose régénérée en nouvelles fibres, filée et tricotée. Il s’agit de recyclage chimique, distinct du simple effilochage.',
 '2023-06-01','Marja Rissanen, Inge Schlapp-Hackl, Daisuke Sawada, Susanna Raiskio, Krishna Ojha, Edward Smith et Herbert Sixta',
 limitation='Démonstration expérimentale de faisabilité, pas description de la voie actuelle de tous vêtements de chanvre. Paramètres chimiques et mécaniques non repris.')
P=source('kyoto-katabira','Summer Kimono: Hitoe and Katabira','Kyoto National Museum',
 'https://www.kyohaku.go.jp/old/eng/theme/floor1_4/past/sensyoku_20180719.html','Présentation de l’exposition, deuxième paragraphe',
 'Le musée décrit le katabira en chanvre ou ramie comme un kimono non doublé porté au plus fort de la chaleur estivale.',
 '2018-07-19',access='official-page',limitation='Usage textile historique présenté par le musée ; chanvre et ramie sont deux matériaux possibles, sans prétendre que tous les katabira sont en chanvre.')
H=source('cenc-finishes','Guide des bonnes pratiques — Tome 3, Béton et mortier de chanvre','Construire en Chanvre, programme PACTE',
 'https://www.construire-en-chanvre.fr/documents/pdf/formations/CenC_Bonnes_Pratiques_Tome_3.pdf',
 'p. 38–39 imprimées, gobetis ; p. 44–45, souplesse ; p. 64–65, gypse ; p. 74–77, finitions et vapeur',
 'Une première couche protège de la pluie ; les finitions doivent tenir compte de la déformabilité et laisser migrer la vapeur ; le gypse affecte différemment absorption et réduction acoustiques.',
 author='Quentin Pichon et Jean-Marc Naumovic',limitation='Préconisations professionnelles attribuées, pas norme universelle ni garantie de performance. La préface contient des récits historiques non fiables qui sont expressément exclus, de même que les promesses sanitaires.')
sources[-1]['documentKind']='professional-guide'
D=source('dreal-fibre-excerpt','Recueil technique des matériaux biosourcés — Filasse et laine de chanvre','DREAL Centre-Val de Loire',
 'https://www.centre-val-de-loire.developpement-durable.gouv.fr/IMG/pdf/recueil_technique_13-07-18_vf.pdf',
 'p. 7, Filasse de chanvre, Fabrication ; Laine de chanvre, Fabrication — extrait indexé',
 'L’extrait indique la filasse de chanvre pour étanchéifier les raccords en plomberie et un liant polyester pour maintenir les fibres d’une laine isolante.',
 '2018-07',access='excerpt',limitation='Ouverture directe : maintenance. Extrait institutionnel indexé effectivement lu par recherche ciblée du titre et du nom du PDF ; aucune lecture intégrale revendiquée. Description du document 2018, pas composition de tous produits actuels.')
sources[-1]['consultation']['result']='URL originale ouverte mais en maintenance ; extrait indexé des deux rubriques effectivement lu, accès déclaré excerpt.'
E=source('cerema-earth-hemp','EcoTerra : recherche sur les performances des bétons terre-chanvre','Cerema',
 'https://www.cerema.fr/fr/actualites/ecoterra-projet-recherche-performances-betons-terre-chanvre',
 'Favoriser l’utilisation des isolants terre-chanvre, premiers paragraphes',
 'Le matériau étudié associe le chanvre à une terre argileuse crue, comme liant au lieu du système chaux-chanvre.',
 '2022-07-01',access='official-page',limitation='La composition est retenue ; chiffres globaux carbone/coût, compostabilité et chronologie du projet contradictoire dans la page ne sont pas repris.')
V=source('pretot14-lca','Life cycle assessment of a hemp concrete wall: impact of thickness and coating','Building and Environment / Université Européenne de Bretagne',
 'https://www.scribd.com/document/765592222/pretot2014','Manuscrit accepté, Abstract ; §4.2, Fig. 5, contribution des matériaux',
 'Dans le mur chaux-chanvre modélisé, la fabrication du liant constitue le premier poste parmi les matériaux pour énergie primaire, consommation d’eau et pollution de l’air.',
 '2014','Sylvie Pretot, Florence Collet et Charles Garnier',
 limitation='Manuscrit original accepté consulté sur un miroir Scribd, identifié par auteurs, titre et DOI10.1016/j.buildenv.2013.11.010. HAL original bloqué et éditeur inaccessible. Résultat situé au mur et au scénario étudiés, aucune neutralité carbone universelle.')

def q(key,domain,level,prompt,options,explanation,sid,locator,support,subject,subjectkey,prop,objective,form='identification',article=None,jurisdiction=None):
    n=len(questions)%4
    rotated=options[-n:]+options[:-n] if n else options
    ed=dict(domain=domain,category='food' if domain=='food' else 'hemp-uses',subject=subject,subjectKey=subjectkey,
      property=prop,expectedAnswer=options[0],learningObjective=objective,factKey=key,form=form,
      difficultyRationale={1:'Usage ou propriété concrète compréhensible sans vocabulaire spécialisé.',2:'Connaissance ciblée de la composition ou du comportement d’un produit de chanvre.',3:'Interprétation de propriétés chimiques ou physiques spécialisée, avec contexte explicite.',4:'Mise en relation technique de plusieurs mécanismes propres au matériau.'}[level],
      sourceEvidence=[dict(sourceId=sid,locator=locator,support=support)])
    if jurisdiction: ed.update(jurisdiction=jurisdiction,reviewAfter='2027-11-17')
    questions.append(dict(id='hemp-q2-rm01-'+key,topicId='seeds' if domain=='food' else 'profiles',level=level,prompt=prompt,options=rotated,answer=n,
      explanation=explanation,articleId=article or ('ref-graines-chanvre' if domain=='food' else 'ref-chenevotte-materiaux'),sourceIds=[sid],editorial=ed))

q('seed-essential-amino-acids-present','food',1,'Quelle description correspond aux acides aminés essentiels des protéines de graines de chanvre ?',
 ['Les neuf sont présents','La lysine est absente','Le tryptophane est absent','La méthionine est absente'],
 'Les neuf sont présents, mais leurs proportions et leur digestibilité comptent aussi. Cette présence ne signifie pas que les protéines de chanvre couvrent à elles seules tous les besoins.',
 G,'Introduction, protéines de graines','L’article indique que les protéines de graines contiennent tous les acides aminés essentiels.','Acides aminés des graines','hemp-seed-storage-proteins','Présence des neuf acides aminés essentiels','Distinguer présence d’acides aminés et qualité nutritionnelle complète.',article='ref-proteines-chanvre')
q('seed-main-protein-edestin','food',2,'Quelle protéine constitue une part majeure des protéines de réserve des graines de chanvre ?',
 ['L’édestine','La caséine','La gliadine','L’ovalbumine'],
 'L’édestine est une globuline de réserve caractéristique du chènevis. Elle représente la fraction majeure décrite dans l’isolat étudié par Tang et ses collègues.',
 T,'Abstract, phrase Edestin... major protein component','L’édestine est le composant protéique majeur.','Protéine majeure du chènevis','hemp-seed-storage-proteins','Identité de la protéine majoritaire','Reconnaître l’édestine comme constituant alimentaire majeur.',article='ref-proteines-chanvre')
q('seed-oil-gla-omega6','food',2,'En plus de l’acide linoléique, quel autre oméga-6 trouve-t-on dans l’huile de graines de chanvre ?',
 ['L’acide gamma-linolénique, ou GLA','L’acide alpha-linolénique, ou ALA','L’acide stéaridonique, ou SDA','L’acide eicosapentaénoïque, ou EPA'],
 'Le GLA est un oméga-6 présent en proportion plus faible que l’acide linoléique. Son nom proche de l’ALA ne doit pas les confondre : l’ALA appartient aux oméga-3.',
 G,'Introduction et Table 4, colonne GLA','GLA18:3 oméga-6 figure dans les profils d’huile mesurés.','GLA de l’huile alimentaire','huile-chenevis','Autre oméga-6 de l’huile de graines','Distinguer GLA et ALA dans la composition alimentaire.',article='ref-huile-graines')
q('seed-meal-phytate-minerals','food',3,'Quel constituant mesuré dans les tourteaux de chanvre peut limiter la disponibilité de leurs minéraux ?',
 ['Les phytates','Les tocophérols','Les phytostérols','Les caroténoïdes'],
 'Les tourteaux étudiés contiennent des phytates, capables de limiter la disponibilité de certains minéraux. Une teneur minérale élevée ne suffit donc pas à décrire ce qui sera absorbé.',
 G,'Results Table2 et Discussion, phytate','Phytates mesurés dans les tourteaux, avec effet défavorable possible sur biodisponibilité macro/microéléments.','Phytates du tourteau','hempseed-meal-antinutrients','Présence et effet des phytates','Relier un constituant réel du tourteau à sa valeur nutritionnelle.',article='ref-proteines-chanvre')
q('seed-food-anaphylaxis','food',2,'Quelle manifestation allergique liée à l’ingestion de graines de chanvre le cas de Bhatia documente-t-il ?',
 ['Une réaction immédiate avec anaphylaxie','Une entérocolite allergique retardée non IgE','Une œsophagite à éosinophiles','Une dermatite allergique de contact retardée'],
 'Un cas clinique décrit une anaphylaxie après consommation de graines de chanvre. Cela établit la possibilité d’une allergie alimentaire grave, sans en mesurer la fréquence.',
 B,'Observation clinique et Discussion','Patient ayant présenté anaphylaxie après yaourt avec graines, tests cutanés positifs aux graines.','Allergie alimentaire au chènevis','hempseed-food-allergy','Anaphylaxie documentée','Savoir que des graines alimentaires peuvent être allergisantes.',jurisdiction='Portée clinique générale ; cas original publié en2018')
q('seed-hazelnut-cross-reactivity','food',3,'Avec quel aliment l’équipe INRAE a-t-elle montré une réaction croisée IgE de protéines de graines de chanvre au laboratoire ?',
 ['La noisette','Le lait de vache','Le poisson','L’œuf de poule'],
 'Les tests de laboratoire montrent une réaction croisée avec des protéines de noisette. Les auteurs demandent encore des évaluations cliniques : ce résultat ne prédit pas la réaction de chaque personne.',
 I,'p.54, Results et Future outlook','Réaction croisée avec protéines de noisette confirmée en ELISA compétitif, pertinence in vivo à déterminer.','Réaction croisée chanvre/noisette','hempseed-hazelnut-cross-reactivity','Aliment concerné par la réaction croisée expérimentale','Distinguer signal immunologique et allergie clinique prédite.',jurisdiction='Recherche allergologique ; compte rendu INRAE2024')
q('seed-cadmium-from-soil','food',1,'Quelle distribution du cadmium l’étude de Mihoc a-t-elle observée chez le chanvre cultivé sur les sols étudiés ?',
 ['Il a aussi été retrouvé dans les graines','Il est resté limité aux racines','Il est resté limité aux tiges','Il est resté limité aux feuilles'],
 'L’étude a mesuré du cadmium dans les graines. Employer le chanvre pour capter des métaux du sol ne garantit donc pas que ses graines conviennent ensuite à un usage alimentaire.',
 M,'Abstract, Conclusion','Cd mesuré dans graines et réserve explicite sur leur usage dans aliments.','Métaux dans les graines alimentaires','hempseed-cadmium-food','Transfert possible de cadmium vers les graines','Comprendre une limite alimentaire de la dépollution par le chanvre.',jurisdiction='Sécurité alimentaire ; étude roumaine2012',article='ref-contaminants')
q('bama-seed-soup','food',2,'Le huoma tang de Bama, dans le Guangxi chinois, correspond à quelle préparation culinaire de chanvre ?',
 ['Une soupe à base de graines moulues','Une pâte de graines à tartiner','Une galette de farine de graines','Un condiment sec de graines écrasées'],
 'Le ministère chinois du Tourisme cite la soupe huoma parmi les spécialités de Bama. Il s’agit d’un usage culinaire des graines, sans reprendre les promesses de longévité de cette présentation touristique.',
 C,'Rubrique cinq, entrée 火麻','Graines moulues servant à soupe huoma et tofu huoma.','Soupe huoma de Bama','bama-huoma-food','Usage des graines dans une soupe locale','Découvrir une tradition alimentaire de graines hors d’Europe.')
q('fda-gras-three-seed-ingredients','food',1,'Quels ingrédients de chanvre étaient concernés par les trois notifications GRAS examinées sans questions par la FDA en2018 ?',
 ['Graines décortiquées, poudre protéique et huile de graines','Feuilles séchées, fleurs moulues et huile de graines','Résine, poudre de CBD et graines décortiquées','Huile essentielle, feuilles séchées et poudre protéique'],
 'Les trois dossiers concernaient des ingrédients issus des graines, sous les usages prévus. Cette réponse de la FDA ne portait pas sur l’ajout de CBD ou de THC aux aliments.',
 F,'Premier paragraphe, GRN765/771/778','Hulled hemp seed, hemp seed protein powder, hemp seed oil.','Ingrédients alimentaires FDA2018','fda-gras-hempseed-2018','Trois ingrédients de graines concernés','Distinguer ingrédients de graines et aliments enrichis en cannabinoïdes.',jurisdiction='États-Unis ; décisionFDA20décembre2018')
q('australia-retail-seeds-nonviable','food',1,'En Australie, quelles graines de chanvre peuvent être vendues au détail comme aliment selon la règle présentée par le Queensland ?',
 ['Des graines décortiquées et incapables de germer','Des graines entières et capables de germer','Des graines entières après simple séchage','Des graines germées conservant leur enveloppe'],
 'Les graines vendues directement comme aliment doivent être décortiquées et non viables. La règle distingue cette vente des graines entières utilisées pour fabriquer de l’huile ou d’autres aliments.',
 Q,'The plant, dernier paragraphe','Seeds for retail sale must be hulled and unable to germinate.','Vente australienne de graines alimentaires','australia-hempseed-food-retail','Décorticage et non-viabilité au détail','Comprendre une condition propre à la commercialisation alimentaire des graines.',jurisdiction='Australie ; règle consultée17novembre2026')
q('seed-albumin-water-solubility','food',3,'Dans les protéines alimentaires du chènevis, quelle fraction est soluble dans l’eau, contrairement à l’édestine extraite en milieu salin ?',
 ['La fraction albumine','La fraction gliadine','La fraction caséine','La fraction gluténine'],
 'L’albumine du chènevis est hydrosoluble, tandis que l’édestine appartient aux globulines solubles en milieu salin. Cette différence aide à comprendre les fractions des ingrédients protéiques.',
 N,'p.1, Abstract ; §2.2','Extraction aqueuse pour albumine puis saline pour globuline éd estine.','Fractions protéiques du chènevis','hemp-seed-storage-proteins','Solubilité de la fraction albumine','Relier les protéines de chanvre à leurs propriétés en formulation.',article='ref-proteines-chanvre')
q('roasted-seed-oil-pyrazine-notes','food',2,'Dans l’huile de graines de chanvre torréfiées étudiée par Bai, quelle famille contribue aux notes grillées ?',
 ['Les pyrazines','Les pinènes','Les alcools floraux','Les esters fruités'],
 'L’étude attribue des notes grillées à plusieurs pyrazines de l’huile. Les pinènes, le myrcène et l’ocimène sont plutôt associés à son caractère frais ou herbacé.',
 R,'Abstract, phrases odorants et toasty flavour','Trois pyrazines identifiées contribuent aux notes grillées.','Arôme de l’huile de graines torréfiées','hempseed-oil-roasting-aroma','Famille contribuant aux notes grillées','Comprendre un changement aromatique d’un aliment de graines.',article='ref-huile-graines')

q('hemp-cottonization-purpose','materials',1,'À quoi sert la cotonisation des fibres de chanvre dans l’industrie textile ?',
 ['Obtenir des fibres plus fines adaptées aux équipements coton','Former des fibres continues comparables aux filaments de soie','Conserver de longs faisceaux pour une filature de type lin','Transformer les fibres en pâte destinée au papier'],
 'La cotonisation divise les faisceaux techniques de chanvre en éléments plus fins adaptés à la filature courte. Le chanvre reste du chanvre : son nom décrit l’adaptation au travail textile du coton.',
 J,'Introduction, paragraphe cottonization','Séparation des fibres techniques en agrégats plus fins de fibres élémentaires pour utilisation as-cotton.','Cotonisation textile du chanvre','hemp-textile-cottonization','Objectif industriel de la cotonisation','Reconnaître une préparation du chanvre pour les lignes de filature courte.',article='ref-fibres-chanvre')
q('hemp-lignin-coarse-texture','materials',2,'Quel constituant contribue au toucher raide et rugueux de fibres de chanvre brutes, d’après l’étude de Mijas ?',
 ['La lignine','La cellulose','L’hémicellulose','La pectine'],
 'L’étude relie une part de la raideur et de la rugosité à la lignine. Sa réduction peut adoucir les fibres ; le toucher du textile dépend aussi des autres étapes de préparation et de filature.',
 J,'Introduction, paragraphe Lignin... coarse and abrasive texture','La lignine contribue à la texture grossière et abrasive ; son retrait adoucit les fibres.','Lignine et toucher textile','hemp-textile-lignin','Contribution de la lignine à la rigidité','Relier composition des fibres et préparation des textiles.',article='ref-fibres-chanvre')
q('hemp-primary-bast-textile-length','materials',2,'Pour les textiles de chanvre à longues fibres, quelle fraction libérienne est particulièrement recherchée ?',
 ['Les fibres primaires, plus longues','Les fibres secondaires, plus longues','Les fibres primaires, plus courtes','Les fibres secondaires, plus courtes'],
 'Les fibres libériennes primaires fournissent les faisceaux longs. Les secondaires sont plus courtes et davantage lignifiées ; elles n’offrent pas la même valeur pour cette filière textile.',
 S,'p.74, Introduction','Primary fibre bundles valuable long fibre ; secondary fibres shorter and more lignified.','Fibres libériennes destinées au textile','hemp-primary-secondary-bast-textiles','Fraction longue recherchée','Distinguer deux qualités de fibres à l’intérieur du liber.',article='ref-fibres-chanvre')
q('hemp-textile-cellulose-regeneration','materials',2,'Quelle voie a permis à Rissanen et ses collègues de recycler du tissu de chanvre en nouvelles fibres textiles ?',
 ['Dissoudre puis régénérer sa cellulose','Effilocher les fils sans dissoudre la cellulose','Fondre directement les fibres comme un thermoplastique','Carboniser les fibres avant de les filer'],
 'L’équipe a démontré un recyclage chimique de la cellulose du tissu, suivie d’une régénération en fibres. Le nouveau matériau a ensuite été filé et tricoté, au lieu de simplement conserver les fibres effilochées.',
 A,'Abstract, p.2545','Fabric dissolved, cellulose regenerated by spinning, yarn knitted into fabric.','Recyclage chimique textile de chanvre','hemp-textile-chemical-recycling','Régénération de la cellulose','Identifier une voie de recyclage différente de l’effilochage.',article='ref-fibres-chanvre')
q('katabira-hemp-summer-robe','materials',2,'Quel vêtement le musée de Kyoto décrit-il comme étant en chanvre ou ramie pour la chaleur du plein été japonais ?',
 ['Le katabira, un kimono non doublé','Le hitoe, un kimono de soie non doublé','Le kosode ouaté pour la saison froide','Le jinbaori, un manteau porté sur une armure'],
 'Le katabira pouvait être tissé en chanvre ou en ramie et se portait sans doublure au plus fort de l’été. Le musée le distingue du hitoe de soie, porté au début et à la fin de la saison.',
 P,'Deuxième paragraphe, hitoe et katabira','Katabira : kimono non doublé en ramie ou chanvre porté au plus fort de la chaleur estivale.','Katabira japonais en fibres libériennes','japan-katabira','Vêtement d’été non doublé en chanvre ou ramie','Découvrir un usage textile du chanvre dans le vêtement japonais.',article='ref-fibres-chanvre')
q('hemp-wall-vapour-compatible-finish','materials',2,'Quelle propriété d’une finition aide à préserver les échanges hydriques d’une paroi en béton de chanvre ?',
 ['Sa perméabilité à la vapeur d’eau','Sa résistance élevée à la compression','Sa conductivité thermique élevée','Sa faible effusivité thermique'],
 'Le guide recommande de préserver la migration de vapeur dans le complexe de paroi. Une finition très fermée peut réduire cette fonction ; la protection contre la pluie relève d’un autre aspect du système.',
 H,'p.64–65 et74–77 imprimées','Finition choisie pour préserver perméabilité vapeur ; finitions influencent tampon hydrique et perméabilité.','Finition d’une paroi de chanvre','hempcrete-wall-finishes','Perméabilité de la finition','Relier la finition aux propriétés hydriques de la paroi.')
q('hemp-wall-flexible-plaster','materials',2,'Pourquoi le guide Construire en Chanvre privilégie-t-il des enduits souples sur un béton de chanvre ?',
 ['Pour accompagner la déformabilité du support','Pour ralentir le séchage en profondeur','Pour accroître la résistance à la diffusion de vapeur','Pour atténuer l’alcalinité du liant'],
 'Le béton de chanvre reste relativement déformable. Un enduit compatible avec ce comportement aide à limiter les contraintes et le risque de fissuration du revêtement.',
 H,'p.40–45 imprimées','Faibles caractéristiques mécaniques et déformabilité du support ; privilégier enduits souples.','Compatibilité mécanique des enduits','hempcrete-wall-finishes','Souplesse du revêtement adaptée au support','Comprendre une contrainte réelle de finition du béton de chanvre.')
q('hemp-wall-gypsum-acoustic-difference','materials',3,'Selon Construire en Chanvre, quel couple décrit une paroi en béton de chanvre avec parement en plaque de gypse ?',
 ['Bonne réduction du son transmis, absorption moins favorable','Faible réduction du son transmis, absorption favorable','Bonne réduction du son transmis, absorption favorable','Faible réduction du son transmis, absorption moins favorable'],
 'Le guide distingue une bonne réduction de transmission et une absorption moins favorable avec le gypse. La finition change donc la façon dont la paroi agit sur le son à l’intérieur de la pièce.',
 H,'p.64–65 imprimées, Finition avec parement en plaque de gypse','En combinaison avec béton de chanvre, réduction acoustique bonne, absorption moins bonne.','Parement gypse sur chanvre','hempcrete-gypsum-acoustics','Effets acoustiques distincts du parement','Distinguer deux fonctions concrètes de cette paroi finie.')
q('hemp-wall-first-rain-protection','materials',1,'Dans le guide du béton de chanvre, contre quoi une première couche extérieure de gobetis protège-t-elle surtout la paroi ?',
 ['La pluie et les projections d’eau liquide','La diffusion normale de vapeur vers l’extérieur','L’échauffement de surface sous le soleil','Le refroidissement de la surface sous le vent'],
 'Cette première protection limite les reprises d’eau dues aux intempéries, qui prolongeraient le séchage. Elle doit être pensée avec les échanges de vapeur et les autres finitions du mur.',
 H,'p.38–39 imprimées, Remarque gobetis','Gobetis première protection eau liquide, intempéries/projections, évitant reprise humidité.','Protection de la paroi de chanvre','hempcrete-exterior-rain-protection','Protection contre eau liquide','Comprendre pourquoi une paroi perméante demande aussi une protection à la pluie.')
q('earth-hemp-clay-binder','materials',1,'Quel liant le projet EcoTerra étudie-t-il avec le chanvre comme alternative aux mélanges à base de chaux ?',
 ['Une terre argileuse crue','Un ciment Portland','Un ciment d’aluminates de calcium','Un plâtre de gypse'],
 'EcoTerra étudie l’association du chanvre et de la terre crue argileuse pour des isolants. Les matériaux de construction au chanvre ne se limitent donc pas aux mélanges à base de chaux.',
 E,'Favoriser l’utilisation des isolants terre-chanvre','Association chanvre avec terre crue comme liant dans les matériaux étudiés.','Liant terre-chanvre','earth-hemp-building-material','Terre argileuse comme liant','Découvrir un matériau au chanvre distinct du chaux-chanvre.')
q('hemp-plumbing-tow-seals','materials',1,'Quel usage de la filasse de chanvre en plomberie le recueil de la DREAL décrit-il ?',
 ['Étanchéifier des raccords','Filtrer l’eau potable dans les tuyaux','Détartrer les canalisations','Désinfecter l’eau stockée'],
 'Le recueil cite l’étanchéité des raccords comme un usage traditionnel de la filasse. Ces fibres ont donc aussi un débouché de plomberie, au-delà des toiles et des isolants.',
 D,'p.7, extrait Filasse de chanvre, Fabrication','Utilisation en plomberie pour étanchéifier les raccords.','Filasse en plomberie','hemp-tow-plumbing','Usage d’étanchéité','Reconnaître un débouché concret des fibres de chanvre.',article='ref-matieres-chanvre')
q('hemp-wool-polyester-binder','materials',2,'Dans la laine de chanvre décrite par le recueil DREAL de2018, quel liant maintient les fibres ensemble ?',
 ['Du polyester','De l’amidon','Des protéines de soja','Du latex naturel'],
 'Cette description emploie un liant polyester pour former un matelas isolant. Un produit appelé laine de chanvre peut donc associer fibres végétales et liant synthétique ; la composition varie selon le produit.',
 D,'p.7, extrait Laine de chanvre, Fabrication','Fibres mélangées avec liant polyester pour maintenir ensemble avant formation du matelas.','Liant d’une laine isolante de chanvre','hemp-wool-polyester-binder','Présence de liant polyester','Comprendre la composition d’une laine végétale manufacturée.')
q('hempcrete-lca-binder-production','materials',3,'Dans le mur chaux-chanvre étudié par Pretot, quel composant pèse le plus sur l’énergie de fabrication des matériaux ?',
 ['Le liant à base de chaux','La chènevotte seule','L’ossature en bois','Les enduits sable-chaux seuls'],
 'Dans ce scénario, la production du liant constitue le premier poste d’énergie primaire des matériaux. Le bilan du béton de chanvre dépend donc aussi du liant et du système de mur retenus.',
 V,'§4.2, Fig.5, répartition des impacts de production','Liant49%énergie primaire, bois37%, chènevotte8%, enduits6% dans le scénario.','Impact du liant chaux-chanvre','hempcrete-lca-binder','Premier poste d’énergie de fabrication dans le mur étudié','Relier l’impact d’un matériau biosourcé à ses autres constituants.')

if __name__=='__main__':
    assert len(questions)==25
    domains=Counter(x['editorial']['domain'] for x in questions)
    assert domains=={'food':12,'materials':13},domains
    arts={a['id'] for a in json.loads((ROOT.parent/'encyclopedia-revision/baseline-catalog.json').read_text(encoding='utf-8'))['articles']}
    for x in questions:
        assert len(x['id'])<=75,x['id']
        assert len(x['prompt'])<=150,(x['id'],'prompt',len(x['prompt']))
        assert len(x['explanation'])<=240,(x['id'],'explanation',len(x['explanation']))
        assert len(set(x['options']))==4
        assert all(len(o)<=75 for o in x['options']),(x['id'],'options')
        assert x['articleId'] in arts,x['articleId']
        assert set(x['sourceIds'])<=set(s['id'] for s in sources)
    batch=dict(batchId='r-mixed-01',author=AUTHOR,role='Graines alimentaires et matériaux de chanvre',questions=questions,sources=sources)
    (ROOT/'batches/r-mixed-01.json').write_text(json.dumps(batch,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    facts=dict(batchId='r-mixed-01',author=AUTHOR,date=DAY,status='author_complete_pending_independent_review',count=len(questions),domains=dict(domains),
      levels=dict(Counter(str(x['level']) for x in questions)),
      neighbourSearch=dict(index='docs/quiz-2000/fact-index.jsonl',terms=['édestine','albumine','phytate','noisette','Bama','GRAS','cotonisation','filasse','polyester','primaire','secondaire','finitions','terre-chanvre','hygroscopie'],
      openedNeighbours=['hemp-seeds-edestine','hemp-profiles-hygroscopie','hemp-seeds-omega-trois','hemp-seeds-fractions-proteines','hemp-en-3-07','hemp-profiles-beton','hemp-profiles-renfort','hemp-profiles-remplissage','hemp-profiles-carbonatation','hemp-en-3-11','hemp-q2-d04-hemp-dehulling-fibre-down-protein-concentrated'],
      distinctions=['Aucun recyclage du fait générique retiré sur hygroscopie ; les questions portent sur choix de finitions et matériau concret.','Édestine : identité majoritaire distincte de son assemblage en six sous-unités.','Albumine : solubilité spécifique, distincte de la seule liste des familles de protéines.','GLA : autre oméga6 minoritaire, distinct de ALA oméga3 de hemp-seeds-omega-trois ; confusion gamma/alpha explicitement enseignée ; subjectKey huile-chenevis partagé.','Pas de nouveau fait décorticage/concentration protéique, PUFA majoritaires, stockage, pressage ou pectine du rouissage.','Primaire/secondaire compare deux qualités libériennes, distinct du contraste écorce/chènevotte.','MAPP retiré après revue de périmètre et remplacé par le vêtement textile katabira, sans voisin dans l’index.','Fabrication du liant dans ACV distincte de la capture de CO2 par carbonatation.']),
      actualReadings=[dict(sourceId=s['id'],url=s['url'],access=s['access'],locator=s['consultation']['locator'],reader=AUTHOR,date=DAY,result=s['consultation']['result']) for s in sources],
      safeguards=['Aucune autoapprobation et aucun fichier actif modifié','Source DREAL en excerpt explicitement déclaré ; manuscrit Pretot lu sur miroir déclaré','Préface historique du guide Construire en Chanvre exclue pour récits non fiables','Pas de promesse santé, longévité, ratio idéal ou neutralité carbone universelle','Aucun niveau4 forcé'],
      facts=[dict(id=x['id'],domain=x['editorial']['domain'],factKey=x['editorial']['factKey'],expectedAnswer=x['editorial']['expectedAnswer']) for x in questions])
    (ROOT/'facts/r-mixed-01.json').write_text(json.dumps(facts,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(dict(questions=len(questions),sources=len(sources),domains=dict(domains),levels=facts['levels'])))
