import json
from pathlib import Path
from collections import Counter

ROOT=Path(__file__).resolve().parents[1]
DAY='2026-11-17'
AUTHOR='rebalance_products_sol'
sources=[]
questions=[]

def source(key,title,org,url,locator,passage,published=None,author=None,access='official-page',limitation=None):
    sid='q2-rp03-'+key
    sources.append(dict(id=sid,title=title,organization=org,url=url,verifiedAt=DAY,author=author or org,
      published=published or 'Date non indiquée sur la page consultée',passage=passage,access=access,
      documentKind='institutional-document',limitation=limitation or 'Passages ciblés uniquement ; aucune recette, méthode de production ni recommandation de dose.',
      consultation=dict(reader=AUTHOR,date=DAY,locator=locator,result='Document original ouvert ; passages indiqués effectivement lus et paraphrasés.')))
    return sid

W=source('who-product-descriptions','Extracts and tinctures of cannabis — Critical Review','WHO Expert Committee on Drug Dependence',
 'https://cdn.who.int/media/docs/default-source/controlled-substances/extracts-and-tinctures.pdf',
 'Section 1, p. 9 : winterization et Edibles ; p. 19, §3.1.5–3.1.6.1',
 'Bhang comme boisson traditionnelle indienne avec feuilles de cannabis et souvent lait ; cannabutter comme beurre au cannabis ; RSO comme huile résineuse brune dense ; dewaxing réduit les cires.',
 '2018','Giuseppe Cannazza, Cinzia Citti et autres auteurs du rapport',access='full-text',
 limitation='Nouvelle notice de passages distincts de q2-rp01-who-extracts-2018. Seules les présentations finales sont reprises ; les recettes, solvants, réglages et allégations thérapeutiques du rapport sont exclus.')
E=source('euda-hash-oil','Cannabis drug profile — grandes formes','EMCDDA, hébergé par EUDA',
 'https://www.euda.europa.eu/publications/drug-profiles/cannabis_en','Introduction, second paragraphe ; Origin',
 'L’huile de cannabis ou hash oil est un extrait de cannabis ou de résine, distinct de l’huile issue des graines.',
 limitation='Page historique : seuls les noms des formes sont retenus. Les affirmations juridiques anciennes, moyennes et généralisations cliniques ne sont pas utilisées.')
C=source('ucsd-vaporization','Vaporization as a Smokeless Cannabis Delivery System','Center for Medicinal Cannabis Research, University of California San Diego',
 'https://cmcr.ucsd.edu/index.php?id=23&option=com_content&view=article',
 'Donald Abrams, étude de vaporisation ; Results, paragraphe carbon monoxide',
 'Le résumé du projet original rapporte moins de monoxyde de carbone avec la vaporisation de fleurs qu’avec leur combustion.',
 author='Donald Abrams et équipe',limitation='Page du centre de recherche responsable. Résultat d’un essai pilote sur fleurs et appareil étudié ; aucune innocuité générale, extrapolation aux cartouches ni consigne technique.')
L=source('hc-breath-holding','Canada’s lower-risk cannabis use guidelines','Public Health Agency of Canada / Health Canada',
 'https://www.canada.ca/en/health-canada/services/drugs-medication/cannabis/resources/lower-risk-cannabis-use-guidelines.html',
 'Modes of administration, paragraphe deep inhalation et breath-holding',
 'L’inhalation profonde et la rétention de fumée accroissent de manière disproportionnée l’entrée de substances toxiques dans les voies respiratoires.',
 '2019-05-10',limitation='Recommandations institutionnelles. Seul le risque lié à la rétention de fumée est repris ; ni fréquence, dose, délai de conduite ni conseil d’optimisation.')
F=source('fda-epidiolex-2026','EPIDIOLEX — Full Prescribing Information, revised 05/2026','FDA / Jazz Pharmaceuticals',
 'https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/210365s024s029s030lbl.pdf',
 '§12.3 Effect of Food ; §7.2 Clobazam ; §7.3 ; §7.4 ; §5.4 et §11',
 'Repas gras : exposition au CBD accrue. Clobazam : métabolite actif augmenté. Valproate : élévations des enzymes hépatiques plus fréquentes. Sédatifs : somnolence accrue. La formulation contient de l’huile de sésame.',
 '2026-05',access='full-text',limitation='Notice réglementaire d’une formulation pharmaceutique précise ; pas de dose ni modification de traitement conseillée. Les résultats ne sont pas transposés quantitativement à toutes les huiles commerciales.')
N=source('nhs-clozapine-smoking','CLP265 Clozapine Policy, version 5.1','Gloucestershire Health and Care NHS Foundation Trust',
 'https://foi.ghc.nhs.uk/wp-content/uploads/2026/02/5.8-CLP265-Clozapine-Policy-V5.1-issued-16.12.25.pdf',
 'p. 27, Action Card 12 ; p. 53, §6.18, dernière puce cannabis avec tabac',
 'L’arrêt de fumée de tabac peut augmenter les taux de clozapine ; le cannabis fumé avec du tabac doit être inclus dans cette évaluation.',
 '2026-02-12',access='full-text',limitation='Interaction avec la fumée du tabac du mélange, pas effet attribué au seul CBD ou THC. Aucun ajustement de traitement ni chiffre posologique repris.')
U=source('hc-oromucosal-local-effects','Cannabis for medical purposes: Using a cannabis product','Health Canada',
 'https://www.canada.ca/en/health-canada/topics/accessing-cannabis-for-medical-purposes/cannabis-medical-purposes/using-cannabis-product.html',
 'Dissolving under the tongue, premier paragraphe',
 'Des produits placés sous la langue, dont des sprays, peuvent piquer ou brûler localement.',
 limitation='Information sur la voie d’administration, sans dose ni délai conseillé. Les listes de voies ne constituent pas une approbation de tous les produits.')
K=source('karschner-oromucosal','Plasma Cannabinoid Pharmacokinetics following Controlled Oral THC and Oromucosal Cannabis Extract Administration','Clinical Chemistry / National Institute on Drug Abuse',
 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3717338/','Discussion, paragraphe although participants were encouraged...',
 'Une partie du spray oromuqueux a été avalée malgré l’administration dans la bouche, contribuant à la variabilité.',
 '2010-11-15','Erin L. Karschner et al.',access='full-text',limitation='Étude humaine originale. Aucune proportion fixe d’absorption buccale, dose ni conduite pratique n’est inférée.')
P=source('cdc-pediatric-edibles','Cannabis and Poisoning — ingestion chez l’enfant','Centers for Disease Control and Prevention',
 'https://www.cdc.gov/cannabis/health-effects/poisoning.html','Effects of edible cannabis, paragraphe Children who consume...',
 'Les enfants ayant ingéré du THC peuvent avoir du mal à marcher, à s’asseoir ou à respirer.',
 '2024-02-15',limitation='Notice ciblée sur un passage clinique distinct des délais et du rangement déjà référencés dans q2-en02-cdc-poison ; aucun diagnostic individuel ni traitement décrit.')
V=source('merck-pets-thc-2026','Toxicosis in Dogs and Cats From Tetrahydrocannabinol (THC)','Merck Veterinary Manual',
 'https://www.merckvetmanual.com/toxicology/toxicoses-from-human-recreational-drugs/toxicosis-in-dogs-and-cats-from-tetrahydrocannabinol-thc',
 'Clinical Signs of THC Toxicosis ; Diagnosis',
 'L’ingestion de THC peut produire ataxie, léthargie et incontinence urinaire ; les tests urinaires humains donnent fréquemment des faux négatifs chez les animaux.',
 '2026-02','Holly Hommerding ; relecture Ahna Brutlag',
 limitation='Référence clinique vétérinaire. Seuls signes et limites diagnostiques cités sont utilisés ; descriptions contestables des extraits et instructions thérapeutiques exclues.')
Y=source('syndros-formulation','SYNDROS — dronabinol oral solution, label version 9','Benuvia Operations / DailyMed, National Library of Medicine',
 'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=a7801c70-995d-46a2-91ee-141ef427c6b5&type=display',
 '§11 Description ; §5.3 ; métadonnées Version 9, Effective Time 20260421',
 'La solution orale SYNDROS contient notamment de l’alcool déshydraté comme excipient, susceptible d’interactions propres à la formulation.',
 '2026-04-21',limitation='Date de version DailyMed attestée ; le texte des prescriptions porte aussi Revised10/2022. La présence d’éthanol est utilisée, sans quantité à administrer ni conseil d’association.')
T=source('hc-topical-warning-2025','Cannabis health warning messages — topicals','Health Canada',
 'https://www.canada.ca/en/health-canada/services/drugs-medication/cannabis/laws-regulations/regulations-support-cannabis-act/health-warning-messages.html',
 'Part 4, avertissement des cannabis topical products ; date d’entrée en vigueur',
 'Les topiques au cannabis ne doivent pas être avalés ou appliqués à l’intérieur du corps, ni sur une peau lésée, irritée ou qui démange.',
 '2025-03-12',limitation='Avertissement canadien d’une classe réglementaire de produits à actifs ; ne décrit pas les médicaments autorisés pour d’autres voies.')
D=source('cdc-bronchitis','Cannabis and Lung Health — symptômes respiratoires','Centers for Disease Control and Prevention',
 'https://www.cdc.gov/cannabis/health-effects/lung-health.html','Lung health and smoking cannabis, paragraphe bronchitis/cough/mucus',
 'Le cannabis fumé est associé à davantage de bronchite, toux et sécrétions de mucus.',
 '2024-02-15',limitation='Passage distinct des toxiques de fumée déjà référencés dans q2-en02-cdc-lungs. Aucune équivalence avec le tabac ni conclusion universelle sur le cancer.')
G=source('hc-edible-alcohol','Guide on composition requirements for cannabis products — edible alcohol','Health Canada',
 'https://www.canada.ca/en/services/health/publications/drugs-health-products/composition-requirements-cannabis-products.html',
 'Edible cannabis, Ethyl alcohol',
 'Les comestibles de cannabis ne peuvent contenir plus de0,5% d’alcool éthylique en masse.',
 limitation='Nouveau passage distinct de q2-rp02-hc-composition. Limite de produit, pas dose conseillée ni règle transposée aux médicaments.')
I=source('hc-ingestible-classification','Classification of ingestible cannabis products: Edible cannabis and cannabis extracts','Health Canada',
 'https://www.canada.ca/en/health-canada/services/cannabis-regulations-licensed-producers/classification-edible-cannabis.html',
 'The product is in a food format ; exemples confectionery et history of food use',
 'Les bonbons, y compris sans sucre, et autres confiseries ont un format alimentaire ; la présence d’un extrait ne les transforme pas en classe cannabis extract.',
 limitation='Classification fédérale canadienne. Les restrictions de vente provinciales peuvent s’ajouter ; la question ne décrit pas l’offre de toutes les provinces.')
Q=source('quebec-extract-colour','C-5.3, r.0.1 — caractéristiques des extraits de cannabis','Légis Québec',
 'https://www.legisquebec.gouv.qc.ca/fr/document/rc/C-5.3,%20r.%200.1','Article 6, deuxième alinéa ; texte officiel à jour au1erjuillet2026',
 'Un extrait de cannabis ne peut contenir d’agent colorant destiné à en modifier la couleur.',
 '2026-07-01',limitation='Nouveau passage distinct de q2-rp02-quebec-products-2026. Règle québécoise, pas interdiction mondiale ni règle de tous les médicaments.')
B=source('hc-cbd-framework','Cannabidiol (CBD) — How we regulate CBD in Canada','Health Canada',
 'https://www.canada.ca/en/health-canada/services/drugs-medication/cannabis/about/cannabidiol.html',
 'How we regulate CBD in Canada, paragraphe As a result...',
 'Les produits au CBD relèvent du Cannabis Act, y compris ceux dont le CBD provient de chanvre industriel.',
 limitation='Seul le régime canadien est retenu. Les affirmations de la page sur le contrôle international du CBD et l’ancienne liste de classes ne sont pas reprises.')

def q(key,level,prompt,opts,explanation,sid,locator,support,subject,sk,prop,objective,
      topic='prevention',category='prevention',article='ref-thc',jurisdiction=None,form='identification',factkey=None):
    ans=len(questions)%4
    options=list(opts);correct=options.pop(0);options.insert(ans,correct)
    ed=dict(domain='active',category=category,subject=subject,subjectKey=sk,property=prop,
      expectedAnswer=correct,learningObjective=objective,factKey=factkey or key,form=form,
      difficultyRationale=('Repère concret de forme ou de risque compréhensible sans mécanisme moléculaire détaillé.' if level==1 else 'Connaissance ciblée d’une formulation, d’une interaction ou d’une règle propre à ces produits.'),
      sourceEvidence=[dict(sourceId=sid,locator=locator,support=support)])
    if jurisdiction:ed.update(jurisdiction=jurisdiction,reviewAfter='2027-05-17')
    questions.append(dict(id='hemp-q2-rp03-'+key,topicId=topic,level=level,prompt=prompt,options=options,answer=ans,
      explanation=explanation,articleId=article,sourceIds=[sid],editorial=ed))

q('bhang-drink-description',1,'Quelle forme du bhang traditionnel indien le rapport OMS de 2018 décrit-il ?',
 ['Une boisson au cannabis, souvent avec du lait','Un bloc de résine destiné à être fumé','Une huile essentielle destinée à parfumer','Une poudre composée de graines de chanvre'],
 'Le rapport décrit une boisson utilisant des feuilles de cannabis, souvent accompagnée de lait. Ce sens concerne une préparation à actifs, distincte des condiments de graines portant des noms proches.',
 W,'Section1, p.9, §1.2.4.3','Bhang est décrit comme une boisson traditionnelle indienne avec feuilles de cannabis et souvent du lait.','Bhang comme boisson','cannabis-bhang-drink','Forme de la préparation','Reconnaître une présentation traditionnelle sans recette.',category='constituents',article='ref-resines-extraits')
q('rso-dense-resinous-oil',2,'Dans le rapport OMS de 2018, quelle présentation correspond à la Rick Simpson Oil, ou RSO ?',
 ['Une huile résineuse brune et dense','Une poudre cristalline de cannabinoïde isolé','Une teinture alcoolique claire et fluide','Une huile essentielle aromatique volatile'],
 'Le rapport décrit la RSO comme une huile résineuse brune et dense. Ce nom de produit ne constitue pas une preuve des allégations thérapeutiques parfois associées à sa promotion.',
 W,'Section1, p.19, §3.1.5–3.1.6.1','RSO signifie Rick Simpson Oil, aussi Phoenix Tears ; aspect huile résineuse dense brun foncé.','Rick Simpson Oil','cannabis-rso','Présentation physique du produit','Identifier une appellation d’huile résineuse sans valider ses promesses.',category='constituents',article='ref-resines-extraits')
q('cannabutter-active-butter',1,'Que désigne le terme « cannabutter » dans le vocabulaire des produits au cannabis ?',
 ['Un beurre contenant des constituants actifs du cannabis','Une huile alimentaire pressée à partir du chènevis','Une pâte de graines de chanvre sans beurre','Une cire résineuse destinée à la vaporisation'],
 'Cannabutter, également appelé butteruana dans le rapport, désigne un beurre au cannabis. Il relève des préparations à actifs et se distingue des pâtes alimentaires de graines de chanvre.',
 W,'Section1, p.9, §1.2.4.3','Le rapport nomme cannabutter ou butteruana un beurre associé au cannabis.','Cannabutter','cannabis-cannabutter','Nature du produit gras alimentaire à actifs','Distinguer préparation au cannabis et aliment de graines.',category='constituents',article='ref-resines-extraits')
q('hash-oil-not-seed-oil',2,'Que désigne « hash oil » dans la typologie des produits de cannabis de l’EUDA ?',
 ['Un extrait de cannabis ou de résine, de consistance huileuse','Une huile obtenue par pressage des graines de chanvre','Une huile essentielle réunissant les composés aromatiques volatils','Une huile alimentaire parfumée avec des terpènes'],
 'L’huile de haschich est un extrait de cannabis ou de résine. Elle appartient à une autre famille que l’huile de graines de chanvre ou l’huile essentielle aromatique.',
 E,'Introduction, second paragraphe ; Origin','Cannabis(hash)oil est un extrait de cannabis ou de résine.','Hash oil','cannabis-hash-oil','Famille de produit distincte des autres huiles','Ne pas confondre les huiles désignées par des mots voisins.',category='constituents',article='ref-resines-extraits')
q('dewaxed-extract-reduced-waxes',2,'Dans un extrait de cannabis dit « winterisé », quelle famille de constituants a été particulièrement réduite ?',
 ['Les cires végétales','Les cannabinoïdes acides','Les terpènes aromatiques','Les pigments anthocyaniques'],
 'Le rapport associe la winterisation au retrait d’une partie des cires de l’extrait. Cette caractéristique de composition ne garantit pas à elle seule la pureté ou la sécurité globale du produit.',
 W,'Section1, p.9, paragraphe de-wax / winterization','Le rapport décrit le retrait de cires dans cette catégorie de produit.','Extrait débarrassé de cires','cannabis-dewaxed-extract','Constituants visés par l’appellation','Lire une caractéristique de composition d’extrait sans protocole.',category='quality',article='ref-resines-extraits')
q('flower-vaporization-lower-co',1,'Quel gaz de combustion l’essai d’Abrams a-t-il trouvé moins présent en vaporisant des fleurs qu’en les fumant ?',
 ['Le monoxyde de carbone','Le protoxyde d’azote','L’ozone','Le dioxyde de soufre'],
 'L’essai pilote a relevé moins de monoxyde de carbone avec la fleur vaporisée. Il ne démontre pas l’innocuité de la vaporisation et ne porte pas sur tous les liquides de cartouches.',
 C,'Étude Donald Abrams, Results','Les niveaux de monoxyde de carbone étaient significativement réduits avec vaporisation par rapport au cannabis fumé.','Fleur fumée et fleur vaporisée','cannabis-flower-vaporization-co','Différence d’exposition au CO','Identifier un risque de combustion distinct du seul THC.',jurisdiction='États-Unis, essai pilote sur fleurs')
q('breath-holding-toxic-intake',1,'Quel effet des inhalations profondes avec rétention de fumée les recommandations canadiennes soulignent-elles pour le cannabis ?',
 ['Une augmentation disproportionnée de l’entrée de toxiques','Une diminution de l’entrée de toxiques malgré plus de fumée','Une élimination plus rapide des toxiques par les poumons','Une diminution de l’exposition au monoxyde de carbone'],
 'Les recommandations signalent une hausse disproportionnée de l’entrée de substances toxiques. Retenir davantage de fumée n’est donc pas présenté comme un moyen d’éviter les risques respiratoires.',
 L,'Modes of administration, breath-holding','Ces pratiques accroissent de façon disproportionnée l’entrée de matières toxiques dans le système respiratoire.','Rétention de fumée de cannabis','cannabis-breath-holding','Augmentation de l’exposition aux toxiques','Connaître un risque lié à une pratique de fumage, sans optimisation.',jurisdiction='Canada, recommandations de santé publique')
q('oral-cbd-fat-meal-exposure',1,'Selon la notice d’Epidiolex, quel effet un repas riche en graisses a-t-il eu sur l’exposition au CBD oral par rapport au jeûne ?',
 ['Une exposition au CBD plus élevée','Une exposition au CBD partiellement réduite','Une exposition au CBD restée inchangée','Une absence de passage du CBD dans le sang'],
 'Dans les études de la solution pharmaceutique, le repas a augmenté l’exposition au CBD. Le contenu alimentaire peut donc changer l’exposition, même si la quantité de produit administrée ne change pas.',
 F,'§12.3 Effect of Food','Un repas gras/calorique augmente le pic et l’exposition totale au CBD par rapport au jeûne.','CBD oral et repas','oral-cbd-food-effect','Influence des aliments sur l’exposition','Reconnaître une interaction aliment-formulation sans conseil de prise.',article='ref-cbd',jurisdiction='États-Unis, notice Epidiolex mai2026')
q('cbd-clobazam-active-metabolite',2,'Avec quel antiépileptique le CBD pharmaceutique augmente-t-il l’exposition à un métabolite actif de ce médicament ?',
 ['Le clobazam','Le valproate','La lamotrigine','Le lévétiracétam'],
 'La notice décrit une hausse du N-desméthylclobazam, métabolite actif du clobazam, avec le CBD. Cette interaction peut augmenter les effets indésirables ; elle relève du suivi du prescripteur.',
 F,'§7.2 Clobazam ; §12.3 Drug Interaction Studies','Le CBD augmente le métabolite actif N-desméthylclobazam, sans hausse du clobazam parent dans l’étude citée.','CBD et clobazam','cbd-clobazam-interaction','Augmentation du métabolite actif du clobazam','Identifier une interaction précise, distincte d’un conseil général de prudence.',article='ref-cbd',jurisdiction='États-Unis, notice Epidiolex mai2026')
q('cbd-valproate-liver-enzymes',2,'Quel risque la notice d’Epidiolex signale-t-elle particulièrement lors de l’association CBD pharmaceutique–valproate ?',
 ['Une augmentation des enzymes du foie','Une chute de la filtration rénale','Une augmentation des hormones thyroïdiennes','Une chute du nombre de plaquettes'],
 'L’association augmente la fréquence des élévations d’enzymes hépatiques. Ce fait concerne une interaction documentée avec le valproate, au-delà du risque hépatique général du CBD.',
 F,'§7.3 ; §5.1 Concomitant Valproate and Clobazam','L’usage concomitant d’Epidiolex et de valproate augmente l’incidence des élévations des enzymes du foie.','CBD et valproate','cbd-valproate-interaction','Risque hépatique accru dans une association','Distinguer risque général du CBD et interaction avec un médicament identifié.',article='ref-cbd',jurisdiction='États-Unis, notice Epidiolex mai2026')
q('cbd-sedatives-somnolence',1,'Quel effet la notice d’Epidiolex signale-t-elle comme potentiellement accru quand ce CBD pharmaceutique est associé à l’alcool ?',
 ['La somnolence','La diarrhée','Les éruptions cutanées','La fièvre'],
 'La notice inclut l’alcool parmi les substances pouvant accroître sédation et somnolence avec Epidiolex. L’absence de high caractéristique du THC n’exclut pas cette interaction du CBD.',
 F,'§7.4 CNS Depressants and Alcohol','La combinaison avec l’alcool peut augmenter sédation et somnolence.','CBD pharmaceutique et alcool','cbd-alcohol-combination','Renforcement possible de la somnolence','Connaître une interaction du CBD avec l’alcool sans la confondre avec celle du THC.',article='ref-cbd',jurisdiction='États-Unis, notice Epidiolex mai2026',factkey='cbd-alcohol-somnolence-interaction')
q('spliff-cessation-clozapine-levels',2,'Sous clozapine, que peut entraîner l’arrêt de joints contenant aussi du tabac sur l’élimination et le taux de ce médicament ?',
 ['Une élimination plus lente et un taux plus élevé','Une élimination plus rapide et un taux plus faible','Une élimination plus rapide et un taux plus élevé','Une élimination plus lente et un taux plus faible'],
 'La fumée de tabac accélère l’élimination de la clozapine ; son arrêt peut faire monter le taux. La recommandation NHS inclut le tabac des joints : ce changement nécessite un suivi du traitement.',
 N,'p.27 Action Card12 ; p.53 §6.18','L’arrêt du tabac augmente les taux de clozapine ; le tabac fumé avec cannabis compte dans l’évaluation.','Joints cannabis-tabac et clozapine','cannabis-tobacco-clozapine','Effet d’un changement de fumage sur un traitement','Reconnaître le rôle du tabac du mélange sans attribuer cet effet au seul THC.',jurisdiction='Royaume-Uni, politique clinique NHS2026')
q('oromucosal-spray-local-stinging',1,'Quel effet local Santé Canada signale-t-il pour des produits de cannabis placés sous la langue, notamment les sprays ?',
 ['Une sensation de picotement ou de brûlure','Une sensation d’anesthésie prolongée','Une sensation de fraîcheur persistante','Une sensation d’effervescence sur la langue'],
 'Des produits sous la langue peuvent piquer ou brûler. Cet effet local dépend de la formulation et de la voie ; il ne correspond pas au high ni à la mesure de THC du produit.',
 U,'Dissolving under the tongue','Les produits sous la langue, dont les sprays, peuvent piquer ou brûler.','Tolérance locale des sprays','cannabis-oromucosal-local-effects','Effet local signalé pour cette voie','Distinguer effet au site d’application et effet général des cannabinoïdes.',jurisdiction='Canada, information médicale consultée en novembre2026')
q('oromucosal-spray-part-swallowed',2,'Dans l’étude de Karschner sur Sativex, quelle contribution à l’exposition a été décrite malgré la voie oromuqueuse recherchée ?',
 ['Une absorption digestive de la fraction avalée','Une absorption pulmonaire de la fraction inhalée','Une absorption nasale de la fraction remontant vers le nez','Une absorption limitée à la seule muqueuse buccale'],
 'Dans l’étude humaine de Karschner, une partie du spray a été avalée malgré l’application dans la bouche. Une formulation oromuqueuse peut donc aussi contribuer à une exposition digestive.',
 K,'Discussion, paragraphe portion of the drug was inevitably swallowed','Une partie du médicament a été avalée malgré la consigne d’absorption muqueuse, contribuant à la variabilité.','Spray de cannabis et déglutition','nabiximols','Contribution possible d’une fraction avalée','Ne pas confondre lieu de pulvérisation et absorption exclusivement muqueuse.',article='ref-origines-formulations',jurisdiction='États-Unis, étude humaine originale')
q('child-edible-thc-breathing',1,'Quelle complication grave les CDC décrivent-ils chez un enfant après l’ingestion d’un aliment contenant du THC ?',
 ['Une difficulté à respirer','Une infection pulmonaire bactérienne','Une occlusion intestinale par corps étranger','Une hypertension intracrânienne'],
 'Les CDC signalent notamment des difficultés respiratoires après ingestion de THC par un enfant. Le risque ne se limite pas à une agitation ou à un état d’ivresse comparable à celui d’un adulte.',
 P,'Effects of edible cannabis, paragraphe Children...','Les enfants peuvent avoir des difficultés à respirer après ingestion de produits au THC.','Intoxication pédiatrique par comestible','child-thc-edible-respiratory-risk','Complication respiratoire possible','Connaître un risque grave spécifique aux ingestions accidentelles infantiles.',jurisdiction='États-Unis, information CDC2024')
q('dog-thc-ataxia-incontinence',2,'Quel tableau le manuel vétérinaire Merck décrit-il notamment chez un chien ayant ingéré du THC ?',
 ['Une démarche mal coordonnée et des fuites urinaires','Des plaques cutanées et un prurit localisé','Un gonflement des articulations et une boiterie','Une toux productive et un écoulement nasal'],
 'Ataxie et incontinence urinaire peuvent accompagner l’intoxication au THC, avec par exemple une léthargie. Ces signes ne suffisent pas à poser un diagnostic ; le vétérinaire évalue l’animal.',
 V,'Clinical Signs of THC Toxicosis','Ataxie et incontinence urinaire sont parmi les signes décrits après ingestion de THC.','THC ingéré par le chien','dog-thc-toxicosis-signs','Signes neurologiques et urinaires possibles','Reconnaître un tableau vétérinaire décrit sans diagnostiquer à distance.',jurisdiction='Portée clinique générale ; manuel vétérinaire février2026')
q('syndros-ethanol-excipient',2,'Quel excipient de la solution orale de dronabinol SYNDROS explique certaines précautions propres à sa formulation ?',
 ['L’alcool éthylique','L’huile de sésame','L’amidon de maïs','Le lactose'],
 'SYNDROS contient de l’alcool, ce qui participe à certaines interactions de formulation. Deux médicaments au même cannabinoïde peuvent donc différer aussi par leurs excipients.',
 Y,'§11 Description ; §5.3','La formulation contient de l’alcool déshydraté, lié à un risque d’interaction de type disulfirame.','Solution orale SYNDROS','syndros-ethanol-formulation','Présence d’éthanol dans une formulation au dronabinol','Distinguer identité du cannabinoïde et composition complète du médicament.',article='ref-origines-formulations',jurisdiction='États-Unis, notice DailyMed version avril2026')
q('epidiolex-sesame-oil-excipient',2,'Quelle huile végétale figure dans les excipients d’Epidiolex et compte dans ses contre-indications d’hypersensibilité ?',
 ['L’huile de graines de sésame','L’huile de noix de coco','L’huile de graines de tournesol','L’huile d’olive'],
 'La notice mentionne l’huile de sésame et les réactions d’hypersensibilité aux ingrédients. Un CBD purifié dans une solution pharmaceutique ne signifie pas que le produit fini contient du CBD seul.',
 F,'§5.4 et §11 Description','L’huile de sésame est un excipient ; hypersensibilité à l’un des ingrédients constitue une contre-indication.','Excipients d’Epidiolex','epidiolex-purified-cbd','Huile de sésame dans la formulation','Distinguer substance purifiée et solution finale comportant des excipients.',article='ref-origines-formulations',jurisdiction='États-Unis, notice Epidiolex mai2026')
q('canada-topical-external-not-internal',1,'Au Canada, quelle destination correspond aux produits de cannabis classés comme topiques, selon leur avertissement ?',
 ['Une application externe sur peau intacte','Une application à l’intérieur de la bouche','Une application sur une plaie ouverte','Une ingestion mélangée à un aliment'],
 'L’avertissement exclut l’ingestion, l’application interne et la peau lésée ou irritée. Cette classe de produits à actifs ne se confond pas avec les formulations autorisées pour d’autres voies.',
 T,'Part4, cannabis topical products','L’avertissement interdit ingestion, usage interne et application sur peau lésée ou irritée.','Topiques de cannabis canadiens','canada-cannabis-topical-external','Destination externe et limites réglementaires','Reconnaître la destination d’une classe de produits au THC ou CBD.',category='quality',article='ref-reglementation-produits',jurisdiction='Canada, avertissement en vigueur depuis mars2025')
q('smoked-cannabis-bronchitis-symptoms',1,'Quelle gêne respiratoire les CDC associent-ils notamment au cannabis fumé ?',
 ['Une toux avec production de mucus','Une apnée du sommeil d’origine nasale','Une rhinite saisonnière aux pollens','Une pneumonie bactérienne'],
 'Les CDC décrivent davantage de toux, de bronchite et de mucus chez les personnes qui fument du cannabis. Cette association respiratoire ne nécessite pas que le cannabis soit mélangé au tabac.',
 D,'Lung health and smoking cannabis','Le cannabis fumé peut augmenter le risque de bronchite, de toux et de production de mucus.','Symptômes du cannabis fumé','cannabis-smoking-bronchitis','Association à des symptômes bronchiques','Identifier des effets respiratoires du fumage au-delà de la seule composition de la fumée.',jurisdiction='États-Unis, information sanitaire CDC2024')
q('canada-edible-alcohol-cap',2,'Au Canada, quelle teneur maximale en alcool éthylique le guide autorise-t-il dans un comestible au cannabis ?',
 ['0,5 % en masse','5 % en masse','15 % en masse','40 % en masse'],
 'Le plafond est de 0,5 % en masse pour les comestibles au cannabis. Une boisson au cannabis ne peut donc pas simplement reprendre le degré d’une boisson alcoolisée ordinaire dans cette catégorie.',
 G,'Edible cannabis, Ethyl alcohol','Le comestible ne peut dépasser0,5% d’alcool éthylique poids par poids.','Alcool des comestibles canadiens','canada-edible-alcohol-limit','Plafond spécifique d’alcool du produit','Distinguer boisson au cannabis et boisson alcoolisée dans le cadre canadien.',category='quality',article='ref-reglementation-produits',jurisdiction='Canada, règles consultées en novembre2026')
q('canada-candy-extract-still-edible',1,'Au Canada, un bonbon au THC fabriqué avec un extrait de cannabis relève normalement de quelle classe de produit ?',
 ['Du cannabis comestible','Des extraits de cannabis','Du cannabis séché','Des topiques au cannabis'],
 'Le format consommé comme un aliment détermine la classe comestible. Utiliser un extrait comme ingrédient ne suffit pas à classer le bonbon parmi les extraits ni à lui appliquer leurs plafonds.',
 I,'Differences between edible cannabis and cannabis extracts ; exemples confectionery','Le format confiserie appartient aux aliments au cannabis et est exclu de la classe cannabis extracts.','Classification des confiseries au THC','canada-cannabis-food-format','Classe liée au format alimentaire du produit','Distinguer ingrédient extrait et classe réglementaire du produit fini.',category='quality',article='ref-reglementation-produits',jurisdiction='Canada, classement fédéral consulté en novembre2026')
q('quebec-extract-no-colour-additive',2,'Quel ajout le règlement québécois interdit-il explicitement dans les extraits de cannabis ?',
 ['Un colorant destiné à modifier leur couleur','Une huile de support pour les cannabinoïdes','Un arôme caractéristique du cannabis','Un stabilisant conforme pour préserver la qualité'],
 'L’article6 exclut les agents colorants destinés à changer la couleur de l’extrait. Cette règle décrit une composition autorisée au Québec et ne vaut pas comme norme mondiale des concentrés.',
 Q,'Article6, deuxième alinéa','L’extrait ne peut contenir aucun agent colorant destiné à en modifier la couleur.','Colorants des extraits québécois','quebec-cannabis-extract-colour','Interdiction spécifique de colorant ajouté','Comprendre une caractéristique réglementaire de l’offre des extraits.',category='quality',article='ref-reglementation-produits',jurisdiction='Québec, texte officiel à jour juillet2026')
q('pet-human-urine-thc-false-negatives',2,'Quelle explication Merck avance-t-il aux faux négatifs des tests urinaires humains de THC utilisés chez les animaux ?',
 ['Des métabolites urinaires mal reconnus par ces tests','Du glucose urinaire masquant le résultat','Une urine trop alcaline pour les anticorps du test','Une coloration urinaire empêchant la lecture du résultat'],
 'Les faux négatifs sont fréquents lorsque ces tests humains sont utilisés chez les animaux. Leurs métabolites urinaires peuvent être mal détectés : un résultat négatif ne suffit pas à exclure l’exposition.',
 V,'Diagnosis','Le manuel évoque des métabolites non détectés comme explication possible des faux négatifs fréquents.','Tests humains chez animaux exposés au THC','pet-thc-human-urine-test','Explication possible des faux négatifs interespèces','Reconnaître une limite spécifique au diagnostic d’exposition animale au cannabis.',jurisdiction='Portée clinique générale ; manuel vétérinaire février2026')
q('canada-cbd-products-cannabis-act',1,'Au Canada, quel cadre réglementaire s’applique aux produits non médicaux au CBD provenant de chanvre industriel ?',
 ['La Loi sur le cannabis et ses règlements','Le cadre des produits de santé naturels ordinaires','Le cadre des aliments nouveaux enrichis','Le cadre des produits de vapotage à la nicotine'],
 'Le CBD reste régi par la Loi sur le cannabis, y compris lorsqu’il vient du chanvre industriel. Une origine « chanvre » ne fait donc pas sortir automatiquement le produit de ce cadre.',
 B,'How we regulate CBD in Canada','CBD et produits au CBD relèvent des règles du Cannabis Act, y compris le CBD issu de chanvre industriel.','Cadre canadien du CBD','canada-cbd-cannabis-act','Régime commun du CBD issu de chanvre','Distinguer origine agricole et régime de commercialisation du CBD.',category='quality',article='ref-reglementation-produits',jurisdiction='Canada, réglementation consultée en novembre2026')

if __name__=='__main__':
    assert len(questions)==25
    article_ids={a['id'] for a in json.loads((ROOT.parent/'encyclopedia-revision/baseline-catalog.json').read_text(encoding='utf-8'))['articles']}
    for x in questions:
        assert len(x['id'])<=75,x['id']
        assert len(x['prompt'])<=150,(x['id'],'prompt',len(x['prompt']))
        assert len(x['explanation'])<=240,(x['id'],'explanation',len(x['explanation']))
        assert len(set(x['options']))==4
        assert all(len(o)<=75 for o in x['options']),(x['id'],'options',[(len(o),o) for o in x['options']])
        assert x['articleId'] in article_ids,x['articleId']
        assert set(x['sourceIds'])<=set(s['id'] for s in sources)
    batch=dict(batchId='r-products-03',author=AUTHOR,role='Formes, voies, formulations et interactions pratiques des produits à actifs',questions=questions,sources=sources)
    (ROOT/'batches/r-products-03.json').write_text(json.dumps(batch,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    facts=dict(batchId='r-products-03',author=AUTHOR,date=DAY,status='author_complete_pending_independent_review',count=25,domain='active',
      levels=dict(Counter(str(x['level']) for x in questions)),
      neighbourSearch=dict(index='docs/quiz-2000/fact-index.jsonl',
        terms=['bhang','cannabutter','Simpson','winter','clobazam','valproate','clozapine','sésame','monoxyde','bronchite','urinaire','chien','repas','sédatif','éthanol'],
        openedNeighbours=['hemp-q2-en02-edible-onset-duration','hemp-q2-en02-locked-storage-children','hemp-q2-en02-smoke-toxic-compounds','hemp-q2-en02-cbd-medication-review','hemp-q2-en02-cbd-liver-risk','hemp-q2-rp01-oral-cannabis-oil-carrier','hemp-q2-rb02-holi-cannabis-tradition'],
        distinctions=['Aucun nouveau fait délai/durée des edibles ni rangement des enfants','Interactions nommées distinctes du conseil général de consulter','Valproate teste une association spécifique, pas simplement l’identité du foie','Symptômes bronchiques distincts de la présence de toxiques dans la fumée','Bhang : forme du produit, pas fête associée','Huile de sésame : composition d’une formulation précise, pas fonction générale d’huile porteuse']),
      actualReadings=[dict(sourceId=s['id'],url=s['url'],locator=s['consultation']['locator'],reader=AUTHOR,date=DAY) for s in sources],
      coordination=dict(agentA='Repas gras/clobazam/valproate/sédatifs/fumée-clozapine expressément laissés à ce lot ; les effets intrinsèques et la clinique générale restent chez A.',agentB='Vocabulaire des formes réservé ; aucune histoire de circuits de résine ni variétés du site.'),
      safeguards=['Aucun dosage, traitement ou ajustement de médicament conseillé','Aucun mode de production/extraction ni recette de produit psychoactif','Descriptions de produits finis, sans paramètres','Limites réglementaires identifiées par pays et date','Aucune autoapprobation, aucun fichier actif ou revue modifié'],
      facts=[dict(id=x['id'],domain='active',factKey=x['editorial']['factKey'],expectedAnswer=x['editorial']['expectedAnswer']) for x in questions])
    (ROOT/'facts/r-products-03.json').write_text(json.dumps(facts,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(dict(questions=25,sources=len(sources),levels=facts['levels'])))
