"""Domain-only review artifact builder; does not edit shared application data."""
import copy, json
from pathlib import Path

ROOT = Path(__file__).parent
data = json.loads((ROOT / 'assignments/botany.json').read_text(encoding='utf-8'))
articles = copy.deepcopy(data['articles'])
sources = {s['id']: copy.deepcopy(s) for s in data['sources']}
evidence = {}
findings = {}
diagrams = {}
blocked = {}
quiz_patches = []

def reviewed(ids, sections, assertions, access=None, url=None):
    for sid in ids.split():
        s = sources[sid]
        if url: s['url'] = url
        if access: s['access'] = access
        s['verifiedAt'] = '2026-11-14'
        s['reviewEvidence'] = [{'url': s['url'], 'sectionsOpened': sections,
            'result': 'Document ouvert et passage lu le 14 novembre 2026.',
            'assertionsSupported': assertions}]
        evidence[sid] = True

def note(i, text): findings.setdefault(i, []).append(text)
def add(i, section, text, refs):
    s = articles[i]['sections'][section]
    s['paragraphs'].append(text)
    s['sourceIds'] = list(dict.fromkeys(s['sourceIds'] + refs.split()))
    articles[i]['sourceIds'] = list(dict.fromkeys(articles[i]['sourceIds'] + refs.split()))

def diagram(i, kind, title, nodes, caption, refs):
    diagrams[i] = {'kind': kind, 'title': title,
        'nodes': [{'label': a, 'detail': b} for a,b in nodes], 'caption': caption,
        'sourceIds': refs.split()}

reviewed('bf-kew-1975 botany-diversity-kew qh-nature-kew',
    ['Accepted name; Classification; Flora of Tropical East Africa (1975), Morphology'],
    ['Cannabis sativa accepté ; Rosales, Cannabaceae ; folioles, fleurs, bractéole enveloppante et fruit'], 'official-page')
reviewed('bf-cfia-2021 botany-diversity-cfia qh-nature-canada',
    ['2.5 Taxonomy and genetics','2.6 General description','4.1 Reproductive biology','4.7 Means of movement and dispersal','6 Potential interaction'],
    ['2n=20 ; pivot ; disposition foliaire ; anthocyanes ; dioécie/monoécie ; pollinisation éolienne ; trichomes et cystolithes ; populations férales'], 'official-page')
reviewed('bf-body-2018', ['30.1 Plant Organ Systems; tissue systems'], ['Racines, axes aériens, épiderme et tissus conducteurs'], 'full-text')
reviewed('bf-stems-2018', ['30.2 Stems'], ['Nœuds, entre-nœuds, phloème et xylème'], 'full-text')
reviewed('bf-leaves-2018', ['30.4 Leaves'], ['Feuille composée, pétiole, épiderme et photosynthèse'], 'full-text')
reviewed('bf-reproduction-2018', ['32.2 Pollination and Fertilization'], ['Pollinisation puis tube pollinique ; double fécondation ; ovule/graine et ovaire/fruit'], 'full-text')
reviewed('bf-fibres-2016', ['Results: Microscopic Characterization of the Growing Hemp Hypocotyl; figure 1'], ['Fibres libériennes périphériques, xylème et développement des parois'], 'full-text')
reviewed('bf-morphology-2023', ['2.1 Leaf Development','2.2 Plant Architecture','2.3 Flower Development','2.4 Trichome Development','4.1 Plant Material','figure 12','Copyright CC BY 4.0'],
    ['Observations sur White Widow Dutch Passion ; succession des feuilles ; fleurs isolées ; trichomes et échelles photographiques'], 'full-text')
reviewed('bf-florogenesis-2019', ['Abstract','Results; figures 2 and 4','Discussion: Floral Development under Long and Short Photoperiod','Copyright CC BY'],
    ['Trois cultivars ; fleurs solitaires sous jours longs et courts ; forte ramification en jours courts ; enveloppes florales distinctes'], 'full-text')
reviewed('bf-geves-2021', ['pp.1 et 6 : objet ; expression du potentiel en pourcentage de plantules normales'], ['Le test de faculté germinative évalue un pourcentage de plantules normales ; les détails embryonnaires sont soutenus séparément par la description botanique et l’étude morphologique.'], 'full-text')
reviewed('bf-trichomes-2020 terpenes-lesson-livingston2020', ['PubMed: Abstract'], ['Trichomes glandulaires, changement de morphologie, cellules sécrétrices et métabolites'], 'abstract')
reviewed('terpenes-lesson-booth2017', ['Abstract; Introduction; terpene synthase characterization'], ['Enzymes des terpènes dans des matériels définis ; synthases multiproduits'], 'full-text')
reviewed('bf-upov-2025', ['TG/276/2, page 1 ; sections 4–5 ; caractères morphologiques'], ['Document du 26 août 2025 ; distinction, homogénéité et stabilité des variétés'], 'full-text')
reviewed('bf-sex-2025', ['PMC11659178 : Abstract, Introduction, Results and Discussion'], ['Constitution XX/XY et expression des gènes ; gènes candidats sans déterminant unique démontré'], 'full-text', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11659178/')
reviewed('bf-geves-2022', ['Article: 3 nouvelles variétés de chanvre'], ['Exemples datés de descriptions variétales de chanvre'], 'official-page')
reviewed('botany-diversity-cfia-seeds', ['Appendix III: Industrial hemp; feminized hemp; day-length insensitive varieties'], ['Descriptions d’inspection ; distinguer autofloraison et féminisation'], 'official-page')

# Six anatomy and developmental articles: retain verified explanations and add mechanisms.
add(0, 0, 'Une grande feuille palmée est une feuille composée : ses « doigts » sont des folioles réunies à l’extrémité d’un pétiole. Les feuilles inférieures sont généralement opposées, tandis que les feuilles supérieures deviennent souvent alternes. Le dessin d’une seule feuille ne représente donc pas tous les âges de la plante.', 'bf-kew-1975 bf-morphology-2023')
note(0, 'Conservés après lecture : famille, annualité, organes, diversité taxonomique et origine cultivée des formes férales. Ajout de repères observables ; la planche de synthèse est remplacée par une observation identifiée.')
add(1, 0, 'Les tissus conducteurs relient ces organes : le xylème transporte principalement l’eau et les ions minéraux ; le phloème distribue notamment des sucres entre organes sources et organes consommateurs. Les racines dépendent ainsi aussi des produits de la photosynthèse des parties aériennes.', 'bf-body-2018 bf-stems-2018')
add(1, 2, 'Dans les tissus verts, la photosynthèse transforme l’énergie lumineuse en énergie chimique et permet de fabriquer des sucres à partir du carbone du dioxyde de carbone. Les stomates participent aux échanges gazeux ; les poils de surface, les folioles et le pétiole sont des structures différentes.', 'bf-leaves-2018 bf-body-2018')
note(1, 'Conservés : fonctions racinaires, nœuds, entre-nœuds, pétiole, stipules et fibres du liber. Les fonctions du xylème/phloème et la fabrication des sucres rendent le fonctionnement de l’ensemble explicite.')
add(2, 2, 'Le fruit et la graine restent emboîtés mais ont des origines différentes. La paroi de l’ovaire devient le péricarpe ; les enveloppes de l’ovule deviennent celles de la graine. Le chènevis commercial entier comprend donc davantage que l’embryon et ses deux cotylédons. Il est dit indéhiscent parce qu’il ne s’ouvre pas spontanément à maturité.', 'bf-kew-1975 bf-reproduction-2018')
note(2, 'Conservées et vérifiées : anthères/pollen, deux branches stigmatiques, bractée/bractéole distincte du périanthe réduit, akène et deux cotylédons. Ajout du mécanisme ovaire→fruit et ovule→graine.')
add(3, 0, 'On décrit habituellement trois formes glandulaires : bulbeuse, capitée sessile et capitée pédonculée. La forme bulbeuse est la plus petite ; « capitée » indique une tête et « pédonculée » une tête portée par un pied allongé. Cette classification morphologique aide à décrire une observation, sans donner à elle seule la quantité de résine ou la composition de l’échantillon.', 'bf-cfia-2021 bf-trichomes-2020')
add(3, 1, 'Une enzyme catalyse une transformation chimique : elle facilite une réaction sans être consommée comme un ingrédient de celle-ci. Les terpène synthases étudiées peuvent fabriquer un produit principal ou plusieurs produits. Un trichome associe ainsi une structure cellulaire et plusieurs voies de biosynthèse, plutôt qu’un réservoir d’une seule molécule.', 'terpenes-lesson-booth2017')
note(3, 'Les trois sections sont cohérentes avec le résumé Livingston effectivement lu ; aucun article intégral Livingston n’est revendiqué. Typologie expliquée et vraie microphotographie substituée à la planche générique ; couleur non convertie en dosage.')
add(4, 0, 'Au sens physiologique strict, l’émission de la radicule marque l’achèvement de la germination. Un test de faculté germinative examine ensuite si la plantule possède les structures nécessaires à son développement normal : voir une racine ne suffit pas à décrire cette qualité complète.', 'bf-geves-2021')
add(4, 2, 'Dans les populations dioïques, les individus staminales terminent souvent leur cycle après la dispersion du pollen, alors que les individus pistillés poursuivent le développement des fruits. L’expression « cycle annuel » décrit le cycle habituel depuis la graine ; le maintien végétatif d’un clone dans un milieu contrôlé n’impose pas à tous les organes un âge identique.', 'bf-kew-1975 bf-cfia-2021')
note(4, 'Conservées : annualité générale, embryon, deux cotylédons, stades floraux et dispersion distincte de celle du pollen. Précision sur radicule/plantule normale et décalage de sénescence entre types sexuels.')
add(5, 1, 'Après son arrivée sur le stigmate, un pollen compatible peut germer et former un tube qui conduit les gamètes mâles vers l’ovule. Chez les plantes à fleurs, la double fécondation forme l’embryon d’une part et un tissu nourricier d’autre part. Polliniser une fleur ne démontre donc pas, à soi seul, qu’un fruit contenant une graine viable sera formé.', 'bf-reproduction-2018')
add(5, 2, 'Les chromosomes sexuels décrivent la constitution génétique, tandis que l’expression sexuelle décrit les fleurs effectivement produites. Des fleurs staminales peuvent apparaître sur un individu XX : leur présence ne transforme pas son caryotype en XY. Les associations d’expression de gènes repérées par l’étude de Shi et collègues sont des pistes mécanistiques, pas la preuve qu’un seul gène expliquerait toutes les organisations sexuelles.', 'bf-sex-2025')
note(5, 'Conservées : distinction dioécie/monoécie/fleur bisexuée et pollinisation/fécondation. Lecture du texte JXB via PMC ; licence CC BY-NC-ND excluant la réutilisation commerciale des figures : diagramme original retenu.')

diagram(4, 'sequence', 'Du fruit semé à la génération suivante', [('Fruit contenant une graine','L’embryon possède deux cotylédons.'),('Germination','La radicule émerge ; la plantule se développe ensuite.'),('Croissance et floraison','Feuilles, axes puis fleurs ; les stades se chevauchent.'),('Reproduction aboutie','Ovules → graines ; ovaires → fruits.'),('Sénescence et dispersion','La fin d’un individu et le départ d’une nouvelle génération sont distincts.')], 'Cycle annuel général ; aucune durée universelle n’est attribuée à ces étapes.', 'bf-geves-2021 bf-reproduction-2018 bf-morphology-2023')
diagram(5, 'comparison', 'Trois organisations florales', [('Dioécie','Un individu porte les fleurs staminales, un autre les fleurs pistillées.'),('Monoécie','Un individu porte des fleurs staminales et pistillées séparées.'),('Fleur bisexuée','Une même fleur réunit les deux appareils reproducteurs.')], 'L’organisation observée des fleurs et le génotype XX/XY sont deux niveaux de description.', 'bf-cfia-2021 bf-sex-2025 bf-reproduction-2018')

def photo(filename, alt, caption, author, url):
    return {'src':'/placard/reference/botany/'+filename, 'alt':alt, 'caption':caption,
        'author':author, 'sourceUrl':url, 'license':'CC BY 4.0',
        'licenseUrl':'https://creativecommons.org/licenses/by/4.0/', 'kind':'photograph'}

photo2 = photo('florogenesis-figure2.webp', 'Photographies d’un cannabis NB140, d’un nœud avec fleurs solitaires et de son apex, accompagnées du schéma d’organisation de la figure originale.',
    'Cannabis NB140 : plante entière (A), nœud avec fleurs solitaires (B), organisation (C), apex observé en microscopie (D–E). Figure 2 originale conservée ; les légendes anglaises désignent tige principale, axe axillaire, feuille, bractée et fleur solitaire. Ce matériel ne représente pas toutes les variétés.',
    'Ben Spitzer-Rimon, Sigal Duchin, Nirit Bernstein et Rina Kamenetsky (2019)', sources['bf-florogenesis-2019']['url'])
photo4 = photo('florogenesis-figure4.webp', 'Microphotographies du développement d’une fleur pistillée, de son périanthe réduit, de sa bractée enveloppante et des stigmates.',
    'Figure 4 : développement de la fleur pistillée. c = carpelle ; r = bractée périgonale ; p = périanthe ; s = stigmate ; b = bractée sous-jacente. Les barres d’échelle sont conservées ; le stigmate a été retiré sur E pour montrer les enveloppes.',
    'Ben Spitzer-Rimon, Sigal Duchin, Nirit Bernstein et Rina Kamenetsky (2019)', sources['bf-florogenesis-2019']['url'])
photot = photo('trichomes-figure12.jpg', 'Microphotographies de têtes glandulaires sur leur pédoncule, avec mesures de longueur du pédoncule et diamètre de tête dans l’étude.',
    'Figure 12 de l’étude White Widow : photographies A–D et mesures E–F (micromètres). Les semaines indiquent les observations expérimentales de ce cultivar ; ce calendrier et les couleurs ne donnent pas un dosage chimique universel.',
    'Mohsen Hesami, Marco Pepe et Andrew Maxwell Phineas Jones (2023)', sources['bf-morphology-2023']['url'])

for i in (0,1): articles[i]['image'] = copy.deepcopy(photo2)
articles[2]['image'] = copy.deepcopy(photo4)
articles[3]['image'] = copy.deepcopy(photot)

reviewed('botany-diversity-sawler', ['Abstract; Results and Discussion; figures 1–2'],
    ['81 matériels drug-type et 43 chanvres ; 14 031 SNP ; corrélation modérée des ascendances annoncées et limites des noms'], 'full-text')
schwabe_pdf='https://grn.issup.net/files/2019-06/Genetic%20tools%20weed%20out%20misconceptions%20of%20strain%20reliability%20in%20Cannabis%20sativa%20implications%20for%20a%20budding%20industry.pdf'
reviewed('botany-diversity-schwabe botany-variety-identity', ['PDF original 2019 : p.1 résumé ; p.2–3 clones et mutations ; résultats et discussion'],
    ['Microsatellites et 30 noms de lignées ; discordances entre échantillons ; plusieurs lignées relativement cohérentes une fois les valeurs atypiques examinées'], 'full-text',schwabe_pdf)
for sid in ('botany-diversity-schwabe','botany-variety-identity'):
    sources[sid]['published']='2019 ; Journal of Cannabis Research 1:3 ; DOI 10.1186/s42238-019-0001-1'
    sources[sid]['limitation']='Article original lu dans son PDF de 2019. La référence précédente liait ce titre au PMID 33526091, qui correspond à un autre article : URL corrigée. Dix marqueurs microsatellites ne couvrent pas tout le génome ni tous les matériels du marché.'
reviewed('botany-diversity-lynch2025', ['Nature : The cannabis pangenome; The pangenome reveals five populations; Domesticated cannabinoid pathway; Conclusions'],
    ['193 assemblages pour 144 échantillons biologiques ; diversité structurale ; chromosome 7 des synthases ; sous-échantillonnage asiatique'], 'full-text','https://www.nature.com/articles/s41586-025-09065-0?error=cookies_not_supported&code=1')
reviewed('botany-diversity-pike2026', ['Abstract; Background and Summary; Germplasm selection; Technical Validation'],
    ['Quatre assemblages diploïdes résolus en haplotypes ; graphe de 66 haplotypes ; précision nucléotidique et phasage incomplet signalés'], 'full-text','https://www.nature.com/articles/s41597-026-07806-y?error=cookies_not_supported&code=1')
reviewed('botany-diversity-genotype botany-diversity-allele botany-diversity-phenotype', ['NHGRI : Definition and Narration'],
    ['Génotype à un locus ; versions alléliques ; homozygotie/hétérozygotie ; phénotype et milieu'], 'official-page')
reviewed('botany-diversity-f1f2', ['Definition and applications; Using hybrids as controls'],
    ['F1 puis F2 ; uniformité conditionnée par des parents consanguins dans l’exemple murin, non garantie générique chez Cannabis'], 'official-page')
reviewed('botany-diversity-geves botany-diversity-geves-diversity', ['Page catalogue ; article du 9 mars 2020, paragraphes sur homogénéité relative et stabilité'],
    ['Description variétale et homogénéité relative ; aucune identité génétique universelle impliquée'], 'official-page')
reviewed('qh-nature-geves-new-varieties', ['PDF Février 2025 : p.2 avertissement ; p.4 tableau des propositions de janvier 2025'],
    ['Vega, monoïque, très précoce ; proposition d’inscription distincte de l’arrêté final'], 'full-text','https://www.geves.fr/wp-content/uploads/PLA_Chanvre_2025_Janvier.pdf')
sources['qh-nature-geves-new-varieties']['published']='Février 2025 ; tableau des propositions de janvier 2025'

add(6,0,'Le photopériodisme est la réponse de la plante à cette alternance. Il faut distinguer durée du jour, intensité et quantité cumulée de lumière : deux journées aussi longues peuvent apporter des quantités de lumière différentes. L’âge de la plante et sa constitution génétique modifient aussi la réponse observée.', 'bf-florogenesis-2019 bf-morphology-2023')
add(6,1,'Dans l’étude de 2019, trois cultivars forment des fleurs solitaires sous jours longs ; leur maturation diffère cependant entre cultivars. Les jours courts favorisent surtout une modification de l’architecture, avec des axes floraux plus ramifiés et resserrés. Ce résultat décrit les matériels étudiés ; il ne signifie pas que chaque étape de floraison de tous les cannabis serait indépendante du jour.', 'bf-florogenesis-2019')
note(6,'Conservée : définition de photopériode et distinction autofloraison/autofécondation/féminisation. Précision déterminante : fleur solitaire et constitution d’une inflorescence ne répondent pas nécessairement au même signal ; pas de seuil horaire universel.')
diagram(6,'comparison','Un signal, plusieurs réponses',[('Photopériode','Durée de l’éclairement dans le cycle jour–nuit.'),('Fleur solitaire','Peut être initiée sous jours longs dans les cultivars étudiés.'),('Inflorescence compacte','La ramification et l’organisation des axes peuvent répondre aux jours courts.'),('Autofloraison','Dépendance plus faible à la photopériode ; distincte de l’autofécondation.')],'Le stade observé et le génotype déterminent la portée de la comparaison.','bf-florogenesis-2019 bf-morphology-2023 botany-diversity-cfia-seeds')
add(7,0,'Dans ce référentiel, l’ordre est Rosales, la famille Cannabaceae, le genre Cannabis et l’espèce Cannabis sativa. Humulus lupulus, le houblon, appartient à la même famille mais à un autre genre. Retenir une seule espèce pour Cannabis n’impose ni une seule variété ni un seul génotype.', 'botany-diversity-kew bf-cfia-2021')
add(7,2,'L’étude de Sawler et collègues observe une corrélation modérée entre ascendances sativa/indica annoncées et structure génétique, plutôt qu’une absence totale de structure. Chez Schwabe et McGlaughlin, les groupes obtenus avec dix marqueurs ne coïncident pas clairement avec les trois catégories du commerce. Ces résultats dépendent de l’échantillonnage et des marqueurs ; ils ne démontrent pas que toutes les plantes seraient identiques.', 'botany-diversity-sawler botany-diversity-schwabe')
note(7,'Préservées : taxonomie discutée et distinction des catégories commerciales. Nuance ajoutée sur la corrélation modérée de Sawler, souvent perdue dans le slogan « indica/sativa ne veulent rien dire ». URL/titre erronés de la source Schwabe corrigés.')
diagram(7,'sequence','Les rangs du référentiel Kew',[('Rosales','Ordre botanique.'),('Cannabaceae','Famille comprenant notamment Cannabis et Humulus.'),('Cannabis','Genre.'),('Cannabis sativa L.','Espèce acceptée ; L. est l’abréviation de Linné.')],'Cette hiérarchie ne place pas les appellations commerciales au rang d’espèces.','botany-diversity-kew')
add(8,2,'Un pangénome est construit avec une collection d’échantillons : ses branches ne sont pas la totalité de la diversité mondiale. Lynch et collègues assemblent 193 génomes à partir de 144 échantillons biologiques, certains individus apportant plusieurs assemblages. Une accession est une entrée identifiée dans cette collection ; elle peut représenter un matériel précis sans représenter toute sa région d’origine.', 'botany-diversity-lynch2025')
note(8,'Conservés : population locale diverse, férale distincte d’ancestrale, sous-échantillonnage asiatique. Ajout d’un exemple explicitant assemblages/individus/accessions pour éviter le double comptage.')
diagram(8,'comparison','Trois histoires de populations',[('Population cultivée locale','Histoire territoriale et sélection humaine, avec diversité interne.'),('Population férale','Descend de plantes cultivées puis se maintient hors culture.'),('Population ancestrale sauvage','Statut à établir avec des données ; ne se déduit pas du seul aspect spontané.')],'Ces histoires peuvent être reliées par des échanges de pollen ou de graines.','bf-cfia-2021 botany-diversity-lynch2025')
add(9,0,'Un nom de cultivar n’est donc pas un rang botanique comme espèce ou sous-espèce. Les examens DHS décrivent distinction, homogénéité et stabilité à partir de caractères et de règles définis ; l’homogénéité recherchée dépend du mode de reproduction et ne signifie pas que chaque base de l’ADN soit identique.', 'bf-upov-2025 botany-diversity-geves-diversity')
add(9,1,'La multiplication végétative ne réunit pas les gamètes de deux parents. Une mutation somatique peut cependant apparaître au fil des divisions cellulaires et se transmettre à une branche clonale. L’étude de Schwabe évoque cette possibilité sans l’utiliser comme explication automatique de toutes les divergences observées entre produits portant le même nom.', 'botany-diversity-schwabe')
note(9,'Conservées : définitions et influence du milieu. Renforcement DHS et source de la mutation clonale : la page GEVES seule ne démontrait pas cette dernière assertion ; le PDF Schwabe la traite explicitement.')
diagram(9,'comparison','Cultivar, clone ou accession ?',[('Cultivar','Ensemble sélectionné et maintenu pour des caractères définis.'),('Clone','Descendance végétative d’un individu ; mutations possibles.'),('Accession','Entrée traçable d’une collection, pas rang taxonomique.')],'Ces mots répondent à des questions différentes et peuvent concerner un même matériel.','bf-upov-2025 botany-diversity-schwabe botany-diversity-lynch2025')
add(10,0,'Le cannabis diploïde ordinaire possède vingt chromosomes dans une cellule somatique, soit dix paires et la notation 2n = 20. À un locus, on peut représenter deux versions par A et a : AA et aa sont homozygotes, Aa est hétérozygote. Ces lettres représentent des versions, sans noter la qualité ou prévoir à elles seules un effet du cannabis.', 'bf-cfia-2021 botany-diversity-allele')
add(10,1,'La méiose sépare les copies chromosomiques et peut échanger des segments entre chromosomes homologues ; la fécondation réunit ensuite deux gamètes. La génération F2 issue de F1 peut ainsi porter de nouvelles associations. L’exemple classique de F1 uniformes suppose des parents suffisamment fixés : écrire F1 sur un lot ne suffit pas à démontrer son uniformité.', 'botany-diversity-f1f2')
add(10,2,'Un haplotype est une combinaison liée de variants sur un chromosome ou une région. L’assemblage « résolu en haplotypes » vise à distinguer les deux copies, plutôt qu’à les écraser en une seule séquence. Dans le pangénome de Lynch et collègues, les gènes THCAS, CBDAS et CBCAS sont décrits dans des ensembles du chromosome 7 ; les copies fonctionnelles, les pseudogènes et leur organisation ne se confondent pas. Leur présence ne donne pas directement un pourcentage de THC ou de CBD dans une fleur.', 'botany-diversity-lynch2025 botany-diversity-pike2026')
note(10,'Lacunes quiz corrigées : ajout explicite de 2n=20, chromosome 7 des synthases et définition d’haplotype. F1/F2 expliqués avec conditions d’uniformité. La référence eLife n’a pas été accessible ; l’introgression est également illustrée par les lignées CBD dans Nature 2025 effectivement lu.')
diagram(10,'comparison','Un individu, plusieurs niveaux de description',[('Génotype au locus','Exemple : Aa, deux versions différentes.'),('Haplotype','Variants liés sur une copie chromosomique.'),('Phénotype','Caractères observables influencés par génotype, développement et milieu.'),('Pangénome','Représentation de séquences communes et variables provenant de plusieurs matériels.')],'Le nombre d’assemblages n’est pas toujours le nombre d’individus.','botany-diversity-allele botany-diversity-phenotype botany-diversity-lynch2025 botany-diversity-pike2026')
add(11,0,'Pour suivre une lignée, on distingue le nom, l’obtenteur ou détenteur, la version et l’échantillon examiné. Une continuité documentaire explique qui a transmis un matériel ; une comparaison génétique examine la proximité de matériels effectivement prélevés. L’une peut compléter l’autre sans la remplacer.', 'botany-diversity-sawler botany-diversity-schwabe')
note(11,'Sections relues : principe des noms et deux exemples conservés. Les deux pages commerciales primaires sont ouvertes et les exemples restent attribués, sans convertir leurs déclarations en preuve ADN.')
diagram(11,'evidence','Une parenté peut être corrigée',[('Ancienne déclaration Cannatonic','MK-Ultra × G13, présentée comme une hypothèse antérieure.'),('Rectification Resin Seeds, 2015','Reina Madre × NYCD remplace cette hypothèse.'),('Portée de la rectification','Documente la déclaration de l’obtenteur ; aucune analyse indépendante présentée.')],'Les deux versions du récit ne sont pas deux couples de parents biologiques simultanés.','botany-diversity-cannatonic')

articles[12]['sections'][0]['paragraphs']=[
    'Le cannabis est une herbacée annuelle à tige dressée, avec des tissus ligneux internes et des entre-nœuds parfois creux. Il développe généralement une racine pivotante ramifiée, dont la forme dépend du sol. Ses feuilles composées portent des folioles au bord denté : généralement opposées en bas, elles deviennent souvent alternes près du sommet.',
    'Les anthocyanes peuvent donner une teinte pourpre aux feuilles et aux tiges. La coloration est un caractère observable, pas une identification variétale. Les fleurs staminales produisent du pollen petit, léger et sec, principalement transporté par le vent. Dans une population dioïque, les pieds mâles terminent souvent leur cycle après sa libération, avant la maturation des fruits des pieds femelles.',
    'Le chènevis entier est un fruit sec indéhiscent, couramment appelé akène : il contient une graine. La bractée périgonale enveloppe l’ovaire puis le fruit. Dans le traitement de Small et Cronquist présenté par l’ACIA, le périanthe adhérent et pigmenté contribue à l’aspect marbré de certaines formes spontanées. Une zone d’abscission développée favorise la chute des fruits mûrs.',
    'La dormance est une propriété par laquelle une graine viable ne germe pas même lorsque certaines conditions extérieures sont favorables ; elle ne signifie pas que l’embryon est mort. Elle peut prolonger le maintien des graines dans le milieu et est plus marquée chez certaines formes spontanées que chez les formes sélectionnées.']
articles[12]['sections'][0]['sourceIds']=['qh-nature-canada','bf-kew-1975','bf-geves-2021']
articles[12]['sections'][1]['paragraphs']=[
    'Les trichomes proviennent de l’épiderme. Parmi les formes glandulaires, les bulbeux sont les plus petits ; les capitَés sessiles portent une tête proche de la surface et les capitَés pédonculés une tête sur un pied allongé. Les cellules sécrétrices participent à la formation et à l’accumulation de cannabinoïdes et de terpènes.',
    'Les poils cystolithiques sont non glandulaires et contiennent des dépôts de carbonate de calcium à leur base. Ils contribuent à la rugosité de la surface. Les deux longs filaments d’une fleur pistillée sont au contraire des branches stigmatiques réceptrices du pollen : ce ne sont ni des trichomes ni deux pistils complets.']
articles[12]['sections'][1]['sourceIds']=['qh-nature-canada','bf-trichomes-2020','bf-florogenesis-2019']
articles[12]['sections'][2]['paragraphs']=[
    'Kew classe Cannabis sativa dans les Rosales et les Cannabaceae, famille qui contient aussi le houblon. Un traitement monotypique du genre retient une seule espèce ; il n’efface pas les différences entre populations ou cultivars. Une population locale a une histoire agricole ; une population férale descend de cultures échappées. Les catégories commerciales sativa et indica ne constituent pas un pedigree complet.',
    'Un cultivar est un ensemble sélectionné ; un clone descend d’une multiplication végétative d’un individu. Les examens DHS portent sur la distinction, l’homogénéité et la stabilité de caractères définis. Dans le tableau CTPS/GEVES des propositions de janvier 2025, Vega est monoïque et classée « très précoce ». Ce repère concerne cette description datée : la proposition d’inscription et sa publication réglementaire finale sont des événements différents.']
articles[12]['sections'][2]['sourceIds']=['qh-nature-kew','qh-nature-canada','qh-nature-geves-new-varieties','botany-diversity-schwabe','bf-upov-2025']
articles[12]['sourceIds']=list(dict.fromkeys(articles[12]['sourceIds']+[x for s in articles[12]['sections'] for x in s['sourceIds']]))
articles[12]['image']=copy.deepcopy(photo2)
note(12,'Les 20 questions associées ont été confrontées à chaque phrase : ajouts substantiels pour enseigner pivot, anthocyanes, phyllotaxie, tige creuse, sénescence mâle, pollen, trichomes, cystolithes, abscission et dormance. Correction fruit/graine. PDF GEVES alternatif effectivement ouvert, p.4 : Vega très précoce ; date éditoriale février, propositions janvier. Les anciennes sources générales placées partout sont réparties par assertion.')

reviewed('botany-variety-haze-ag', ['Article du 1 mai 2025 : paragraphes Original Haze, G, Sam, Colombian varieties'],
    ['Récit attribué de Santa Cruz 1969, transmission par Sam et trois composantes colombiennes'], 'full-text')
reviewed('botany-variety-skunk-sam', ['Intro; Sam, you were talking about Skunk #1; The process of hybridisation'],
    ['Entretien original 2023 révisé en 2025 ; séquence Afghan/Colombian puis Acapulco Gold ; transmission européenne'], 'full-text')
sources['botany-variety-skunk-sam']['published']='Entretien 2023 ; page mise à jour en 2025'
reviewed('botany-variety-mango', ['Premier paragraphe; Heritage; Family of breed; Breeder'],
    ['Mr. Nice décrit un père Haze commun avec SSH et une mère sœur de celle de SSH ; ascendance NL5/Skunk/Haze ; attribution Nevil/Shantibaba'], 'full-text')
reviewed('botany-variety-ssh', ['Titre; Genetics'], ['Ascendances annoncées Skunk, Northern Lights et Haze ; pas ordre complet des croisements'], 'full-text')
reviewed('botany-variety-kush-sensi', ['About Hindu Kush Feminized; origine dans le massif'],
    ['Provenance revendiquée Afghanistan/Pakistan pour la version de Sensi, pas parentage universel de Kush'], 'official-page')
reviewed('botany-variety-og-cbd', ['Cultivation data: Genetics'], ['OG Kush × Dancehall annoncé par Dinafem ; allégations médicales et consignes pratiques exclues'], 'full-text')
reviewed('botany-variety-soma', ['Titre; Strain Description'], ['NYC Diesel Soma : Mexican Sativa × Afghani et récit des graines reçues d’un ami'], 'full-text')
reviewed('botany-diversity-cannatonic botany-variety-cannatonic', ['Article complet, publication 10 novembre 2015 et modification 17 janvier 2016'],
    ['Rectification explicite Reina Madre × NYCD remplaçant MK-Ultra × G13'], 'full-text')
reviewed('botany-variety-blueberry', ['Dutch Passion Blueberry: one of the most rewarding cannabis strains; Blueberry strain info'],
    ['DJ Short ; introduction néerlandaise 1998 ; composantes Afghani, Thai et Oaxacan explicitement données dans la page'], 'full-text')
reviewed('botany-variety-hso-cbd botany-variety-hso-blue', ['Tableau Cross; description de la génétique'],
    ['Version HSO : Blueberry × Super Silver Haze ; Blue Dream CBD : Blue Dream × California Orange CBD'], 'full-text')
reviewed('botany-variety-hso2017', ['Catalogue 2017 : sommaire ; pages imprimées 9–10 Blue Dream CBD et Blue Dream'],
    ['Présence commerciale datée des deux versions ; ascendance Blueberry et Super Silver Haze pour Blue Dream'], 'full-text')
reviewed('botany-variety-black-widow', ['Présentation; Heritage; Family of breed; Breeder'],
    ['Shantibaba revendique White Widow renommée Black Widow ; Brazilian Sativa × South Indian hybrid dans le texte, South Indian Indica dans le tableau ; récompense 1995 annoncée'], 'full-text')
reviewed('botany-variety-trikoma botany-diversity-widow', ['Linaje genético; Características de un vistazo; Parentales y origen genético'],
    ['Version propre Trikoma ; Widow Bilbo × Widow BCN, mères conservées à Barcelone'], 'full-text')
reviewed('botany-variety-therapy', ['CBD Therapy : paragraphes de présentation et variations des lots'],
    ['Origine déclarée à partir de matériels récréatifs à THC, sans parents nommés ; la marque reconnaît des variations de ratios entre descendants'], 'full-text')
sources['botany-variety-therapy']['passage']='Présentation et paragraphes sur la variation des ratios CBD/THC au sein des semences. Les parents précis ne sont pas nommés.'
sources['botany-variety-therapy']['limitation']='Page primaire commerciale effectivement lue, sans données de lot indépendantes. Les allégations thérapeutiques présentes sur cette page ne sont pas reprises et ne constituent pas une preuve clinique.'
sources['botany-gelato-sherbinskis-2026']={'id':'botany-gelato-sherbinskis-2026','title':'The Gelato Family','author':'Sherbinskis','organization':'Sherbinskis','published':'Page sans date éditoriale affichée','url':'https://sherbinskis.com/','verifiedAt':'2026-11-14','passage':'The Gelato Family : Sunset Sherbert × Thin Mint Cookies ; Bacio Gelato / #41.','access':'official-page','documentKind':'Déclaration primaire de marque','limitation':'Confirme la parenté actuellement annoncée par cette marque, sans analyse indépendante de parentage et sans date de création certifiée.'}
reviewed('botany-gelato-sherbinskis-2026',['The Gelato Family'],['Sunset Sherbert × Thin Mint Cookies ; Bacio #41'], 'official-page')

def replace_sections(i, texts):
    for section, paragraphs in zip(articles[i]['sections'], texts):
        section['paragraphs']=paragraphs

replace_sections(13,[
    ['Dans son article du 1er mai 2025, Todd McCormick attribue la création de son Original Haze à « G », dans les montagnes de Santa Cruz, en 1969. Sam aurait ensuite conservé et transmis les graines. Ce récit identifie des acteurs de la circulation du matériel ; sa publication récente ne constitue pas une archive contemporaine de la création.'],
    ['Authentic Genetics décrit une combinaison de trois composantes colombiennes. Cette attribution doit rester attachée à cette version d’Original Haze ; elle ne résout pas l’histoire de toutes les sélections portant Haze. Green House annonce pour sa Super Silver Haze les ascendances Skunk, Northern Lights et Haze, sans détailler dans le champ Genetics l’ordre de tous les croisements.'],
    ['Haze sert aussi de nom de famille à de nombreux hybrides. Original Haze, Super Silver Haze et une sélection nommée Mango Haze ne sont donc pas trois synonymes. Mr. Nice décrit sa Mango Haze comme une branche parallèle à SSH, avec un père Haze commun et une mère apparentée. Hawaiian Haze, Mango Haze CBD et Lemon Haze CBD conservent leurs fiches Buddies et leurs attributions propres.'],
    ['On peut vérifier ici un récit publié et des déclarations d’ascendance, mais pas l’identité génétique de chaque fondateur historique. Le document de McCormick ne fournit pas les génotypes des trois composantes. Un arbre complet exigerait des échantillons identifiés ou des archives de croisements supplémentaires ; le diagramme garde donc les composantes et les versions séparées.']])
add(13,2,'Cette parenté est une déclaration de Mr. Nice, distincte de la présentation de Super Silver Haze par Green House ; les deux maisons ne sont pas fusionnées en une seule source de pedigree.','botany-variety-mango')
note(13,'Conservés après ouverture : récit McCormick et champ Genetics Green House. Fragments développés pour expliquer conservation, branches et différence entre ascendance et parents directs. Pas de photo générique attribuée à un cultivar historique.')
diagram(13,'comparison','Haze : trois descriptions à distinguer',[('Original Haze / Authentic Genetics','Trois composantes colombiennes selon McCormick, récit 2025.'),('Super Silver Haze / Green House','Skunk, Northern Lights et Haze annoncés ; ordre incomplet.'),('Mango Haze / Mr. Nice','Branche parallèle, père Haze commun et mère sœur selon sa fiche.')],'Comparaison de déclarations ; ce diagramme ne certifie ni l’identité ADN ni une filiation entre toutes les Haze.','botany-variety-haze-ag botany-variety-ssh botany-variety-mango')
replace_sections(14,[
    ['L’entretien original de 2023 avec Sam the Skunkman, mis à jour par Sensi en 2025, rattache Skunk #1 au travail de Sacred Seeds en Californie puis à la circulation de graines vers les Pays-Bas. La transmission d’un matériel à une autre maison et sa création initiale sont deux événements différents.'],
    ['La présentation décrit un croisement Afghan–Colombian, puis un apport d’Acapulco Gold au descendant. Il s’agit d’une histoire en plusieurs générations : trois composantes ancestrales ne sont pas trois parents directs simultanés. Les identités exactes de tous les échantillons fondateurs ne sont pas documentées dans cet entretien.'],
    ['Les versions régulière, féminisée et automatique doivent être identifiées séparément : le format de semences et le caractère de floraison font partie de leur description. Sensi Skunk, Skunk Dream CBD et Cheese CBD sont des entrées distinctes ; leur proximité de nom ne garantit pas une identité avec chaque lot Skunk #1.'],
    ['Le témoignage de Sam est une source primaire attribuée mais rétrospective. La rétrospective des quarante ans de Sensi, qui fournit dans le dossier initial les repères 2007 et 2013 pour certaines versions, n’a pas pu être relue directement pendant cette révision : ces dates ne sont donc pas reprises comme faits revérifiés. Le terme courant « skunk » ne certifie pas une descendance de Skunk #1.']])
note(14,'Séquence ancestrale conservée après lecture ; trois parents directs simultanés évités. Dates 2007/2013 mises en réserve car source Sensi 40 ans inaccessible malgré plusieurs tentatives, avec trace distincte.')
diagram(14,'sequence','Le récit d’ascendance de Skunk #1',[('Premier croisement annoncé','Afghan et Colombian.'),('Apport suivant annoncé','Acapulco Gold rejoint la descendance du premier croisement.'),('Sélection puis versions','Skunk #1 et matériels ultérieurs à identifier par maison et version.')],'Séquence rapportée par Sensi dans le récit de Sam, sans certification génétique indépendante.','botany-variety-skunk-sam')
replace_sections(15,[
    ['Northern Lights désigne une famille de matériels avec des sélections numérotées. Le dossier initial rattache sa diffusion européenne à du matériel américain et cite un repère de catalogue de 1985 dans une rétrospective Sensi. Cette rétrospective n’ayant pas pu être relue directement ici, la date reste à contre-vérifier ; elle ne daterait de toute façon pas à elle seule la création du matériel américain.'],
    ['Les fondateurs exacts de Northern Lights ne sont pas établis par les documents effectivement ouverts. En revanche, Mr. Nice décrit explicitement NL5 dans l’ascendance de Mango Haze, aux côtés de Skunk et de Haze. Green House cite Northern Lights dans celle de Super Silver Haze. Ces déclarations décrivent des descendants ou des ascendances composées ; elles ne reconstituent pas les parents de Northern Lights.'],
    ['Northern Lights sans numéro, Northern Lights #5 et les descendants portant leur nom ne sont pas automatiquement interchangeables. Pour Mango Haze, Mr. Nice précise un père Haze commun à SSH et une mère sœur de celle de SSH. Le Buddy Mango Haze CBD correspond encore à une version distincte, dont les données ne doivent pas être transférées à tout ce groupe.'],
    ['Les fiches Mr. Nice et Green House sont des sources primaires ouvertes pour leurs propres annonces. Aucun arbre Afghani/Thai ou Afghani/Hawaiian n’est ajouté pour trancher les récits historiques. La continuité d’un numéro de sélection exige de préciser le détenteur et l’échantillon, pas seulement la répétition du nom dans un catalogue.']])
note(15,'Ascendances NL5/Skunk/Haze et relation entre Mango Haze et SSH relues chez Mr. Nice. Repère 1985 non confirmé faute d’accès Sensi ; pas de fondateurs reconstruits avec des récits secondaires.')
diagram(15,'evidence','Ce que documentent les fiches Northern Lights',[('Northern Lights historique','Parents fondateurs non établis dans les pièces ouvertes.'),('NL5 dans Mango Haze','Ascendance explicitement annoncée par Mr. Nice.'),('Northern Lights dans SSH','Ascendance annoncée par Green House.'),('Repère de catalogue 1985','Source rétrospective Sensi à relire avant validation de cette date.')],'Les deux annonces de descendants ne renseignent pas les parents fondateurs de Northern Lights.','botany-variety-mango botany-variety-ssh')
replace_sections(16,[
    ['Hindu Kush est à la fois un toponyme et une appellation de matériels sélectionnés. Sensi attribue sa version au massif entre Afghanistan et Pakistan. Le dossier initial présente séparément un récit d’OG Kush transmis de Floride vers Los Angeles avec Josh D et Matt Berger : l’entretien PDF de LA Weekly a dépassé la limite du navigateur documentaire et n’a pas été relu intégralement pendant cette révision. La date de 1996 reste donc à confirmer dans ce document.'],
    ['Aucun parent fondateur d’OG Kush historique n’est établi ici. La fiche Dinafem effectivement ouverte annonce en revanche OG Kush × Dancehall pour sa version OG Kush CBD. C’est une relation déclarée entre deux matériels nommés, sans certificat de parentage indépendant présenté.'],
    ['Hindu Kush, OG Kush et Bubba Kush gardent leurs dossiers propres. Une sélection CBD comportant OG Kush dans son nom correspond à un travail de sélection supplémentaire ; elle ne définit pas toutes les Kush. Skywalker OG et Kandy Kush ne deviennent pas des parents universels par la seule présence de Kush ou OG dans leur appellation.'],
    ['Le catalogue Sensi soutient une provenance revendiquée pour sa Hindu Kush ; le tableau Genetics de Dinafem soutient l’annonce OG Kush × Dancehall. Ni cette provenance ni ce croisement ne résolvent les fondateurs d’OG Kush. Les effets thérapeutiques et les conseils de culture présents sur les pages commerciales ne sont pas utilisés comme preuves botaniques.']])
note(16,'Pages Sensi et Dinafem ouvertes, annonces conservées avec attribution. Véritable limite : entretien OG PDF non relu, trop volumineux pour outil web ; date et transmission signalées à contre-vérifier. Aucun parent Chemdawg/Hindu Kush inventé.')
diagram(16,'comparison','Kush : provenance et croisement',[('Hindu Kush / Sensi','Origine revendiquée dans le massif Afghanistan–Pakistan.'),('OG Kush historique','Parents fondateurs non établis dans ce dossier.'),('OG Kush CBD / Dinafem','Croisement annoncé : OG Kush × Dancehall.')],'Le nom partagé n’est pas une flèche généalogique entre ces trois descriptions.','botany-variety-kush-sensi botany-variety-og-cbd')
replace_sections(17,[
    ['Soma raconte avoir reçu des graines d’un ami de New York pour sa NYC Diesel. La fiche actuelle documente ce récit de transmission, sans dater précisément le croisement fondateur. La rectification Cannatonic publiée par Resin Seeds en 2015 emploie déjà NYCD comme nom parental ; elle ne fournit cependant pas l’identité d’un lot Soma de référence.'],
    ['Soma annonce Mexican Sativa × Afghani pour NYC Diesel. Resin Seeds annonce Reina Madre × NYCD pour Cannatonic dans son correctif de novembre 2015. Relier automatiquement le NYCD du correctif à tout lot actuel NYC Diesel exigerait davantage de traçabilité : un nom commun dans deux documents ne suffit pas à identifier les mêmes individus.'],
    ['NYC Diesel et Sour Diesel sont deux appellations à maintenir distinctes. Sour Tsunami et NYC Diesel CBD SWS69 gardent également leurs fiches particulières. Une odeur qualifiée de diesel décrit une perception aromatique ; ce caractère ne démontre pas une descendance de Soma ni une parenté avec Sour Diesel.'],
    ['Les deux pages primaires effectivement ouvertes permettent d’attribuer les annonces à Soma et à Resin Seeds. Elles ne donnent ni génotypes fondateurs ni comparaison ADN des versions portant les mêmes noms. La parenté Cannatonic ancienne, MK-Ultra × G13, est une déclaration retirée par Resin Seeds, et non une seconde généalogie biologique à ajouter au diagramme.']])
note(17,'Soma et correction Resin Seeds relus ; les parentés annoncées sont conservées. Clarification NYCD/lot Soma et retrait du style de fragments ; aucune confusion avec Sour Diesel.')
diagram(17,'comparison','Deux annonces utilisant Diesel',[('NYC Diesel / Soma','Mexican Sativa × Afghani.'),('Cannatonic / Resin Seeds, 2015','Reina Madre × NYCD.'),('Lien entre les deux NYCD','Identité exacte des lots non vérifiée par ADN ici.')],'La présence du nom NYCD dans deux documents n’autorise pas à fusionner leurs échantillons.','botany-variety-soma botany-variety-cannatonic')

replace_sections(18,[
    ['Dutch Passion attribue les sélections de la Blue Family à DJ Short et leur introduction sur le marché néerlandais à une coopération en 1998. Ce repère date une diffusion commerciale annoncée ; il ne constitue pas la date précise de chaque croisement antérieur. Le catalogue HSO de 2017 documente séparément la présence de Blue Dream et de Blue Dream CBD.'],
    ['La page Dutch Passion donne davantage de détails que le dossier initial : elle cite une composante Afghani, une composante Thai et un apport Oaxacan pour Blueberry. Cette liste d’ascendances ne donne pas à elle seule les individus fondateurs et l’ordre complet des croisements. Pour sa Blue Dream, HSO annonce Blueberry × Super Silver Haze ; sa Blue Dream CBD est annoncée comme Blue Dream × California Orange CBD.'],
    ['La version DJ Short et les sélections Dutch Passion gardent leurs attributions et ne sont pas déclarées génétiquement identiques sans comparaison. De même, Blue Dream et Blue Dream CBD sont deux versions distinctes. Le Buddy CB Dream de Crop King possède une autre parenté annoncée dans sa fiche : la proximité des noms ne la fusionne pas avec Blue Dream.'],
    ['La source Dutch Passion est une présentation primaire commerciale ; les fiches et le catalogue HSO décrivent leurs propres matériels. Les composantes Afghani/Thai/Oaxacan peuvent donc être enseignées comme ascendances déclarées, tout en laissant inconnus les génotypes des fondateurs. La couleur ou une odeur fruitée ne permet pas de reconnaître ces parents ni de mesurer une concentration.']])
note(18,'Correction d’une lacune après lecture : Dutch Passion publie bien Afghani, Thai et Oaxacan dans sa page, absents du dossier initial. Ascendances ajoutées avec attribution, sans ordre de croisements inventé. Catalogue HSO 2017 et tableaux Cross ouverts.')
diagram(18,'comparison','Blueberry et deux versions HSO',[('Blueberry / Dutch Passion','Afghani, Thai et Oaxacan : composantes ancestrales annoncées.'),('Blue Dream / HSO','Blueberry × Super Silver Haze : croisement annoncé.'),('Blue Dream CBD / HSO','Blue Dream × California Orange CBD : croisement annoncé.')],'Les composantes ancestrales de Blueberry ne sont pas présentées comme trois parents directs simultanés.','botany-variety-blueberry botany-variety-hso-blue botany-variety-hso-cbd')
replace_sections(19,[
    ['Shantibaba revendique sa White Widow devenue Black Widow après le transfert de son matériel chez Mr. Nice, et évoque la Cannabis Cup de 1995. Il s’agit du récit de son détenteur, qui n’épuise pas les controverses sur la création historique. Trikoma décrit aujourd’hui une White Widow issue de ses propres mères conservées à Barcelone.'],
    ['Dans la présentation Shantibaba, l’ascendance est Brazilian Sativa × South Indian hybrid ; le tableau de la même page abrège la seconde composante en South Indian Indica. Cette différence de formulation ne permet pas de préciser tous les fondateurs. Trikoma annonce Widow Bilbo × Widow BCN pour sa propre version. Ces deux déclarations doivent être représentées séparément.'],
    ['White Widow et Black Widow sont reliées dans le récit de Shantibaba. La version Trikoma, White Widow CBD et Sweet and Sour Widow de CBD Crew conservent leurs dossiers et leurs obtenteurs. Une sélection supplémentaire ou l’introduction d’un caractère CBD ne transforme pas tous ces noms en synonymes.'],
    ['Les pages Shantibaba et Trikoma ont été ouvertes et leurs passages de génétique lus. Elles établissent ce que ces maisons déclarent, sans fournir ici une analyse comparative de tous les matériels. Les enquêtes génétiques sur les noms du commerce montrent l’intérêt de conserver le détenteur et l’échantillon ; elles ne prouvent pas que toute lignée commerciale soit incohérente.']])
note(19,'Deux versions réellement vérifiées et maintenues séparées. Ajout de la divergence interne South Indian hybrid/Indica de la page Shantibaba, sans résoudre artificiellement le parentage. Histoire et prix restent attribués.')
diagram(19,'comparison','Deux annonces White Widow',[('Shantibaba / Black Widow','Brazilian Sativa × South Indian hybrid dans le récit ; renommage White Widow → Black Widow annoncé.'),('Trikoma / White Widow','Widow Bilbo × Widow BCN ; mères conservées à Barcelone.'),('Comparaison ADN','Aucune identité entre les deux versions démontrée ici.')],'Les deux branches ne sont pas réunies en un pedigree unique.','botany-variety-black-widow botany-variety-trikoma')
replace_sections(20,[
    ['Le dossier initial attribue à Jigga un récit de sélection dans la scène californienne, publié par Jimi Devine dans Cannabis Now le 30 mars 2020. L’accès direct à cet entretien a renvoyé une erreur 403 pendant cette révision, y compris lors d’une seconde méthode de lecture. Les détails historiques restent donc des affirmations à revérifier dans le texte original.'],
    ['L’entretien est cité dans le dossier initial pour Girl Scout Cookies comme F1 Durban × Florida OG et pour une explication du nom F1 liée à la course automobile. Ces deux assertions ne sont pas déclarées relues ici. Indépendamment de ce cas, F1 désigne en génétique une première génération filiale issue de parents définis ; la présence des caractères F1 dans un nom propre n’en constitue pas une certification.'],
    ['Girl Scout Cookies, Thin Mint Cookies et les descendants portant Cookies doivent être distingués par sélection et détenteur. La page actuelle de Sherbinskis, effectivement ouverte, annonce Thin Mint Cookies et Sunset Sherbert dans la parenté de Gelato. Elle confirme une annonce de branche Gelato, sans vérifier à elle seule les fondateurs de toutes les Cookies.'],
    ['La fiche nécessite encore une relecture du témoignage Jigga avant validation de son histoire précise et de son explication du nom F1 Durban. Aucun arbre de parentage n’est construit à partir d’extraits du moteur de recherche. Le diagramme indique exactement quelle annonce dispose d’une page primaire ouverte et quelles assertions restent en attente.']])
add(20,2,'Cette annonce commerciale reste distincte d’un génotypage de Thin Mint Cookies ou d’un lot Girl Scout Cookies.','botany-gelato-sherbinskis-2026')
note(20,'Vrai blocage documentaire : entretien Cannabis Now inaccessible (403), aucune lecture d’extrait de moteur transformée en texte intégral. La déclaration actuelle Sherbinskis confirme la branche Gelato, mais ne suffit pas aux deux affirmations fondatrices Cookies.')
blocked[20]=['Relire l’entretien primaire Jigga du 30 mars 2020 pour confirmer F1 Durban × Florida OG et l’étymologie F1 ; accès direct 403.']
diagram(20,'evidence','Cookies : portée des pièces disponibles',[('Entretien Jigga 2020','Source primaire identifiée, texte non accessible pendant cette révision.'),('Parenté et nom F1 Durban','Assertions historiques à revérifier dans cet entretien.'),('Gelato / Sherbinskis','Thin Mint Cookies × Sunset Sherbert, annonce actuelle effectivement ouverte.')],'Ce diagramme n’est pas un arbre généalogique certifié et laisse les relations non relues en attente.','botany-gelato-sherbinskis-2026')
articles[21]['lead']='Gelato est une famille de sélections dont Sherbinskis annonce l’ascendance Sunset Sherbert × Thin Mint Cookies. Les sélections numérotées doivent conserver leur identité propre.'
replace_sections(21,[
    ['Le dossier initial cite un entretien de Sherbinski publié par Jimi Devine le 19 mai 2017 et situe le travail avec Jigga à San Francisco. La date approximative de 2014 y est déduite d’un intervalle de trois ans ; elle ne constitue pas une date de croisement exacte. Cet entretien n’a pas pu être ouvert directement pendant cette révision et sa chronologie reste à contre-vérifier.'],
    ['La page officielle actuelle de Sherbinskis, effectivement ouverte, publie Sunset Sherbert × Thin Mint Cookies. Cette annonce peut être conservée comme déclaration de la marque, indépendamment de l’accès manquant à l’entretien de 2017. L’ordre des noms n’est pas utilisé ici pour imposer une orientation maternelle valable pour toutes les sélections.'],
    ['La page Sherbinskis identifie notamment Bacio Gelato / #41 et plusieurs membres de sa famille Gelato. Les numéros sont des identifiants de sélections, pas des pourcentages ni des générations filiales. Les numéros 25 et 33 présents dans le récit initial devront être revérifiés dans une source primaire ouverte avant d’être présentés comme une liste historique complète.'],
    ['La parenté actuellement annoncée par Sherbinskis est documentée, sans analyse de parentage indépendante fournie. L’entretien de 2017 reste une source primaire identifiée mais non relue ; le dossier ne le qualifie plus de texte intégral consulté. Un lot simplement étiqueté Gelato sans numéro, détenteur et traçabilité ne permet pas de choisir un clone précis.']])
for sec in articles[21]['sections']: sec['sourceIds'].append('botany-gelato-sherbinskis-2026')
articles[21]['sourceIds'].append('botany-gelato-sherbinskis-2026')
note(21,'Parenté confirmée sur page officielle Sherbinskis ouverte ; Bacio #41 relu. Chronologie 2014, attribution détaillée et sélections historiques attendent l’entretien Cannabis Now inaccessible. Source nouvelle ajoutée, sans fausse lecture de la source ancienne.')
blocked[21]=['Récupérer l’entretien Sherbinski 2017 pour la chronologie et la liste historique des sélections ; page primaire 403. La parenté actuelle est confirmée séparément sur Sherbinskis.']
diagram(21,'evidence','Gelato : parenté annoncée, sélection précisée',[('Parenté de la marque','Sunset Sherbert × Thin Mint Cookies.'),('Exemple nommé','Bacio Gelato / #41 sur la page Sherbinskis.'),('Date du croisement','Vers 2014 selon le dossier initial ; entretien 2017 à relire.')],'Annonce de marque ouverte en 2026 ; aucune preuve ADN ni date exacte de création n’est déduite.','botany-gelato-sherbinskis-2026')
replace_sections(22,[
    ['Les hybrides CBD regroupent plusieurs programmes de sélection, et non une espèce ou une origine géographique unique. Resin Seeds publie une correction du pedigree de Cannatonic en novembre 2015. CBD Crew décrit séparément son programme CBD Therapy. La date de sortie fin 2015 donnée par le Buddy reste une information locale, non datée par la page commerciale courante.'],
    ['Resin Seeds remplace explicitement l’ancienne annonce MK-Ultra × G13 par Reina Madre × NYCD pour Cannatonic. La page CBD Therapy ne nomme pas ses parents précis ; elle revendique une origine dans des matériels récréatifs à THC plutôt que dans des chanvres industriels. Cette annonce ne permet pas de dessiner des parents inventés.'],
    ['Cannatonic, ACDC, Elektra et CBD Therapy gardent leurs histoires et leurs versions propres. La page CBD Crew reconnaît une variation de ratios CBD/THC entre descendants et des efforts pour stabiliser son matériel. Cette variabilité déclarée explique pourquoi le nom d’une semence ou de ses parents n’est pas un résultat d’analyse du lot obtenu.'],
    ['Le correctif Resin Seeds est une pièce primaire datée. La page CBD Crew est également lue, mais ses affirmations thérapeutiques et ses chiffres commerciaux ne sont pas des preuves d’efficacité clinique ni des garanties individuelles. L’absence de parents précis pour CBD Therapy est une lacune de pedigree explicitement représentée ; elle ne prouve pas l’existence d’un ancêtre commun à tous les hybrides CBD.']])
note(22,'Amélioration déterminante : la page CBD Crew est effectivement lisible et reconnaît des variations entre descendants ; la vieille limitation « contenu extrait limité » est corrigée. Parentés Cannatonic corrigées et attribuées ; aucun parent CBD Therapy inventé ni promesse médicale reprise.')
diagram(22,'comparison','Deux programmes CBD documentés',[('Cannatonic / Resin Seeds','Reina Madre × NYCD ; correctif publié en novembre 2015.'),('Ancienne annonce Cannatonic','MK-Ultra × G13, explicitement retirée par l’obtenteur.'),('CBD Therapy / CBD Crew','Parents précis non publiés sur la page lue ; variations entre descendants reconnues.')],'Les deux programmes ne partagent pas un ancêtre unique démontré ; CBD n’est pas une espèce.','botany-variety-cannatonic botany-variety-therapy')

# Failed references stay visible, but never count as sources actually read.
failures={
    'botany-diversity-introgression':'Page eLife : défi JavaScript ; contenu scientifique non ouvert. L’introgression est soutenue également par Nature 2025.',
    'botany-variety-sensi-history':'Timeout à plusieurs ouvertures de la rétrospective Sensi. Dates spécifiques non revérifiées.',
    'botany-variety-og-interview':'PDF LA Weekly dépasse la limite de taille de l’outil web (plus de 10 Mo) ; entretien non relu.',
    'botany-variety-cookies':'Accès direct Cannabis Now 403 ; essai web puis accès direct Python refusés.',
    'botany-variety-gelato':'Accès direct Cannabis Now 403 ; autre page primaire Sherbinskis ouverte pour la parenté actuelle.',
    'botany-variety-buddies':'Lien local présent dans le dossier affecté ; fiche de liaison conservée. Aucun accès supplémentaire aux fichiers partagés n’a été entrepris, conformément au périmètre de lecture.'}
for sid, reason in failures.items():
    sources[sid]['reviewEvidence']=[{'url':sources[sid]['url'],'sectionsOpened':[],
        'result':reason,'assertionsSupported':[],'status':'not-reverified'}]
    sources[sid]['limitation']=sources[sid].get('limitation','')+' Révision 14/11/2026 : '+reason
blocked[15]=['Repère Northern Lights de 1985 encore à vérifier dans la rétrospective Sensi inaccessible ; annonces de descendants bien lues.']
blocked[16]=['Lire l’entretien OG Kush / Josh D dans le PDF LA Weekly pour confirmer la transmission et le repère 1996 ; taille dépassant la limite web.']

for a in articles:
    for section in a['sections']:
        section['paragraphs']=[p.replace('capitَés','capités').replace('individus staminales','individus staminaux') for p in section['paragraphs']]

# Term-by-term editorial corrections; all other definitions were read and retained.
for t in data['terms']:
    if t['id']=='botany-haplotype':
        t['definition']='Combinaison de variants liés sur une même copie chromosomique, dans une région définie. Un individu diploïde peut porter deux haplotypes différents pour cette région.'
    elif t['id']=='botany-f2':
        t['definition']='Deuxième génération filiale obtenue par reproduction d’individus F1 entre eux ou, lorsque le système biologique le permet, par autofécondation. Les allèles et leurs associations peuvent y ségréger.'
    elif t['id']=='botany-germination':
        t['definition']='Reprise du développement de l’embryon, conduisant à l’émission de la radicule. L’observation d’une germination et l’évaluation d’une plantule normale dans un test de faculté germinative sont distinctes.'
    elif t['id']=='botany-clone':
        t['definition']='Descendance obtenue par multiplication végétative d’un individu, qui conserve en principe son génotype ; des mutations somatiques peuvent toutefois apparaître.'
        t['sourceIds']=['botany-diversity-schwabe','botany-diversity-phenotype']
    elif t['id']=='botany-selfing': t['sourceIds']=['bf-reproduction-2018']

# Corrections to unsupported quiz citations; IDs, levels, scoring and correct choices remain.
for qid, refs in {
    'hemp-genetics-clone':['botany-diversity-schwabe'],
    'hemp-genetics-mutation-clonale':['botany-diversity-schwabe'],
    'hemp-genetics-introgression':['botany-diversity-lynch2025'],
    'hemp-genetics-chromosomes-diploides':['bf-cfia-2021'],
}.items():
    q=copy.deepcopy(next(q for q in data['quiz'] if q['id']==qid))
    q['sourceIds']=refs
    quiz_patches.append({k:q[k] for k in ['id','prompt','options','answer','explanation','articleId','sourceIds']})

article_questions={
    0:['Qu’est-ce que Cannabis sativa et à quelle famille appartient-il ?','Comment relier feuilles, fibres, fruits et trichomes à leurs fonctions ?','Pourquoi une population férale n’est-elle pas nécessairement ancestrale ?'],
    1:['Comment les racines, le xylème et le phloème participent-ils au fonctionnement de la plante ?','Comment distinguer nœud, entre-nœud, pétiole, stipule et foliole ?','Quel processus fabrique des sucres dans les tissus verts ?'],
    2:['Où sont produits et reçus les grains de pollen ?','Pourquoi les deux filaments de la fleur ne sont-ils pas deux pistils ?','Comment distinguer bractée, périanthe, fruit et graine ?'],
    3:['Quels types de trichomes la plante porte-t-elle ?','Comment des cellules sécrétrices et des enzymes participent-elles à la production des métabolites ?','Pourquoi une couleur photographiée ne donne-t-elle pas une concentration chimique ?'],
    4:['Comment l’embryon devient-il une plantule ?','Pourquoi fleurs solitaires et inflorescences sont-elles deux étapes différentes ?','Pourquoi les pieds mâles et femelles peuvent-ils finir leur cycle à des moments différents ?'],
    5:['Quelle différence existe-t-il entre dioécie, monoécie et fleur bisexuée ?','Que se passe-t-il entre pollinisation et formation d’une graine ?','Comment distinguer constitution XX/XY et expression des fleurs ?'],
    6:['Quelle différence existe-t-il entre durée du jour, intensité et cumul lumineux ?','Quelles étapes florales peuvent répondre différemment à la photopériode ?','Pourquoi autofloraison, autofécondation et féminisation sont-elles distinctes ?'],
    7:['Quels rangs Kew attribue-t-il à Cannabis sativa ?','Pourquoi plusieurs traitements taxonomiques du genre existent-ils ?','Que montrent exactement les études des étiquettes sativa, indica et hybride ?'],
    8:['Qu’est-ce qu’une population locale cultivée ?','Qu’est-ce qu’une population férale ?','Que représentent une accession, un assemblage et un pangénome ?'],
    9:['Qu’est-ce qui définit un cultivar ?','Comment une descendance clonale peut-elle varier ?','Pourquoi homogénéité variétale et identité de tout l’ADN ne sont-elles pas synonymes ?'],
    10:['Comment distinguer allèle, génotype, haplotype et phénotype ?','Que signifient 2n = 20, F1 et F2 ?','Où sont décrits les gènes THCAS, CBDAS et CBCAS dans le pangénome ?'],
    11:['Pourquoi faut-il préciser le détenteur et la version d’un nom de lignée ?','Que documente la rectification du pedigree de Cannatonic ?','Pourquoi deux annonces White Widow ne doivent-elles pas être fusionnées ?'],
    12:['Quels organes, surfaces et pigments peut-on observer sur un cannabis ?','Quelles structures interviennent dans la reproduction, la dispersion et la dormance ?','Que signifient monotypique, cultivar, clone et le repère de précocité de Vega ?'],
    13:['À qui le récit McCormick attribue-t-il Original Haze ?','Comment distinguer ses composantes colombiennes, Super Silver Haze et Mango Haze ?'],
    14:['Quelle séquence d’ascendances le récit de Sam annonce-t-il pour Skunk #1 ?','Pourquoi les versions commerciales ne sont-elles pas interchangeables ?'],
    15:['Que documentent les mentions de NL5 dans Mango Haze et de Northern Lights dans SSH ?','Quels fondateurs et quel repère historique restent à vérifier ?'],
    16:['Quelle différence existe-t-il entre provenance Hindu Kush et parenté OG Kush CBD ?','Quels points historiques sur OG Kush restent à vérifier ?'],
    17:['Quelle parenté Soma annonce-t-il pour NYC Diesel ?','Pourquoi le nom NYCD dans Cannatonic ne suffit-il pas à identifier un lot Soma ?'],
    18:['Quelles composantes et quelle diffusion Dutch Passion annonce-t-il pour Blueberry ?','Comment distinguer Blue Dream et Blue Dream CBD chez HSO ?'],
    19:['Que revendique Shantibaba pour Black Widow ?','Quelle autre parenté Trikoma publie-t-il pour sa White Widow ?'],
    20:['Quelles assertions fondatrices Cookies attendent la relecture du témoignage Jigga ?','Quelle branche comprenant Thin Mint Cookies est actuellement annoncée par Sherbinskis ?'],
    21:['Quelle parenté Sherbinskis publie-t-il pour Gelato ?','Que désigne Bacio #41 et quels repères historiques restent à confirmer ?'],
    22:['Quelle correction Resin Seeds publie-t-il pour Cannatonic ?','Que sait-on et qu’ignore-t-on des parents et de la variabilité de CBD Therapy ?']
}

def write_batch(number, indices):
    entries=[]
    for i in indices:
        a=articles[i]
        refs=list(dict.fromkeys(a['sourceIds']+[r for s in a['sections'] for r in s['sourceIds']]))
        patch={k:copy.deepcopy(a[k]) for k in ['lead','sections','sourceIds','relatedArticleIds','glossaryIds','legacyPassages']}
        if 'facts' in a: patch['facts']=a['facts']
        if i in diagrams: patch['diagram']=diagrams[i]
        if a['image'].get('kind')=='photograph': patch['image']=a['image']
        else: patch['image']=None
        quizzes=[q['id'] for q in data['quiz'] if q['articleId']==a['id']]
        entries.append({'id':a['id'],'questions':article_questions[i],
            'fullyRead':True,'findings':findings.get(i,[]),'patch':patch,
            'sourceIdsReviewed':[s for s in refs if evidence.get(s)],
            'visual':{'status':'verified' if i not in blocked else 'reviewed-with-source-limitations',
                'notes':('Photo effectivement affichée et page d’origine/licence lues ; échelles et portée expérimentale décrites.' if a['image'].get('kind')=='photograph' else 'Planche de synthèse existante examinée, écartée comme preuve. Diagramme original contrôlé sur les passages sources ; chaque relation est décrite en texte, sans pedigree implicite.')},
            'quizIdsReviewed':quizzes, 'status':'blocked' if i in blocked else 'ready-for-integration','blockers':blocked.get(i,[])})
    term_ids={t['id'] for t in data['terms'] if t['articleId'] in [articles[i]['id'] for i in indices]}
    term_reviews=[{'id':t['id'],'definition':t['definition'],'sourceIds':t['sourceIds'],
        'findings':['Définition relue individuellement ; sens conservé, avec les limites de portée propres à la source.']} for t in data['terms'] if t['id'] in term_ids]
    wanted={s for e in entries for s in e['patch']['sourceIds']}
    wanted.update(s for t in term_reviews for s in t['sourceIds'])
    wanted.update(s for i in indices for s in diagrams.get(i,{}).get('sourceIds',[]))
    result={'domain':'botany','reviewedAt':'2026-11-14','sources':[sources[s] for s in sources if s in wanted],
        'articles':entries,'termReviews':term_reviews,
        'quizPatches':[q for q in quiz_patches if q['articleId'] in [articles[i]['id'] for i in indices]],
        'sensitivePoints':['Le coordinateur doit contre-vérifier les taxonomies et pedigrees attribués avant validation finale.']}
    (ROOT/'batches').mkdir(exist_ok=True)
    (ROOT/'batches'/f'botany-{number:02}.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

if __name__=='__main__':
    write_batch(1,range(0,6))
    write_batch(2,range(6,13))
    write_batch(3,range(13,18))
    write_batch(4,range(18,23))
