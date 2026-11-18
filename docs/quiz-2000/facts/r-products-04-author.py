import json
from pathlib import Path
from collections import Counter

ROOT=Path(__file__).resolve().parents[1]
DAY='2026-11-17'
AUTHOR='rebalance_products_sol'
sources=[]
questions=[]

def s(key,title,org,url,locator,support,published=None,author=None,access='official-page',kind='institutional-document',limitation=None):
    sid='q2-rp04-'+key
    sources.append(dict(id=sid,title=title,organization=org,url=url,verifiedAt=DAY,
      author=author or org,published=published or 'Date non indiquée sur la page consultée',
      passage=support,access=access,documentKind=kind,
      limitation=limitation or 'Seuls les passages indiqués soutiennent le fait ; aucune recette, dose, méthode de fabrication ou optimisation de culture reprise.',
      consultation=dict(reader=AUTHOR,date=DAY,locator=locator,result='Source originale ouverte ; passage indiqué effectivement lu et paraphrasé.')))
    return sid

COM=s('hc-edible-composition','Guide on composition requirements for cannabis products','Santé Canada',
 'https://www.canada.ca/en/services/health/publications/drugs-health-products/composition-requirements-cannabis-products.html',
 'Edible cannabis : Shelf-stable ; Supplemented foods ; Vitamins and minerals',
 'Les comestibles doivent être stables avant ouverture, sans réfrigération nécessaire pour prévenir la contamination. Les aliments supplémentés ne sont pas des ingrédients autorisés, avec des exceptions distinctes pour certaines vitamines déjà présentes dans des aliments.',
 '2026-10-14',kind='institutional-guide')
GAZ=s('gazette-total-label','Regulations Amending Certain Regulations Concerning Cannabis (Streamlining of Requirements): SOR/2025-43','Gouvernement du Canada / Gazette du Canada',
 'https://gazette.gc.ca/rp-pr/p2/2025/2025-03-12/html/sor-dors43-eng.html',
 'Packaging and labelling : paragraphes commençant Under the current requirements et With these amendments',
 'La réforme exige les valeurs total THC et total CBD, et rend facultatives les valeurs des formes déjà neutres ou acides. Des dispositions transitoires autorisent l’écoulement des anciens étiquetages.',
 '2025-03-12',kind='regulatory-document')
PAP=s('hc-rolling-papers','Cannabis accessories for inhalation: Minimizing your risk when smoking, vaping and dabbing','Santé Canada',
 'https://www.canada.ca/en/health-canada/services/drugs-medication/cannabis/personal-use/accessories-inhalation.html',
 'Smoking accessories : Rolling papers',
 'Santé Canada signale que les papiers à rouler ne sont pas réglementés et peuvent contenir des métaux lourds, notamment du plomb, ainsi que des pesticides.',
 '2024-09-20',limitation='Nouveau passage sur le papier, distinct des matériaux des pipes, du rôle de l’eau et des contaminants des fleurs.')
UNR=s('unr-sugar-leaves','Hemp Basics: Anatomy of a Female Hemp Plant','University of Nevada, Reno Extension',
 'https://extension.unr.edu/publication.aspx?PubID=4479','Paragraphe Sugar leaves et comparaison avec fan leaves',
 'Les sugar leaves sont de petites feuilles présentes dans les têtes florales ; les trichomes leur donnent un aspect givré. Les fan leaves sont de grandes feuilles saillantes.',
 '2021','L. McGue, M. Morawska, M. L. Robinson et A. O. O’Callaghan',
 limitation='Description des petites feuilles résineuses uniquement ; les recommandations de défoliation, récolte et les formulations imprécises sur la couleur des stigmates sont exclues.')
CHI=s('sanskriti-chillum','Chillum — Sanskriti Museums','Sanskriti Museums / Google Arts & Culture',
 'https://artsandculture.google.com/asset/chillum/SgFoYeYzgjKoDQ','Notice de l’objet, comparaison avec hukkah',
 'Le chillum est une pipe à main composée d’un foyer et d’un embout, sans réservoir d’eau contrairement au hukkah.',author='Jyotindra Jain',access='catalogue',kind='museum-catalogue',
 limitation='Notice de typologie de l’objet et usage cannabis/haschich ; chronologie contestable du tabac non reprise. Les dates de l’objet ne sont pas une date de publication.')
VOL=s('volcano-classic','VOLCANO CLASSIC','Storz & Bickel',
 'https://www.storz-bickel.com/en/devices/volcanoclassic','Description du système EASY VALVE et ballon détachable',
 'Le modèle de table VOLCANO CLASSIC collecte l’aérosol dans un ballon EASY VALVE détachable.',kind='manufacturer-product-description',
 limitation='Caractéristique matérielle attribuée au modèle ; aucune allégation de pureté, santé ou supériorité et aucun réglage de chauffe repris.')
DYN=s('dynavap-battery-free','Try DynaVap — Battery Free','DynaVap',
 'https://www.dynavap.com/pages/try-dynavap','Battery Free : How does it work?',
 'Le fabricant présente ses dispositifs comme dépourvus de batterie et d’électronique, utilisant une source de chaleur externe.',kind='manufacturer-product-description',
 limitation='Description matérielle attribuée, pas garantie de sécurité. Aucun geste de chauffe, temps, température ni quantité repris.')
FRE=s('frenchy-cannoli','About Frenchy Cannoli','Frenchy Cannoli Brand / succession Frenchy Cannoli',
 'https://frenchycannoli.com/about','Premier paragraphe et récit de transmission du haschich traditionnel',
 'Frenchy Cannoli était un artisan, enseignant et défenseur californien des concentrés traditionnels du cannabis, particulièrement du haschich.',kind='first-party-biographical-account',
 limitation='Présentation par sa succession ; seules son activité et sa place dans la culture du haschich sont reprises, pas les méthodes de fabrication.')
EME=s('emerald-cup-2021','All the winners of The Emerald Cup 2021','The Emerald Cup / communiqué original',
 'https://leafly-cms-production.imgix.net/wp-content/uploads/2021/04/12102915/Press-Release_-All-the-winners-of-The-Emerald-Cup-2021_.pdf',
 'p.1 introduction ; p.9 About the Emerald Cup',
 'Le communiqué décrit un concours et une célébration des récoltes de cannabis cultivées au soleil, dans la tradition des producteurs californiens.',
 '2021-04-12',access='full-text',kind='organizer-press-release',
 limitation='Communiqué original hébergé en copie par Leafly ; site organisateur directement tenté mais bloqué403. Les superlatifs publicitaires et l’idée que toutes les catégories seraient exclusivement outdoor sont exclus.')
SPA=s('spannabis','Spannabis Bilbao 2027 — XXIV Feria del Cáñamo','Feria del Cáñamo S.L.',
 'https://spannabis.es/','Sobre Spannabis ; Qué encontrarás',
 'Spannabis est un salon du secteur cannabique associant expositions de produits, conférences et culture du cannabis.',
 kind='organizer-event-description',limitation='Page d’annonce de l’organisateur effectivement ouverte après redirection de spannabis.com ; le fait porte sur la nature du salon, sans garantir dates, taille ou classement.')
BOG=s('bogart-merriam','Bogart — Definition and meaning','Merriam-Webster',
 'https://www.merriam-webster.com/dictionary/bogart','Verb sense2 ; Did you know?',
 'Bogart signifie consommer sans partager ; le dictionnaire rappelle l’emploi historique dans l’expression Don’t bogart that joint.',kind='dictionary-entry',
 limitation='Sens dans l’argot des usages ; étymologie présentée comme probable et non testée. Aucune parole de chanson reproduite.')
CUR=s('baek-curing','Postharvest Drying and Curing Affect Cannabinoid Contents and Microbial Levels in Industrial Hemp','Cornell University / Plants',
 'https://www.mdpi.com/2223-7747/14/3/414','Introduction, paragraphe Curing is another important subsequent postharvest process',
 'L’affinage ou curing est une maturation postérieure au séchage des inflorescences, associée à l’évolution de leurs caractères aromatiques.',
 '2025-01-31','Yousoon Baek, Heather Grab et Chang Chen',access='full-text',kind='original-research',
 limitation='Définition descriptive du produit floral uniquement ; aucun contenant, réglage, durée, rendement, protocole ni promesse d’augmentation du THC repris.')
HHC=s('bfr-hhc-mixture','Hexahydrocannabinol (HHC) in foodstuffs: Indications of psychoactive effects — Opinion044/2023','BfR',
 'https://www.bfr.bund.de/cm/349/hexahydrocannabinol-hhc-in-foodstuffs-indications-of-psychoactive-effects.pdf',
 'p.4 Figure1 et §3.2 Agent, paragraphe mixture of the epimers',
 'Le HHC de production semi-synthétique est typiquement un mélange de9R-HHC et9S-HHC, dont les proportions peuvent varier.',
 '2023-10-05',access='full-text',kind='institutional-risk-assessment',
 limitation='Passage de composition uniquement ; statut juridique ancien, étapes chimiques, doses et pharmacologie comparative non repris. Distinct de la simple définition d’épimères déjà couverte.')
BLU=s('peters-blunt-wrapper','Does marijuana blunt smoking contribute to nicotine exposure? Preliminary product testing of nicotine content in wrappers of cigars commonly used for blunt smoking','Johns Hopkins University / Drug and Alcohol Dependence',
 'https://pure.johnshopkins.edu/en/publications/does-marijuana-blunt-smoking-contribute-to-nicotine-exposure-prel/',
 'Abstract : Introduction ; Results ; Discussion',
 'Les enveloppes des cinq cigares/cigarillos testés contenaient de la nicotine : retirer le tabac intérieur ne retire pas la nicotine présente dans l’enveloppe.',
 '2016-11-01','Erica N. Peters, Gillian L. Schauer, Zachary R. Rosenberry et Wallace B. Pickworth',access='abstract',kind='original-research',
 limitation='Résumé original complet lu sur portail universitaire ; pas texte intégral de l’éditeur bloqué. La nicotine du matériau est mesurée, la quantité effectivement inhalée n’est pas établie.')
DOG=s('cornell-edible-co-toxins','Cannabis (THC) intoxication in dogs','Cornell University College of Veterinary Medicine',
 'https://www.vet.cornell.edu/departments-centers-and-institutes/riney-canine-health-center/canine-health-information/Cannabis-THC-intoxication-in-dogs',
 'Introduction ; Diagnosis, paragraphe packaging',
 'Les comestibles au cannabis peuvent cumuler la toxicité du THC avec celle du chocolat ou du xylitol pour les chiens ; l’emballage aide à identifier ces ingrédients.',
 'Mise à jour2025-12-22',kind='institutional-health-information',
 limitation='Nouveau fait sur les co-ingrédients toxiques, distinct de l’ataxie/incontinence et de la fiabilité des tests urinaires traités en rp03. Aucun traitement ni dosage vétérinaire proposé.')
GG=s('gg4-trademark','Gorilla Glue vs. Gorilla Glue','Cannabis Business Times',
 'https://www.cannabisbusinesstimes.com/home/article/15703851/gorilla-glue-vs-gorilla-glue',
 'Paragraphes88–99 : entretiens Catherine Franklin et Ross Johnson, changement de noms',
 'Dans l’entretien de2017, GG Strains explique le remplacement de Gorilla Glue#4 par GG4 ou Original Glue après un accord dans le litige de marque avec la société d’adhésifs.',
 '2017-11-01','Melissa Schiller',access='full-text',kind='original-interview',
 limitation='Reportage avec entretiens directs des dirigeants ; le récit commercial est attribué. Aucune ascendance, teneur, authenticité ou promesse de cultivar n’en est déduite.')
WEE=s('weed-the-people','Weed the People — Filmmakers','BOBB Films / équipe du film',
 'https://www.weedthepeoplemovie.com/filmmakers','Présentation du film au-dessus de The Filmmakers',
 'Le documentaire suit des familles d’enfants atteints de cancers qui se tournent vers des huiles de cannabis.',kind='film-official-synopsis',
 limitation='Synopsis original sur le sujet du film seulement ; ses affirmations militantes de guérison ne sont pas adoptées comme preuves médicales.')
MUR=s('murder-mountain','Murder Mountain','Netflix',
 'https://www.netflix.com/ms/title/80217475','Synopsis ; Episodes1–2',
 'La série documentaire2018 se situe dans le comté californien de Humboldt, autour de l’industrie cannabique et de disparitions.',kind='film-official-synopsis',
 limitation='Identification du cadre de la série, pas preuve d’un taux de criminalité ni portrait universel des producteurs de Humboldt.')
COOK=s('cooked-with-cannabis','Cooked with Cannabis','Netflix',
 'https://www.netflix.com/pr/title/81032347','Synopsis et Genres',
 'L’émission2020 présente une compétition entre chefs autour de plats utilisant du cannabis, des infusionsTHC et des saucesCBD.',kind='film-official-synopsis',
 limitation='Identification d’un format télévisuel de culture cannabique uniquement ; aucune recette, dose ou préparation psychoactive reprise.')
WIT=s('budney-withdrawal','The time course and significance of cannabis withdrawal','Johns Hopkins University / Journal of Abnormal Psychology',
 'https://pure.johnshopkins.edu/en/publications/the-time-course-and-significance-of-cannabis-withdrawal-3/',
 'Abstract complet, onset et peak effects',
 'Le suivi d’adultes usagers importants décrit un début de sevrage dans les premiers jours et un maximum typique entre les jours2et6.',
 '2003-08','Alan J. Budney, Brent A. Moore, Ryan G. Vandrey et John R. Hughes',access='abstract',kind='original-research',
 limitation='Résumé original lu ; chronologie typique variable entre personnes, distincte de la liste irritabilité/anxiété/sommeil de E02. Aucun protocole de prise ou d’arrêt médical.')
REM=s('vandrey-rem','Sleep disturbance and the effects of extended-release zolpidem during cannabis withdrawal','Johns Hopkins University / Drug and Alcohol Dependence',
 'https://pubmed.ncbi.nlm.nih.gov/21296508/','Abstract, Methods et Results : placebo-abstinence',
 'Pendant l’abstinence sous placebo, les20 usagers quotidiens ont passé davantage de temps en sommeil paradoxal qu’en période de consommation, malgré une moindre durée totale de sommeil.',
 '2011-02-05 ; numéro2011-08-01','Ryan Vandrey, Michael T. Smith, Una D. McCann, Alan J. Budney et Erin M. Curran',access='abstract',kind='original-research',
 limitation='Résultat polysomnographique d’un petit essai, sans généralisation à tous les usages ni recommandation de somnifère. Le bras médicamenteux n’est pas testé.')
PG=s('lpv-cbd-base','Comment choisir son e-liquide CBD ?','Le Petit Vapoteur',
 'https://www.lepetitvapoteur.com/fr/content/55-guide-eliquide-cbd','Paragraphe La base est composée de propylène glycol',
 'Le guide commercial décrit une base d’e-liquide CBD associant propylène glycol et glycérine végétale.',kind='retailer-product-guide',
 limitation='Composition attribuée à ce guide, non norme universelle de tous les produits CBD. Ses promesses, statut légal général, proportions et doses sont exclus.')
PUR=s('bassolino-purple-flowers','When Cannabis sativa L. Turns Purple: Biosynthesis and Accumulation of Anthocyanins','CREA / University of Bologna / Antioxidants',
 'https://www.mdpi.com/2076-3921/12/7/1393','§3.2 et Table3 : inflorescences S1750/S1759',
 'La cyanidine-3-rutinoside, appelée kéracyanine, est le pigment anthocyanique majoritaire dans les inflorescences violettes analysées, notamment S1750 etS1759.',
 '2023-07-06','Laura Bassolino, Flavia Fulvio et collaborateurs',access='full-text',kind='original-research',
 limitation='Preuve portant effectivement sur les fleurs analysées, pas transposition de résultats foliaires ; aucun lien de puissance THC ou caractère universel des fleurs violettes.')
CBN=s('zamengo-aging','The role of time and storage conditions on the composition of hashish and marijuana samples: A four-year study','AULSS3 Serenissima / University of Padua / Forensic Science International',
 'https://static1.squarespace.com/static/59cd905351a5846569cfbbca/t/5e9f49ab8e5c8b0d1594b7b0/1587497389678/zamengo2019.pdf',
 'p.1 Abstract ; §3.1 : dégradation THC et formation CBN',
 'Le suivi d’herbe et de résine montre la diminution du THC et la formation de CBN au cours du vieillissement des produits.',
 '2019-03-08','Luca Zamengo, Chiara Bettin, Denis Badocco, Valerio Di Marco, Giorgia Miolo et Giampietro Frison',access='full-text',kind='original-research',
 limitation='PDF original sur miroir, éditeur identifié ; pas de recette d’affinage, conservation optimisée ou âge déduit d’un simple tauxCBN.')
STA=s('kosovic-cbd-matrix','Stability Study of Cannabidiol in the Form of Solid Powder and Sunflower Oil Solution','Czech Academy of Sciences / UCT Prague / Pharmaceutics',
 'https://www.mdpi.com/1999-4923/13/3/412','§5 Conclusions',
 'Dans les conditions étudiées, le CBD solide s’est mieux maintenu que le CBD dissous dans l’huile de tournesol, beaucoup plus sensible aux conditions environnementales.',
 '2021-03-19','Ema Kosović, David Sýkora et Martin Kuchař',access='full-text',kind='original-research',
 limitation='Comparaison de deux formes précises ; pas durée de conservation universelle ni extension à toutes les huiles. Aucun paramètre de formulation ou d’optimisation repris.')
D8=s('kaczor-delta8-delta9','Commercial Delta-8 THC Products: an Analysis of Content and Labeling','American College of Medical Toxicology / Journal of Medical Toxicology',
 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10774316/','Results : Δ-9 THC and Other Cannabinoid Content Analysis ; Table2',
 'Du delta-9-THC a été détecté dans sept des vingt produits achetés à Pittsburgh et vendus comme produits delta-8.',
 '2023-11-02','Eric E. Kaczor, Kevin Greene, Kavita M. Babu, Erin C. Berthold, Abhisheak Sharma et Stephanie P. Carreiro',access='full-text',kind='original-research',
 limitation='Échantillon de commodité situé, pas fréquence mondiale ni preuve de composition de tout produit delta-8. Statut légal ancien et doses non repris.')
EQU=s('hc-dried-equivalence','Online calculator: Limits for public possession of cannabis','Santé Canada',
 'https://www.canada.ca/en/health-canada/services/drugs-medication/cannabis/online-calculator-limits-public-possession.html',
 'Introduction et paragraphe You can use this tool',
 'Les équivalences en cannabis séché servent à compter ensemble diverses catégories de produits dans la limite de possession publique non médicale.',
 '2026-10-22',kind='institutional-legal-information',limitation='Finalité de la conversion légale seulement ; aucune dose, recette, équivalence d’intensité ni limite de patient médical déduite.')
LPP=s('last-prisoner-project','Mission and Vision','Last Prisoner Project',
 'https://www.lastprisonerproject.org/mission-and-vision','Vision ; Mission ; Values',
 'L’organisation, fondée en2019, se consacre à la justice pénale liée au cannabis, à la libération et à la reconstruction de la vie des personnes affectées par sa criminalisation.',kind='organization-mission-statement',
 limitation='Mission déclarée de l’organisation, sans chiffre de personnes détenues, résultat juridique garanti ni appel à agir.')

def q(key,level,prompt,opts,explanation,sid,subject,sk,prop,objective,topic='prevention',category='quality',article='ref-resines-extraits',jurisdiction=None,form='identification'):
    ans=len(questions)%4
    options=list(opts);correct=options.pop(0);options.insert(ans,correct)
    src=next(x for x in sources if x['id']==sid)
    ed=dict(domain='active',category=category,subject=subject,subjectKey=sk,property=prop,expectedAnswer=correct,
      learningObjective=objective,factKey=key,form=form,
      difficultyRationale={1:'Repère concret de produit, d’objet ou de culture des usages, sans mécanisme spécialisé.',2:'Connaissance précise d’un terme d’usage, d’une composition ou d’une règle applicable aux produits.',3:'Lecture d’un résultat analytique ou clinique circonscrit et comparaison de formes chimiques.',4:'Identification spécialisée d’un pigment floral par son nom moléculaire.'}[level],
      sourceEvidence=[dict(sourceId=sid,locator=src['consultation']['locator'],support=src['passage'])])
    if jurisdiction:ed.update(jurisdiction=jurisdiction,reviewAfter='2027-05-17')
    questions.append(dict(id='hemp-q2-rp04-'+key,topicId=topic,level=level,prompt=prompt,options=options,answer=ans,
      explanation=explanation,articleId=article,sourceIds=[sid],editorial=ed))

q('canada-edible-shelf-stable',1,'Avant ouverture, quelle conservation les comestibles au cannabis autorisés au Canada doivent-ils supporter ?',['Sans réfrigération nécessaire à leur sécurité','Au réfrigérateur pour prévenir toute contamination','Au congélateur jusqu’au moment de la vente','Dans une chaîne du froid comparable au lait frais'],
 'Le règlement exige des produits stables avant ouverture. Cela ne dispense ni du respect des indications de conservation, ni des règles d’hygiène une fois l’emballage ouvert.',COM,'Conservation des comestibles canadiens','canada-cannabis-edible-stability','Stabilité avant ouverture','Reconnaître une différence entre comestible commercial autorisé et aliment périssable.',jurisdiction='Canada, guide octobre2026')
q('canada-supplemented-food-ingredients',2,'Quelle catégorie est exclue comme ingrédient d’un comestible au cannabis par le guide canadien de2026 ?',['Les aliments supplémentés, comme certaines boissons vitaminées','Les aliments contenant naturellement des vitamines','Les farines enrichies conformément au droit alimentaire','Les aliments contenant des additifs alimentaires autorisés'],
 'Les aliments supplémentés sont exclus. Le guide distingue ce cas des vitamines naturellement présentes, de certains additifs autorisés et d’aliments légalement enrichis, tels que certaines farines.',COM,'Ingrédients des comestibles canadiens','canada-cannabis-supplemented-food','Aliments supplémentés exclus','Distinguer une catégorie réglementaire des vitamines présentes dans un aliment.',jurisdiction='Canada, guide octobre2026')
q('canada-label-total-only-required',2,'Depuis la réforme canadienne de2025, quelles valeurs THC/CBD restent obligatoires sur l’étiquette d’un produit ?',['Le THC total et le CBD total','Le THC et le CBD déjà neutres uniquement','Le THCA et le CBDA uniquement','Le CBD total et les terpènes totaux uniquement'],
 'Les valeurs totales restent exigées. Les valeurs séparées des formes neutres ou acides deviennent facultatives ; des produits portant l’ancien double affichage peuvent encore être écoulés.',GAZ,'Étiquetage cannabinoïde canadien','canada-cannabinoid-label-total','Totaux requis après réforme','Comprendre pourquoi une étiquette récente peut comporter moins de valeurs THC/CBD.',jurisdiction='Canada, réforme2025 consultée novembre2026')
q('rolling-paper-contaminants',1,'Quel couple de contaminants Santé Canada cite-t-il pour le papier d’un joint, indépendamment des fleurs ?',['Des métaux lourds et des pesticides','Des mycotoxines et des alcaloïdes de l’ergot','De la nicotine et des nitrosamines du tabac','Des résidus de butane et de propane'],
 'Santé Canada mentionne notamment le plomb et des pesticides possibles dans les papiers à rouler. Le support de combustion constitue donc une source d’exposition distincte de la composition des fleurs.',PAP,'Papier à rouler du cannabis','cannabis-rolling-paper','Contaminants possibles du support','Identifier le papier comme composant du produit fumé.',category='prevention',article='ref-contaminants',jurisdiction='Canada, conseil sanitaire2024')
q('sugar-leaves-small-resinous',1,'Dans la description d’une tête de cannabis, quelles feuilles sont appelées « sugar leaves » ?',['Les petites feuilles résineuses insérées dans les têtes','Les grandes feuilles en éventail éloignées des têtes','Les premières feuilles arrondies de la plantule','Les feuilles jaunies déjà tombées au sol'],
 'Ces petites feuilles portent des trichomes donnant un aspect givré. Elles se distinguent des grandes fan leaves ; le nom ne signifie pas qu’un sucre a été ajouté au produit.',UNR,'Petites feuilles des têtes florales','cannabis-sugar-leaves','Feuilles florales résineuses','Reconnaître un élément concret des fleurs commercialisées.',topic='plant',category='botany',article='ref-fleurs-fruits-graines')
q('chillum-without-water',1,'Quelle différence distingue le chillum traditionnel du hukkah dans la notice des Sanskriti Museums ?',['Il ne comporte pas de réservoir d’eau','Il ne comporte pas de foyer','Il ne comporte pas de passage pour la fumée','Il ne comporte pas d’embout'],
 'Le chillum est une pipe à main avec foyer et embout, sans réservoir d’eau. La notice le décrit parmi les objets utilisés traditionnellement pour fumer du cannabis ou du haschich.',CHI,'Pipe chillum','cannabis-chillum','Absence de réservoir d’eau','Distinguer deux familles d’objets de consommation.',category='history',article='ref-histoire-culture')
q('volcano-classic-detachable-balloon',1,'Quel élément recueille l’aérosol sur le vaporisateur de table VOLCANO CLASSIC décrit par son fabricant ?',['Un ballon détachable','Un réservoir d’eau intégré','Un tube plongeant dans une huile','Une cartouche de liquide jetable'],
 'Le système EASY VALVE utilise un ballon détachable. C’est une caractéristique du modèle, qui le distingue des dispositifs à cartouche et ne constitue pas une garantie d’innocuité.',VOL,'Vaporisateur VOLCANO CLASSIC','volcano-classic','Ballon détachable','Reconnaître un modèle courant de vaporisateur de fleurs.')
q('dynavap-no-integrated-battery',1,'Comment DynaVap décrit-il l’alimentation en chaleur de ses vaporisateurs sans batterie ?',['Par une source de chaleur externe','Par une batterie rechargeable intégrée','Par une pile jetable dans l’embout','Par une résistance alimentée en USB uniquement'],
 'Ces dispositifs sont présentés comme dépourvus de batterie et d’électronique intégrées. Ils reçoivent une chaleur externe ; cette description ne donne ni réglage ni consigne de chauffe.',DYN,'Vaporisateurs DynaVap','dynavap-vaporizer','Chaleur externe sans batterie','Distinguer la conception d’un dispositif de celle d’un vaporisateur électrique.')
q('frenchy-cannoli-hash-artisan',1,'Dans la culture cannabique, à quelle activité Frenchy Cannoli est-il particulièrement associé ?',['L’artisanat et la transmission du haschich traditionnel','La création des premières cigarettes électroniques','La sélection exclusive de graines alimentaires','La formulation des premiers médicaments au CBD pur'],
 'Sa succession le présente comme un artisan et un enseignant du haschich traditionnel installé en Californie. Sa notoriété tient à cette culture des résines, au-delà d’un simple nom de produit.',FRE,'Frenchy Cannoli','frenchy-cannoli','Artisan et transmetteur du haschich','Identifier une figure de la culture des concentrés.',topic='history',category='history',article='ref-histoire-culture')
q('emerald-cup-sungrown-tradition',2,'Quelle tradition de cannabis l’Emerald Cup met-elle particulièrement à l’honneur dans son communiqué de2021 ?',['Les récoltes de plein air cultivées au soleil','Les fleurs produites sous lampes en intérieur','Les variétés cultivées pour leurs fibres longues','Les cultures destinées à l’huile alimentaire de graines'],
 'L’événement revendique la tradition des récoltes sun-grown et des producteurs de plein air. Il comporte aussi des catégories d’extraits et de produits transformés : toute la compétition ne se réduit pas aux fleurs.',EME,'Concours Emerald Cup','emerald-cup','Tradition des récoltes au soleil','Situer un concours dans la culture des produits californiens.',topic='history',category='history',article='ref-histoire-culture')
q('spannabis-fair-nature',1,'Qu’est-ce que Spannabis dans le secteur du cannabis ?',['Un salon réunissant exposants, produits et conférences','Un réseau de pharmacies publiques distribuant du THC','Une certification européenne de composition des fleurs','Une banque publique de génomes de cannabis'],
 'L’organisateur décrit un salon cannabique avec expositions, conférences et culture des usages. La présence d’un produit à un salon n’est pas une certification de sa composition ou de son statut légal.',SPA,'Salon Spannabis','spannabis','Salon cannabique','Reconnaître un événement professionnel et culturel.',topic='history',category='history',article='ref-histoire-culture')
q('bogart-joint-monopolize',2,'Dans l’argot anglophone, que reproche-t-on à quelqu’un qui « bogart » un joint partagé ?',['De l’accaparer sans le faire passer','De l’éteindre avant la première bouffée','De mélanger deux variétés dans le joint','De remplacer le papier par une feuille de cigare'],
 'Merriam-Webster définit ce verbe comme consommer sans partager et rappelle son usage autour du joint. Le sens s’est ensuite étendu au fait d’accaparer d’autres choses.',BOG,'Argot du partage de joint','bogart-joint','Accaparement du joint','Comprendre un terme culturel sans confondre partage et technique de préparation.',topic='history',category='history',article='ref-histoire-culture')
q('curing-postdrying-maturation',1,'Pour des fleurs de cannabis, à quelle étape descriptive correspond le « curing » ou affinage ?',['Une maturation du produit après le séchage','Le séchage initial des fleurs encore fraîches','La séparation des petites feuilles des têtes florales','Le tri des fleurs séchées selon leur calibre'],
 'L’affinage désigne une maturation postérieure au séchage, durant laquelle les caractères du produit peuvent évoluer. Ce terme ne désigne ni une extraction ni une garantie d’augmentation du THC.',CUR,'Affinage des fleurs','cannabis-flower-curing','Maturation après séchage','Distinguer une étape descriptive du produit fini d’une extraction.')
q('commercial-hhc-epimer-mixture',3,'Quelle composition le BfR décrit-il comme typique du HHC semi-synthétique commercial ?',['Un mélange de9R-HHC et de9S-HHC à proportions variables','Du9R-HHC seul, le9S étant absent de ces produits','Du9S-HHC seul, le9R étant absent de ces produits','Un mélange toujours égal de HHC et de delta-9-THC'],
 'L’appellation HHC peut recouvrir un mélange des deux épimères, sans proportion universelle. Connaître le nom du cannabinoïde ne suffit donc pas à connaître la composition exacte du produit.',HHC,'Composition du HHC commercial','commercial-hhc-epimer-mixture','Mélange variable9R/9S','Appliquer la distinction d’épimères à des produits réels.',topic='evidence',category='constituents',article='ref-cannabinoides-transformes')
q('cooked-with-cannabis-competition',1,'Quel format propose l’émission « Cooked with Cannabis » de2020 ?',['Une compétition entre chefs autour de plats au cannabis','Un concours de sélection de nouvelles variétés de cannabis','Une compétition d’analyse des teneurs des produits auCBD','Un concours d’objets en verre pour consommer du cannabis'],
 'Netflix présente un concours culinaire avec des plats contenant du cannabis, du THC ou duCBD. Le fait porte sur un repère télévisuel de la culture des comestibles, sans reprendre ses préparations.',COOK,'Émission Cooked with Cannabis','cooked-with-cannabis-series','Concours culinaire cannabique','Identifier un format médiatique consacré aux comestibles à actifs.',topic='history',category='history',article='ref-histoire-culture')
q('dog-edible-chocolate-xylitol',1,'Outre le THC, quel couple d’ingrédients d’un comestible au cannabis peut ajouter une toxicité pour un chien ?',['Le chocolat et le xylitol','Le miel et le sorbitol','La vanille et le glucose','L’amidon et le fructose'],
 'Cornell souligne le risque cumulé de certains comestibles : cannabis et ingrédients toxiques pour les chiens. Identifier le produit et son emballage aide le vétérinaire à évaluer l’exposition.',DOG,'Co-ingrédients des comestibles et chiens','cannabis-edible-dog-co-toxins','Chocolat et xylitol comme co-toxiques','Comprendre pourquoi l’identité complète du comestible importe.',category='prevention',article='ref-thc',jurisdiction='États-Unis, information vétérinaire mise à jour2025')
q('gg4-trademark-renaming',2,'Pourquoi GG Strains a-t-il remplacé le nom « Gorilla Glue#4 » par « GG4 » ou « Original Glue » en2017 ?',['À la suite d’un litige de marque avec une société d’adhésifs','Après l’identification d’une nouvelle espèce botanique','Pour annoncer le remplacement du THC par du CBD','Après une modification imposée du pedigree génétique'],
 'Dans l’entretien publié en2017, les dirigeants expliquent le changement de nom après un accord avec Gorilla Glue. Un changement commercial de nom n’implique pas à lui seul un nouveau génotype.',GG,'Renommage de Gorilla Glue#4','gg4-trademark-renaming','Litige de marque','Distinguer histoire d’un nom commercial et changement de variété.',topic='history',category='history',article='ref-noms-lignees')
q('weed-the-people-families',1,'Quelles personnes le documentaire « Weed the People » suit-il autour des huiles de cannabis ?',['Des familles d’enfants atteints de cancers','Des jurés d’une compétition de haschich','Des collectionneurs de pipes anciennes','Des policiers enquêtant sur un dispensaire clandestin'],
 'Le film suit ces familles et leurs recherches d’accès aux huiles de cannabis. Son récit militant est un objet culturel ; les trajectoires racontées ne démontrent pas une efficacité anticancéreuse.',WEE,'Documentaire Weed the People','weed-the-people-film','Familles et cannabis médical','Identifier le sujet d’un documentaire en distinguant récit et preuve clinique.',topic='history',category='history',article='ref-histoire-culture')
q('murder-mountain-humboldt',2,'Dans quelle région cannabique se déroule la série documentaire « Murder Mountain » de2018 ?',['Le comté de Humboldt, en Californie','Le Rif, au Maroc','La vallée de la Bekaa, au Liban','La vallée de Parvati, en Inde'],
 'La série situe son récit dans le comté de Humboldt, autour de l’industrie du cannabis et de disparitions. Ce cadre narratif ne permet pas de généraliser ses événements à tous les producteurs de la région.',MUR,'Série Murder Mountain','murder-mountain-series','Cadre de Humboldt','Situer une œuvre dans une région de culture cannabique.',topic='history',category='history',article='ref-histoire-culture')
q('withdrawal-early-days-peak',2,'Dans le suivi de Budney (2003), quand le sevrage après un usage important de cannabis atteignait-il typiquement son maximum ?',['Entre le deuxième et le sixième jour après l’arrêt','Dans les deux premières heures après l’arrêt','Entre la quatrième et la sixième semaine après l’arrêt','Entre le deuxième et le troisième mois après l’arrêt'],
 'Le début se situait généralement dans les premiers jours, avec un maximum entre les jours2et6. Les délais varient : une absence de gêne immédiate ne signifie pas que l’arrêt sera sans symptômes.',WIT,'Chronologie du sevrage du cannabis','cannabis-withdrawal-time-course','Maximum typique dans les premiers jours','Distinguer disparition de l’ivresse et évolution du sevrage.',category='prevention',article='ref-thc',jurisdiction='États-Unis, étude d’adultes2003')
q('withdrawal-rem-rebound-trial',3,'Dans l’essai de Vandrey (2011), comment évoluaient sommeil paradoxal et sommeil total pendant l’abstinence sous placebo ?',['Plus de sommeil paradoxal, mais moins de sommeil total','Moins de sommeil paradoxal, mais plus de sommeil total','Moins de sommeil paradoxal et moins de sommeil total','Plus de sommeil paradoxal et plus de sommeil total'],
 'Chez ces20 usagers quotidiens, le temps paradoxal augmentait tandis que le sommeil total et sa qualité diminuaient. Le rebond d’une phase ne signifie donc pas que l’ensemble du sommeil s’améliore.',REM,'Sommeil paradoxal et abstinence','cannabis-withdrawal-rem','Augmentation REM dans un essai d’abstinence','Distinguer architecture du sommeil et impression globale de mieux dormir.',category='prevention',article='ref-thc',jurisdiction='États-Unis, petit essai2011')
q('cbd-liquid-pg-vg-base',2,'Quelle base Le Petit Vapoteur décrit-il dans son guide des e-liquides CBD ?',['Propylène glycol et glycérine végétale','Huile d’olive et huile de graines de chanvre','Éthanol et huile de coco','Eau et huile de tournesol'],
 'Le guide décrit une base PG/VG portant le CBD et les arômes. Cette présentation commerciale d’un liquide à vapoter diffère de celle d’une huile orale et ne vaut pas pour toutes les formulations.',PG,'Base des e-liquides CBD','cbd-vape-liquid-base','BasePG/VG décrite par un vendeur','Distinguer la composition d’un liquide à vapoter de celle d’une huile orale.',category='constituents',article='ref-cbd')
q('purple-flower-keracyanin',4,'Quel pigment domine les anthocyanes des inflorescences violettes S1750/S1759 analysées par Bassolino (2023) ?',['La cyanidine-3-rutinoside, ou kéracyanine','La cyanidine-3-glucoside','La péonidine-3-glucoside','La péonidine-3-rutinoside'],
 'La kéracyanine est majoritaire dans ces inflorescences analysées. Il s’agit d’une caractérisation de leur pigmentation, sans déduction de teneur en THC ou de puissance à partir de la couleur.',PUR,'Pigment mesuré dans des inflorescences violettes','purple-cannabis-flower-keracyanin','Kéracyanine majoritaire dans les fleurs étudiées','Connaître un pigment floral identifié sans confondre couleur et cannabinoïdes.',topic='plant',category='constituents',article='ref-fleurs-fruits-graines')
q('last-prisoner-project-mission',2,'Quelle organisation fondée en2019 se consacre à libérer et accompagner les personnes incarcérées pour des faits liés au cannabis ?',['Last Prisoner Project','Marijuana Policy Project','NORML','Drug Policy Alliance'],
 'Last Prisoner Project place la justice pénale et les personnes touchées par la criminalisation au centre de sa mission. Son action inclut la libération et la reconstruction des parcours après l’incarcération.',LPP,'Organisation Last Prisoner Project','last-prisoner-project','Mission de justice pénale cannabique','Reconnaître un acteur contemporain de la culture et de la réforme du cannabis.',topic='history',category='history',article='ref-histoire-politiques')
q('cbd-powder-oil-stability-comparison',3,'Dans l’étude de Kosović (2021), quelle comparaison de stabilité du CBD solide et dissous dans l’huile de tournesol est observée ?',['Une dégradation plus marquée dans la solution huileuse','Une dégradation plus marquée dans la poudre solide','Une dégradation comparable dans les deux formes étudiées','Une absence de dégradation détectable dans les deux formes'],
 'Dans ces essais, le CBD solide était plus stable que la solution huileuse étudiée. La forme et le véhicule comptent : cette comparaison ne fixe pas une durée de conservation de toutes les huilesCBD.',STA,'Stabilité du CBD selon la forme','cbd-powder-oil-stability','Solution huileuse plus sensible dans les essais','Reconnaître une influence documentée de la formulation sur la stabilité.',topic='evidence',category='quality',article='ref-cbd')
q('delta8-products-also-delta9',3,'Quel autre cannabinoïde l’équipe de Kaczor a-t-elle détecté dans sept produits commercialisés comme delta-8-THC ?',['Le delta-9-THC','Le delta-10-THC','Le THCP','Le HHC'],
 'L’analyse a retrouvé du delta-9-THC dans sept des vingt produits achetés à Pittsburgh. Le résultat concerne cet échantillon : il ne donne pas la composition de tous les produits vendus sous le nom delta-8.',D8,'Composition de produits delta-8 du commerce','commercial-delta8-delta9-mixture','Présence concomitante de delta9 dans un échantillon','Distinguer l’actif mis en avant et l’ensemble des cannabinoïdes effectivement présents.',topic='evidence',category='quality')
q('canada-dried-equivalence-purpose',2,'À quoi sert l’équivalence en grammes de cannabis séché utilisée pour différents produits au Canada ?',['À comptabiliser la possession publique légale','À prédire une même intensité d’ivresse','À garantir une même quantité de THC absorbée','À fixer une durée identique des effets'],
 'Il s’agit d’une conversion réglementaire pour additionner des catégories de produits dans une limite de possession. Ce n’est pas une équivalence pharmacologique entre une boisson, une fleur et un extrait.',EQU,'Équivalences réglementaires de produits','canada-dried-cannabis-equivalence','Calcul de possession et non d’effet','Lire une équivalence légale sans en faire une équivalence d’intoxication.',jurisdiction='Canada, information octobre2026')

if __name__=='__main__':
    assert len(questions)==27
    sources[:]=[s for s in sources if any(s['id'] in q['sourceIds'] for q in questions)]
    article_ids={a['id'] for a in json.loads((ROOT.parent/'encyclopedia-revision/baseline-catalog.json').read_text(encoding='utf-8'))['articles']}
    for x in questions:
        assert len(x['id'])<=75,x['id']
        assert len(x['prompt'])<=150,(x['id'],'prompt',len(x['prompt']))
        assert len(x['explanation'])<=240,(x['id'],'explanation',len(x['explanation']))
        assert len(set(x['options']))==4
        assert all(len(o)<=75 for o in x['options']),(x['id'],'options',[(len(o),o) for o in x['options']])
        assert x['articleId'] in article_ids,x['articleId']
        assert x['options'][x['answer']]==x['editorial']['expectedAnswer']
    batch=dict(batchId='r-products-04',author=AUTHOR,role='Produits, objets, culture des usages et propriétés de fleurs résineuses',questions=questions,sources=sources)
    (ROOT/'batches/r-products-04.json').write_text(json.dumps(batch,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    facts=dict(batchId='r-products-04',author=AUTHOR,createdAt=DAY,status='author-frozen-awaiting-independent-review',domain='active',count=len(questions),
      levels=dict(Counter(str(x['level']) for x in questions)),
      sourcesRead=[dict(sourceId=x['id'],url=x['url'],access=x['access'],locator=x['consultation']['locator']) for x in sources],
      neighbourAudit=dict(index='docs/quiz-2000/fact-index.jsonl',
        excludedCandidates=['THC versCBN au vieillissement : même apprentissage que hemp-evidence-cbn-oxydation, objet complet relu après alerteA.','Nicotine dans l’enveloppe de blunt : déjà explicite dans l’explication et la preuve de rp02, écartée après lecture de l’objet complet.','Stigmates comme filaments : déjà deux branches stigmatiques dans la banque.','Fleurs mâles non nulles en cannabinoïdes : trop proche de la comparaison glandulaire femelle/mâle rb03.','DisponibilitéCB1 et récupération : déjà ra02 et son explication.','CannabisCup : réservé à rb06.','Cola simple synonyme de regroupement floral : apport trop proche de l’inflorescence.'],
        openedNeighbours=['hemp-evidence-cbn-oxydation','hemp-evidence-hhc-epimeres','hemp-q2-en02-withdrawal-sleep-irritability','hemp-q2-rb03-fleurs-femelles-richesse-glandulaire','hemp-q2-rp03-dog-thc-ataxia-incontinence','hemp-q2-rp02-traditional-blunt-tobacco-wrapper','hemp-q2-ra01-cbn-insomnia-primary-wake-result-2026'],
        distinctions=['Sugar leaves : petites feuilles résineuses de la tête, pas réception du pollen ou types de glandes.','Papier : contaminant du support, pas analyse des fleurs.','Chien : co-ingrédients toxiques distincts des symptômes et des tests urinaires.','Sevrage : chronologie et architectureREM, pas simple liste de symptômes.','HHC : composition commerciale variable9R/9S, pas définition des épimères ni comparaison de pharmacologie.','Pigment : mesure réellement florale et molécule identifiée, pas rappel général sur les feuilles violettes.']),
      facts=[dict(id=x['id'],factKey=x['editorial']['factKey'],subjectKey=x['editorial']['subjectKey'],expectedAnswer=x['editorial']['expectedAnswer']) for x in questions])
    (ROOT/'facts/r-products-04.json').write_text(json.dumps(facts,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(dict(questions=len(questions),sources=len(sources),levels=facts['levels'])))
