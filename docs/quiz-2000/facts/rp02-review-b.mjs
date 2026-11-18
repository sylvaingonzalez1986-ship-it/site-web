import fs from 'node:fs';
import crypto from 'node:crypto';
const base='docs/quiz-2000/';
const batch=JSON.parse(fs.readFileSync(base+'batches/r-products-02.json','utf8'));
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const requests={
  1:'Fait et choix recevables. Corriger topicId en plant et category en botany : le sens « sans graines » décrit les fleurs, pas un cannabinoïde. Garder domain active.',
  5:'Le fait traditionnel et la réserve sur les enveloppes modernes sont soutenus. Remplacer les choix « absence complète d’enveloppe combustible » et « enveloppe comestible dissoute dans la bouche », trop fantaisistes pour un blunt. Proposer quatre matériaux/enveloppes plausibles.',
  6:'Le fait est soutenu, mais les trois mauvaises réponses ont « uniquement », contrairement à la bonne. Rééquilibrer les formulations ; une huile orale et une teinture alcoolique sont également très éloignées de la destination d’un appareil à herbes sèches.',
  7:'Le refroidissement est soutenu. Les choix conversion CBD→THC et remplacement par de l’air pur sont fantaisistes ; l’arrêt de combustion est également facilement éliminé. Proposer des effets plausibles du passage dans l’eau, sans présenter une réduction de risque comme garantie.',
  8:'L’aérosol est soutenu. Deux distracteurs reposent sur une pureté absolue (« eau pure », « uniquement THC pur »), ce qui isole la réponse prudente. Remplacer ces deux choix par des compositions ou phénomènes physiquement plausibles et comparables.',
  19:'Statut européen confirmé dans le flyer. Les distracteurs « tous les animaux », « dès qu’il est végétal » et « médicament ... sans examen » sont excessifs ; ce dernier change aussi de catégorie. Proposer quatre statuts réglementaires comparables, sans trois autorisations caricaturales face à une seule absence d’autorisation.',
  20:'Les deux origines sont confirmées. Trois réponses « seulement » opposées à la seule combinaison rendent la réponse facile à deviner ; l’huile de graines n’est en outre pas une origine plausible du CBD. Réécrire les choix en catégories d’origine parallèles et crédibles.',
  26:'Règle canadienne confirmée. La bonne réponse est seule à comporter une condition réglementaire ; deux distracteurs annoncent un ajout « libre » et le dernier supprime tout cannabinoïde. Réécrire les quatre conditions d’admission à longueur comparable et avec de vraies alternatives réglementaires.',
  29:'La distinction shake/trim est précisément soutenue. Les trois autres choix (huiles, cristaux, résines) sont trop éloignés de deux matières végétales. Employer des distinctions concurrentes entre fleurs, feuilles et fragments pour tester le vocabulaire lui-même.'
};
const findings=[
'Définition sans graines explicite ; le périmètre concerne la présentation des fleurs actives.',
'Charas est explicitement classé parmi les noms de résine ; pas de technique ni origine disputée.',
'Le bulletin décrit les trois composants ; question descriptive sans paramètres de fabrication.',
'Tableau ATS : tabac et cannabis roulés ensemble ; le contexte anglophone évite la variation du mot joint.',
'Tableau ATS et paragraphe suivant sur les enveloppes modernes sans tabac effectivement lus.',
'Tableau ATS : fleurs chauffées sans combustion ; la réserve sur les accessoires pour extraits est soutenue.',
'Santé Canada distingue refroidissement et innocuité ; cette limite est correctement conservée.',
'Santé Canada définit précisément le vapotage d’extrait par production d’un aérosol.',
'Le passage sur la migration de métaux vers l’extrait puis l’aérosol soutient la réponse et sa provenance matérielle.',
'Le résumé de recherche rapporte des produits de dégradation ; la limite du substitut expérimental est conservée.',
'Le rapport CDC retrouve l’acétate dans les lavages ; association historique et causalité non exclusive correctement distinguées.',
'La DEA rattache Spice/K2 aux cannabinoïdes synthétiques imitant le THC ; pas de généralisation de puissance.',
'Le paragraphe EUDA sur le fumage soutient la conversion. Distinct du bilan CO2 de hemp-evidence-decarboxylation et du calcul conventionnel rp01.',
'Le sens du timbre et les exemptions sont explicites ; le marquage reste propre au cannabis réglementé.',
'La substance signalée et le seuil de marquage sont explicités par Santé Canada.',
'Communiqué du 20 mai 2026 : ajout alimentaire de CBD non autorisé, y compris compléments ; état et juridiction datés.',
'Communiqué : exception des feuilles exclusivement pour infusion aqueuse, sans enrichissement et sous limites de THC ; distinction spécifique du CBD alimentaire.',
'Flyer p.2 : CBD pur comme ingrédient cosmétique et limite de THC ; aucune promesse de santé.',
'Flyer p.2 : absence d’autorisation comme additif animal explicitement affirmée.',
'Flyer p.2 : origine chimique ou extraction et obligations REACH explicitement mentionnées.',
'Flyer p.2 : déclaration à l’Anses par fabricants et distributeurs ; distinction avec autorisation de médicament correcte.',
'Article 3 officiel : plafond de 30 % p/p hors comestibles ; source à jour au 1er juillet 2026.',
'Article 4 officiel : chocolat et confiseries explicitement exclus ; les autres formats ne sont pas interdits par leur simple catégorie.',
'Guide canadien : 10 mg de THC total par contenant immédiat ; règle de conditionnement clairement séparée d’un conseil de consommation.',
'Guide canadien : nicotine explicitement non permise dans les extraits.',
'Guide canadien : caféine naturellement apportée par des ingrédients et sous plafond, ajout de caféine/citrate exclu.',
'FDA : nabilone synthétique non naturellement présent ; distinct du fait ancien sur son indication antiémétique.',
'FDA : formulation Epidiolex contenant du CBD purifié ; aucune indication ou limite d’âge obsolète reprise.',
'Encadré UNODC : fragments de fleurs versus feuilles retirées ; pas de taux ou d’extraction généralisé.',
'Glossaire OFDT : gâteau au cannabis ; terme de culture de produit distinct de sa composition précise.'
];
const results={
'q2-rp02-ofdt-glossaire':'PDF p.19 (index19), entrées SINSEMILLA et SPACE-CAKE réellement lues : sens sans graine et gâteau contenant du cannabis confirmés ; règles historiques et conseils de culture exclus.',
'q2-rp02-euda-charas':'Analyse, premier paragraphe réellement lu : charas donné comme nom de résine avec hashish. Aucun procédé repris.',
'q2-rp02-michigan-moonrocks':'Bulletin du 19 septembre 2022, p.1, Moon rocks réellement lu : fleur, concentré et kief confirmés ; seule composition descriptive retenue.',
'q2-rp02-ats-terminology':'Tableau 1 et paragraphe sur les nouvelles enveloppes sans tabac réellement lus : spliff, blunt traditionnel et vaporisateur à fleurs confirmés, terminologie culturellement située.',
'q2-rp02-hc-accessories':'Passages Pipes et Vaping réellement lus : refroidissement sans innocuité, aérosol d’extrait chauffé et migration de métaux confirmés.',
'q2-rp02-hc-vape-byproducts':'Résumé Investigation of degradation by-products... réellement lu : sous-produits oxydatifs/de dégradation et limite du substitut de laboratoire confirmés ; aucune fréquence ou toxicité extrapolée.',
'q2-rp02-cdc-evali':'Résultats et discussion du rapport MMWR réellement lus : 29 lavages positifs à l’acétate, association et limites causales. Erratum du 31 janvier 2020 ouvert : noms omis, pas de changement de résultat.',
'q2-rp02-dea-spice':'What is Spice/K2 et How is it abused réellement lus : noms de produits à cannabinoïdes synthétiques, présentation possible comme encens végétal confirmés.',
'q2-rp02-hc-label':'Sections 1 et 3 réellement lues : symbole THC au-delà de 10 microgrammes/g, provenance du titulaire de licence et exemptions du timbre confirmés.',
'q2-rp02-maasa-cbd-foods-2026':'Communiqué du 20 mai 2026 réellement lu : CBD ajouté non autorisé, compléments inclus ; feuilles exclusivement pour infusion aqueuse sans enrichissement distinguées, sous limites THC.',
'q2-rp02-quebec-products-2026':'Texte officiel à jour au 1er juillet 2026 réellement lu, articles 3 et 4 : 30 % p/p hors comestibles ; exclusions chocolat/confiserie/dessert confirmées.',
'q2-rp02-hc-composition':'Guide réellement lu aux passages nicotine, caffeine et edible maximum quantities : nicotine exclue, caféine naturelle sous plafond et 10 mg THC total/contenant comestible confirmés.',
'q2-rp02-fda-drug-identities':'Diagramme et paragraphes sur Epidiolex/Cesamet réellement lus : CBD purifié et nabilone synthétique non naturellement présent confirmés ; indication/âge non repris.',
'q2-rp02-unodc-shake-trim':'Rapport original UNODC sur serveur ministériel, encadré p.31 imprimée/PDF index32 réellement lu : shake fragments floraux, trim feuilles retirées.',
'q2-rp02-mildeca-product-categories-2026':'Flyer officiel octobre2026, p.2 intégralement lu aux rubriques concernées : cosmétique CBD pur, animal non autorisé, deux origines vape/REACH et déclaration Anses confirmés ; autres affirmations non utilisées.',
'q2-rp02-euda-flower-thca-heating':'Biosynthesis..., paragraphe When natural cannabis products are smoked réellement lu : THCA converti en THC sous chaleur ; aucun paramètre de transformation repris.'
};
const items=batch.questions.map((q,i)=>({id:q.id,status:requests[i+1]?'changes_requested':'approved',domain:'active',domainComment:findings[i],comment:requests[i+1]||'Fait, réponse et explication soutenus ; choix et difficulté recevables. '+findings[i],contentHash:hash(q),sourceChecks:q.sourceIds.map(id=>{const s=batch.sources.find(x=>x.id===id);if(!s||!results[id])throw Error(id);return {sourceId:id,url:s.url,locator:q.editorial.sourceEvidence.find(x=>x.sourceId===id)?.locator||s.passage,result:results[id],sourceHash:hash(s)};})}));
const review={batchId:batch.batchId,reviewer:'rebalance_classify_b',reviewedAt:'2026-11-17',items,summary:{reviewed:items.length,approved:items.filter(x=>x.status==='approved').length,changes_requested:items.filter(x=>x.status==='changes_requested').length,rejected:0,sourcesIndependentlyConsulted:batch.sources.length,duplicateCheck:'Index des faits existants et voisins consultés. Proximités THCA/CO2/calcul THC total, nabilone/indication et cosmétique/étiquette générale distinctes par propriété. Aucun doublon de fait imposant retrait trouvé.'}};
fs.writeFileSync(base+'reviews/r-products-02.json',JSON.stringify(review,null,2)+'\n','utf8');
console.log(review.summary);
