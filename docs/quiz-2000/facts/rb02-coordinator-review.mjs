// Final targeted wording review after A's first review and limited source reprise.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
const root='docs/quiz-2000', read=async path=>JSON.parse(await readFile(path,'utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const batch=await read(`${root}/batches/r-actives-b-02.json`), path=`${root}/reviews/r-actives-b-02.json`, review=await read(path);
const notes={
 'reefer-film-culte':'Quatre modes de réception/diffusion remplacent les sujets médicaux ou botaniques sans rapport ; rééditions tardives et réception culte conservées.',
 'stoner-comedy-genre':'Quatre genres de cinéma liés au cannabis remplacent les leurres industriels ; la comédie reste la définition sourcée.',
 '420-date-celebration':'La conversion de notation américaine a disparu ; le fait teste la date de la tradition culturelle 420.',
 'rastafari-sacrement':'Indice herbe sacrée supprimé ; quatre rôles rituels comparables, avec réserve sur les pratiques situées.',
 'rastafari-reasoning':'Quatre pratiques collectives plausibles remplacent les activités sur graines et poids ; la dimension spirituelle est le fait sourcé.',
 'jamaica-2015-rastafari':'Quatre usages religieux comparables ; reconnaissance historique ciblée, sans déduction sur la vente générale.',
 'holi-cannabis-tradition':'Indice fête des couleurs supprimé ; association bhang/Holi testée parmi quatre fêtes. Localisation du tableau contrôlée par A dans sa reprise.',
 'shiva-cannabis-tradition':'Indice Shivratri retiré du prompt ; lien culturel au cannabis maintenu, sans universalité. Localisation du tableau contrôlée par A.',
 'armstrong-muggles-titre':'Quatre sens argotiques ou musicaux plausibles remplacent brevets, taxonomie et tribunal anachroniques.',
 'brownie-mary-solidarite':'Quatre causes militantes comparables ; contexte cannabis médical et solidarité maintenu. Métadonnée de la notice vérifiée par A.',
 'coffeeshop-sans-alcool':'Le prompt emploie désormais tolérance sous conditions ; quatre régimes de service d’alcool plausibles.',
 'colorado-vote-avant-vente':'Quatre étapes historiques réelles ou plausibles ; repère2013 limité à la chronologie de Denver, niveau2 cohérent.',
 'south-africa-vie-privee':'Indice privé retiré ; quatre droits constitutionnels plausibles, avec portée historique de l’arrêt.',
 'pot-luck-jeu-societe':'Quatre mécanismes de jeux connus remplacent les objets sans rapport ; analogie Monopoly explicitement présente dans le passage déjà lu par A.',
 'hempfest-protestival':'Quatre finalités d’événements de culture cannabis remplacent les domaines secondaires ; mission politique revendiquée par l’organisateur.'
};
for(const [suffix,comment] of Object.entries(notes)){
 const id='hemp-q2-rb02-'+suffix, q=batch.questions.find(q=>q.id===id), item=review.items.find(item=>item.id===id);
 assert(q && item?.status==='changes_requested');
 for(const proof of item.sourceChecks) assert.equal(proof.sourceHash,hash(batch.sources.find(source=>source.id===proof.sourceId)),`${id}: source reprise must be complete`);
 const previous={...item};
 Object.assign(item,{status:'approved',comment,contentHash:hash(q),finalReviewer:'root',finalReviewedAt:'2026-11-17',coordinatorHistory:[previous],coordinatorScope:'Lecture complète des quinze QCM corrigés et des demandes de première revue. Preuves Sol préservées ; nouvelles preuves et métadonnées déjà reprises par A. Aucune consultation supplémentaire revendiquée par le coordinateur pour ces quinze décisions.'});
}
assert.equal(batch.questions.length,30);
for(const q of batch.questions){const item=review.items.find(item=>item.id===q.id);assert.equal(item.status,'approved');assert.equal(item.contentHash,hash(q));}
await writeFile(path,JSON.stringify(review,null,2)+'\n');
console.log('rb02:30 approved after targeted final arbitration');
