import fs from 'node:fs';
import crypto from 'node:crypto';
const base='docs/quiz-2000/';
const b=JSON.parse(fs.readFileSync(base+'batches/r-actives-a-02.json','utf8'));
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const requests={
3:'Voie fécale et explication confirmées. Ajouter la voie urinaire parmi les choix : c’est l’alternative réellement pertinente à distinguer. Les larmes face aux selles, sans urine, rendent cette question trop facile à éliminer pour un fait de pharmacocinétique niveau2.',
4:'Fait de dissociation concentration/effets confirmé. Remplacer la conversion complète du THC en CBD, fantaisiste. Comparer quatre évolutions temporelles plausibles des effets et de la concentration.',
8:'Résultat humain confirmé, niveau2 recevable. Le prompt appelle oui/non mais les réponses commencent par des constats nominaux ; préférer « Quel résultat ... ? ». Rééquilibrer la seule absence d’atténuation face à trois protections : comparer quatre conclusions expérimentales formulées de façon parallèle, sans effet garanti à chaque condition.',
9:'Doublon de fait de hemp-molecules-skunk-thiol, déjà approuvé et dont l’objet complet a été relu : même question sur la famille donnant la note skunk, même réponse thiols prénylés, même étude2021. L’attribution à Oswald ne crée pas de propriété nouvelle. Remplacer par un fait distinct ou retirer ; ne pas inverser famille/molécule car hemp-en-2-14 teste déjà le thiol précis.',
12:'Doublon du registre olfactif de hemp-molecules-caryophyllene-arome déjà approuvé (boisé et épicé), dont l’objet complet a été relu. La précision girofle appartient au même fait d’identification de l’arôme du bêta-caryophyllène ; elle ne crée pas une propriété distincte. Remplacer ou retirer, sans renverser la question.',
18:'Portée historique de l’annulation correctement bornée et soutenue. Les choix portent sur fleurs, mineurs, conduite et médicaments ; le dernier n’est même pas une interdiction. Comparer quatre interdictions commerciales plausibles dans le contentieux CBD, pour que la réponse ne soit pas la seule relevant de l’objet annoncé.',
22:'Condition de six mois confirmée. Harmoniser editorial.subjectKey avec germany-cannabis-clubs, utilisé par la question20 pour le même objet associatif ; la clé actuelle par propriété contourne la limite de répétition. Dire explicitement « en Allemagne » dans le prompt pour éviter le référent de « y ».',
24:'Interdiction de consommation confirmée. Harmoniser editorial.subjectKey avec germany-cannabis-clubs (question20) : même objet récurrent, propriété distincte, pas de clé séparée pour les locaux.',
25:'Interdiction à proximité immédiate des mineurs confirmée. Remplacer le distracteur « après65ans », sans fondement plausible ; proposer une autre restriction spatiale ou de public crédible.',
28:'Unicité d’adhésion confirmée. Harmoniser editorial.subjectKey avec malta-cannabis-associations (question27) pour le même objet ; ne pas ajouter une clé propre à la seule propriété membership.',
30:'Plafond par communauté domestique confirmé, sans guide de culture. Remplacer « chaque chambre utilisée », trop fantaisiste pour une unité juridique, par une unité administrative ou résidentielle plausible.'
};
const domains=[
'Isomères psychoactifs du THC.','Distribution du THC.','Élimination des dérivés du THC.','Persistance des effets du THC.','Adaptation CB1 à l’usage chronique.','Limite du mécanisme du CBD médical.','Métabolite actif du CBD.','Limite clinique de l’alpha-pinène associé au THC.','Odorants du cannabis, mais fait déjà testé.','Profils olfactifs concrets du cannabis.','Arôme de l’humulène du cannabis.','Arôme du bêta-caryophyllène du cannabis.','Limite clinique du CBD dans une douleur définie.','Esters odorants du cannabis.','Signal clinique exploratoire du CBG.','Statut du cannabis stupéfiant en France.','Sanction forfaitaire française de l’usage.','Portée historique du contentieux fleurs CBD.','Circulation européenne du CBD.','Modèle associatif du cannabis non médical.','Possession personnelle de cannabis.','Accès aux associations de cannabis.','Remise du cannabis non médical.','Usage des locaux associatifs de cannabis.','Consommation de cannabis à proximité des mineurs.','Promotion du cannabis non médical.','Accès touristique aux associations de cannabis.','Adhésion aux associations de cannabis.','Distinction usage public/privé du cannabis.','Unité d’un plafond juridique, sans conseil de culture.'
];
const results=[
'Chemistry réellement lu : double liaison C8–C9 contre C9–C10 confirmée.',
'OMS PDF index39 réellement lu : forte liaison du THC aux protéines plasmatiques.',
'OMS PDF index40 réellement lu : élimination principalement fécale, puis urinaire ; faible part inchangée.',
'OMS PDF index39 réellement lu : baisse plasmatique après voie orale malgré poursuite des effets.',
'Résumé PubMed et légendes réellement lus : réduction régionale corticale CB1 réversible ; aucune durée individuelle déduite.',
'Notice FDA2026 §12.1 réellement lu : mécanismes anticonvulsivants humains précis inconnus, interaction cannabinoïde non apparente.',
'Notice FDA2026 §12.3 réellement lu : 7-OH-CBD actif ; résultats murins séparés de leur pertinence humaine.',
'Résumé original Kumar réellement lu : aucune atténuation mnésique du THC par alpha-pinène dans cet essai19adultes.',
'Résumé et reconstitution aromatique PDF index5–6 réellement lus : contribution soufrée prénylée à la note skunk confirmée.',
'Résumé Oswald2023 réellement lu : profils terpéniques similaires malgré parfums distincts, rôle des constituants minoritaires.',
'Infographie ministérielle PDF index0 réellement lue : humulène, registre terreux et boisé.',
'Terpene Analysis réellement lu : bêta-caryophyllène décrit épicé, terreux et giroflé.',
'Summary/Interpretation et limites réellement lus : pas de bénéfice antalgique supplémentaire du CBD ajouté au paracétamol dans cet essai.',
'Esters: Flavor of Fruits, PDF index6 réellement lu : esters présents, descriptions fruitées et douces confirmées.',
'Résumé et limites du PDF auteur réellement lus : anxiété déclarée réduite sans ivresse ; population non clinique et petite étude aiguë.',
'L3421-1 version20août2026 réellement lu : usage illicite pénalisé, qualifié de délit.',
'L3421-1 dernier alinéa réellement lu :500€ ordinaire,400€ minoré,1000€ majoré ; procédure distincte du maximum pénal.',
'Présentation officielle de la décision29décembre2022 réellement lue : interdiction générale de commercialiser fleurs/feuilles brutes faible THC annulée.',
'Communiqué CJUE141/20 p.2 réellement lu : santé publique, aptitude et nécessité de la mesure ; cas du CBD légalement produit dans un autre État.',
'FAQ BMG réellement lue : associations non commerciales, coopératives et financement par cotisations.',
'FAQ BMG possession réellement lue :25g séchés portés par adulte.',
'FAQ BMG membership réellement lue : majorité et six mois de résidence habituelle.',
'FAQ BMG protection des jeunes réellement lue : envoi/livraison/commerce en ligne restent interdits.',
'FAQ BMG locaux réellement lue : consommation interdite dans l’enceinte et à portée de vue.',
'FAQ BMG restrictions réellement lue : consommation interdite à proximité immédiate des mineurs.',
'FAQ BMG publicité réellement lue : interdiction générale publicité/parrainage, réseaux sociaux inclus.',
'FAQ ARUC task réellement lue : espace fermé sans accès touristes/non-membres.',
'FAQ ARUC membership réellement lue : inscription centralisée empêchant plusieurs associations simultanées.',
'Flyer ministériel p.3 réellement lu : consommation publique et hors lieu de culture reste interdite.',
'Flyer ministériel p.2 réellement lu : quatre plantes par communauté domestique ; aucun paramètre de culture repris.'
];
const items=b.questions.map((q,i)=>({id:q.id,status:requests[i+1]?'changes_requested':'approved',domain:'active',domainComment:domains[i],comment:requests[i+1]||'Fait et corrigé soutenus ; portée, choix et niveau recevables.',contentHash:sha(q),sourceChecks:q.sourceIds.map(id=>{const s=b.sources.find(s=>s.id===id);if(!s)throw Error(id);return {sourceId:id,url:s.url,locator:q.editorial.sourceEvidence.find(x=>x.sourceId===id)?.locator||s.passage,result:results[i],sourceHash:sha(s)};})}));
const r={batchId:b.batchId,reviewer:'rebalance_classify_b',reviewedAt:'2026-11-17',items,summary:{reviewed:30,approved:items.filter(x=>x.status==='approved').length,changes_requested:items.filter(x=>x.status==='changes_requested').length,rejected:0,sourcesIndependentlyConsulted:17,assemblyCheck:'30 couples question/4choix/corrigé/source/juridiction intégralement lus ; publicitéAllemagne et adhésionMalte restaurées, aucune collision restante constatée.',duplicateCheck:'Index et voisins consultés ; objets complets hemp-molecules-skunk-thiol et hemp-molecules-caryophyllene-arome relus : doublons questions9 et12. THCdelta8structure distinct d’origineproduitsrp01 ; humulènearôme distinct de synonymie ; indications médicales distinctes des limites ici testées.',constraints:'Longueurs et choix distincts contrôlés ; tous les faits dans le domaine active. Les clés d’objet des associations doivent être harmonisées.'}};
fs.writeFileSync(base+'reviews/r-actives-a-02.json',JSON.stringify(r,null,2)+'\n','utf8');
console.log(r.summary);
