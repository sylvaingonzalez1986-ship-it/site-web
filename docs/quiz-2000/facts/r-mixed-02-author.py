import json
import re
from pathlib import Path
from collections import Counter

ROOT=Path(__file__).resolve().parents[1]
DAY='2026-11-17'
AUTHOR='rebalance_products_sol'
sources=[]
questions=[]

def source(key,title,org,url,locator,support,published=None,author=None,access='full-text',kind=None,limitation=None):
    sid='q2-rm02-'+key
    sources.append(dict(id=sid,title=title,organization=org,url=url,verifiedAt=DAY,author=author or org,
      published=published or 'Date non indiquée sur la page consultée',passage=support,access=access,
      documentKind=kind or ('original-research' if access in ['full-text','abstract'] else 'institutional-document'),
      limitation=limitation or 'Passages indiqués effectivement lus ; résultats bornés au produit ou à l’étude, sans promesse sanitaire universelle.',
      consultation=dict(reader=AUTHOR,date=DAY,locator=locator,result='Document original ou institutionnel ouvert ; passage indiqué effectivement lu.')))
    return sid

H=source('hc-pipe-dab-components','Cannabis accessories for inhalation: Minimizing your risk when smoking, vaping and dabbing','Santé Canada',
 'https://www.canada.ca/en/health-canada/services/drugs-medication/cannabis/personal-use/accessories-inhalation.html',
 'Smoking accessories, Pipes ; Dabbing accessories, Dab rigs',
 'Le nail ou banger est le compartiment chauffant recevant l’extrait. Santé Canada privilégie le verre et la céramique pour les pipes, les plastiques chauffés pouvant exposer à des produits nocifs.',
 '2024-09-20',access='official-page',limitation='Nouvelle lecture de passages distincts du refroidissement par l’eau déjà traité en rp02 ; aucun réglage de chauffe ni mode d’emploi repris.')
A=source('alberta-cannabis-tobacco','Using cannabis and tobacco together','Alberta Health Services',
 'https://myhealth.alberta.ca/Alberta/Pages/Using-cannabis-and-tobacco-together.aspx','Risks of using, liste',
 'L’usage conjoint du cannabis et du tabac augmente les risques de dépendance aux deux substances et de troubles d’usage correspondants.',
 '2023-08-31','Tobacco, Vaping and Cannabis Program, Alberta Health Services',access='official-page')
E=source('euda-synthetic-hot-pockets','EU Drug Market: New psychoactive substances — Distribution and supply in Europe: Synthetic cannabinoids','EUDA et Europol',
 'https://www.euda.europa.eu/publications/eu-drug-markets/new-psychoactive-substances/distribution-and-supply/synthetic-cannabinoids_en',
 'Overview, dernier paragraphe avant Production',
 'Les hot pockets sont des zones du produit fortement concentrées en cannabinoïdes de synthèse ; leur répartition inégale participe au risque d’intoxication.',
 '2024-03-22 ; mise à jour 2024-06-27',access='official-page',limitation='Description du marché européen en 2024 ; pas de méthode de formulation ni de dépistage ou de contournement de tests.')
C=source('cdc-brodifacoum-2018','Outbreak of Severe Illness Linked to the Vitamin K Antagonist Brodifacoum and Use of Synthetic Cannabinoids — Illinois, March–April 2018','CDC / MMWR',
 'https://www.cdc.gov/mmwr/volumes/67/wr/mm6721a4.htm','Paragraphes signes cliniques et analyses des prélèvements',
 'L’enquête sur les cannabinoïdes de synthèse a documenté des saignements graves et retrouvé du brodifacoum, anticoagulant de rodenticides, dans les prélèvements analysés.',
 '2018-06-01','Erin Moritz et collaborateurs',limitation='Épidémie située ; ne pas généraliser ce contaminant à tous les mélanges Spice ni affirmer que l’intention d’ajout était connue.')
W=source('grayson-cbd-warfarin','An interaction between warfarin and cannabidiol, a case report','Epilepsy & Behavior Case Reports / University of Alabama at Birmingham',
 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5789126/','§2 Case report ; §3 Discussion ; §4 Conclusions',
 'Chez ce patient sous warfarine, l’introduction du CBD pharmaceutique s’est accompagnée d’une hausse de l’INR ; le suivi médical a adapté le traitement, sans complication hémorragique observée.',
 '2017-10-12','Leslie Grayson, Brannon Vines, Kate Nichol et Jerzy P. Szaflarski',limitation='Cas individuel de CBD pharmaceutique ; interaction possible, pas fréquence mesurée ni conduite thérapeutique à appliquer soi-même. Aucun dosage repris.')
F=source('fda-cbd-everolimus','Epidiolex prescribing information — revised May 2026','FDA',
 'https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/210365s024s029s030lbl.pdf','§7.2 Orally Administered P-gp Substrates ; §12.3 Everolimus',
 'L’association du CBD pharmaceutique avec l’évérolimus oral a augmenté son exposition plasmatique dans l’étude décrite ; la notice demande un suivi des concentrations du médicament.',
 '2026-05','Jazz Pharmaceuticals, notice approuvée FDA',kind='institutional-regulatory-label',limitation='Passage nouvellement lu, distinct des interactions clobazam/valproate/alcool de rp03. Aucun ajustement de dose ni généralisation à toute préparation de CBD.')
K=source('gi-kush-2025','Kush in Sierra Leone: West Africa’s growing synthetic drugs challenge','Global Initiative Against Transnational Organized Crime et Clingendael Institute',
 'https://globalinitiative.net/wp-content/uploads/2025/02/Lucia-Bird-Ruiz-Benitez-de-Lugo-and-Dr-Kars-de-Bruijne-Kush-in-Sierra-Leone-%E2%80%93-West-Africas-growing-synthetic-drugs-challenge-GI-TOC-and-Clingendael-Institute-February-2025.final_.pdf',
 'p.5–6 imprimées, méthodes ; p.8–9, Components of kush et Figure1',
 'Les échantillons de kush de Freetown collectés en 2024 et confirmés au laboratoire contenaient principalement soit des nitazènes, soit des cannabinoïdes de synthèse, plutôt que des fleurs seules d’une lignée Kush.',
 '2025-02-25','Lucia Bird Ruiz-Benitez de Lugo et Kars de Bruijne',limitation='Un seul fait sur la confusion d’appellation, expressément accepté par le coordinateur. Échantillon situé, non composition universelle de tout produit appelé kush ; procédés exclus.')
M=source('munger-acetates-ketene','Vaping Cannabinoid Acetates Leads to Ketene Formation','Portland State University / ChemRxiv',
 'https://chemrxiv.org/engage/api-gateway/chemrxiv/assets/orp/resource/item/627401c36cae1c94a5fe8fe7/original/vaping-cannabinoid-acetates-leads-to-ketene-formation.pdf',
 'Abstract ; Study limitations ; Conclusion',
 'Les essais ont mis en évidence du cétène dans les condensats de cannabinoïdes acétates chauffés, dont un produit commercial delta-8-THC-O-acétate.',
 '2022','Kaelas R. Munger, Robert P. Jensen et Robert M. Strongin',limitation='Manuscrit original ChemRxiv effectivement ouvert, et poster original de l’équipe également lu ; version ACS bloquée. Petit nombre de produits, preuve expérimentale d’émission, pas diagnostic d’EVALI. Paramètres expérimentaux exclus.')
J=source('canada-transparent-flower','Cannabis Regulations, section108','Ministère de la Justice du Canada',
 'https://laws-lois.justice.gc.ca/eng/regulations/SOR-2018-144/section-108.html','Article108(1)(a) et108(2)',
 'Le texte autorise un contenant immédiat transparent pour le cannabis séché ou frais, par exception à la règle opaque ou translucide.',
 'Texte courant au2026-10-19 ; dernière modification2026-10-01',access='official-page',limitation='Règle canadienne actuelle avec exception de2025, sans la présenter comme une règle mondiale ni une garantie de conservation.')
G=source('galasso-trypsin','Variability in Seed Traits in a Collection of Cannabis sativa L. Genotypes','Frontiers in Plant Science',
 'https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2016.00688/full','Introduction ; Results, Table2 et paragraphe TI',
 'Une activité d’inhibition de trypsine a été mesurée dans les farines dégraissées des graines. Ces inhibiteurs peuvent réduire l’activité de cette enzyme de digestion protéique.',
 '2016-05-20','I. Galasso et collaborateurs',limitation='Nouveau passage réellement lu sur TI, distinct de GLA, acides aminés et phytates du lot précédent. Pas d’extrapolation clinique ni de classement de variétés.')
U=source('uf-hemp-milk-nutrition','Plant-Based Milks: Hemp','University of Florida, IFAS Extension',
 'https://ask.ifas.ufl.edu/publication/FS420/pdf','p.1, comparaison nutritionnelle ; p.4, Table1',
 'La boisson de chanvre non sucrée comparée contient moins de protéines et de calories que les laits de vache du tableau. Sa teneur calcique comparable correspond à une boisson enrichie.',
 '2020-10 ; révision2024-05','Sarah Curl, Daniela Rivero-Mendoza et Wendy J. Dahl',access='official-page',limitation='Comparaison de la boisson présentée, pas composition universelle de toutes boissons. Affirmations sur protéine complète, absence d’allergie et effets cliniques de l’introduction exclues.')
T=source('tang-emulsifying-comparison','Physicochemical and functional properties of hemp (Cannabis sativa L.) protein isolate','Journal of Agricultural and Food Chemistry / PubMed',
 'https://pubmed.ncbi.nlm.nih.gov/17090145/','Abstract, phrases emulsifying activity et emulsion stability',
 'L’isolat de chanvre étudié présentait des indices d’activité émulsifiante et de stabilité de l’émulsion inférieurs à l’isolat de soja comparé.',
 '2006-11-15','Chuan-He Tang, Zi Ten, Xian-Sheng Wang et Xiao-Quan Yang',access='abstract',limitation='Résumé original complet effectivement lu ; ni texte intégral payant ni règle pour tous procédés commerciaux revendiqués. Pas de promesse infantile.')
P=source('montserrat-sterol','Hemp (Cannabis sativa L.) seed oil: analytical and phytochemical characterization of the unsaponifiable fraction','Journal of Agricultural and Food Chemistry / PubMed',
 'https://pubmed.ncbi.nlm.nih.gov/24422510/','Abstract, concentrations de la fraction insaponifiable',
 'Le bêta-sitostérol est plus abondant que le campestérol et le cycloarténol dans la fraction stérolique de l’huile analysée.',
 '2014-01-23','S. Montserrat-de la Paz, F. Marín-Aguilar, M. D. García-Giménez et M. A. Fernández-Arche',access='abstract',limitation='Résumé original complet lu ; identité d’un constituant alimentaire minoritaire, sans allégation de baisse du cholestérol ou de bénéfice clinique.')
D=source('house-dehulling-digestibility','Evaluating the quality of protein from hemp seed products through the protein digestibility-corrected amino acid score method','Journal of Agricultural and Food Chemistry / University of Manitoba',
 'https://pubmed.ncbi.nlm.nih.gov/20977230/','Abstract, derniers paragraphes',
 'Le retrait de l’enveloppe a amélioré la digestibilité des protéines et le score corrigé dans les produits étudiés, avec bioessai chez le rat.',
 '2010-10-26','James D. House, Jason Neufeld et Gero Leson',access='abstract',limitation='Résumé original complet lu. Bioessai chez le rat, non essai d’efficacité chez l’humain. Distinct de la concentration protéique après décorticage, déjà couverte.')
L=source('eu-food-thc-limits','Règlement (UE)2023/915, version consolidée au19août2026 — AnnexeI, point2.6','Union européenne / EUR-Lex',
 'https://eur-lex.europa.eu/eli/reg/2023/915/eng','AnnexeI, points2.6.1 à2.6.3, extrait original indexé',
 'Les maxima en équivalents delta-9-THC sont3mg/kg pour les graines et produits de graines concernés,7,5mg/kg pour leur huile.',
 '2023-04-25 ; consolidation2026-08-19',access='excerpt',limitation='URL originale ouverte mais protection JavaScript. Extrait indexé du texte consolidé effectivement lu ; aucune lecture intégrale revendiquée. Limites alimentaires, distinctes du seuil agricole de THC.')
sources[-1]['consultation']['result']='Ouvertures EUR-Lex protégées par contrôle JavaScript ; extrait original indexé du tableau2.6 effectivement lu, accès déclaré excerpt.'
B=source('defra-green-decortication','A supply chain assessment and development for hemp bast fibre in the non-woven and technical textile industries — NF0616','Defra / NNFCC',
 'https://www.votehemp.com/wp-content/uploads/2018/09/file.pdf','p.1, Executive Summary',
 'Le green decortication étudié sépare les fibres de tiges fraîches, plutôt que de tiges préalablement séchées ou rouies.',
 author='Jacqueline Broadhead et partenaires du projet NF0616',kind='institutional-project-report',limitation='Copie du document original Defra/NNFCC sur miroir Vote Hemp, titre et numéro de projet vérifiés. Pas de date de publication déduite du chemin de la copie.')
Z=source('dabiret-geotextile-ageing','Durability assessment of nonwoven hemp geotextiles for road infrastructures: field and laboratory ageing under alkaline conditions','Gustave Eiffel University / ICSMGE2026',
 'https://www.issmge.org/uploads/publications/1/141/694.pdf','p.6299 Abstract ; p.6301 §3.1 ; p.6302 Conclusions',
 'Les géotextiles de chanvre enfouis dans le béton concassé étudié ont perdu une part importante de leur résistance en traction, au laboratoire comme sur plateforme.',
 '2026-06','Sama Angèle Dabiret, Fabienne Farcas, Laetitia Van Schoors, Carlos Minatchy, Lamis Makki, Philippe Reiffsteck, Dimitri Durin et Olivier Waterblez',limitation='Essai de produits non traités et conditions définies, pas durée de vie universelle de tout géotextile de chanvre ni promesse de remplacement de tous synthétiques.')
V=source('dgmr-capillary-moisture','Hempcrete: The effectiveness of hempcrete in the reduction of environmental and financial costs of residences in the Netherlands','DGMR / TU Delft',
 'https://dgmr.nl/wp-content/uploads/2023/02/Whitepaper-Hempcrete_feb2023_DGMR.pdf','p.5, The application, liste et Figure6',
 'Les recommandations d’application prévoient de protéger les blocs de béton de chanvre contre les remontées capillaires depuis le soubassement.',
 '2023-02','Alexandra Vontetsianou',kind='professional-white-paper',limitation='Recommandation professionnelle attribuée, distincte d’une norme universelle. Aucun dimensionnement de chantier ni propriété de tous blocs non documentés.')
R=source('walker-soluble-shiv','Effect of Hemp’s Soluble Components on the Physical Properties of Hemp Concrete','Journal of Materials Science Research / Trinity College Dublin',
 'https://www.academia.edu/64707331/Effect_of_Hemp_S_Soluble_Components_on_the_Physical_Properties_of_Hemp_Concrete',
 'p.12 Abstract ; p.15–16 §3.1 Effect of Water-Soluble Hemp Components on Setting Time',
 'Les constituants hydrosolubles de la chènevotte ont retardé les réactions et la prise des liants chaux-pouzzolane étudiés ; la seule rétention d’eau ne l’expliquait pas.',
 '2014-06-13','Rosanne Walker et Sara Pavía',limitation='Texte original intégral accessible sur le dépôt Academia de l’autrice, passages identifiés réellement lus. Résultats des liants testés, pas de recette ou règle universelle pour toute chaux.')
O=source('mazian-over-retting','A Comparative Study of the Effect of Field Retting Time on the Properties of Hemp Fibres Harvested at Different Growth Stages','Fibers / IMT Mines Alès',
 'https://www.mdpi.com/2079-6439/7/12/108','§3, propriétés en traction ; §4 Conclusions',
 'Après une amélioration initiale, un rouissage prolongé peut dégrader les propriétés en traction des fibres de chanvre ; le résultat dépend de la matière et des conditions.',
 '2019-12-07','Brahim Mazian, Anne Bergeret, Jean-Charles Benezet et Luc Malhautier',limitation='Question de qualité de fibres industrielles, sans calendrier de récolte, durée de rouissage ou optimisation de cannabis à actifs.')
Q=source('refashion-hemp-textiles','Le lin et le chanvre','Refashion',
 'https://pro.refashion.fr/ressource/fiche-pratique/le-lin-et-le-chanvre','Propriétés distinctives ; Enjeux éco-conception, Recyclabilité et Incorporation',
 'La fiche décrit un adoucissement du chanvre au fil des lavages et la difficulté du tri automatisé à le distinguer d’autres fibres cellulosiques, notamment du coton.',
 'Mise à jour2026-10',access='official-page',limitation='Observations professionnelles attribuées ; pas de garantie sur tout vêtement, apprêt ou technologie future. Affirmations hypoallergéniques et résistances biologiques générales non reprises.')
Y=source('williams-directional-hemp-lime','The influence of the casting process on the internal structure and physical properties of hemp-lime','Materials and Structures / University of Bath',
 'https://link.springer.com/article/10.1617/s11527-016-0976-4','§3.3 Thermal conductivity ; §4 Discussion, Fig.7 ; §5 Conclusions',
 'L’orientation des particules de chènevotte conduit à des propriétés directionnelles ; à densité comparable les fonctions de conductivité et de rupture doivent distinguer les deux directions de chargement.',
 '2016-12-09','Joseph Williams, Mike Lawrence et Pete Walker',limitation='Résultats d’une formulation et d’un mode de compactage ; pas de valeur universelle ni paramètre de mise en œuvre conseillé.')

def q(key,domain,level,prompt,options,explanation,sid,locator,support,subject,sk,prop,obj,article=None,category=None,jurisdiction=None,form='identification'):
    def readable(s):
        s=re.sub(r'(?<=[A-Za-zÀ-ÿ])(?=\d)', ' ', s)
        return re.sub(r'(?<=\d)(?=[A-Za-zÀ-ÿ])', ' ', s)
    prompt=readable(prompt)
    explanation=readable(explanation)
    options=[readable(o) for o in options]
    n=len(questions)%4
    opts=list(options);correct=opts.pop(0);opts.insert(n,correct)
    ed=dict(domain=domain,category=category or ('food' if domain=='food' else 'hemp-uses' if domain=='materials' else 'prevention'),
      subject=subject,subjectKey=sk,property=prop,expectedAnswer=correct,learningObjective=obj,factKey=key,form=form,
      difficultyRationale={1:'Repère concret de produit ou de matériau, sans mécanisme technique spécialisé.',2:'Connaissance ciblée d’un produit, de sa composition ou de son comportement.',3:'Connaissance technique ou interprétation située demandant un vocabulaire spécialisé.',4:'Mise en relation de mécanismes spécialisés, sans niveau gonflé pour le quota.'}[level],
      sourceEvidence=[dict(sourceId=sid,locator=locator,support=support)])
    if jurisdiction:ed.update(jurisdiction=jurisdiction,reviewAfter='2027-05-17')
    questions.append(dict(id='hemp-q2-rm02-'+key,topicId='seeds' if domain=='food' else 'profiles' if domain=='materials' else 'prevention',level=level,
      prompt=prompt,options=opts,answer=n,explanation=explanation,articleId=article or ('ref-graines-chanvre' if domain=='food' else 'ref-chenevotte-materiaux' if domain=='materials' else 'ref-thc'),sourceIds=[sid],editorial=ed))

q('dab-rig-banger-component','active',1,'Dans un dab rig, à quel élément correspondent les noms « nail » ou « banger » ?',
 ['Au compartiment où l’extrait est chauffé','À l’embout par lequel on aspire','Au réservoir contenant l’eau','À l’outil servant à déposer l’extrait'],
 'Le nail ou banger reçoit l’extrait concentré et constitue la partie chauffée du dispositif. Il se distingue du réservoir d’eau, de l’embout et du dabber servant à manipuler l’extrait.',
 H,'Dabbing accessories, Dab rigs','Le nail est le compartiment où l’extrait est chauffé.','Pièces d’un dab rig','cannabis-dabbing','Rôle du nail ou banger','Reconnaître un élément courant d’un dispositif à concentrés.',article='ref-resines-extraits',category='constituents')
q('pipe-glass-ceramic','active',1,'Quels matériaux Santé Canada privilégie-t-il pour le corps d’une pipe à cannabis ?',
 ['Le verre et la céramique','Le verre et l’acier galvanisé','La céramique et le plastique','Le plastique et le cuivre'],
 'Santé Canada recommande le verre ou la céramique. L’organisme signale que le chauffage de plastiques et d’autres matériaux peut libérer des substances nocives ensuite inhalées.',
 H,'Smoking accessories, Pipes','Choisir une pipe en verre ou céramique ; exposition possible aux produits nocifs de matériaux chauffés.','Matériaux de pipe à cannabis','cannabis-smoking-pipe','Matériaux recommandés pour la pipe','Relier une caractéristique du dispositif à l’exposition par inhalation.',jurisdiction='Canada, conseil sanitaire consulté en novembre2026')
q('cannabis-tobacco-dual-dependence','active',1,'Quel risque d’usage la co-consommation de cannabis et de tabac ajoute-t-elle, selon Alberta Health Services ?',
 ['Une dépendance au cannabis comme au tabac','Une dépendance limitée au cannabis, même avec du tabac','Une dépendance limitée au tabac, même avec du cannabis','Une dépendance unique où les deux produits se substituent'],
 'Le mélange peut renforcer la dépendance au cannabis comme au tabac et compliquer l’arrêt. Le tabac du joint constitue une exposition à part entière, au-delà des effets recherchés du cannabis.',
 A,'Risks of using','La co-consommation augmente les risques de dépendance et de troubles d’usage des deux substances.','Co-consommation cannabis et tabac','cannabis-tobacco-co-use','Risque de double dépendance','Comprendre une conséquence propre au mélange, distincte de la définition d’un spliff.',jurisdiction='Canada, conseil sanitaire Alberta2023')
q('synthetic-hot-pockets','active',2,'Dans certains mélanges Spice, que désignent les « hot pockets » décrits par l’EUDA ?',
 ['Des zones surconcentrées en actifs au sein du mélange','Des zones où les actifs sont répartis à concentration uniforme','Des amas de végétaux ne contenant aucun actif ajouté','Des couches d’actifs restant séparées du support végétal'],
 'Les actifs peuvent être répartis de manière inégale dans le produit. Des zones très concentrées en cannabinoïdes de synthèse rendent l’exposition imprévisible et augmentent le risque d’intoxication.',
 E,'Overview, dernier paragraphe','Hot pockets : forte concentration locale de la substance dans un produit hétérogène.','Hétérogénéité des mélanges Spice','synthetic-cannabinoid-spice-k2','Concentration locale des actifs','Comprendre un risque lié à la répartition des actifs dans le produit.',jurisdiction='Europe, description EUDA2024')
q('spice-brodifacoum-bleeding','active',2,'Quelle complication a marqué l’épidémie liée aux cannabinoïdes de synthèse et au brodifacoum dans l’Illinois en2018 ?',
 ['Des hémorragies avec trouble de la coagulation','Des insuffisances rénales aiguës sans saignement','Des convulsions sans trouble de la coagulation','Des pneumonies lipidiques sans saignement'],
 'L’enquête a documenté des saignements graves et retrouvé du brodifacoum, anticoagulant employé dans des rodenticides. Il s’agit d’une contamination située, pas de la composition de tous les Spice.',
 C,'Signes cliniques ; analyses des81 prélèvements','Saignements et INR élevés ; brodifacoum retrouvé dans les prélèvements analysés.','Épidémie Spice Illinois2018','synthetic-cannabinoid-brodifacoum-2018','Complication hémorragique de produits contaminés','Connaître un risque documenté de cette famille de produits.',jurisdiction='États-Unis, Illinois, épidémie2018')
q('cbd-warfarin-inr-rise','active',2,'Quel effet a été observé lors de l’introduction du CBD pharmaceutique chez le patient sous warfarine décrit par Grayson ?',
 ['Une anticoagulation accrue avec hausse de l’INR','Une anticoagulation diminuée avec baisse de l’INR','Une réaction allergique immédiate avec INR inchangé','Une hémolyse avec INR inchangé'],
 'Ce cas rapporte une hausse de l’INR avec le CBD et un suivi du traitement par le médecin. Il signale une interaction possible avec la warfarine ; il ne permet pas d’en chiffrer la fréquence.',
 W,'§2 Case report ; §4 Conclusions','INR augmenté après introduction du CBD ; adaptation médicale, sans saignement rapporté.','CBD et warfarine','cbd-warfarin-interaction','Augmentation observée de l’effet anticoagulant','Identifier une interaction pratique au-delà du seul conseil général de consulter.',article='ref-cbd',jurisdiction='États-Unis, cas publié2017')
q('cbd-everolimus-exposure','active',3,'Quel effet du CBD d’Epidiolex sur l’évérolimus oral sa notice décrit-elle dans l’étude d’interaction ?',
 ['Une exposition plasmatique à l’évérolimus augmentée','Une exposition plasmatique à l’évérolimus diminuée','Un pic retardé, sans changement de l’exposition totale','Un pic plus précoce, sans changement de l’exposition totale'],
 'L’exposition à l’évérolimus a augmenté avec le CBD pharmaceutique. La notice prévoit une surveillance médicale de ses concentrations ; ce résultat ne justifie aucun ajustement autonome du traitement.',
 F,'§7.2 ; §12.3 Everolimus','Hausse de l’exposition à l’évérolimus lors de la coadministration étudiée.','CBD et évérolimus','cbd-everolimus-interaction','Hausse de l’exposition à un médicament associé','Connaître une interaction documentée de formulation orale.',article='ref-cbd',jurisdiction='États-Unis, noticeFDAmai2026')
q('sierra-leone-kush-name','active',2,'Dans les échantillons de « kush » de Freetown étudiés en2024, qu’a identifié le rapport GI-TOC/Clingendael publié en2025 ?',
 ['Des mélanges à cannabinoïdes de synthèse ou à nitazènes','Des fleurs seules de cannabis d’une lignée Kush','De la résine de cannabis sans autre substance active','Du tabac associé uniquement à un extrait de THC'],
 'Dans cet échantillon, le nom kush recouvrait surtout l’un ou l’autre type d’actifs de synthèse. Cette appellation locale ne désigne donc pas nécessairement des fleurs d’une lignée cannabique Kush.',
 K,'p.8–9 imprimées, Components of kush ; Fig.1','Échantillons contenant majoritairement soit nitazènes, soit cannabinoïde de synthèse, plutôt que les deux.','Appellation kush en Sierra Leone','sierra-leone-kush-2024','Composition du produit distincte d’une lignée Kush','Éviter une confusion entre nom de mélange et nom de fleurs.',article='ref-resines-extraits',jurisdiction='Sierra Leone, Freetown, échantillonnage2024')
q('thc-acetate-ketene-emission','active',3,'Quel gaz toxique Munger et ses collègues ont-ils mis en évidence en chauffant notamment un produit THC-O-acétate ?',
 ['Le cétène','L’acroléine','Le benzène','Le formaldéhyde'],
 'Les essais ont détecté une émission de cétène à partir de cannabinoïdes acétates, dont un produit commercial. Cette observation de laboratoire ne détermine pas à elle seule le risque clinique de chaque produit.',
 M,'Abstract ; Study limitations ; Conclusion','Cétène observé dans les condensats chauffés des acétates testés et d’un produit commercial.','Émissions des cannabinoïdes acétates','cannabis-acetate-vaping-ketene','Émission expérimentale de cétène','Connaître un risque de dégradation propre aux formes acétates inhalées.',jurisdiction='Recherche expérimentale2022, produits étudiés')
q('canada-transparent-dried-fresh','active',2,'Au Canada, quelle classe bénéficie de l’exception autorisant un contenant immédiat transparent à l’article108 ?',
 ['Le cannabis séché ou frais','Les extraits de cannabis','Le cannabis comestible','Les topiques au cannabis'],
 'Le texte permet cette transparence pour le cannabis séché ou frais. L’exception de2025 ne s’étend pas aux autres classes, soumises à la règle opaque ou translucide.',
 J,'Article108(1)(a) et108(2)','Exception de transparence pour dried cannabis ou fresh cannabis.','Emballage transparent des fleurs','canada-cannabis-container-transparency','Exception réglementaire pour fleurs séchées ou fraîches','Lire une règle de conditionnement sans reprendre son ancienne version.',article='ref-reglementation-produits',category='quality',jurisdiction='Canada, règlement courant octobre2026')

q('seed-trypsin-inhibitors','food',3,'Quel antinutriment Galasso et ses collègues ont-ils quantifié dans les farines de graines de chanvre, en plus des phytates ?',
 ['Les inhibiteurs de trypsine','Les lectines','Les oxalates','Les glucosinolates'],
 'Une activité inhibitrice de trypsine a été mesurée dans les farines dégraissées. Ces constituants peuvent réduire la digestion protéique ; leur présence distingue la composition brute d’une disponibilité totale.',
 G,'Introduction ; Results, TI et Table2','Inhibiteurs de trypsine présents et activité mesurée dans les farines dégraissées.','Antinutriments protéiques du chènevis','hempseed-meal-antinutrients','Présence d’inhibiteurs de trypsine','Comprendre une limite réelle de la valeur alimentaire du tourteau.',article='ref-proteines-chanvre')
q('hemp-milk-protein-energy-profile','food',1,'Dans la comparaison UF/IFAS, quel profil a la boisson de chanvre non sucrée face aux laits de vache comparés ?',
 ['Moins de protéines et moins de calories','Plus de protéines et moins de calories','Moins de protéines et plus de calories','Plus de protéines et plus de calories'],
 'La boisson comparée apporte moins de protéines et de calories à volume égal. Une graine riche en protéines ne donne donc pas automatiquement une boisson aussi protéinée que le lait de vache.',
 U,'p.1 comparaison ; p.4 Table1','Boisson chanvre3g protéines et60calories par tasse, contre8g et83à150calories pour les laits comparés.','Profil d’une boisson alimentaire de chanvre','hempseed-milk-nutrient-profile','Profil protéique et énergétique comparé','Distinguer valeur des graines et composition de leur boisson.',form='comparaison')
q('hemp-milk-calcium-fortification','food',1,'Dans le tableau UF/IFAS, qu’explique la teneur en calcium de la boisson de chanvre comparable à celle du lait de vache ?',
 ['Un enrichissement de la boisson en calcium','La forte teneur naturelle du seul jus de graines','L’ajout de protéines de lait à la boisson','L’emploi d’une eau naturellement très calcaire'],
 'La comparaison porte sur une boisson enrichie en calcium. Elle ne décrit pas une teneur garantie pour toute boisson de graines ou préparation maison au chanvre.',
 U,'p.1, comparaison nutritionnelle, when fortified ; Table1','La boisson de chanvre comparée est enrichie en calcium.','Calcium d’une boisson de chanvre','hempseed-milk-nutrient-profile','Enrichissement du produit comparé','Comprendre une caractéristique nutritionnelle de cette catégorie alimentaire.')
q('hemp-isolate-soy-emulsifying','food',3,'Chez Tang, comment l’isolat de chanvre se compare-t-il au soja pour former et stabiliser une émulsion ?',
 ['Activité et stabilité émulsifiantes plus faibles','Activité et stabilité émulsifiantes plus élevées','Activité plus élevée, stabilité plus faible','Activité plus faible, stabilité plus élevée'],
 'L’isolat de chanvre étudié formait et stabilisait moins bien les émulsions que celui de soja. Les auteurs relient ces limites notamment à l’agrégation des protéines ; d’autres formulations peuvent différer.',
 T,'Abstract, indices activité émulsifiante et stabilité','Les deux indices étaient bien inférieurs pour l’isolat de chanvre étudié.','Isolat de chanvre comme ingrédient émulsifiant','hemp-protein-isolate-emulsifying','Activité et stabilité comparées au soja','Connaître une limite fonctionnelle d’un ingrédient alimentaire réel.',article='ref-proteines-chanvre',form='comparaison')
q('seed-oil-beta-sitosterol','food',3,'Quel phytostérol domine dans l’huile de graines de chanvre analysée par Montserrat-de la Paz et ses collègues ?',
 ['Le bêta-sitostérol','Le campestérol','Le stigmastérol','Le brassicastérol'],
 'Le bêta-sitostérol est un constituant majeur de la fraction stérolique de l’huile étudiée. Cette composition ne démontre pas que consommer l’huile produit un effet médical donné.',
 P,'Abstract, fraction insaponifiable','Bêta-sitostérol1905mg/kg, campestérol505,69mg/kg dans l’huile étudiée.','Phytostérols de l’huile de graines','huile-chenevis','Identité du phytostérol dominant','Identifier un constituant minoritaire alimentaire au-delà de sa seule famille.',article='ref-huile-graines')
q('dehulling-protein-digestibility','food',2,'Dans le bioessai de House, quel traitement des graines de chanvre a amélioré la digestibilité de leurs protéines ?',
 ['Le retrait de l’enveloppe extérieure','La simple dessiccation des graines entières','Le lavage des graines à l’eau froide','L’adjonction d’huile de graines'],
 'Le décorticage a amélioré la digestibilité protéique mesurée et le score corrigé dans ce bioessai chez le rat. Ce résultat est distinct de la simple hausse de concentration des protéines après retrait de la coque.',
 D,'Abstract, phrase Removal of the hull fraction','Retrait de l’enveloppe : digestibilité et PDCAAS améliorés dans les produits étudiés.','Décorticage et valeur protéique','hempseed-dehulling','Digestibilité améliorée au bioessai','Distinguer concentration de protéines et proportion digérée.',article='ref-proteines-chanvre')
q('eu-seed-oil-thc-food-maxima','food',3,'Quels maxima UE en équivalents delta-9-THC s’appliquent respectivement aux graines alimentaires de chanvre et à leur huile ?',
 ['3 mg/kg et7,5 mg/kg','7,5 mg/kg et3 mg/kg','3 mg/kg et3 mg/kg','7,5 mg/kg et7,5 mg/kg'],
 'Le règlement distingue les graines et leur huile :3 puis7,5mg/kg d’équivalents delta-9-THC. Ces limites de contaminants alimentaires ne sont pas le seuil agricole exprimé en pourcentage de THC.',
 L,'AnnexeI, points2.6.1–2.6.3','Maxima3mg/kg graines et produits concernés ;7,5mg/kg huile de graines.','THC résiduel dans les aliments de graines','eu-hempseed-food-thc-maxima','Limites alimentaires distinctes pour graines et huile','Ne pas appliquer aux aliments le seuil agricole de THC.',jurisdiction='Union européenne, texte consolidé19août2026')

q('green-decortication-no-retting','materials',2,'Dans le projet Defra NF0616, quel état des tiges caractérise le « green decortication » du chanvre ?',
 ['Des tiges fraîches, avant séchage ou rouissage','Des tiges sèches ayant déjà subi un rouissage','Des tiges séchées après immersion de rouissage','Des tiges rouies puis réhumidifiées avant défibrage'],
 'Le projet étudie le défibrage de tiges fraîches sans rouissage préalable. Cette voie industrielle diffère de la chaîne traditionnelle utilisant des tiges préalablement rouies et séchées.',
 B,'p.1 Executive Summary','Fresh green stems plutôt que dried or retted stems.','Défibrage de tiges fraîches','hemp-green-decortication','Absence de rouissage préalable','Reconnaître deux voies de préparation des fibres textiles.',article='ref-fibres-chanvre')
q('geotextile-buried-tensile-loss','materials',3,'Quel effet l’enfouissement dans le béton concassé étudié par Dabiret a-t-il eu sur les géotextiles de chanvre non traités ?',
 ['Une forte perte de résistance en traction','Une forte augmentation de résistance en traction','Une résistance stable malgré la coloration de surface','Une résistance accrue au laboratoire mais réduite sur site'],
 'Les essais sur plateforme et au laboratoire ont montré une forte perte de résistance. La biodégradabilité de ce textile devient ici une contrainte de durabilité pour son emploi enfoui en infrastructure.',
 Z,'§3.1 et Conclusions','Perte importante de résistance dans les deux environnements d’essai.','Géotextiles de chanvre enfouis','hemp-geotextile-road-ageing','Dégradation mécanique en sol alcalin étudié','Comprendre une limite d’usage d’un textile technique de chanvre.',form='comparaison')
q('hempcrete-capillary-base','materials',1,'Quelle arrivée d’eau la protection au pied d’un mur en blocs de chanvre vise-t-elle à interrompre selon DGMR ?',
 ['Les remontées depuis le soubassement','La pluie entrant par la face extérieure de l’enduit','La condensation de l’air intérieur sur la paroi','Les infiltrations depuis la couverture du toit'],
 'Les blocs doivent être protégés des remontées capillaires. Leur aptitude à échanger de la vapeur ne signifie pas qu’ils puissent rester en contact permanent avec de l’eau provenant du soubassement.',
 V,'p.5, Application et Fig.6','Protection nécessaire contre capillary moisture rise.','Pied de mur chaux-chanvre','hempcrete-capillary-base-protection','Protection contre les remontées d’eau','Distinguer comportement à la vapeur et exposition à l’eau liquide.')
q('shiv-solubles-delay-binder','materials',3,'Quelle fraction de chènevotte a retardé la prise des liants chaux-pouzzolane dans l’étude de Walker et Pavía ?',
 ['Les constituants hydrosolubles, dont des pectines','La cellulose cristalline des parois','La lignine du tissu ligneux','Les cires insolubles de surface'],
 'Les constituants passés dans l’eau ont ralenti les réactions du liant et sa prise. L’étude distingue cet effet chimique d’une simple rétention d’eau : le choix chènevotte-liant compte pour le matériau.',
 R,'§3.1, p.15–16 imprimées','Solubles ralentissent prise par interaction avec réactions chaux-pouzzolanes ; séchage comparable ne soutient pas rétention seule.','Chènevotte et compatibilité du liant','hempcrete-shiv-soluble-binder-reactions','Retard de prise par constituants solubles','Comprendre une contrainte chimique propre au composite de construction.')
q('hemp-over-retting-tensile-risk','materials',2,'Quel risque textile les résultats de Mazian mettent-ils en évidence quand le rouissage du chanvre est prolongé à l’excès ?',
 ['Une baisse de résistance des fibres en traction','Une baisse de leur aptitude à se mouiller','Une hausse durable de leur rigidité initiale','Une fixation insuffisante des teintures réactives'],
 'Après une amélioration initiale, les propriétés en traction peuvent reculer. Un rouissage plus poussé ne garantit donc pas une meilleure fibre textile : la cohésion de sa structure peut se dégrader.',
 O,'§4 Conclusions, propriétés en traction et over-retting','Maximum initial des propriétés, puis baisse lors du rouissage prolongé.','Rouissage excessif et fibres textiles','hemp-retting','Fragilisation possible des fibres surrouies','Connaître une limite qualitative du rouissage industriel.',article='ref-fibres-chanvre')
q('hemp-textile-softens-washing','materials',1,'Quelle évolution du toucher des textiles de chanvre au fil des lavages la fiche Refashion décrit-elle ?',
 ['Un adoucissement progressif','Un durcissement progressif','Un toucher devenant plus abrasif','Un toucher restant rigide sans évolution'],
 'Refashion décrit un adoucissement progressif du chanvre lavé. Cela ne prédit pas à lui seul le toucher de chaque vêtement : filature, armure, mélanges et finitions comptent aussi.',
 Q,'Propriétés distinctives, chanvre','Le chanvre s’adoucit progressivement au fil des lavages.','Toucher du textile de chanvre lavé','hemp-textile-washing-handle','Adoucissement décrit à l’usage','Connaître une propriété concrète d’un vêtement de chanvre.',article='ref-fibres-chanvre')
q('hemp-textile-sorting-cotton','materials',2,'Avec quelle matière le chanvre textile peut-il être confondu lors du tri automatisé actuel, selon Refashion ?',
 ['Le coton','La laine','Le polyester','Le nylon'],
 'La proximité des fibres cellulosiques complique l’identification du chanvre face au coton dans le tri. Cette difficulté contribue au manque de gisements de chanvre triés pour le recyclage textile.',
 Q,'Recyclabilité ; Incorporation de matière recyclée','Fibres cellulosiques proches du coton, difficulté de détection et confusion au tri.','Tri du chanvre textile usagé','hemp-textile-recycling-sorting','Confusion avec le coton au tri','Comprendre une difficulté propre au recyclage de ces textiles.',article='ref-fibres-chanvre',jurisdiction='France, fiche professionnelle mise à jour octobre2026')
q('hemp-lime-directional-performance','materials',3,'Chez Williams, comment se compare le chaux-chanvre testé perpendiculairement au compactage à celui testé parallèlement ?',
 ['Conductivité et résistance en compression plus élevées','Conductivité et résistance en compression plus faibles','Conductivité plus élevée, résistance en compression plus faible','Conductivité plus faible, résistance en compression plus élevée'],
 'L’orientation de la chènevotte rend les performances directionnelles. Dans la formulation étudiée, les modèles distinguent donc les deux sens d’essai, même à densité comparable ; ce n’est pas un béton isotrope.',
 Y,'§3.3 ; §4, Fig.7 et fonctions directionnelles','Conductivité plus forte transversalement au compactage ; modèle de rupture plus élevé dans cette direction à densité comparable.','Orientation dans le béton chaux-chanvre','hemp-lime-casting-anisotropy','Couple de performances dépendant de l’orientation','Relier la structure de la chènevotte aux performances de l’isolant.',form='comparaison')

if __name__=='__main__':
    assert len(questions)==25,len(questions)
    domains=Counter(x['editorial']['domain'] for x in questions)
    assert domains=={'active':10,'food':7,'materials':8},domains
    arts={a['id'] for a in json.loads((ROOT.parent/'encyclopedia-revision/baseline-catalog.json').read_text(encoding='utf-8'))['articles']}
    for x in questions:
        assert len(x['id'])<=75,x['id']
        assert len(x['prompt'])<=150,(x['id'],'prompt',len(x['prompt']))
        assert len(x['explanation'])<=240,(x['id'],'explanation',len(x['explanation']))
        assert len(set(x['options']))==4,x['id']
        assert all(len(o)<=75 for o in x['options']),(x['id'],'options')
        assert x['articleId'] in arts,x['articleId']
        assert set(x['sourceIds'])<=set(s['id'] for s in sources)
    batch=dict(batchId='r-mixed-02',author=AUTHOR,role='Produits à actifs, graines alimentaires et matériaux de chanvre',questions=questions,sources=sources)
    (ROOT/'batches/r-mixed-02.json').write_text(json.dumps(batch,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    facts=dict(batchId=batch['batchId'],author=AUTHOR,date=DAY,status='author_complete_pending_independent_review',count=25,domains=dict(domains),
      levels=dict(Counter(str(x['level']) for x in questions)),
      neighbourSearch=dict(index='docs/quiz-2000/fact-index.jsonl',
        terms=['warfar','everol','ketene','brodifacoum','hot pockets','Spice','banger','tryps','digestibil','sitost','capillar','decortic','rouiss','conductiv','katabira','recycl'],
        openedNeighbours=['hemp-q2-rp01-dabbing-vaporizing-concentrate','hemp-q2-rp02-bong-water-cools-smoke','hemp-q2-rp02-spice-k2-synthetic-cannabinoid-products','hemp-q2-d01-lysine-limitante','hemp-q2-d04-hemp-dehulling-fibre-down-protein-concentrated','hemp-q2-d01-gouttes-et-depot','hemp-q2-d04-hemp-oil-phytosterols-unsaponifiable-fraction','hemp-profiles-pectines','hemp-profiles-rouissage-organismes','hemp-q2-d01-beton-densite-chaleur','hemp-q2-d01-beton-grands-pores'],
        distinctions=['Spice : nouveaux faits distribution locale et épidémie précise, pas nature synthétique déjà testée.','Pipe : matériaux, pas rôle de l’eau ou présence générale de fumée toxique.','Antinutriments TI distincts des phytates/minéraux.','Digestibilité au bioessai distincte de concentration protéique par décorticage.','Bêta-sitostérol dominant distinct de la seule famille phytostérols dans insaponifiable.','Isolat émulsifiant face au soja distinct de taille des gouttes/sédimentation et de solubilité à pH acide.','Rouissage excessif : qualité en traction distincte des organismes ou du substrat pectique ciblé.','Remontées depuis soubassement distinctes du gobetis extérieur contre pluie.','Orientation du béton distincte des variations de densité, humidité et taille de pores déjà couvertes.','Recyclage : tri chanvre/coton distinct de dissolution-régénération chimique.']),
      actualReadings=[dict(sourceId=s['id'],url=s['url'],access=s['access'],locator=s['consultation']['locator'],reader=AUTHOR,date=DAY,result=s['consultation']['result']) for s in sources],
      coordination=dict(agentA='Interactions pratiques, dispositifs et règles de produits laissés à Sol ; A garde contaminants des fleurs, clinique générale, CHS et allergie cannabis.',agentB='Aucune nouvelle lignée ou histoire générale. Confusion kush Sierra Leone limitée à la nature du produit et autorisée par le coordinateur.'),
      safeguards=['Aucune autoapprobation ni fichier actif ou revue modifié','Aucun protocole/dose/paramètre de fabrication ou culture de cannabis à actifs','EUR-Lex accès excerpt déclaré honnêtement','Manuscrit original ChemRxiv et article original sur dépôt autrice, limites d’accès explicites','Aucun niveau4 artificiel','Tous les faits restent situés et sans promesse universelle'],
      facts=[dict(id=x['id'],domain=x['editorial']['domain'],factKey=x['editorial']['factKey'],expectedAnswer=x['editorial']['expectedAnswer']) for x in questions])
    (ROOT/'facts/r-mixed-02.json').write_text(json.dumps(facts,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(dict(questions=25,sources=len(sources),domains=dict(domains),levels=facts['levels'])))
