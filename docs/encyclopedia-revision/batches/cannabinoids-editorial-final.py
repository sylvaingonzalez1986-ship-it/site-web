import pathlib,json,re
r=pathlib.Path('C:/lesiteinternetquitue/docs/encyclopedia-revision/batches')
bs={p:json.loads(p.read_text(encoding='utf-8')) for p in sorted(r.glob('cannabinoids-*.json'))}
aa={a['id']:a for b in bs.values() for a in b['articles']}
def edit(aid,sid,text=None,refs=None):
 a=aa[aid];s=next(s for s in a['patch']['sections'] if s['id']==sid)
 if text is not None:s['paragraphs']=text if isinstance(text,list) else [text]
 if refs:s['sourceIds']=refs.split()
def mol(key,sid,text=None,refs=None):edit('record-cannabinoid-'+key,sid,text,refs)
def main(aid,idx,text=None,refs=None):
 a=aa[aid];edit(aid,a['patch']['sections'][idx]['id'],text,refs)

# Les références sont attribuées aux assertions de chaque section.
main('ref-phytocannabinoides',0,refs='bf-trichomes-2020 cb-kim-2022')
main('ref-phytocannabinoides',1,'THC, THCA et THCP ne sont pas des noms interchangeables. La fonction carboxyle distingue le THCA du THC ; la chaîne latérale pentyle du THC compte cinq carbones, contre sept pour la chaîne heptyle du THCP. Les premiers forment une paire acide/neutre, les seconds sont des homologues. Ces relations structurales peuvent modifier les propriétés biologiques sans fournir, à elles seules, une équivalence d’effet.', 'cb-kim-2022 cb-citti-2019')
main('ref-phytocannabinoides',2,'Une identité chimique présente dans une plante peut aussi être obtenue par synthèse : la notice du dronabinol décrit ainsi du Δ9-THC synthétique. Le terme phytocannabinoïde renseigne donc une présence végétale, sans déterminer la provenance de chaque lot. Les endocannabinoïdes, comme l’anandamide, sont quant à eux des messagers produits par l’organisme.','cb-dronabinol cb-anandamide-1992')
main('ref-biosynthese-cannabinoides',0,refs='cb-kim-2022 cannabinoids-lesson-decarb2016')
main('ref-biosynthese-cannabinoides',1,'La THCA synthase conduit du CBGA au THCA, la CBDA synthase au CBDA et la CBCA synthase au CBCA. Ces oxydocyclisations constituent des branches parallèles, plutôt qu’une succession obligatoire THCA, puis CBDA, puis CBCA. La perte ultérieure du carboxyle sous forme de CO₂ est une transformation distincte, qui relie chaque acide à sa forme neutre.','cb-kim-2022 cannabinoids-lesson-decarb2016')
main('ref-biosynthese-cannabinoides',2,refs='cb-kim-2022 cb-luo-2019')
main('ref-formes-acides-neutres',0,'La décarboxylation retire un groupe carboxyle sous forme de dioxyde de carbone, notamment dans les paires THCA–THC, CBDA–CBD et CBGA–CBG. Elle modifie la structure et la masse de la molécule : la perte de CO₂ empêche une équivalence gramme pour gramme. Des réactions concurrentes et d’autres pertes peuvent aussi réduire la récupération de la forme neutre ; la disparition d’un acide ne mesure donc pas à elle seule la quantité de produit obtenue.','cannabinoids-lesson-decarb2016')
main('ref-formes-acides-neutres',1,'Le mot neutre décrit ici l’absence de la fonction acide considérée ; il ne signifie pas inoffensif. Les formes acides ne sont pas non plus toutes biologiquement inertes : le THCA a montré une activité sur PPARγ, un récepteur nucléaire, dans des cellules et dans un modèle murin utilisant une toxine mitochondriale. Ce résultat préclinique ne démontre pas un traitement de la maladie de Huntington chez des patients.','cannabinoids-lesson-thca2017 cb-dronabinol')
main('ref-formes-acides-neutres',2,'Le vieillissement oxydatif du THC peut conduire au CBN ; il diffère de la décarboxylation du THCA comme du métabolisme humain. Une étude sur six produits suivis pendant quatre ans montre que lumière et température influencent l’évolution THC/CBN. La composition initiale et la conservation conditionnent donc les quantités mesurées : ce rapport ne constitue pas une horloge universelle.','cannabinoids-lesson-aging2019 cb-dronabinol')
main('ref-thc',0,'THC signifie tétrahydrocannabinol ; Δ9 précise une position de double liaison, et non une concentration. Cette forme neutre peut provenir de la décarboxylation du THCA et se distingue du Δ8-THC et du THCP. Le dronabinol correspond à une substance pharmaceutique définie, décrite comme synthétique dans la notice : ce nom ne s’applique pas indistinctement à tous les extraits de cannabis.','cb-dronabinol cb-kim-2022')
main('ref-thc',1,'Le THC interagit notamment avec CB1, récepteur couplé aux protéines G qui participe à la régulation de la libération des neurotransmetteurs. Ses effets dépendent de l’exposition et du contexte individuel. Les notices pharmaceutiques décrivent des altérations cognitives et motrices, ainsi que des effets psychiatriques et cardiovasculaires ; le seul nom d’une variété ne permet pas de prévoir ces risques.','cb-dronabinol qh-sci-receptors')
main('ref-thc',2,'L’organisme transforme le THC en plusieurs métabolites, dont le 11-hydroxy-THC, qui conserve une activité biologique, et le THC-COOH, distinct du THCA végétal. Le premier passage hépatique contribue aux différences entre voies d’exposition. Les concentrations dépendent aussi de la matrice biologique : dans le liquide oral, la contamination des muqueuses peut contribuer à la mesure. Une concentration isolée ne résume donc ni l’exposition complète ni les capacités fonctionnelles.','cb-dronabinol cannabinoids-lesson-metabolism2017')
main('ref-cbd',0,refs='cb-kim-2022 cb-citti-2019')
main('ref-cbd',1,refs='cb-epidyolex')
main('ref-cbd',2,[
'Le terme non intoxicant est plus précis que « sans effet psychotrope » : le CBD ne produit pas l’intoxication caractéristique du THC, mais agit sur le système nerveux et peut notamment provoquer une somnolence. Les données pharmaceutiques décrivent aussi troubles digestifs, interactions médicamenteuses et atteintes hépatiques. Une huile commerciale peut différer du médicament par sa composition, y compris par la présence de THC.',
'Dans l’essai croisé d’Englund, augmenter le CBD à quantité expérimentale de THC constante n’apporte pas de protection significative contre les altérations aiguës mesurées. Une interaction bénéfique doit être démontrée pour une composition, une population et un critère précis ; elle ne se déduit pas d’une promesse générale d’« entourage ».'], 'cb-epidyolex can-study-englund')
main('ref-systeme-endocannabinoide',0,'L’anandamide, ou N-arachidonoyléthanolamide (AEA), et le 2-arachidonoylglycérol (2-AG) sont deux messagers produits par l’organisme. L’AEA est une éthanolamide lipidique, identifiée dans le cerveau porcin en 1992 ; le 2-AG est un monoacylglycérol, caractérisé en 1995 notamment dans le cerveau et l’intestin canin. Ces études fondatrices portent sur des tissus animaux, sans constituer des essais thérapeutiques humains.','cb-anandamide-1992 cb-2ag-1995 cb-2ag-gut-1995')
main('ref-systeme-endocannabinoide',1,'CB1 et CB2 sont des récepteurs cannabinoïdes couplés aux protéines G, qui modulent notamment l’adénylyl cyclase. CB1 est surtout présent dans les neurones centraux et périphériques et participe à la régulation de la libération des neurotransmetteurs ; CB2 est très étudié dans les cellules immunitaires. Ces distributions ne sont pas exclusives. La formation et la dégradation des messagers contribuent également au fonctionnement du système.','qh-sci-receptors')
main('ref-systeme-endocannabinoide',2,'Une affinité de liaison et une réponse fonctionnelle décrivent deux propriétés distinctes : une molécule peut se lier sans produire la même activation qu’une autre. Les cannabinoïdes interagissent aussi avec des cibles autres que CB1 et CB2, notamment des canaux et des récepteurs nucléaires. L’activité préclinique du THCA sur PPARγ, dont l’activation peut modifier l’expression de gènes, illustre cette diversité.','qh-sci-receptors cannabinoids-lesson-thca2017')
main('ref-cannabinoides-mineurs',0,refs='cb-kim-2022')
main('ref-cannabinoides-mineurs',1,refs='cb-propyl-1977 cb-propyl-1975')
main('ref-cannabinoides-mineurs',2,'Le THCP et le CBDP, identifiés dans un matériel végétal étudié en 2019, possèdent une chaîne heptyle à sept carbones, contre cinq pour la chaîne pentyle du THC et du CBD. Les essais de liaison sur récepteurs humains et les expériences animales publiés sur le THCP ne sont pas des essais sur des personnes. Ils ne permettent de déduire ni une puissance clinique humaine, ni les effets du CBDP, ni la composition des produits vendus sous ces noms.','cb-citti-2019')
main('ref-cannabinoides-transformes',0,refs='cb-euda-2023')
main('ref-cannabinoides-transformes',1,refs='cb-euda-2023 cb-h4cbd-2023')
main('ref-cannabinoides-transformes',2,refs='cb-euda-2023 cb-acetates-2022')
main('ref-decouvertes-cannabinoides',0,[
'W. B. O’Shaughnessy signe un article sur les préparations de chanvre indien réimprimé en 1843. Il y distingue expériences animales et observations de patients atteints notamment de tétanos. Ce document du XIXe siècle ne constitue ni un essai contrôlé moderne ni la preuve d’une première utilisation mondiale. Les travaux de Wood, Spivey et Easterfield appartiennent également à l’histoire des premières recherches sur le cannabinol, dont les étapes d’isolement et d’attribution structurale doivent être distinguées.',
'En 1963, Mechoulam et Shvo publient Hashish I: The structure of cannabidiol, sur la structure et la stéréochimie du CBD après des isolements antérieurs. Leur laboratoire est le Daniel Sieff Research Institute de l’Institut Weizmann, à Rehovot en Israël. En avril 1964, Gaoni et Mechoulam publient dans le JACS Isolation, Structure, and Partial Synthesis of an Active Constituent of Hashish, consacré au constituant aujourd’hui appelé Δ9-THC ; ils distinguent aussi le cannabinol. Les conventions de nomenclature de l’époque demandent une lecture attentive de la numérotation des structures. Ces jalons chimiques ne constituent pas des preuves cliniques.'])
main('ref-decouvertes-cannabinoides',1,'L’article de clonage du récepteur aujourd’hui appelé CB1 est publié dans Nature le 9 août 1990 par Matsuda, Lolait, Brownstein, Young et Bonner ; CB2 est cloné en 1993. Les travaux de liaison ont précédé ces clonages. La classification de Howlett décrit environ 48 % d’identité de séquence entre ces protéines couplées aux protéines G, avec une prédominance neuronale de CB1 et immunitaire de CB2, sans distribution exclusive entre organes.')
main('ref-decouvertes-cannabinoides',2,[
'En 1992, Devane et ses collègues identifient l’anandamide (AEA) dans le cerveau porcin. Sa fonction amide unit une partie arachidonoyle à une éthanolamine ; les essais de liaison et de préparation animale suggèrent un rôle de ligand endogène. Les publications de 1995 caractérisent le 2-arachidonoylglycérol (2-AG), notamment dans le cerveau et l’intestin canin, et documentent sa liaison à CB1 et CB2. Contrairement à l’AEA, le 2-AG est un ester de glycérol.',
'Cravatt et ses collègues caractérisent en 1996 FAAH, hydrolase capable de libérer par hydrolyse les deux parties de l’anandamide. Dinh et ses collègues étudient ensuite MGL, aussi appelée MAGL : augmenter son expression dans des neurones de rat augmente la dégradation du 2-AG, sans le même effet sur l’AEA. En 2003, Bisogno et ses collègues caractérisent des DAG lipases qui forment le 2-AG à partir d’un diacylglycérol arachidonoylé.',
'Ces voies animales se distinguent des enzymes de la plante. La géranylpyrophosphate:olivétolate géranyltransférase (GOT), une prényltransférase, participe ainsi à la formation du CBGA à partir d’olivétolate et de géranylpyrophosphate.'])

# Chaque absence de preuve est reliée au modèle effectivement présenté, en une phrase.
clinical={
'delta9-thca-b':'La cristallographie établit une structure, sans évaluer un effet thérapeutique chez des patients.',
'cbda':'Les résultats antiémétiques présentés concernent des animaux ; leur portée thérapeutique humaine reste à établir.',
'cbga':'Les études enzymatiques et analytiques citées ne mesurent pas une efficacité thérapeutique du CBGA chez des patients.',
'cbca':'La caractérisation de la CBCA synthase ne fournit pas de résultat clinique sur le CBCA.',
'cbna':'L’étude chimique du CBNA dans du cannabis conservé ne teste pas son efficacité chez des patients.',
'thcva':'La production de THCVA dans une levure reconstituée constitue une preuve biosynthétique, sans résultat clinique humain.',
'cbdva':'La production de CBDVA dans une levure reconstituée ne permet pas de conclure à une efficacité chez des patients.',
'cbgva':'L’isolement du CBGVA et les voies reconstituées citées n’évaluent pas un bénéfice thérapeutique humain.',
'cbcva':'L’isolement structural de 1977 ne mesure pas un effet clinique du CBCVA.',
'cbgv':'Les travaux d’isolement cités ne testent pas un effet thérapeutique du CBGV chez l’humain.',
'cbcv':'Les données structurales de 1975 ne constituent pas une évaluation clinique du CBCV.',
'thcp':'Les essais de liaison et la tétrade murine de 2019 ne mesurent pas la puissance ni les effets du THCP chez des personnes.',
'cbdp':'La publication de 2019 caractérise le CBDP, sans tester son efficacité chez des patients.',
'delta8-thc':'Les rapports de surveillance cités ne constituent pas une comparaison clinique complète du Δ8-THC avec le Δ9-THC.',
'thc-o-acetate':'Les analyses des acétates et de leurs émissions ne démontrent pas une efficacité thérapeutique des produits THC-O.',
'hhc-o':'L’étude cellulaire ne reproduit pas l’exposition et le métabolisme humains ; elle ne démontre pas un bénéfice clinique du HHC-O.',
'hhcp':'Les mesures d’activation de CB1 dans des cellules ne déterminent pas les effets du HHCP chez une personne.',
'h4-cbd':'La caractérisation des diastéréoisomères ne valide pas l’usage thérapeutique du H4-CBD chez l’humain.',
'anandamide':'Les études fondatrices établissent un médiateur endogène ; elles ne valident pas une intervention thérapeutique destinée à augmenter l’anandamide.',
'2-ag':'Les travaux biochimiques décrivent la formation, la liaison et l’inactivation du 2-AG, sans démontrer un bénéfice thérapeutique à modifier son niveau.'}
for key,text in clinical.items():mol(key,'human',text)

# Réunir les réserves propres à la molécule, sans quatre avertissements de modèle.
for a in aa.values():
 if not a['id'].startswith('record-cannabinoid-'):continue
 for s in a['patch']['sections']:
  ps=s['paragraphs']
  if s['id']=='risks':
   generic='Une identité analytique n’établit ni innocuité, ni dose sûre, ni équivalence entre produits.'
   if generic in ps and len(ps)>1:ps.remove(generic)
  if len(ps)>1 and s['id'] in ['identity','risks','occurrence']:s['paragraphs']=[' '.join(dict.fromkeys(ps))]
  s['paragraphs']=[t.replace('Biodisponibilité, effets durables et conséquences des mélanges insuffisamment établis dans les sources consultées.','La biodisponibilité, les effets durables et les conséquences des mélanges restent insuffisamment caractérisés par ces études.')
   .replace('Rôle physiologique dans la plante et pharmacologie humaine non établis dans ce dossier.','Le rôle physiologique dans la plante et la pharmacologie humaine restent à préciser.')
   .replace('Enzyme, flux dans la plante et données humaines non établis par les pièces consultées.','L’enzyme responsable, le flux dans la plante et les effets humains ne sont pas établis par l’identification chimique.')
   .replace('dans ce dossier','par ces travaux').replace('dans les documents consultés','dans ces études').replace('dans ce corpus','dans ces études')
   for t in s['paragraphs']]

mol('delta9-thc','risks','La notice du dronabinol signale des altérations cognitives et motrices, ainsi que des effets psychiatriques et cardiovasculaires. La voie d’exposition, les coexpositions et la composition réelle d’un produit influencent le risque ; son nom commercial ne permet pas de les déterminer.')
mol('delta9-thca-a','human','L’activité du THCA-A sur PPARγ et ses effets dans le modèle murin présenté sont précliniques ; ils ne démontrent pas une efficacité thérapeutique chez des patients.')
mol('cbd','human','Une formulation pharmaceutique de CBD possède des indications autorisées dans certaines épilepsies. Ces résultats concernent ce médicament et ne valident pas toutes les allégations relatives aux produits au CBD du commerce.')
mol('cbd','risks','Le CBD est non intoxicant au sens habituel du THC, mais peut agir sur le système nerveux et provoquer une somnolence. Les données pharmaceutiques décrivent aussi troubles digestifs, interactions et atteintes hépatiques. Un étiquetage CBD ne garantit ni la quantité réelle, ni l’absence de THC ou de contaminants.')
mol('cbga','identity','Le CBGA, acide cannabigérolique, porte une fonction carboxyle qui le distingue du CBG neutre. Sa décarboxylation donne du CBG ; elle diffère des réactions enzymatiques qui forment les autres cannabinoïdes acides.','cb-kim-2022 cannabinoids-lesson-decarb2016')
mol('cbga','occurrence','Le CBGA est identifié dans les échantillons de cannabis et comme substrat des synthases caractérisées. Son rôle de précurseur commun n’implique pas une forte abondance dans chaque fleur.','cb-kim-2022 cb-cbcas-1998')
mol('cbga','human',refs='cb-cbcas-1998 qh-sci-cbga')
mol('cbga','risks',refs='cb-kim-2022 cannabinoids-lesson-decarb2016')
mol('cbga','mechanisms',refs='qh-sci-cbga cb-kim-2022 cb-cbcas-1998 cannabinoids-lesson-decarb2016')
mol('cbna','mechanisms','L’étude chimique observe une transformation du THCA en CBNA dans du matériel conservé. Elle ne démontre pas une enzyme dédiée dans la plante vivante ni une cinétique universelle. Les transformations dans l’organisme humain constituent encore une autre question.')
mol('thcva','mechanisms','Luo reconstruit dans Saccharomyces cerevisiae une voie utilisant des enzymes végétales qui produit du THCVA à partir de la branche CBGVA. Ce résultat établit une capacité du système hétérologue, sans mesurer le flux de chaque organe d’une plante entière.')
mol('cbdva','mechanisms','Luo documente la production de CBDVA à partir de la branche CBGVA dans une levure reconstituée. Cette capacité du système hétérologue ne mesure pas l’abondance naturelle du composé dans chaque plante.')
mol('cbgva','identity','Le CBGVA porte une chaîne propyle à trois carbones, contre cinq pour le CBGA pentyle. Il se distingue aussi du CBGV neutre par sa fonction carboxyle : longueur de chaîne et forme acide/neutre sont deux caractéristiques indépendantes.','cb-propyl-1977')
mol('cbgva','occurrence','Le CBGVA fait partie des quatre cannabinoïdes acides isolés du matériel thaïlandais Meao en 1977. Cette identification ne détermine pas son abondance générale dans le cannabis.','cb-propyl-1977')
mol('cbgva','human',refs='cb-propyl-1977 cb-luo-2019')
mol('cbgva','risks','La présence de composés apparentés ne prouve pas à elle seule l’enzyme ni chaque étape qui les relie. Le flux dans la plante et les effets d’une exposition humaine restent à préciser.','cb-propyl-1977 cb-luo-2019')
mol('cbgva','mechanisms','Dans la levure reconstituée de Luo, des signaux compatibles avec CBGVA accompagnent la production de THCVA et de CBDVA. Ces branches documentées ne fournissent pas une preuve enzymatique directe équivalente pour la conversion vers le CBCVA.','cb-luo-2019')
mol('cbcva','mechanisms','L’isolement et les données spectrales de 1977 documentent le CBCVA dans le matériel Meao. Sa parenté structurale avec le CBGVA suggère une question biosynthétique, mais ne démontre pas leur conversion enzymatique directe. Les branches rapportées par Luo vers d’autres acides ne constituent pas une preuve équivalente de cette réaction.')
for key,fam in [('cbgv','CBG'),('cbcv','CBC')]:
 mol(key,'identity',f'Le {key.upper()} est l’homologue propyle du {fam} : sa chaîne latérale possède trois carbones au lieu de cinq. La forme acide apparentée, {key.upper()}A, porte en plus une fonction carboxyle. Ces noms désignent des structures distinctes, sans correspondre à des variétés de plante.')
 mol(key,'mechanisms',f'Le résumé original de 1975 décrit un isolat caractérisé par des données spectrales et chimiques. Il ne mesure ni action sur un récepteur humain ni résultat chez des patients ; la parenté avec le {fam} guide une hypothèse pharmacologique sans la démontrer.')
mol('cbdp','identity','Le CBDP porte une chaîne heptyle à sept carbones, contre cinq pour le CBD. Il est également distinct du THCP, malgré leur identification dans le même article ; les données pharmacologiques ne sont pas interchangeables entre ces molécules.')
mol('cbdp','mechanisms','L’identification du CBDP combine chromatographie, spectrométrie de masse et comparaison RMN avec une référence synthétique. Les mesures de liaison et la tétrade murine de la publication portent sur le THCP, sans démontrer une activité équivalente du CBDP.')
mol('delta8-thc','identity','Le Δ8-THC conserve la formule brute du Δ9-THC, mais sa double liaison occupe une autre position. Cette isomérie diffère de l’hydrogénation qui forme un analogue comme le HHC ; le chiffre 8 ne décrit ni une concentration ni une absence d’intoxication.')
mol('delta8-thc','mechanisms','La parenté structurale avec le Δ9-THC ne permet pas de quantifier les effets humains d’un produit Δ8. Les rapports techniques décrivent des substances et des enjeux toxicologiques ; ils ne fournissent pas une comparaison clinique exhaustive ni un fondement pour qualifier le Δ8 de non intoxicant.')
mol('thc-o-acetate','identity','Le label THC-O recouvre des acétates dont il faut préciser la structure, notamment la position Δ8 ou Δ9 de la double liaison. L’acétylation modifie une fonction phénolique ; elle ne dispense pas d’identifier les autres caractéristiques de la molécule.')
mol('thc-o-acetate','mechanisms','Munger étudie les acétates de Δ8-THC, de CBD et de CBN, ainsi qu’un produit commercial au Δ8-THC-acétate. Du cétène est observé dans les condensats. Ce résultat chimique ne couvre pas tous les isomères vendus comme THC-O et ne mesure pas une probabilité individuelle d’atteinte.')
mol('h4-cbd','mechanisms','La saturation modifie les doubles liaisons du CBD et l’arrangement spatial de certains substituants. Les méthodes RMN, HPLC et GC-MS caractérisent les diastéréoisomères ; les hypothèses biologiques de l’introduction ne démontrent ni un traitement du cancer ni une sécurité humaine.')
mol('hhc','occurrence','Des traces historiques ont été rapportées dans des préparations de cannabis, sans établir une biosynthèse normale dans la plante : des transformations peuvent aussi les expliquer. Le HHC est surveillé sur le marché européen, où le nom du produit ne garantit ni proportions d’épimères ni pureté.','cb-euda-2023 cb-euda-2026')
mol('hhc','identity',refs='cb-hhc-2023 cb-euda-2023')
mol('hhc','human','L’étude de 2025 porte sur six volontaires ; l’article métabolique de 2026 réanalyse leurs prélèvements avec de nouveaux dosages. Ces publications reposent donc sur une seule cohorte, dont les effectifs ne doivent pas être additionnés. Elles ne démontrent ni une efficacité thérapeutique ni une sécurité générale.','cb-hhc-human-2025 cb-hhc-metabolites-2026')
mol('hhc','risks','Des intoxications sont signalées, avec des effets cognitifs et psychiques et une composition variable des produits. La mention « naturel » ne garantit pas leur sécurité ; les risques chroniques, les interactions et le contenu réel de nombreux lots restent incertains.','cb-euda-2023 cb-euda-2026 cb-hhc-human-2025')
mol('hhc','mechanisms',refs='cb-hhc-2023')
mol('2-ag','identity','Le 2-arachidonoylglycérol (2-AG) est un monoacylglycérol : une partie arachidonoyle est liée au glycérol par une fonction ester. Il se distingue ainsi de l’éthanolamide AEA, tout en appartenant au même système de messagers endogènes.','cb-2ag-1995 cb-2ag-gut-1995')
mol('2-ag','occurrence','Deux travaux de 1995 caractérisent le 2-AG endogène dans le cerveau de rat et l’intestin de chien. Ces matrices animales ne permettent pas de déduire une présence dans le cannabis.','cb-2ag-1995 cb-2ag-gut-1995')
mol('2-ag','human',refs='cb-2ag-1995 cb-2ag-gut-1995')
mol('2-ag','risks','Le rôle biologique du 2-AG dépend de sa formation, de son inactivation et du tissu considéré. Identifier ce médiateur ne démontre pas un bénéfice à modifier artificiellement son niveau.','qh-sci-dagl qh-sci-magl')
mol('2-ag','mechanisms',refs='cb-2ag-1995 cb-2ag-gut-1995 qh-sci-dagl qh-sci-magl')

# Retirer le vocabulaire de conduite de l’audit du texte publié ; le conserver dans les preuves.
edit('record-study-cbg-laboratory-2026','publication','Le résumé décrit une étude de pharmacologie aiguë, et non un traitement établi. Le financement expérimental et le détail complet des événements ne peuvent pas être précisés à partir de ce seul résumé.')
edit('record-study-thcp-discovery-2019','publication','Le projet UNIHEMP est financé par FESR/PON ; l’institut militaire de Florence fournit FM2. Les dates de collecte ne sont pas précisées ici. Le docking propose un modèle : l’une de ses références structurales porte un signal de rétractation, ce qui limite son réemploi comme support mécanistique.')
edit('record-study-cbd-dravet-2017','publication','Le financement déclaré provient de GW Pharmaceuticals. GWPCARE1 concerne une population et une formulation précises, sans établir l’efficacité d’une fleur ou d’une huile commerciale. L’extension ouverte reprend des participants et ne constitue pas une répétition indépendante sous placebo.')
for a in aa.values():
 for s in a['patch']['sections']:
  s['paragraphs']=[t.replace('La source retenue','L’étude').replace('Le dossier','L’étude').replace('le dossier','l’étude') for t in s['paragraphs']]
 # Une séquence montre seulement les étapes de la voie ; les réserves restent dans la légende et le texte.
 if a['id'] in ['record-cannabinoid-cbda','record-cannabinoid-thcva','record-cannabinoid-cbca']:
  dia=a['patch']['diagram'];last=dia['nodes'].pop()
  dia['caption']={'record-cannabinoid-cbda':'La voie chimique ne démontre pas une efficacité antiémétique humaine ; les observations animales sont décrites dans le texte.', 'record-cannabinoid-thcva':'Voie reconstituée dans une levure : preuve de capacité, sans mesure du flux d’une plante entière.', 'record-cannabinoid-cbca':'Enzyme végétale purifiée : la réaction ne démontre ni flux universel dans la plante ni bénéfice clinique.'}[a['id']]
 # Réunir les fragments très courts sans changer leur contenu.
 for s in a['patch']['sections']:
  if len(s['paragraphs'])>1 and sum(len(t) for t in s['paragraphs'])<600:s['paragraphs']=[' '.join(s['paragraphs'])]

for p,b in bs.items():
 # Le résumé de 2016 a été lu depuis : éliminer l’ancien blocage devenu caduc.
 b['sensitivePoints']=[x for x in b['sensitivePoints'] if not ('THCV' in x and 'fiche blocked pour ce seul point' in x)]
 for a in b['articles']:
  refs=set(a['patch']['sourceIds'])
  for s in a['patch']['sections']:assert set(s['sourceIds'])<=refs,(a['id'],s['id'])
  for q in b['quizPatches']:
   if q['articleId']==a['id']:assert set(q['sourceIds'])<=refs,q['id']
  assert a['patch'].get('diagram'),a['id']
 p.write_text(json.dumps(b,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Finition éditoriale appliquée aux 51 fiches ; références par section et trois séquences corrigées.')
