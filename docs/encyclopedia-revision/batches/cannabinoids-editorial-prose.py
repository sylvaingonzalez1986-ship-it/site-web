import pathlib,json
r=pathlib.Path('C:/lesiteinternetquitue/docs/encyclopedia-revision/batches')
bs={p:json.loads(p.read_text(encoding='utf-8')) for p in sorted(r.glob('cannabinoids-*.json'))}
aa={a['id']:a for b in bs.values() for a in b['articles']}
def mol(key,sid,text):next(s for s in aa['record-cannabinoid-'+key]['patch']['sections'] if s['id']==sid)['paragraphs']=[text]
occ={
'delta9-thc':'Le THC est mesuré dans des préparations de cannabis et peut provenir de la décarboxylation du THCA. La teneur mesurée après cette transformation diffère de la quantité de THC initialement présente dans la plante.',
'delta9-thca-a':'Le THCA est identifié dans le matériel végétal et relié au CBGA par une enzyme caractérisée. Sa proportion dépend de l’échantillon et de sa conservation.',
'cbd':'Le CBD est identifié dans le cannabis et ses préparations ; une partie peut résulter de la décarboxylation du CBDA. La quantité de CBD neutre déjà présente diffère donc de la quantité potentiellement issue des acides.',
'cbda':'Le CBDA et l’enzyme végétale qui le forme sont documentés notamment dans du cannabis de type fibre. La catégorie « chanvre » ne permet toutefois pas de connaître la teneur d’un échantillon.',
'cbg':'Les analyses distinguent CBG et CBGA dans les échantillons de cannabis. Leur détection et leurs quantités dépendent de la matrice et des transformations survenues avant la mesure.',
'cbc':'Le CBC est identifié parmi les formes neutres des préparations analysées. Une mesure après décarboxylation peut aussi inclure du CBC formé à partir de l’acide, plutôt que seulement celui qui préexistait.',
'cbca':'Le CBCA est documenté dans le matériel végétal et les études enzymatiques. Caractériser l’enzyme qui le forme ne quantifie pas sa présence dans un produit commercial.',
'cbn':'Des transformations oxydatives du THC peuvent former du CBN dans le cannabis conservé. La composition dépend de l’histoire du matériau, et toutes les pertes de THC ne deviennent pas nécessairement du CBN.',
'cbna':'L’étude de 1970 rapporte l’isolement de CBNA dans du cannabis conservé et sa formation à partir de THCA. Cette observation ne démontre pas une voie biosynthétique dédiée dans la plante vivante.',
'thcv':'Le THCV est identifié dans les préparations végétales analysées. Cette détection ne permet pas de prédire la teneur d’une autre variété ou d’un produit commercial.',
'thcva':'Le THCVA est isolé et caractérisé avec les autres acides propyles dans le matériel thaïlandais Meao. Ce résultat porte sur un matériel défini, sans établir une présence universelle dans le cannabis.',
'cbdv':'Le CBDV est identifié parmi les formes neutres après préparation analytique des échantillons végétaux. Comme cette préparation peut transformer une partie des acides, la matrice et les traitements doivent accompagner l’interprétation du résultat.',
'cbdva':'Le CBDVA est isolé et caractérisé dans le cannabis Meao. Cette observation historique ne fournit pas un profil quantitatif de tous les cannabis.',
'cbcva':'L’isolement et la structure du CBCVA sont publiés avec les autres acides propyles du matériel Meao. L’étude d’isolement ne reproduit pas directement sa formation depuis le CBGVA par une CBCAS végétale purifiée.',
'cbgv':'Le CBGV est isolé du cannabis Meao dans la publication de 1975. Ce résultat ne fixe pas une teneur universelle et ne sépare pas entièrement les effets des traitements de l’échantillon.',
'cbcv':'Le CBCV est isolé et caractérisé avec le CBGV dans le matériel Meao. Cette présence documentée ne constitue pas une conclusion sur tous les cannabis.',
'thcp':'L’étude de 2019 isole et caractérise le THCP dans le cannabis médicinal FM2. Cette présence ne détermine ni son abondance habituelle ni l’origine d’un produit commercial vendu sous ce nom.',
'cbdp':'Le CBDP est identifié avec le THCP dans le matériel FM2 étudié. La présence dans cet échantillon ne garantit pas l’identité ou la provenance d’un produit commercial.',
'delta8-thc':'Certaines détections de Δ8-THC dans des préparations ou extraits peuvent résulter d’une isomérisation pendant le traitement. Des produits du marché sont obtenus par transformation ; une trace analytique ne suffit donc pas à établir une voie biosynthétique, et l’origine annoncée ne certifie pas la composition du lot.',
'thc-o-acetate':'L’expérience publiée inclut un produit commercial au Δ8-THC-O ainsi que des substances expérimentales. Elle ne présente pas ces acétates phénoliques comme des constituants naturels établis du cannabis.',
'hhc-o':'Le HHC-O est signalé parmi les substances émergentes du marché. Les sources de surveillance citées n’établissent pas une présence naturelle dans le cannabis.',
'hhcp':'L’EUDA rapporte la disponibilité du HHCP sur le marché européen et une production apparemment entièrement synthétique. La provenance d’un lot particulier nécessite toutefois une traçabilité propre.',
'h4-cbd':'L’UNODC signale le H4-CBD sur le marché, tandis que les travaux analytiques en caractérisent l’identité. Ces données n’établissent pas une biosynthèse naturelle dans le cannabis.',
'anandamide':'L’anandamide est isolée du cerveau porcin et sa structure publiée en 1992. Cette origine animale concerne la découverte d’un médiateur endogène, pas une teneur mesurée dans le cannabis.'}
for k,t in occ.items():mol(k,'occurrence',t)
mol('delta9-thca-b','identity','THCA-A et THCA-B sont des isomères de position : leur groupe carboxyle n’occupe pas le même emplacement. Une étude cristallographique du THCA-B est publiée en 1975 ; cette caractérisation structurale ne détermine pas son activité biologique.')
mol('delta9-thca-b','occurrence','L’étude de diffraction X de 1975 caractérise le THCA-B sans quantifier sa fréquence dans les plantes ni démontrer sa voie de formation. Les autres cannabinoïdes acides décrits par Shoyama en 1970 ne permettent pas non plus de conclure à une absence universelle du THCA-B.')
mol('cbda','risks','La biodisponibilité, les effets durables et les conséquences des mélanges restent insuffisamment caractérisés. Les transformations de l’acide dans une préparation et la présence d’autres constituants compliquent aussi l’attribution de ses effets propres.')
mol('cbc','risks','Les conséquences cliniques propres au CBC restent difficiles à distinguer de celles des mélanges étudiés ; leurs résultats ne suffisent pas à définir la sécurité du CBC isolé.')
mol('cbgv','risks','La pharmacologie et les conséquences d’une exposition humaine au CBGV restent insuffisamment caractérisées par les travaux d’isolement.')
mol('cbcv','risks','Les mécanismes pharmacologiques, la variabilité des expositions et la sécurité humaine du CBCV ne sont pas établis par les données structurales citées.')
mol('cbdva','identity','Le CBDVA possède une chaîne propyle à trois carbones, contre cinq pour le CBDA pentyle. Sa fonction carboxyle le distingue aussi du CBDV neutre.')
mol('cbcva','identity','Le CBCVA appartient à la famille acide du cannabichromène et possède une chaîne propyle à trois carbones, contre cinq pour le CBCA. Le carboxyle le distingue du CBCV neutre ; cette identité structurale ne démontre pas la voie enzymatique qui le forme.')
mol('thcp','identity','Le THCP est l’homologue heptyle du THC : sa chaîne latérale comporte sept carbones au lieu de cinq. La structure caractérisée dans l’étude de découverte doit être distinguée de la composition d’un produit vendu sous le nom THCP.')
mol('hhc','identity','Le HHC est un analogue hydrogéné du THC. Les formes 9R et 9S sont des épimères, donc des diastéréoisomères, plutôt qu’une paire d’énantiomères dont le mélange serait dit racémique. Leur activité doit être étudiée séparément.')
mol('hhcp','identity','La chaîne heptyle du HHCP contient sept carbones, contre cinq pour le HHC. Ses épimères 9R et 9S restent à distinguer en plus de cette longueur ; le nom ne détermine ni l’origine végétale ni une puissance clinique chiffrée.')
mol('hhc-o','risks','La composition et la toxicologie de ce produit émergent restent insuffisamment connues, notamment son exposition aux formes actives chez l’humain. Les résultats sur d’autres acétates ne mesurent pas directement le risque propre au HHC-O.')

qfix={
'hemp-hs-sci-cbd-1940':'Gaoni et Mechoulam distinguent le cannabinol du constituant actif dont ils étudient la structure dans leur publication de 1964.',
'hemp-hs-sci-anandamide-name':'L’AEA est une N-arachidonoyléthanolamide : la partie arachidonoyle est liée à une éthanolamine par une fonction amide.',
'hemp-hs-sci-mechoulam-country':'L’article de Mechoulam et Shvo de 1963 indique l’Institut Weizmann à Rehovot, en Israël.',
'hemp-hs-sci-cb2-tissue':'La classification de Howlett décrit une présence principalement immunitaire de CB2, sans en faire une distribution exclusive.',
'hemp-hs-sci-cb1-discovery-v-clone':'La classification de Howlett confirme le clonage de CB1 en 1990, puis de CB2 en 1993. Les travaux de liaison aux récepteurs précèdent ces clonages.'}
for b in bs.values():
 for q in b['quizPatches']:
  if q['id'] in qfix:q['explanation']=qfix[q['id']]
for k in ['delta9-thca-b','cbgva','cbcva']:
 d=aa['record-cannabinoid-'+k]['patch']['diagram']
 for n in d['nodes']:
  if k=='delta9-thca-b' and n['label']=='THCA-A / THCA-B':n['detail']='Isomérie de position du carboxyle ; la comparaison porte sur l’organisation des atomes.'
  if k=='cbgva' and n['label']=='CBCVA':n['detail']='Identité isolée ; preuve enzymatique directe distincte des branches THCVA et CBDVA.'
  if k=='cbcva' and n['label'].startswith('Branche'):n['detail']='La relation structurale ne démontre pas une conversion catalytique directe.'
captions={
'record-study-cbd-thc-2023':'Comparer les compositions à quantité de THC constante permet de tester une protection précise, sans promettre un entourage universel.',
'record-study-thcp-discovery-2019':'L’identification végétale, la liaison et les comportements murins ne mesurent pas une puissance clinique humaine.',
'record-study-cbd-dravet-2017':'Résultats d’une formulation pharmaceutique en complément des traitements habituels, avec comparaison placebo.',
'record-study-cbd-lgs-2018':'Le critère porte sur les crises avec chute ; efficacité et événements indésirables doivent être interprétés ensemble.',
'record-study-cbd-tsc-2021':'Les groupes et leurs expositions se comparent au placebo ; une extension ouverte ne constitue pas un nouvel essai indépendant.',
'record-study-cbd-pain-2023':'Cette population et ce critère douloureux limitent la généralisation aux autres douleurs et formulations.',
'record-study-cbg-acute-2024':'Un résultat aigu chez des volontaires sains ne démontre pas un traitement établi du trouble anxieux.',
'record-study-cbg-laboratory-2026':'Le petit effectif et l’exposition aiguë limitent les conclusions sur la sécurité chronique.',
'record-study-hhc-human-2025':'Six volontaires sans placebo fournissent des observations exploratoires, plutôt qu’une équivalence clinique avec le THC.',
'record-study-hhc-metabolites-2026':'Même cohorte et mesures relatives ; pour M2, une impureté initiale demeure une autre explication possible.',
'record-study-cbn-sleep-2026':'Un critère principal négatif et des signaux secondaires ne constituent pas une efficacité hypnotique garantie.',
'record-study-cbdv-seizures-2021':'L’absence de supériorité au placebo et les événements indésirables limitent la conclusion thérapeutique.',
'record-study-cbda-preclinical-2013':'Modèles animaux et tests de signalisation, sans démonstration d’un traitement antiémétique humain.'}
for aid,caption in captions.items():aa[aid]['patch']['diagram']['caption']=caption
next(n for n in aa['record-study-cbg-laboratory-2026']['patch']['diagram']['nodes'] if n['label']=='Limite')['detail']='Exposition aiguë, douze adultes sains ; effets chroniques et autres populations non évalués.'
for p,b in bs.items():p.write_text(json.dumps(b,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Phrases de présence fluidifiées ; identité THCP/HHC développée ; explications du quiz et légendes rendues publiques.')
