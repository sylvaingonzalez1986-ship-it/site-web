import fs from 'node:fs';
import crypto from 'node:crypto';

const base='docs/quiz-2000';
const batch=JSON.parse(fs.readFileSync(`${base}/batches/r-actives-b-03.json`,'utf8'));
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const sourceById=new Map(batch.sources.map(s=>[s.id,s]));
const readings={
 smith22:['Résultats THC-dominant and high-CBD Cannabis ; Commercial labels ; Discussion','Article PLOS original ouvert. Types I/II/III explicités ; plusieurs profils terpèniques chez les THC dominants ; faible séparation Indica/Hybrid/Sativa ; variabilité des produits partageant un nom.'],
 livingston20:['Introduction, premier paragraphe','Original Wiley ouvert : abondance glandulaire sur fleurs femelles et rareté sur fleurs mâles, explicitement liées à leurs usages.'],
 gagalova24:['Abstract ; Introduction, paragraphes pigmentation et drug-type ; Results','Accès PMC limité par un contrôle navigateur ; même article original intégral effectivement ouvert chez Wiley, DOI 10.1002/pld3.70016. Anthocyanes et pigmentation rouge/pourpre soutenues ; étude de cannabis à actifs.', 'https://onlinelibrary.wiley.com/doi/full/10.1002/pld3.70016'],
 demeijer03:['Résumé p. 335 ; modèle de ségrégation des chimotypes','Copie du papier Genetics original ouverte. F1 toutes mixtes CBD-THC et ségrégation F2 compatible avec 1:2:1 explicitement rapportées. Modèle moléculaire historique non universalisé.'],
 allen26:['§2.13 Clade B2 Pseudogenes ; métadonnées des auteurs','Original PMC ouvert. Copies proches de CBDAS dans des cultivars THC avec décalages et arrêts, sans cadre de lecture intact. Métadonnées : Reginald Gaudino, et non Ryan Gaudino.'],
 namdar18:['Résumé p. 376 ; résultats sur la position des inflorescences','PDF original hébergé par Colorado State University ouvert. Les quantités de cannabinoïdes et terpénoïdes diminuent globalement des inflorescences hautes vers les basses dans les plantes étudiées.'],
 gysin:['Room 3, PDF p. 8, passage Toklas et Kif Notes','Guide original de l’exposition IAC ouvert. Livre hybride souvenirs/cuisine de Toklas, et contribution au haschisch attribuée à Gysin. Aucun contenu de recette repris.'],
 times:['Ownership note, deux paragraphes','Notice Wellcome ouverte. L’annonce du Times du 24 juillet 1967 appelle à la réforme et à l’usage privé ; financement attribué à Paul McCartney et signatures des autres Beatles.'],
 weeds:['Extrait indexé du synopsis officiel Lionsgate, About Weeds Season 2','Ouverture directe sans texte ; extrait officiel ciblé effectivement lu : Nancy Botwin apprend à vendre de la marijuana après la mort de son mari. Accès excerpt exact ; aucune lecture intégrale ou visionnage revendiqué.'],
 disjointed:['Synopsis du Netflix Media Center','Synopsis original Netflix ouvert. Kathy Bates incarne une militante devenue propriétaire d’un dispensaire dans la région de Los Angeles.'],
 maintenance:['Extrait indexé About High Maintenance, synopsis HBO','Ouverture directe refusée 403 ; extrait officiel de cette URL effectivement retrouvé et lu. The Guy est un livreur de cannabis reliant les histoires de New-Yorkais. Accès excerpt exact.'],
 arte:['Entretien PDF p. 4 ; portraits PDF p. 5 ; présentation PDF p. 23','Magazine ARTE original ouvert. Borleteau souligne l’absence de point de vue policier ; portraits et synopsis centrés sur les personnages et leur entourage pris dans le trafic, France/Espagne.'],
 friday:['Synopsis Friday (1995), paragraphes 1–3','Compte rendu original du suivi de production American Humane ouvert. Smokey a consommé plus de marijuana qu’il n’en a vendu et Big Worm réclame son argent.'],
 pineapple:['ABOUT','Synopsis original Sony ouvert. Seth Rogen est décrit comme consommateur, James Franco comme son dealer, dans cette comédie d’action.'],
 nice:['Synopsis PDF p. 5 ; entretien Bernard Rose PDF p. 6','Dossier de presse original du distributeur ouvert. Howard Marks est la figure racontée et Bernard Rose explique l’adaptation de son autobiographie.'],
 norml:['Mission statement ; A Voice for Responsible Marijuana Consumers','Page originale de l’association ouverte. Mission déclarée : légalisation de l’usage adulte responsable et défense des consommateurs. Ce discours est identifié comme position militante.'],
 hightimes:['Passages High Times, pro-pot magazine ; Starting High Times Magazine','Témoignage original de Keith Stroup ouvert. Magazine pro-cannabis, couverture du travail de NORML et place dans le mouvement de légalisation effectivement décrites.'],
 ginsberg:['Titre de dossier et Cite Item, Box 44 Folder 101','Notice institutionnelle NLM ouverte. Titre The great marijuana hoax explicitement associé à Ginsberg, Allen. Aucun argument médical du texte n’est validé par cette simple notice.'],
 shafer:['Key Reports and Studies, C. The Shafer Commission – 1972','Analyse parlementaire originale ouverte au passage ciblé. Dépénalisation de l’usage personnel privé recommandée ; légalisation alors rejetée ; possession publique restant saisissable.'],
 laguardia:['Sociological study, tea-pad PDF p. 11 ; Conclusions, point 10, PDF p. 22','Copie intégrale du rapport historique ouverte. Tea-pad défini comme pièce/appartement pour fumer ensemble ; conclusion 10 : cannabis non déterminant dans les crimes graves. Constats historiques situés, pas conclusion actuelle générale.'],
 ludlow:['Description de l’édition critique','Notice originale Rutgers ouverte. Ludlow rapporte ses propres visions, expériences et réflexions liées au haschisch ; ouvrage situé dans la littérature des drogues, pas étude clinique.'],
 dumas:['Chapitre XXXVIII, paragraphes Et alors Franz raconta... et Il s’appesantit...','Texte littéraire original ouvert : Franz raconte à Albert la grotte, le souper et le hachisch. La graphie du texte est hachisch, ce qui explique l’absence de résultat à la recherche haschisch.'],
 benjamin:['Premier paragraphe et deux suivants','Compte rendu universitaire original H-Net ouvert. Douze protocoles d’expériences, deux textes publiés et fragments réunis dans On Hashish ; description de la composition du livre soutenue.'],
 freak:['Extrait indexé du site officiel, The Show Old','Accès direct refusé 402 ; extrait officiel effectivement lu : BD de Gilbert Shelton, satire de contre-culture et place centrale de la marijuana. Accès excerpt exact.']
};

const comments=[
 'Classification I/II/III soutenue et distincte des types IV/V déjà présents ; proportions cannabinoïdes, pas concentration fixe.',
 'Comparaison glandulaire femelles/mâles soutenue ; distincte du simple lieu de sécrétion ou de l’aspect givré des fleurs.',
 'Hors périmètre : le fait teste seulement la famille générale des pigments rouges/pourpres, à partir d’une étude de pigmentation foliaire. Les plantes à actifs de l’étude ne suffisent pas à rendre ce rappel active. Remplacer par un vrai fait floral/produit avec preuve adaptée, sans simplement renommer les feuilles en fleurs.',
 'Fait soutenu ; reprendre les distracteurs. Trois réponses attribuent une classification chimique exacte ou fixe, face à la seule réponse nuancée. Proposer des interprétations commerciales/chimiques concurrentes réellement plausibles, sans trois affirmations absolues.',
 'Fait soutenu ; reprendre les distracteurs. Invariant, concentration imposée et toujours distinct sont trois garanties absolues face à la seule réponse prudente. Garder la variabilité des produits de même nom, avec des propositions de portée comparable.',
 'Diversité terpénique au sein du groupe THC dominant soutenue ; distincte de l’identité des types THC/CBD et de la validité des noms commerciaux.',
 'Profil mixte des F1 soutenu et situé dans l’étude ; aucun protocole de croisement ni modèle moléculaire historique présenté comme actuel.',
 'Doublon du fait de ségrégation F2 1:2:1 déjà exploité par hemp-q2-ext-f2-rapport-mixte, approuvé (50 % de profils mixtes). Réordonner le rapport ne crée pas un fait distinct. Remplacer, ou arbitrage explicite du coordinateur entre les deux objets avant toute approbation.',
 'Fait sur les pseudogènes soutenu. Corriger l’auteur de la source q2-rb03-allen26 : l’original porte Reginald Gaudino, pas Ryan Gaudino. Nouvelle empreinte de source requise après correction.',
 'Résultat soutenu, mais préciser dans l’énoncé ce que sont les teneurs : cannabinoïdes et terpénoïdes. La question actuelle ne nomme aucune substance mesurée ; conserver la portée aux plantes de Namdar.',
 'Le guide décrit explicitement le livre comme souvenirs/cuisine. Repère d’histoire du cannabis, sans recette ni fabrication.',
 'Attribution à Gysin soutenue ; fait distinct de la nature du livre de Toklas, même récit commun à limiter au tirage.',
 'Objet politique de l’annonce attesté par la notice d’archives ; pas de règle actuelle déduite de la mobilisation de 1967.',
 'Financement attribué à McCartney attesté ; distinct de l’objet de l’annonce et non déduit de la simple liste des signatures.',
 'Point de départ narratif soutenu par l’extrait officiel Lionsgate ; accès incomplet honnêtement déclaré et vérifié.',
 'Cadre du dispensaire attesté dans le synopsis officiel ; choix de lieux comparables, aucune pratique réelle inférée de la fiction.',
 'Rôle de livreur et fonction narrative soutenus par l’extrait HBO ; la lecture ne revendique pas de visionnage.',
 'Entretien et portraits officiels soutiennent le point de vue sur les personnages du trafic ; fait de fiction correctement distingué d’un constat sociologique.',
 'Origine de la dette de Smokey explicitement décrite ; quatre explications narratives comparables.',
 'Relation consommateur/dealer soutenue dans le synopsis du distributeur ; pas d’affirmation sur une variété commerciale nommée Pineapple Express.',
 'Identité de Howard Marks et adaptation autobiographique soutenues ; quatre noms de figures du cannabis plausibles.',
 'Mission soutenue ; rééquilibrer les choix en quatre causes associatives plausibles. L’attribution des licences fédérales et la coordination policière ne sont pas des missions plausibles pour l’association annoncée dans l’énoncé.',
 'Rôle médiatique du magazine soutenu par un témoignage identifié ; quatre types de publication distinguables, sans validation scientifique des opinions du témoin.',
 'Auteur et titre soutenus par la notice d’archives ; les quatre choix appartiennent à la Beat Generation.',
 'Orientation historique soutenue et distincte d’une légalisation commerciale ; recommandation non confondue avec loi adoptée.',
 'Conclusion historique précisément soutenue au point 10, sans généralisation aux risques actuels ni prétention de causalité universelle.',
 'Définition du lieu social soutenue dans le rapport original ; pas de détail pratique de commerce reproduit.',
 'Nature personnelle du récit soutenue par la notice éditoriale universitaire ; ne transforme pas les visions racontées en observation clinique.',
 'Le passage original confirme roman, personnages, souper et hachisch. Les quatre romans sont bien des œuvres de Dumas.',
 'Composition du recueil soutenue par la recension universitaire ; genre intellectuel distinct d’une enquête statistique ou d’un roman.',
 'Repère de BD cannabique soutenu par l’extrait du site officiel. L’objet testé est l’œuvre, sans propriété réelle du cannabis déduite de ses aventures.'
];
const changeIndices=new Set([2,3,4,7,8,9,21]);
const items=batch.questions.map((q,i)=>({id:q.id,status:changeIndices.has(i)?'changes_requested':'approved',domain:i===2?null:'active',
 domainComment:i===2?'Hors périmètre : identification générale d’une famille de pigments foliaires ; aucune propriété propre des fleurs ou produits à actifs n’est testée.':i<10?'Le fait porte sur profils cannabinoïdes, glandes ou caractères des cannabis à actifs ; les généralités non liées à ces objets ne sont pas testées.':'Repère culturel, littéraire, associatif ou historique directement lié aux usages et représentations du cannabis psychoactif.',
 comment:comments[i],contentHash:hash(q),
 sourceChecks:q.sourceIds.map(id=>{
   const s=sourceById.get(id); if(!s)throw Error(id);
   const key=id.replace('q2-rb03-',''); const read=readings[key]; if(!read)throw Error(key);
   return {sourceId:id,url:s.url,locator:read[0],result:read[1],sourceHash:hash(s),...(read[2]?{actualReadUrl:read[2]}:{})};
 })}));
const review={batchId:batch.batchId,reviewer:'rebalance_products_sol',reviewedAt:'2026-11-17',items,
 summary:{questions:items.length,approved:items.filter(i=>i.status==='approved').length,changes_requested:items.filter(i=>i.status==='changes_requested').length,sourcesRead:24},
 neighbourAudit:{index:'docs/quiz-2000/fact-index.jsonl',
   searched:['chimotype','I II III','indica/sativa','même nom','terpènes','femelles/mâles','anthocyanes','violet','pseudogènes','F2','Toklas','Gysin','Beatles','Times','McCartney','Weeds','Disjointed','High Maintenance','Friday','Pineapple Express','Howard Marks','NORML','High Times','Ginsberg','Shafer','LaGuardia','tea-pad','Ludlow','Monte-Cristo','Benjamin','Freak Brothers'],
   openedNeighbours:['hemp-q2-ext-f2-rapport-mixte','hemp-q2-b04-seriotica-leaves-flowers-colour','hemp-q2-rb01-stigmates-brun-rouge'],
   exactDuplicate:{candidate:'hemp-q2-rb03-f2-segregation-profils',existing:'hemp-q2-ext-f2-rapport-mixte',reason:'Même ségrégation F2 1:2:1, autre lecture de sa part mixte.'}},
 sourceAccessNotes:['Les trois notices excerpt (Lionsgate, HBO, Freak Brothers) ont été recherchées et effectivement lues comme extraits officiels ; pas comme textes intégraux.','Gagalova : URL PMC soumise à contrôle navigateur lors de la revue ; même article primaire intégral lu chez Wiley et URL de lecture alternative consignée dans sourceChecks.'],
 safeguards:['Chaque question, ses quatre choix et son explication ont été lus.','Empreintes calculées sur JSON.stringify des objets complets, sans réécriture du lot auteur.','Aucune question du reviewer approuvée par cette revue.']};
if(items.length!==31||new Set(items.map(i=>i.id)).size!==31)throw Error('count');
fs.writeFileSync(`${base}/reviews/r-actives-b-03.json`,JSON.stringify(review,null,2)+'\n');
console.log(JSON.stringify(review.summary));
