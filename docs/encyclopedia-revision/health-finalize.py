"""Final prose pass over the 28 notices; do not regenerate the original builder.

Reads current batches so coordinator changes to the three lessons survive.
"""
from pathlib import Path
import json,re,copy
ROOT=Path(__file__).parent
paths=sorted((ROOT/'batches').glob('health-*.json'))
batches=[json.loads(p.read_text(encoding='utf-8')) for p in paths]
articles=[a for b in batches for a in b['articles']]
original=json.loads((ROOT/'assignments/health.json').read_text(encoding='utf-8'))
assert len(articles)==31
assert [a['id'] for a in articles]==[a['id'] for a in original['articles']]
lessons_before=copy.deepcopy(articles[:3])

# Each row contains context, observed signs and management as connected prose.
# Detailed mechanisms/identification already written and verified are retained below.
PROSE={
3:(
'Tetranychus urticae est décrit sur le chanvre par NC State en Caroline du Nord. Les observations concernent des cultures de plein air ou sous abri ; elles établissent une association avec cette plante, sans mesurer sa fréquence en France ni prédire la gravité de chaque foyer.',
'Sur les feuilles, de nombreuses ponctuations pâles peuvent confluer en un jaunissement. Au revers, la présence d’acariens, d’œufs et parfois de fines toiles fournit des indices plus directs que la couleur de la feuille seule.',
'L’inspection des végétaux entrants et le suivi des feuilles déjà atteintes permettent de repérer une progression. Il faut documenter les acariens, les lésions et leurs prédateurs ensemble avant de décider d’une réponse adaptée ; la fiche chanvre de NC State n’établit pas de seuil d’intervention universel.'),
4:(
'Cet ériophyide est documenté sur Cannabis dans les ressources universitaires américaines. Les observations décrivent des foyers sous abri et au champ, mais plusieurs aspects du cycle restent mal connus ; ces documents ne constituent pas une enquête sur sa fréquence en France.',
'Les feuilles et les jeunes tissus peuvent présenter un bronzage ou des déformations, parfois discrets ; les inflorescences peuvent aussi être concernées. Aculops ne produit pas de toile : leur absence ne permet cependant pas, à elle seule, de le reconnaître.',
'La traçabilité des végétaux et de leurs déplacements aide à relier les premiers foyers aux introductions possibles. Une confirmation par observation grossie reste nécessaire avant d’attribuer une feuille enroulée à cet acarien ; un symptôme isolé ne justifie pas une réponse ciblée sur Aculops.'),
5:(
'Polyphagotarsonemus latus a été identifié sur le chanvre dans les collectes de Floride. La fiche de l’Utah présente le risque sans y annoncer de détection locale : un inventaire régional et une fiche de vigilance répondent à des questions différentes, et aucun des deux ne mesure la fréquence française.',
'L’observation porte surtout sur les bourgeons et les jeunes feuilles, qui peuvent se déformer, durcir ou se bronzer. Ces réponses de croissance ne sont pas spécifiques d’une espèce ; il faut rechercher les organismes sur les tissus concernés plutôt que déduire leur identité de la seule forme du limbe.',
'Inspecter le matériel entrant et localiser les premières zones atteintes permet de suivre l’évolution du foyer. Une identification de l’acarien est nécessaire pour choisir une réponse adaptée à la cible et au milieu ; la mention d’un risque dans une région ne vaut pas observation dans une autre.'),
6:(
'Thrips tabaci et Frankliniella occidentalis sont décrits sur le chanvre dans la fiche du New Hampshire. Les assemblages d’espèces et leur importance varient avec la région et les conditions de culture ; ces rapports ne donnent ni une fréquence française ni une gravité commune à tous les thrips.',
'Sur les feuilles et les jeunes pousses, les thrips peuvent laisser des cicatrices argentées et des ponctuations. De petits points fécaux sombres peuvent accompagner ces marques ; leur rapprochement avec des larves ou des adultes observés sur la plante aide à orienter l’identification.',
'La surveillance doit relier les captures éventuelles, les organismes présents sur le feuillage et les lésions qui progressent. Les végétaux entrants méritent aussi d’être examinés. Une capacité vectorielle connue chez un thrips ne prouve pas qu’un virus est présent dans la plante observée.'),
7:(
'Phorodon cannabis est décrit sur le chanvre par NC State et figure parmi les pucerons identifiés dans les collectes floridiennes. Ces observations étayent sa relation avec l’hôte, mais ne donnent pas une estimation de sa fréquence en France ni la preuve d’une transmission virale dans chaque colonie.',
'Les colonies se rencontrent sur les feuilles, les tiges et les inflorescences. Des exuvies claires, laissées par les mues, peuvent rester sur les tissus ; le miellat rend les surfaces collantes et peut s’accompagner de fumagine. Ces éléments indiquent une activité de pucerons, sans identifier à eux seuls l’espèce.',
'Le suivi associe les colonies, les symptômes et les ennemis naturels, afin d’apprécier leur évolution plutôt que la seule présence d’un insecte. La décision dépend de la progression et du contexte de culture ; toute intervention doit correspondre à un usage autorisé. Ni le miellat ni la fumagine ne suffisent à nommer le puceron.'),
8:(
'Myzus persicae est cité parmi les pucerons signalés sur chanvre dans la synthèse de NC State. L’inventaire floridien le mentionne à propos d’autres régions et ne le présente pas comme une nouvelle collecte locale ; les références ne fournissent ici ni enquête quantitative ni essai de nuisibilité propre à cette espèce sur chanvre.',
'Des pucerons sur les feuilles ou les jeunes pousses, du miellat et parfois un jaunissement peuvent orienter l’examen. Ces observations sont partagées avec d’autres pucerons : le nom courant « puceron vert » ne permet pas de déterminer Myzus persicae.',
'L’observation des colonies et du matériel entrant doit être accompagnée d’une vérification de l’espèce et des dégâts associés. Les auxiliaires identifiés font partie du suivi. La fiche ne désigne pas ce puceron comme l’espèce dominante des cultures françaises de chanvre.'),
9:(
'Trialeurodes vaporariorum est présenté parmi les ravageurs du chanvre sous abri dans le guide de Purdue, en Indiana. Il n’a pas été retrouvé sur cette plante dans l’inventaire floridien consulté ; cette différence entre échantillonnages n’établit pas son absence dans d’autres régions ou systèmes de culture.',
'L’examen du revers des feuilles peut révéler de petits adultes blancs et des stades immatures aplatis, fixés à la surface. Du miellat peut être présent. L’envol des adultes attire l’attention, mais les immatures peuvent rester sur la feuille sans être remarqués.',
'L’inspection des revers de feuilles et des végétaux introduits permet de suivre les stades présents. L’évolution du foyer doit être rapprochée des conditions de l’abri et de l’identité de l’aleurode avant une réponse encadrée ; la présence d’aleurodes ne prouve pas une virose.'),
10:(
'Bemisia tabaci a été identifié sur le chanvre dans l’inventaire floridien, où le matériel étudié a été rattaché à MEAM1. Cette observation locale ne détermine ni l’identité d’un aleurode trouvé en France ni son rôle éventuel dans la transmission d’un virus.',
'Sur les feuilles, des adultes blancs et des stades immatures fixés peuvent être accompagnés de miellat. Ces signes ne permettent pas de séparer les membres du complexe Bemisia tabaci ; ils doivent conduire à examiner les organismes plutôt qu’à attribuer directement une lignée cryptique.',
'La surveillance des introductions et la traçabilité des observations permettent de caractériser un foyer. Il faut faire préciser l’identité et les conditions locales avant d’en déduire une mesure ; les performances ou comportements d’une population ne se transfèrent pas automatiquement à toutes les autres.'),
11:(
'Les attaques d’Helicoverpa zea sur les inflorescences de chanvre sont documentées aux États-Unis. Leur importance varie avec les populations régionales et le débouché de la récolte ; ces observations ne constituent pas une confirmation de présence dans un site français.',
'Dans les inflorescences et les tissus voisins, une chenille, des morsures et des déjections peuvent être observées ensemble. Une blessure peut être suivie d’une pourriture, mais la consommation par une chenille et l’identification d’un microorganisme responsable de pourriture sont deux constats distincts.',
'Le suivi doit consigner les organes atteints et les organismes réellement associés aux lésions. Une observation américaine ne suffit pas à identifier un foyer européen ; de même, reconnaître la blessure initiale ne démontre pas qu’une matière ensuite pourrie est récupérable.'),
12:(
'Les références américaines décrivent le développement d’Ostrinia nubilalis dans des tiges de chanvre, avec des données historiques et des observations plus récentes encore limitées dans la synthèse de 2019. Les conséquences sur la récolte varient : une association connue avec la plante ne fournit pas un niveau actuel de risque pour une parcelle française.',
'Une galerie à l’intérieur d’une tige, parfois accompagnée de déjections, peut expliquer son affaiblissement. L’examen doit distinguer une lésion interne de simples morsures sur le feuillage ; la présence d’une galerie ne permet pas à elle seule d’identifier le foreur.',
'L’historique et les observations locales doivent être rapprochés avec les organismes de conseil. Il faut apprécier les dégâts effectifs sur le chanvre plutôt que transposer un calendrier établi sur maïs ; une galerie observée n’équivaut pas automatiquement à une perte économique mesurée.'),
13:(
'La fiche s’appuie sur des observations et une synthèse du Colorado décrivant Grapholita delineana sur chanvre. Elles documentent des organes attaqués et des traits biologiques, mais ne fixent ni sa phénologie en France ni un risque identique dans toutes les régions.',
'Les petites galeries peuvent concerner les tiges, la base des inflorescences et les structures portant les graines. Un renflement ou un flétrissement local peut rester discret ; l’emplacement précis de la lésion aide à relier la chenille au symptôme.',
'La traçabilité des végétaux et le suivi des signes localisés permettent de documenter le foyer. Une évaluation régionale reste nécessaire avant d’en tirer une réponse culturale ; certains hôtes et effets sur la récolte demeurent discutés dans la source, et aucun nombre de générations n’est valable partout.'),
14:(
'Le guide français du chanvre de 2026 décrit les adultes de Psylliodes attenuata et leurs morsures sur de jeunes plantes. Le signalement d’un ravageur ne signifie pas que toute présence entraîne une perte : l’importance dépend du stade et de l’étendue des dégâts.',
'Sur les cotylédons et les premières feuilles, de petites morsures ou perforations peuvent apparaître. Des coléoptères capables de sauter peuvent être observés à proximité ; les trous dans le limbe doivent être rapprochés de l’insecte et de ses caractères avant d’attribuer l’espèce.',
'Comparer les jeunes plantes atteintes et les zones indemnes permet d’apprécier la progression et la surface réellement consommée. Chaque perforation ne déclenche pas automatiquement une intervention ; la présente fiche ne fixe ni seuil d’action ni produit à employer.'),
15:(
'Le guide français du chanvre cite des limaces parmi les causes possibles de dégâts à la levée. Les termes « grise » et « noire » décrivent leur aspect, sans constituer des identifications d’espèce ; la source ne donne ici ni classement spécifique ni taux de perte universel.',
'Les plantules et les cotylédons peuvent présenter des tissus consommés, et des traces de mucus sont parfois visibles. La disparition d’une jeune plante doit être rapprochée de ces indices et des organismes observés, car plusieurs causes peuvent produire un manque dans le peuplement.',
'L’examen des bordures et de zones présentant des symptômes comparables aide à apprécier la pression réelle. Les protections physiques doivent être adaptées au contexte ; une couleur de limace ou une trace isolée ne permet ni d’identifier l’espèce ni de mesurer l’importance du foyer.'),
16:(
'Les colombidés et les corvidés sont cités comme consommateurs possibles de graines dans le guide français du chanvre. Leur présence dans le paysage ne suffit cependant pas à expliquer une levée irrégulière : il faut établir un lien avec une consommation observée ou des indices concordants.',
'Des graines manquantes ou consommées et des interruptions localisées du jeune peuplement peuvent être observées. Les traces et les oiseaux présents apportent du contexte, mais un pigeon posé près d’une parcelle n’est pas, à lui seul, une preuve de dommage.',
'Il faut documenter les épisodes et les espèces avec les acteurs locaux, puis examiner les protections ou moyens de dissuasion adaptés et autorisés. Les oiseaux remplissent aussi d’autres fonctions écologiques ; les règles dépendent de l’espèce et du lieu, et la fiche ne propose aucune destruction.'),
17:(
'Golovinomyces ambrosiae est documenté sur Cannabis dans des travaux nord-américains et dans les prélèvements tchèques étudiés en 2022 et 2023. La microscopie et les séquences sont interprétées ensemble ; cette documentation ne donne pas une prévalence française et les anciennes identifications au sens large demandent de la prudence.',
'L’oïdium se présente comme des colonies blanches poudreuses sur les feuilles et, selon les observations, sur d’autres tissus aériens. Ce signe de surface oriente vers un oïdium, mais plusieurs espèces peuvent produire un aspect comparable.',
'L’observation du matériel entrant et des premiers foyers permet de suivre la maladie. Faire préciser l’agent aide à interpréter les résultats publiés sur un oïdium donné ; la gestion de la plante et l’évaluation d’un produit atteint restent deux questions différentes.'),
18:(
'L’étude tchèque de 2024 rapporte Podosphaera macularis dans le prélèvement de chanvre de 2022, où deux types d’oïdiums ont été observés. La morphologie met en évidence la coexistence avec Golovinomyces ; les séquences du mélange ne donnent pas deux identifications moléculaires indépendantes complètes pour ce même prélèvement.',
'Sur les feuilles, les colonies poudreuses ressemblent à celles d’autres oïdiums. La photographie comparative montre une maladie attribuée à Podosphaera macularis sur houblon, un autre hôte : elle explique l’aspect poudreux sans représenter une observation sur chanvre ni permettre de déterminer l’agent sur une nouvelle plante.',
'La traçabilité des observations et des végétaux entrants aide à suivre l’origine et l’évolution des foyers. Il faut préciser l’agent avant de transférer un résultat obtenu sur un autre oïdium ou un autre hôte : le nom « oïdium » ne désigne pas un organisme unique.'),
19:(
'Botrytis cinerea est associé à des atteintes de tiges et d’inflorescences dans le guide français et dans l’étude canadienne de Punja et ses collègues. Ces références portent sur des systèmes de culture différents ; elles documentent l’agent sans transformer toute moisissure grise photographiée en diagnostic de Botrytis.',
'Les tissus peuvent brunir, flétrir et se dégrader, avec parfois un feutrage gris visible. Une atteinte peut commencer à l’intérieur d’une inflorescence : l’absence de sporulation extérieure n’exclut donc pas une lésion interne.',
'Le suivi porte sur les zones humides, le microclimat et l’intégrité des tissus, en conservant l’historique des foyers. La confirmation de la maladie végétale doit être distinguée de la décision sur une matière suspecte ; aucune méthode de récupération d’un produit atteint n’est proposée.'),
20:(
'Le guide français du chanvre décrit une sclérotiniose due à Sclerotinia sclerotiorum, avec lésions de tige, mycélium et sclérotes. La description aide à reconnaître un ensemble d’indices, sans fournir une fréquence nationale ni attribuer à cette espèce tout dépérissement.',
'Les tiges peuvent porter des lésions et un mycélium blanc, tandis que des sclérotes se forment dans ou sur les tissus. Le dépérissement de la plante est un symptôme ; les structures du champignon apportent des indices plus directs sur la nature de l’atteinte.',
'L’historique des foyers et des plantes hôtes aide à comprendre la persistance de l’inoculum, particulièrement dans les contextes humides favorables. Une évaluation agronomique et sanitaire reste nécessaire ; la blancheur d’un tissu ne suffit pas à nommer Sclerotinia.'),
21:(
'L’étude canadienne rapporte des Fusarium associés aux racines, au collet et à d’autres tissus de Cannabis. Des isolats de F. oxysporum et de F. solani ont reproduit des symptômes puis ont été réisolés ; cette preuve concerne le matériel testé, pas tous les membres du genre.',
'Les racines, le collet et les tiges peuvent présenter un brunissement ; la partie aérienne peut jaunir, ralentir sa croissance ou dépérir. Des atteintes d’inflorescences sont aussi décrites, mais aucun de ces symptômes ne permet à lui seul de reconnaître un Fusarium.',
'La traçabilité des milieux et des plantes, ainsi que les transferts entre foyers, doit être documentée avec l’état des racines et les blessures éventuelles. Une caractérisation de la cause est nécessaire : tous les Fusarium ne sont pas pathogènes dans toutes les situations, et un isolement ne signifie pas automatiquement un même niveau de risque.'),
22:(
'Plusieurs Pythium ont été isolés dans les systèmes canadiens étudiés sur Cannabis ; la fonte des plantules est aussi décrite dans le contexte français. La portée causale varie selon l’espèce et l’essai : la présence dans un tissu malade ne suffit pas à démontrer que l’organisme explique toutes les lésions.',
'Les plantules peuvent s’effondrer et les racines ou le collet brunir ; des plantes plus développées peuvent flétrir ou ralentir leur croissance. La photographie comparative montre une fonte attribuée à Pythium sur basilic : le syndrome illustre la vulnérabilité des jeunes plantes, sans identifier l’agent d’un chanvre présentant un aspect semblable.',
'L’examen associe les racines, l’eau, le milieu et l’historique des végétaux. Un diagnostic doit préciser l’agent plutôt que partir de la seule étiquette « fonte ». La mobilité dans l’eau et les structures de survie diffèrent entre oomycètes ; aucune mesure ne se déduit d’une ressemblance photographique ou du seul constat d’un milieu humide.'),
23:(
'Des rhizoctones sont rapportés dans le guide français du chanvre parmi les causes possibles d’atteinte racinaire et de dépérissement. Cette synthèse technique ne caractérise pas tous les isolats ni tous les groupes biologiques susceptibles d’être rencontrés en France.',
'Des pourritures des racines, du collet ou de la base des tiges peuvent s’accompagner d’un dépérissement. Ces symptômes ne sont pas spécifiques : ils doivent être confrontés à l’examen des tissus et aux autres causes possibles de dysfonctionnement racinaire.',
'L’historique du sol et des hôtes, ainsi que les déplacements de milieu ou de matériel végétal, aide à relier les observations. Une analyse du foyer peut préciser le niveau d’identification obtenu ; la fiche traite un groupe et ne détermine pas un isolat à partir d’un simple flétrissement.'),
24:(
'Beet curly top virus a été détecté dans des plantes de chanvre de deux champs de l’État de Washington. L’étude confirme des séquences de plusieurs souches et décrit un corpus comportant aussi d’autres agents ; elle n’établit pas sa présence sur un site français.',
'Des feuilles peuvent s’enrouler ou jaunir et la plante rester de petite taille. Ces manifestations, observées à différents stades, sont partagées avec d’autres infections et des troubles non infectieux ; elles ne constituent pas une signature photographique de BCTV.',
'Les observations et mouvements de végétaux doivent être documentés, sans attribuer à tout insecte le rôle de vecteur. Le diagnostic et l’épidémiologie demandent une expertise adaptée ; une série de plantes sélectionnées parce qu’elles sont malades ne mesure pas la prévalence de toutes les cultures, et un changement de climat ne prouve pas une guérison.'),
25:(
'Citrus yellow vein-associated virus a été retrouvé dans les échantillons de chanvre étudiés dans l’État de Washington, par séquences puis RT-PCR. Des co-infections étaient présentes : la note ne reproduit pas séparément une maladie du chanvre due à CYVaV seul et ne mesure pas sa prévalence en France.',
'Aucun symptôme exclusif du chanvre n’est attribué ici à cet agent. L’ensemble de la plante et les feuilles doivent être examinés, mais une déformation ou un jaunissement ne permet pas de nommer CYVaV sans recherche spécifique.',
'La traçabilité des plantes et la communication des observations au laboratoire permettent d’interpréter les résultats. Une présence moléculaire documentée ne fournit pas à elle seule une mesure ciblée ni l’explication de tous les symptômes ; les voies et leur importance relative sur chanvre restent à préciser.'),
26:(
'Des publications nord-américaines rapportent HLVd sur Cannabis. L’étude expérimentale de 2024 apporte des données d’infection, de déplacement dans la plante et de transmission à la descendance pour le matériel étudié ; elle ne mesure pas une prévalence française. Une série d’échantillons adressés à un laboratoire ne représente pas nécessairement toutes les cultures.',
'Un retard de croissance, des déformations ou des tiges fragiles peuvent être rapportés, mais une plante positive peut aussi ne montrer aucun symptôme apparent. Plusieurs tissus sont concernés ; la gravité ne se déduit donc pas d’une seule photographie ou d’un seul résultat positif.',
'La traçabilité sanitaire et la limitation des transferts entre végétaux suspects et autres lots permettent de suivre le problème. Un lot doit être confirmé et évalué dans un cadre professionnel ; la fiche ne propose pas de procédé de guérison et un résultat de laboratoire ne vaut ni mesure de gravité universelle ni prévalence nationale.'),
27:(
'Purdue décrit des coccinelles prédatrices parmi les ennemis naturels observés sur chanvre dans le centre-nord des États-Unis. Il s’agit d’observations d’interactions, pas d’une évaluation garantissant l’efficacité d’un achat ou d’un lâcher d’auxiliaires.',
'Les adultes et les larves allongées peuvent être vus sur le feuillage au voisinage des proies. Une prédation directement observée renseigne sur l’interaction ; la seule silhouette d’une larve ne permet pas de décider qu’elle est un ravageur.',
'Le suivi doit associer les proies et les auxiliaires identifiés, en évitant les interventions indifférenciées. La présence de coccinelles ne garantit pas que les dégâts sont suffisamment limités ; la fiche ne recommande ni lâcher ni introduction d’une espèce importée.'),
28:(
'La source du Colorado décrit Chrysopa oculata régulièrement observée près de colonies de pucerons sur chanvre. Cette association documente un auxiliaire possible, sans fournir un taux de contrôle ; elle ne donne pas le nom de toute chrysope présente dans une culture française.',
'Au voisinage des proies, les larves portent des mandibules courbes et les adultes ont des ailes parcourues de nombreuses nervures. Ces stades ne se ressemblent pas ; les œufs pédonculés sont un autre indice, sans permettre à eux seuls une identification d’espèce.',
'Les auxiliaires identifiés doivent être intégrés à l’observation du foyer avec leurs proies. Une présence naturelle ne garantit pas une régulation suffisante et ne prédit pas le succès d’un lâcher commercial ; le stade et les besoins alimentaires de l’espèce comptent.'),
29:(
'Les ressources universitaires américaines présentent des momies de pucerons et des orifices d’émergence sur chanvre comme indices d’activité de parasitoïdes. Ces observations ne désignent ni une espèce unique ni une efficacité commune à tous les hyménoptères parasitoïdes.',
'Dans une colonie, certains pucerons peuvent paraître gonflés et momifiés ; un orifice de sortie est parfois visible. La momie est le reste de l’hôte transformé au cours du développement du parasitoïde, et non l’adulte parasitoïde lui-même.',
'Il faut distinguer l’activité de parasitisme et la maîtrise effective de la colonie, en suivant aussi les pucerons vivants. Tous les petits insectes ne doivent pas être considérés indistinctement comme ravageurs ; une momie seule ne suffit pas à identifier précisément le parasitoïde ou à quantifier une régulation.'),
30:(
'Le guide de serre de Purdue décrit des acariens prédateurs utilisés contre des acariens phytophages, tout en soulignant le manque de résultats propres au chanvre pour certaines interactions, notamment avec Aculops. Les préférences alimentaires connues ne constituent pas une garantie d’efficacité dans un milieu différent.',
'De petits acariens mobiles peuvent être observés sur le feuillage près des proies. Le comportement apporte un indice, mais les caractères nécessitent un grossissement ; une vitesse de déplacement élevée n’est pas une identification suffisante d’un prédateur.',
'La reconnaissance de l’auxiliaire et de la proie doit précéder l’interprétation d’une interaction utile. Toute option de biocontrôle dépend de l’adéquation entre espèce, proie, température, humidité et cadre local ; la fiche ne prescrit aucun lâcher et ne généralise pas un résultat obtenu contre des tétranyques à tous les acariens.')
}

# Retain the detailed mechanisms while replacing the old disconnected cycle list.
CYCLE={
3:'Le développement comprend l’œuf, une larve à six pattes, puis des nymphes et l’adulte à huit pattes. Plusieurs générations peuvent se chevaucher ; la chaleur et l’air sec favorisent souvent la multiplication. Les végétaux porteurs et les déplacements entre plantes participent à la dispersion.',
4:'Les minuscules stades se développent sur l’hôte et peuvent être transportés avec des végétaux porteurs. Le vent peut contribuer à la dispersion entre plantes ; le cycle au champ et l’hivernation restent incomplètement décrits.',
5:'Le cycle comprend l’œuf, la larve, un stade de transition puis l’adulte ; les générations se succèdent selon les conditions du milieu. Des plantes porteuses participent à la dispersion, et la présence d’hôtes variés peut entretenir des foyers, notamment en milieu protégé.',
6:'Le cycle comporte des œufs, des larves actives, des stades préadultes et des adultes. Tous ne vivent pas au même endroit ; les adultes ailés et le transport de végétaux contribuent à la dispersion, avec une importance variable selon l’espèce et le milieu.',
7:'Les formes ailées favorisent la dispersion et des plantes porteuses peuvent déplacer les colonies. La reproduction et le stade hivernant varient avec la saison ; la présence durable d’un hôte et des conditions favorables peuvent permettre une augmentation rapide.',
8:'Les formes ailées peuvent voler entre hôtes et le transport de matériel végétal déplacer une colonie. Les modes de reproduction et les formes observées dépendent de la saison et du milieu ; les hôtes voisins font donc partie du contexte à documenter.',
9:'Le cycle passe de l’œuf à un premier stade immature mobile, puis à des stades fixés et enfin à l’adulte ailé. Les végétaux peuvent transporter les immatures, tandis que les adultes volent localement ; la continuité des plantes hôtes peut maintenir des populations sous abri.',
10:'Le développement comprend l’œuf, plusieurs stades immatures puis l’adulte ailé, avec des générations pouvant se chevaucher. La dispersion implique les adultes et les plantes porteuses ; les hôtes, le climat et le système de culture modifient la dynamique.',
11:'Le papillon pond des œufs dont sortent les chenilles ; celles-ci se transforment ensuite en chrysalides, puis en adultes ailés. Le vol des papillons et les plantes hôtes du paysage participent à la dynamique régionale ; les dégâts dépendent aussi de l’organe disponible.',
12:'Le cycle comprend l’œuf, la chenille, la chrysalide et le papillon. Les larves mûres peuvent passer l’hiver dans des résidus végétaux ; le déplacement des adultes et les matières porteuses participent à la dispersion.',
13:'D’abord exposée, la chenille pénètre ensuite dans des tissus ; les derniers stades peuvent hiverner dans des tiges ou des replis végétaux. Les adultes se déplacent en volant et les végétaux porteurs peuvent aussi transporter l’insecte ; le nombre de générations dépend du contexte régional.',
14:'Ce coléoptère possède une métamorphose complète, mais le guide français décrit surtout les adultes et leurs déplacements sur les jeunes plantes. Les conditions chaudes et sèches sont associées au contexte d’attaque observé ; elles ne suffisent pas à prédire l’intensité de chaque foyer.',
15:'Les limaces naissent d’œufs et accomplissent des cycles variables selon l’espèce, sans passer par les stades d’un insecte. Elles se déplacent au sol et peuvent être transportées accidentellement avec des matériaux ; les abris et l’humidité modifient leur activité.',
16:'Les cycles et déplacements dépendent de l’espèce d’oiseau. Des rassemblements locaux peuvent rencontrer des graines facilement accessibles ; leur présence doit être comprise dans le paysage et ne se résume pas à un rôle de ravageur.',
17:'Les spores aériennes et les végétaux infectés peuvent participer à la propagation. La disponibilité d’un hôte sensible et le microclimat interviennent ; les conditions favorables à un oïdium ne se réduisent pas à la présence visible d’eau sur la feuille.',
18:'Des spores et des tissus végétaux infectés participent à la propagation. Le développement dépend de la sensibilité de l’hôte et des conditions du milieu ; l’écologie de Podosphaera ne doit pas être assimilée automatiquement à celle d’un autre oïdium.',
19:'Les spores aériennes et les tissus colonisés peuvent entretenir un foyer. L’humectation, le microclimat, les blessures et l’état des tissus modifient les possibilités d’infection et de développement.',
20:'L’inoculum peut rester dans le milieu entre les cultures. L’histoire de la parcelle et les plantes hôtes aident à comprendre les reprises de maladie, dont les voies de dissémination et l’importance doivent être précisées localement.',
21:'Des propagules et des tissus colonisés peuvent persister puis alimenter de nouvelles infections. Le milieu, l’eau ou les végétaux porteurs participent aux transferts selon le système ; les espèces et les isolats n’ont pas tous la même biologie.',
22:'Ces agents sont des oomycètes, distincts des vrais champignons. Leurs structures de survie et de propagation varient ; l’eau, les milieux et les végétaux porteurs peuvent participer aux transferts selon l’espèce et le système.',
23:'La persistance peut impliquer du mycélium ou des structures de survie selon le taxon. Le contact avec un milieu porteur et les transferts de matières colonisées relient les infections possibles à l’historique du sol et des hôtes.',
24:'Le virus utilise les cellules de l’hôte pour se multiplier. Une transmission par vecteur est connue, mais le vecteur présent et sa contribution doivent être vérifiés dans la situation étudiée ; l’épidémiologie régionale et les infections multiples comptent.',
25:'Cet agent viral à ARN est détecté dans les tissus de chanvre, mais la note n’établit pas un cycle épidémiologique complet sur cette culture. Les voies de transmission et leur importance relative ne peuvent donc pas être déduites de la seule co-détection dans des plantes malades.',
26:'Le matériel végétal infecté et la transmission mécanique peuvent participer aux transferts. L’importance relative des voies doit être appréciée dans le contexte étudié, et l’expression des symptômes dépend de la plante et du milieu.',
27:'Le cycle passe par l’œuf, la larve, la nymphe et l’adulte. Les stades immatures se déplacent sur les plantes et les adultes peuvent voler ; la présence de ressources alimentaires et d’un habitat compatibles conditionne leur maintien.',
28:'Les larves se déplacent sur la végétation et les adultes peuvent voler. La présence de proies et les autres ressources nécessaires aux différents stades participent à leur maintien ; le régime des adultes varie selon l’espèce.',
29:'Les adultes se déplacent et recherchent un hôte compatible avec leur espèce et leur stade de développement. Les parasitoïdes de pucerons et ceux d’aleurodes ne sont pas interchangeables : une ressemblance de cycle ne suffit pas à définir la cible.',
30:'Le cycle comprend l’œuf, les stades immatures et l’adulte. Les déplacements entre tissus ou plantes, la disponibilité des proies et les conditions de température et d’humidité influencent le maintien de chaque espèce.'
}

# Pair the primary biological reference with diagnostic reasoning only where needed.
MAIN={
3:['health-atlas-tetranychus'],4:['health-new-aculops-ncsu','health-atlas-aculops'],5:['health-atlas-broad-mite'],
6:['health-atlas-thrips-unh'],7:['health-atlas-aphids'],8:['health-atlas-aphids'],9:['health-atlas-purdue-greenhouse'],
10:['health-atlas-bemisia-name','health-atlas-florida-2023'],11:['health-atlas-cranshaw-2019','health-atlas-thrips-unh'],
12:['health-atlas-ostrinia'],13:['health-atlas-grapholita'],14:['health-atlas-hemp-france'],15:['health-atlas-hemp-france'],16:['health-atlas-hemp-france'],
17:['health-atlas-powdery-2024','health-atlas-punja-2019'],18:['health-atlas-powdery-2024'],19:['health-atlas-punja-2019'],20:['health-atlas-hemp-france'],
21:['health-atlas-punja-2019'],22:['health-atlas-punja-2019','health-lesson-oomycetes'],23:['health-atlas-hemp-france'],
24:['health-atlas-viruses-wa-2023'],25:['health-atlas-viruses-wa-2023'],26:['health-new-hlvd-2024','health-new-hlvd-pnw'],
27:['health-atlas-beneficial-purdue'],28:['health-atlas-lacewings-csu','health-atlas-beneficial-purdue'],29:['health-atlas-beneficial-purdue'],30:['health-atlas-purdue-greenhouse']}
CONTEXT={5:['health-atlas-florida-2023','health-atlas-broad-mite'],7:['health-atlas-aphids','health-atlas-florida-2023'],8:['health-atlas-aphids','health-atlas-florida-2023'],9:['health-atlas-purdue-greenhouse','health-atlas-florida-2023'],17:['health-atlas-powdery-2024'],19:['health-atlas-hemp-france','health-atlas-punja-2019']}
LEADS={
3:'Tetranychus urticae est un acarien phytophage qui peut vivre sur le chanvre. Sa couleur et ses deux taches sombres ne suffisent pas toujours à l’identifier : le stade et les autres caractères comptent.',
4:'Aculops cannibicola, aussi publié sous le nom A. cannabicola, est un minuscule acarien ériophyide associé au chanvre. Il porte deux paires de pattes aux stades mobiles et ne produit pas de toile.',
5:'Polyphagotarsonemus latus est un acarien tarsonémide polyphage, signalé notamment sur chanvre. Il peut déformer les tissus jeunes, mais ce symptôme ne suffit pas à le reconnaître.',
6:'Plusieurs thrips peuvent se nourrir du chanvre, dont Thrips tabaci et Frankliniella occidentalis. Les cicatrices sur le feuillage orientent l’observation sans identifier à elles seules l’espèce.',
7:'Phorodon cannabis est un puceron qui prélève de la sève sur le chanvre. Les colonies peuvent produire du miellat et présenter des formes ailées ou aptères, dont les caractères doivent être examinés pour identifier l’espèce.',
8:'Myzus persicae, le puceron vert du pêcher, est polyphage et a été signalé sur chanvre. Le nom de son hôte habituel ne restreint pas toutes ses associations, et sa couleur ne suffit pas à le distinguer des autres pucerons.',
9:'Trialeurodes vaporariorum est l’aleurode des serres, décrit parmi les ravageurs du chanvre sous abri. Il faut distinguer ses adultes ailés des stades immatures fixés au revers des feuilles.',
10:'Bemisia tabaci désigne un complexe d’aleurodes cryptiques comprenant des populations signalées sur chanvre. L’identification du complexe et celle d’une lignée en son sein demandent des niveaux d’examen différents.',
11:'Helicoverpa zea est un papillon dont la chenille peut consommer des inflorescences et des structures portant les graines du chanvre. Les attaques documentées aux États-Unis ne constituent pas un diagnostic local en Europe.',
12:'Ostrinia nubilalis, la pyrale du maïs, peut aussi se développer dans des tiges de chanvre. La chenille creuse des galeries qui peuvent fragiliser la tige, avec des conséquences variables selon la situation.',
13:'Grapholita delineana est un papillon de la famille des Tortricidae dont les chenilles peuvent attaquer les bourgeons et les tiges de chanvre. Une atteinte localisée peut être discrète et nécessite l’examen de l’insecte et des tissus.',
14:'Psylliodes attenuata est un coléoptère appelé altise du chanvre. Les adultes peuvent perforer les cotylédons et les premières feuilles ; reconnaître l’insecte et apprécier les dégâts sont deux étapes distinctes.',
15:'Les limaces sont des mollusques gastéropodes qui peuvent consommer les tissus tendres du chanvre à la levée. Plusieurs espèces sont possibles, sans pouvoir les nommer à partir de la seule couleur.',
16:'Des oiseaux granivores, notamment des colombidés et des corvidés, peuvent consommer des graines de chanvre. Leur présence doit être reliée à des indices de consommation avant d’expliquer un manque dans le peuplement.',
17:'Golovinomyces ambrosiae est l’un des agents d’oïdium documentés sur Cannabis. Les anciennes identifications au sens large et la présence d’autres oïdiums imposent de distinguer le dépôt poudreux visible de l’identité précise du champignon.',
18:'Podosphaera macularis est un champignon d’oïdium connu sur houblon et documenté séparément sur chanvre. Une photographie d’un autre hôte illustre l’aspect poudreux, sans identifier l’agent d’une feuille de Cannabis.',
19:'Botrytis cinerea est un agent de pourriture grise documenté sur Cannabis. Le brunissement et la sporulation orientent l’examen, mais toute moisissure grise n’est pas automatiquement Botrytis.',
20:'Sclerotinia sclerotiorum est un champignon pouvant provoquer une sclérotiniose du chanvre. Ses sclérotes sont des structures de survie du champignon, distinctes des graines et des œufs d’insectes.',
21:'Des Fusarium, dont les groupes F. oxysporum et F. solani, sont associés à des maladies de Cannabis. Ces noms recouvrent des ensembles complexes dont le pouvoir pathogène ne se déduit pas de la couleur d’une colonie.',
22:'Des oomycètes nommés Pythium ou Globisporangium selon les classifications sont associés à certaines fontes et pourritures racinaires du chanvre. Ils sont distincts des vrais champignons et ne s’identifient pas à partir du seul flétrissement.',
23:'Le terme rhizoctone recouvre plusieurs taxons, dont le complexe Rhizoctonia solani. Des atteintes racinaires sont rapportées sur chanvre, mais le groupe et l’isolat doivent être précisés avant d’attribuer un risque particulier.',
24:'Beet curly top virus, ou BCTV, a été détecté sur chanvre dans l’État de Washington. L’étude distingue plusieurs souches et confronte les symptômes aux résultats moléculaires, sans fournir une fréquence française.',
25:'Citrus yellow vein-associated virus, ou CYVaV, a été détecté dans des tissus de chanvre. Son nom ne limite pas les détections aux agrumes, et sa présence ne démontre pas à elle seule sa contribution aux symptômes d’une plante co-infectée.',
26:'Hop latent viroid, abrégé HLVd ou HpLVd, est un viroïde infectant Cannabis. Ce petit ARN circulaire n’est ni un virus ni un champignon ; sa détection et la gravité des symptômes sont deux informations différentes.',
27:'Certaines coccinelles de la famille des Coccinellidae consomment des pucerons présents sur chanvre. La famille possède des régimes variés : cette fiche concerne les espèces prédatrices et leur rôle possible d’auxiliaires.',
28:'Les larves de chrysopes de la famille des Chrysopidae peuvent chasser des pucerons sur chanvre. Chrysopa oculata est l’exemple observé au Colorado ; ce nom ne désigne pas toutes les chrysopes présentes en France.',
29:'Plusieurs hyménoptères parasitoïdes se développent aux dépens de pucerons présents sur chanvre. Une momie indique une activité possible de parasitisme, sans déterminer à elle seule l’espèce de parasitoïde ni l’efficacité de la régulation.',
30:'Les Phytoseiidae comprennent des acariens prédateurs, dont Phytoseiulus et Neoseiulus, susceptibles de consommer des acariens phytophages. Leurs régimes diffèrent : un prédateur de tétranyques n’est pas automatiquement adapté à tous les autres acariens.'}
for i in range(3,31):
    a=articles[i];sections={s['id']:s for s in a['patch']['sections']}
    a['patch']['lead']=LEADS[i]
    ctx,signs,manage=PROSE[i]
    sections['context']['paragraphs']=[ctx]
    sections['signs']['paragraphs']=[signs]
    # Last paragraphs are the substantive, individually authored explanations.
    mechanism=sections['biology']['paragraphs'][-1]
    identification=sections['identification']['paragraphs'][-1]
    sections['biology']['paragraphs']=[CYCLE[i],mechanism]
    sections['identification']['paragraphs']=[identification]
    sections['management']['paragraphs']=[manage]
    sections['context']['sourceIds']=CONTEXT.get(i,MAIN[i])
    sections['signs']['sourceIds']=MAIN[i]
    sections['biology']['sourceIds']=MAIN[i]
    sections['identification']['sourceIds']=list(dict.fromkeys(MAIN[i]+['health-atlas-diagnostic']))
    sections['management']['sourceIds']=['health-atlas-diagnostic']+MAIN[i][:1]
    if i==4:sections['identification']['sourceIds']=['health-atlas-aculops-name','health-new-aculops-ncsu','health-atlas-diagnostic']
    if i==22:sections['identification']['sourceIds']=['health-atlas-pythium-name','health-atlas-punja-2019','health-atlas-diagnostic']
    if i==26:sections['biology']['sourceIds']=['health-atlas-viroids-ictv','health-new-hlvd-2024','health-new-hlvd-pnw']
    a['patch']['sourceIds']=list(dict.fromkeys(a['patch']['sourceIds']+[sid for sec in sections.values() for sid in sec['sourceIds']]))
    # Each of these section references was actually opened during the specialist
    # review. Inaccessible legacy references remain outside this list.
    a['sourceIdsReviewed']=list(dict.fromkeys(a['sourceIdsReviewed']+[sid for sec in sections.values() for sid in sec['sourceIds']]))
    a['findings'].append('Finition éditoriale : les cinq sections ont été reformulées en paragraphes naturels ; répétitions réduites et références réparties selon les assertions de chaque section.')

# The old identification explanation sometimes already includes a biological
# description; each remains in its appropriate section without retaining lists.
IDENTIFICATION_LEAD={
3:'Les thrips, d’autres acariens et des stress physiologiques peuvent aussi produire des ponctuations. Observer plusieurs feuilles à la loupe, puis faire préciser les caractères si nécessaire, évite de conclure à partir d’une seule tache.',
5:'Des déformations comparables peuvent accompagner d’autres acariens ou des troubles non parasitaires ; la concordance entre organismes, tissus jeunes et progression est donc essentielle.',
6:'Des ponctuations dues à des acariens ou à un stress peuvent ressembler à certains dégâts de thrips ; les cicatrices, déjections et insectes doivent être examinés ensemble.',
7:'L’observation microscopique permet de distinguer le puceron du chanvre de formes proches, plutôt que de retenir le nom d’espèce à partir du miellat ou de la fumagine.',
8:'Des Phorodon et d’autres pucerons peuvent se rencontrer sur les mêmes tissus ; le jaunissement et le miellat ne les séparent pas.',
9:'D’autres aleurodes, dont Bemisia, et des dépôts clairs peuvent prêter à confusion ; examiner plusieurs stades sur le revers des feuilles.',
10:'Il faut distinguer l’identification du complexe Bemisia tabaci de celle d’une lignée à l’intérieur de ce complexe.',
11:'Plusieurs chenilles consomment des fleurs ou des graines ; une blessure peut également être colonisée secondairement par des microorganismes.',
12:'D’autres foreurs, dont Grapholita, peuvent produire des lésions internes ; des troubles de tige non parasitaires peuvent aussi provoquer un flétrissement.',
13:'Les autres chenilles foreuses et les lésions sans insecte doivent être envisagées ; la galerie seule ne nomme pas la tordeuse.',
14:'D’autres insectes peuvent perforer de jeunes feuilles ; l’identification de l’adulte est plus précise qu’une attribution fondée sur la forme d’un trou.',
15:'D’autres organismes et des défauts de levée peuvent provoquer des manques : chercher les animaux et les indices associés à la consommation.',
16:'La qualité des semences, l’état du sol et d’autres consommateurs peuvent aussi expliquer des manques ; ces hypothèses se confrontent aux observations.',
17:'D’autres oïdiums et des dépôts non biologiques peuvent donner un aspect blanc ; les caractères microscopiques et les séquences précisent l’hypothèse.',
18:'La présence de Golovinomyces ou d’un dépôt non biologique fait partie des hypothèses à comparer ; rechercher un mélange si les structures et les séquences divergent.',
19:'Autres pourritures, vieillissement et blessures de chenilles peuvent produire des aspects voisins ; l’examen des tissus et des isolats permet de les distinguer.',
20:'D’autres pourritures blanches ou dépérissements peuvent ressembler au syndrome décrit ; observer la structure et sa position dans les tissus.',
21:'Des oomycètes, d’autres agents racinaires et l’asphyxie non infectieuse peuvent produire des symptômes voisins.',
22:'Des Fusarium, d’autres pourritures racinaires et le manque d’oxygène autour des racines doivent aussi être envisagés.',
23:'La recherche doit aussi considérer Fusarium, les oomycètes et les causes physiologiques de dysfonctionnement racinaire.',
24:'Autres infections, dégâts d’acariens et troubles abiotiques font partie du diagnostic différentiel ; PCR et séquences doivent être interprétées avec le contexte.',
25:'La RT-PCR et le séquençage répondent à une recherche spécifique ; il faut aussi étudier les autres explications compatibles avec les symptômes.',
26:'Des stress et d’autres infections peuvent expliquer les mêmes retards ou déformations : une attribution automatique à HLVd n’est pas un diagnostic.',
27:'La détermination du groupe, et si nécessaire de l’espèce, doit être associée au comportement observé ; toute coccinelle n’a pas le même régime.',
28:'D’autres larves prédatrices peuvent ressembler à une chrysope ; le stade et les caractères observés doivent guider la détermination.',
29:'Des exuvies, des pucerons desséchés et d’autres agents peuvent produire des restes trompeurs ; l’examen de la momie et de l’adulte émergé précise l’interprétation.',
30:'Les acariens phytophages et prédateurs doivent être déterminés séparément, puis leur interaction observée plutôt que supposée.'}
for i,text in IDENTIFICATION_LEAD.items():
    sec=next(s for s in articles[i]['patch']['sections'] if s['id']=='identification')
    sec['paragraphs'].insert(0,text)

manifest=json.loads((ROOT/'health-media-manifest.json').read_text(encoding='utf-8'))
for index,name,alt,caption,notes in [
(18,'podosphaera-hop.jpg','Feuilles de houblon couvertes de nombreuses plages blanches poudreuses.',
'Oïdium du houblon attribué à Podosphaera macularis, David Gent/USDA Agricultural Research Service, Bugwood 5393947, CC BY 3.0. Autre hôte : Humulus lupulus, pas Cannabis. L’aspect poudreux est comparable, mais ne sépare pas à lui seul les espèces d’oïdium du chanvre.',
'Page Commons ouverte, auteur et licence CC BY 3.0 lus ; photo locale examinée : feuilles de houblon avec plages poudreuses. Illustration comparative explicitement sur un autre hôte. La détermination publiée n’est pas transposée à toute plage blanche sur chanvre.'),
(22,'pythium-basil.jpg','Pot de jeunes basilics comportant des plantules vertes et des plantules effondrées ou mortes.',
'Fonte de semis de basilic attribuée à Pythium, Roswitha Ulrich/Pflanzenschutzdienst, CC BY-SA 4.0 ; permission confirmée par Wikimedia VRT. Autre hôte : Ocimum basilicum, pas Cannabis. Le symptôme illustre une fonte et ne suffit pas à identifier l’agent d’une plantule de chanvre.',
'Page Commons et licence CC BY-SA 4.0 ouvertes ; auteur service de protection des plantes et permission VRT 2024091110008277 vérifiés. Photo locale examinée : basilics au stade plantule, plusieurs effondrés. Identification de Pythium attribuée à la documentation ; pas d’espèce ou de test non documenté inventé.')]:
    m=next(x for x in manifest if Path(x['src']).name==name)
    m.update(imageViewed=True,viewedAt='2026-11-14',sourcePageRead='Commons file page, original imageinfo.extmetadata API, licence and permission notices')
    a=articles[index]
    a['patch']['image']={**{k:m[k] for k in ('src','author','sourceUrl','license','licenseUrl')},'kind':'photograph','alt':alt,'caption':caption}
    a['visual']={'status':'verified','notes':notes}
    a['status']='ready-for-integration';a['blockers']=[]
    a['findings'].append('Blocage photographique levé : photographie documentaire identifiée et commercialement réutilisable sur un autre hôte, explicitement légendé sans transfert de diagnostic.')

# Correct typography in notices and their image descriptions, keeping identifiers,
# URLs, scientific spellings and the three coordinator-reviewed lessons intact.
def typography(text):
    text=re.sub(r'(?<=[A-Za-zÀ-ÿ])(20\d{2})\b',r' \1',text)
    text=re.sub(r'\b(figure|panneau|Bugwood|septembre|novembre|Arnhem)(\d)',r'\1 \2',text,flags=re.I)
    text=re.sub(r'\b(CC BY(?:-SA)?)(\d)',r'\1 \2',text)
    text=re.sub(r'(et al\.)(?=20\d{2})',r'\1 ',text)
    text=re.sub(r'(?<=\d)(?=×)', ' ',text)
    return text
for a in articles[3:]:
    p=a['patch']
    p['lead']=typography(p['lead'])
    for s in p['sections']:s['paragraphs']=[typography(t) for t in s['paragraphs']]
    for visual in (p.get('image',{}),p.get('diagram',{})):
        for k in ('alt','caption','title'):
            if k in visual:visual[k]=typography(visual[k])
        for n in visual.get('nodes',[]):
            n['label']=typography(n['label']);n['detail']=typography(n['detail'])

assert articles[:3]==lessons_before
# Only image-credit typography changes in the otherwise untouched lessons.
for a in articles[:3]:
    if a['patch'].get('image'):
        a['patch']['image']['caption']=typography(a['patch']['image'].get('caption',''))
        a['visual']['notes']=typography(a['visual']['notes'])
assert all(a['status']=='ready-for-integration' for a in articles)
for a,old in zip(articles,original['articles']):
    assert [s['id'] for s in a['patch']['sections']]==[s['id'] for s in old['sections']]
    assert set(a['patch']['sourceIds'])>=set(s for sec in a['patch']['sections'] for s in sec['sourceIds'])
    if a['patch'].get('image'):assert (ROOT.parents[1]/('public'+a['patch']['image']['src'])).exists()
for p,b in zip(paths,batches):p.write_text(json.dumps(b,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(ROOT/'health-media-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
checkpoint=json.loads((ROOT/'health-checkpoint.json').read_text(encoding='utf-8'))
checkpoint['coverage'].update(readyForIntegration=31,blocked=0)
checkpoint['blockers']=[]
checkpoint['resolvedPhotoBlockers']=[{'articleId':articles[i]['id'],'image':articles[i]['patch']['image'],'notes':articles[i]['visual']['notes']} for i in (18,22)]
checkpoint['checks'].append('Finition des 28 notices : paragraphes naturels, mécanismes conservés, références distribuées par section ; trois grands articles strictement préservés.')
checkpoint['next']='Contrelecture finale du coordinateur sur les 28 notices et les deux images comparatives. Lots stables ; ne pas régénérer health-review.py, qui représente une étape antérieure.'
(ROOT/'health-checkpoint.json').write_text(json.dumps(checkpoint,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('28 notices rédigées ; 3 grands articles préservés ; 31 ready, 0 blocage photographique.')
