import fs from 'node:fs';
import crypto from 'node:crypto';
const dir='docs/quiz-2000';
const batch=JSON.parse(fs.readFileSync(`${dir}/batches/r-actives-b-01.json`,'utf8'));
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const byId=new Map(batch.sources.map(s=>[s.id,s]));
const reading={
 'q2-rb01-livingston20':['Discussion et Figure 8 ; résultats, Figure 5','Texte original Wiley ouvert. Le modèle fait dériver les glandes pédonculées de précurseurs d’aspect sessile ; profil floral dominé par les monoterpènes.'],
 'q2-rb01-spitzer19':['Results: Growth and Development Under Long Photoperiod ; Plant and Inflorescence Architecture, Figures 2 et 5–6','Texte original Frontiers ouvert. Les trois cultivars ont des fleurs solitaires sous jours longs ; les unités de l’inflorescence ont des feuilles réduites.'],
 'q2-rb01-lipson21':['Discussion, trois premiers paragraphes ; résultats terpénoïdes, Figures 5–6','Texte intégral PMC ouvert. Baisse générale des cannabinoïdes après fécondation, profils relatifs principalement conservés, réponses des sesquiterpénoïdes diverses.'],
 'q2-rb01-punja20':['Discussion, pollen germination ; PCR and Sequence Analysis ; Figure 10D–F','Texte original Frontiers ouvert. Pollen d’inflorescences hermaphrodites germé et descendants étudiés portant le profil PCR femelle. Pas de généralisation à tous les croisements.'],
 'q2-rb01-punja23':['Abstract: Results et Conclusion ; Resin exudation from trichomes and senescence ; Figures 8–12','Texte original Springer ouvert. Stades asynchrones, gouttes adhésives et agrégats de têtes, sénescence et altérations après récolte sont décrits.'],
 'q2-rb01-hesami23':['Results: Flower development, avant Figure 9 ; Discussion','Texte original MDPI ouvert. Le suivi White Widow décrit des glandes avant l’allongement des stigmates et une évolution blanc-jaune vers brun rougeâtre.'],
 'q2-rb01-conneely21':['Abstract ; Figure 1B et 1D ; Discussion et modèle Figure 8','Texte intégral PMC ouvert. Fluorescence chlorophyllienne dans le pédoncule et les cellules de soutien, absente du disque. Apport floral de sucres présenté comme modèle suggéré.'],
 'q2-rb01-allen26':['Abstract ; §1.4–1.5 ; Discussion §3.1 et §3.3','Texte intégral PMC ouvert. THCAS et CBDAS sont des gènes distincts liés ; locus de type supergène à recombinaison réduite ; enzymes testées surtout productrices de CBCA.'],
 'q2-rb01-alberti25':['Abstract ; Introduction §1.3–1.4 ; passages trichome density alone et frosty appearance','Synthèse originale PMC ouverte. Recommande les bractées comme unité cohérente ; densité seule insuffisante pour prédire les teneurs ; aspect givré lié aux glandes.'],
 'q2-rb01-salamone22':['Introduction, paragraphes chimotypes et témoins ; tableau 1 ; Results and Discussion, premier paragraphe','Texte original MDPI ouvert. Type IV à dominante CBG, type V largement dépourvu de cannabinoïdes mais traces mesurées ; intérêt sensoriel de témoins pauvres en cannabinoïdes.'],
 'q2-rb01-steel23':['Florogenesis ; Figure 4 et paragraphes précédents','Synthèse originale Frontiers ouverte. Le modèle de florogenèse distingue l’induction solitaire, la formation des groupes et la transition du méristème apical en fleur terminale.'],
 'q2-rb01-livingston22':['Abstract PubMed, extrait indexé ; phrases cytoplasmic bridges et final step ... cell-surface wall facing the extracellular storage cavity','L’ouverture directe PubMed ne restitue pas le résumé. Recherche du titre exact et du PMID : extrait original PubMed effectivement lu, confirmant ponts cytoplasmiques et étape THCA extracellulaire. Aucune lecture intégrale revendiquée.'],
 'q2-rb01-stack23':['Results: Increasing concentrations of CBDA and CBGA in artificial diet decreased larval growth and survival ; Discussion','Texte intégral PMC ouvert. Bioessais sur alimentation artificielle isolent la contribution du CBDA/CBGA : baisse de croissance et de survie larvaires.']
};
const changes={
 'glandes-monoterpenes':'Fait soutenu et réellement actif, mais topicId doit être molecules (thème affiché « Arômes et terpènes »), et non evidence (« Cannabinoïdes »). Ne pas changer le fait pour cette correction.',
 'fecondation-sesquiterpenes':'Fait soutenu et délimité à cet essai. Corriger topicId en molecules : la propriété testée concerne les sesquiterpénoïdes, pas les cannabinoïdes.',
 'pollen-hermaphrodite-fonctionnel':'Conserver le fait, refaire les quatre choix : trois réponses commencent par Non et une seule par Oui ; deux négations absolues servent d’indices. Proposer quatre observations reproductrices de même nature. Niveau 2 recommandé : viabilité observée de ce pollen, qui n’est pas rendue accessible par la brièveté du oui/non.',
 'descendance-hermaphrodite-femelle':'Fait soutenu, mais passer au niveau 2 et adapter difficultyRationale. Le sexe génétique d’une descendance issue de ces inflorescences demande un résultat spécialisé ou un raisonnement génétique ; les réponses courtes ne justifient pas le niveau 1. Maintenir la restriction à la descendance effectivement étudiée.',
 'glandes-maturation-asynchrone':'Conserver le fait ; refaire prompt/choix sans une seule option Non nuancée face à trois Oui absolus. Demander l’organisation des stades observés avec quatre organisations plausibles. Le résultat doit rester l’asynchronie des glandes, pas le simple rejet de nécessairement/toujours/exactement.',
 'gouttes-resine-tetes-collees':'Soutien source précis. Refaire les distracteurs : exclusivement, toujours et systématiquement les rendent éliminables sans connaître les glandes. Comparer quatre conséquences physiques plausibles des sécrétions ; aucune méthode de manipulation ou d’extraction.',
 'glandes-fragilite-manipulation':'Conserver la fragilité des têtes après récolte, mais refaire les choix : trois Non, dont deux absolus, face à un seul Oui détaillé. Tester l’altération précise observée par quatre évolutions anatomiques plausibles, pas la proposition générale qu’une manipulation peut abîmer un objet.',
 'fleur-apport-sucres-glandes':'Le modèle et sa réserve sont correctement rapportés. Remplacer pollen extérieur et graines mûres par de vrais tissus sources candidats plausibles ; les trois distracteurs actuels sont trop éloignés du trajet carboné étudié. Garder explicitement le statut de modèle suggéré.',
 'oxidocyclases-cbca':'Source exacte, mais le rappel « trois oxidocyclases nouvellement caractérisées dans Allen 2026 » est un résultat isolé difficile à relier à une connaissance utile sans lire l’article. Remplacer ou reformuler autour d’une conséquence cannabinoïde intelligible de cette caractérisation, avec les enzymes/branches précisées ; ne pas simplement demander de mémoriser CBCA pour trois enzymes anonymes.',
 'densite-glandes-pas-dosage':'Conserver la limite entre aspect résineux et teneur mesurée. Refaire les choix : une seule réponse Non nuancée face à trois Oui conditionnels donne la réponse prudente. Quatre explications positives de même nature doivent tester les propriétés des glandes qui empêchent l’équivalence.',
 'sans-cannabinoides-autres-phenols':'Le fait des témoins sensoriels de cannabis est recevable. Refaire les distracteurs : remplacer la randomisation, supprimer l’analyse et garantir seul la sécurité sont trois objectifs méthodologiques manifestement incorrects. Comparer quatre rôles plausibles d’une préparation témoin ou quatre propriétés sensorielles/chimiques comparables.',
 'fleur-terminale-meristeme':'Remplacer : l’énoncé annonce la formation d’une fleur terminale, et la réponse dit que l’extrémité devient cette fleur. L’explication définit ensuite un méristème de façon générale. Le cannabis n’est pas nécessaire pour résoudre ce fait ; choisir une propriété réellement spécifique de sa florogenèse et non une inversion de cette définition.'
};
const notes={
 'glande-sessile-precurseur':'Développement glandulaire floral distinct de la simple morphologie pédonculée déjà présente dans l’index.',
 'fleurs-solitaires-jours-longs':'Distinction biologique utile entre fleurs solitaires et inflorescence compacte, bornée aux trois cultivars observés ; aucun réglage de culture proposé.',
 'petites-feuilles-florales':'Morphologie concrète d’une inflorescence résineuse ; les quatre états de feuilles sont comparables.',
 'fecondation-concentrations':'Relation fécondation/composition des fleurs, sous forme qualitative délimitée ; aucun protocole d’augmentation de production.',
 'fecondation-rapports':'Proportions cannabinoïdes distinctes de leur concentration après fécondation ; source et portée concordent.',
 'glandes-brunes-senescence':'Observation anatomique liée à la sénescence des glandes, sans en faire un indicateur universel de récolte.',
 'stigmates-brun-rouge':'Évolution visible d’organes floraux dans le cultivar suivi ; explication distingue stigmates et glandes.',
 'glandes-avant-stigmates':'Ordre de mise en place des glandes de la bractée effectivement décrit avant l’allongement des stigmates.',
 'disque-secreteur-sans-chlorophylle':'Compartimentation propre aux glandes résineuses observées ; source et absence de fluorescence sont correctement délimitées.',
 'thcas-cbdas-genes-distincts':'Organisation de gènes déterminant directement le profil THC/CBD ; distinct de la localisation chromosomique déjà testée.',
 'locus-b-recombinaison-reduite':'Le fait vise l’architecture du locus cannabinoïde B et la transmission des chimotypes, pas une définition générale de recombinaison.',
 'bractees-unite-comparaison':'La recommandation propre aux structures florales riches en cannabinoïdes est attribuée aux auteurs de la synthèse.',
 'chimotype-iv-cbg':'Identification claire d’une classe chimique CBG dominante ; distincte des profils variétaux commerciaux et du type V.',
 'chimotype-v-traces':'Définition correctement nuancée ; traces acides du matériel étudié concordantes avec le texte.',
 'aspect-givre-glandes':'Vocabulaire concret de l’aspect résineux des fleurs ; aucune teneur déduite de l’aspect.',
 'supercellule-ponts':'Organisation spécialisée des cellules sécrétrices soutenue par le résumé original indexé ; niveau 3 approprié.',
 'thca-synthese-extracellulaire':'Localisation de l’étape finale de THCA distincte du stockage sous-cuticulaire déjà testé ; résumé original suffisant et accès limité déclaré.',
 'cannabinoides-defense-directe':'Bioessai artificiel isolant l’action des cannabinoïdes, distinct de la comparaison de génotypes sur feuilles déjà présente dans a-01.'
};
const items=batch.questions.map(question=>{
 const key=question.id.replace('hemp-q2-rb01-','');
 const status=changes[key]?'changes_requested':'approved';
 if(!changes[key]&&!notes[key]) throw new Error('Missing explicit reading decision '+key);
 const domainComment=key==='fleur-terminale-meristeme'?
   'Candidat active à remplacer : le fait actuel est une définition tautologique de botanique générale.':
   /chimotype|thcas|locus-b|oxidocyclases|cannabinoides-defense|thca-synthese/.test(key)?
   'Le fait concerne directement un profil, une synthèse, une transmission ou une fonction des cannabinoïdes.':
   'Le fait porte sur les glandes résineuses, leur fonctionnement ou l’anatomie des fleurs productrices d’actifs.';
 return {id:question.id,status,domain:'active',domainComment,
   comment:changes[key]||notes[key],contentHash:sha(question),
   sourceChecks:question.sourceIds.map(sourceId=>{
     const source=byId.get(sourceId); const [locator,result]=reading[sourceId]||[];
     if(!source||!result)throw new Error('Unread source '+sourceId);
     return {sourceId,url:source.url,locator,result,sourceHash:sha(source)};
   })};
});
const report={batchId:batch.batchId,reviewer:'rebalance_products_sol',reviewedAt:'2026-11-17',items,
 summary:{readQuestions:items.length,approved:items.filter(x=>x.status==='approved').length,changesRequested:items.filter(x=>x.status==='changes_requested').length,rejected:0,
  sourcesRead:batch.sources.length,fullTextSources:12,excerptSources:1,
  method:'Lecture des 30 objets complets, de leurs quatre options, explications et preuves ; ouverture des 13 sources, puis recherche des passages cités. Hashes Node natif de JSON.stringify des objets réellement lus.',
  sourceLimitations:'Livingston 2022 : ouverture PubMed directe incomplète, résumé original obtenu par recherche titre/PMID ; source explicitement excerpt. Les autres passages sont dans les textes intégralement accessibles. Les résultats expérimentaux restent délimités aux matériels et essais décrits.',
  scope:'Le lot contient des connaissances réellement liées aux fleurs résineuses et cannabinoïdes. Item 26 insuffisant en l’état. Un noyau de questions très centrées sur les résultats de publications doit être équilibré par des sujets plus largement connus dans les lots suivants, sans abaisser artificiellement les niveaux.',
  difficulty:'Niveau 2 demandé explicitement pour les items 8 et 9 ; les niveaux 1 acceptés visent des observations concrètes et qualitatives. Un prompt court ne suffit pas à déterminer le niveau.',
  duplicateCheck:{index:'docs/quiz-2000/fact-index.jsonl',searched:['trichome','sessile','chimotype','chemotype','hermaphrodite','fécondation','pollinisation','terminal','densité','givre','supercellule','XX'],
    nearNeighbours:[
      {id:'hemp-en-1-13',resolution:'Morphologie tête/pied déjà testée ; rb01-1 vise le stade de développement qui précède.'},
      {id:'hemp-q2-c-trichomes-disques-cellules',resolution:'Nombre de cellules déjà testé ; rb01-2 vise le profil terpénique.'},
      {id:'hemp-q2-c-trichome-cavite-sous-cuticule',resolution:'Stockage déjà testé ; rb01-29 vise le lieu d’une réaction terminale de biosynthèse.'},
      {id:'hemp-q2-cn02-hermaphrodite-flower-male-female-organs-same-flower',resolution:'Définition d’une fleur hermaphrodite déjà testée ; rb01-8/9 visent viabilité du pollen et descendance réellement observées.'},
      {id:'hemp-q2-a01-csp1-femelles-monoeciques',resolution:'Marqueur et phénotype d’individus parentaux ; rb01-9 concerne une descendance issue d’inflorescences déterminées.'},
      {id:'hemp-q2-a01-chimotype-rapport-versus-total',resolution:'Pouvoir explicatif d’un groupe de marqueurs ; rb01-6 concerne un changement physiologique après fécondation.'},
      {id:'hemp-q2-a01-cbd-feuilles-herbivorie',resolution:'Comparaison de génotypes sur feuilles ; rb01-30 utilise un régime artificiel pour isoler une contribution directe de cannabinoïdes.'}
    ],conclusion:'Aucun doublon exact de fait établi ; aucune ancienne leçon générale exclue réintroduite comme nouvel ajout approuvé.'},
  sourceIdentityNotes:[
    {sourceId:'q2-rb01-livingston20',sameUrlHistoricalId:'q2-c-livingston-trichomes-2020',note:'Nouvelle consultation et passages documentés ; pas de redéfinition du même ID. Harmonisation éventuelle non bloquante selon le coordinateur.'},
    {sourceId:'q2-rb01-hesami23',sameUrlHistoricalId:'q2-c-hesami-morphology-2023',note:'Même publication ; source exacte fournie lue et hashée pour cette revue.'},
    {sourceId:'q2-rb01-stack23',sameUrlHistoricalId:'q2-a01-stack-herbivores',note:'Même publication ; passage régime artificiel différent de la question historique sur feuilles.'}
  ]}};
fs.writeFileSync(`${dir}/reviews/r-actives-b-01.json`,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report.summary));
