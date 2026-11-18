import fs from 'node:fs';
import crypto from 'node:crypto';
const base='docs/quiz-2000/';
const batch=JSON.parse(fs.readFileSync(base+'batches/r-actives-b-04.json','utf8'));
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const reader='rebalance_products_sol';
const readings={
 'q2-rb04-herer':['Introduction, avant Cultivating, ligne67 du texte ouvert','Hommage explicite à l’auteur de The Emperor Wears No Clothes et à son militantisme. Date affichée : mise à jour23juillet2020.'],
 'q2-rb04-widow':['Titre et Genetics, lignes51–53 et81–82','La version Green House affiche Brazilian x South Indian. Attribution au fabricant préservée.'],
 'q2-rb04-northern':['Growth pattern of Northern Lights Regular, premier paragraphe','Sensi cite Afghani and Thai genetics ; l’origine américaine est formulée comme hypothèse.'],
 'q2-rb04-blueberry':['Best cross-breeding projects, Blueberry, paragraphe commençant The breeding project','Collaboration Dutch Passion et DJ Short explicitement indiquée ; recherche de saveurs fruitées aussi mentionnée.'],
 'q2-rb04-durban':['Durban Poison is a classic variety ; strain info, lignes450–455','Origine sud-africaine et ville de Durban explicites. Les affirmations promotionnelles sur effets et culture ne soutiennent aucun QCM ici.'],
 'q2-rb04-landrace':['Famous landrace indicas, Hindu Kush ; 9 top modern hybrids, Skunk','Hindu Kush : contreforts Afghanistan/Pakistan/Tadjikistan ; Skunk#1 : Acapulco Gold/Colombian Gold/Afghan. Page signée Steven Voser et mise à jour14mars2025, publiée par Sensi.'],
 'q2-rb04-cannatonic':['Annonce datée10novembre2015, paragraphe unique, modification17janvier2016','Ancienne hypothèse MK-Ultra x G13 abandonnée au profit de Reina Madre x NYCD, dans l’annonce du breeder.'],
 'q2-rb04-presse':['p.161–162 imprimées / PDF157–158, L’APPEL DU18JOINT','Actuel rattaché à la presse underground/contre-culture ; appel Libération18juin1976 pour dépénaliser l’usage. Passage complet lu, aucun extrait de paroles reproduit.'],
 'q2-rb04-reefer':['PDF couverture ; PDFp6/p.5 imprimée, ReelOF491.2-1 nº4 ; PDFp61, Drug Songs','Reefer Man attribué à Cab Calloway and His Harlemanics ; montage Drug Songs confirme vocals by Calloway. Couverture : Ben Pubols, Franklin A. Robinson Jr. et Wendy Shay, année2001 : date à renseigner dans la notice.'],
 'q2-rb04-howhigh':['Synopsis et Motifs de classement, lignes48–68','Deux fumeurs de cannabis étudiants à Harvard ; traitement burlesque. Titre original How High!, classement4décembre2001.'],
 'q2-rb04-harold':['Synopsis, lignes42–44 ; classement, ligne58','Deux amis cherchent marijuana et fast-food durant une soirée ; titres français/original et date de version23mai2008 vérifiés.'],
 'q2-rb04-grace':['Synopsis et Storyline, lignes9 et27–30','Mari décédé ayant tout hypothéqué ; menace de saisie ; elle vend du cannabis avec son jardinier pour sauver sa maison. Pas de technique de culture reprise.'],
 'q2-rb04-grass':['Fiche année/réalisation puis Years in the making, lignes40–66','Ron Mann1999 ; histoire de l’usage récréatif et de sa criminalisation. Archives et bande musicale décrites ; jugements promotionnels d’innocuité exclus du quiz.'],
 'q2-rb04-family':['Synopsis Netflix, ligne80 ; épisode1 Business Plan','Conversion de la boucherie familiale en marijuana café après annonce fictive de légalisation. La question distingue correctement intrigue et droit réel.'],
 'q2-rb04-paulette':['Synopsis complet, lignes8–12','Retraitée pauvre en HLM, ancienne pâtissière, se tournant vers le cannabis ; thème de précarité/mise à l’écart explicite.'],
 'q2-rb04-nlm':['Premier volet PDF, rubrique Marijuana, lignes42–62','Campagnes officielles des années1930 employant le nom espagnol pour associer cannabis et immigrés mexicains. Distinct de l’étymologie du mot.'],
 'q2-rb04-resinmarkets':['Cannabis resin production outside the EU, paragraphes479–485 ; date16novembre2023','Maroc première provenance de résine pour Europe ; Rif explicitement rattaché à cette production ; remplacement progressif des types traditionnels par hybrides à potentiel résine/THC supérieur.'],
 'q2-rb04-euda26':['Introduction, ligne305 ; Changing flows, lignes355–358 ; Cannabis market data, ligne433','Rapport9juin2026 : cannabis substance illicite la plus consommée ; Canada/États-Unis cités dans les nouveaux flux ; saisies2024 :24,6%résine et12%herbe, environ double. Aucune garantie par produit.'],
 'q2-rb04-irradiation':['Abstract ; Introduction ; Discussion and conclusion, paragraphes439–451 ; Conflict of interest','But microbiologique et spores ; quatre matériels étudiés ; THC/CBD inchangés et réduction de certains terpènes. Auteur salarié Bedrocan, conflit déclaré dans le lot. Aucun réglage de traitement repris dans les questions.'],
 'q2-rb04-zuardi':['Résumé PubMed complet, lignes246–249','Recul médical occidental lié en partie aux difficultés d’obtenir des résultats constants avec des lots de puissances variables. Résumé seulement, conformément à l’accès annoncé.'],
 'q2-rb04-iom':['Chapitre2 p.16 imprimée/PDF31 ; chapitre11 p.157–158 imprimées/PDF172–173','Commission1893–1894 recommande contre prohibition générale ; Tax Act1937 autorise usage médical mais bureaucratie dissuasive. Locator auteur p.158–159 décalé d’une page, à corriger pour l’item Tax Act.'],
 'q2-rb04-pharmahistory':['§4, paragraphes précédant §4.1, définitions1925 et Indian hemp ; §4.1, paragraphes333–335 cannabine/haschischine','Herba1925 non privée de résine ; Cannabis Indicae terme géographique/commercial et pharmaceutique, pas taxon strict ; cannabine/haschischine noms d’extraits complexes et non de cannabinoïdes purs. Les deux premiers passages sont en §4 avant4.1 : locators auteur à corriger.']
};
const changes={
 'hemp-q2-rb04-reefer-man-calloway':'Fait, quatre interprètes et explication soutenus. Corriger la notice q2-rb04-reefer : la couverture de l’inventaire porte2001, au lieu de s.d. ; elle nomme aussi Ben Pubols, Franklin A. Robinson Jr. et Wendy Shay. Aucun remplacement de fait nécessaire. La source modifiée demandera une nouvelle empreinte.',
 'hemp-q2-rb04-taxact1937-usage-medical':'Fait distinct et soutenu : possibilité médicale sous contraintes, différente de l’identification du Tax Act et des formalités de transfert déjà retenues. Refaire les deux distracteurs animaux seuls/hôpitaux militaires seuls, peu plausibles pour ce texte : proposer quatre régimes administratifs ou conditions d’accès médicaux historiquement comparables. Corriger le locator en p.157–158 imprimées/PDF172–173, plutôt que158–159.',
 'hemp-q2-rb04-medecine-variabilite-lots':'Fait historique soutenu par le résumé, et domaine actif justifié. Les choix couleur pour provenance et parfum pour reconnaissance sont trop faibles face à la variabilité de puissance. Refaire quatre obstacles pharmaceutiques comparables et plausibles (constance entre lots, conservation/stabilité, absorption, formulation), en gardant une seule réponse soutenue et l’ancrage à Zuardi.',
 'hemp-q2-rb04-herba-indicae-resine1925':'Fait, réponse unique et explication soutenus : la définition1925 exige les sommités non privées de résine. Corriger le locator de sourceEvidence et celui de la notice partagée : ce passage se trouve en §4 avant le titre4.1, pas en§4.1. Les trois options alternatives ne sont pas des exigences de cette définition.',
 'hemp-q2-rb04-indian-hemp-appellation-pharmacie':'Sens historique bien soutenu et quatre interprétations plausibles. Corriger le locator de sourceEvidence et celui de la notice partagée : le passage Indian hemp/Cannabis Indicae se trouve en §4 avant le titre4.1. Le contenu n’a pas besoin de remplacement.'
};
const notes=[
 'Hommage de lignée attribué, sans parenté ni effet déduit du nom.',
 'Parenté géographique explicitement annoncée pour la version Green House, pas certification indépendante.',
 'Ascendances afghane/thaïe attribuées à la version Sensi ; origine américaine qualifiée.',
 'Breeder collaborateur nommé et arômes fruités décrits dans le récit Dutch Passion.',
 'Provenance revendiquée sud-africaine ; le nom de ville n’est pas traité comme preuve autonome.',
 'Trois ascendances données par le récit Sensi ; distracteurs de même nature et niveau3 cohérent.',
 'Rectification publique explicite ; ancienne hypothèse distinguée de l’annonce corrigée.',
 'Provenance de la lignée attribuée ; quatre ensembles montagneux géographiquement comparables.',
 'Revendication de dépénalisation datée et historiquement située, distincte d’un droit actuel.',
 'Rôle dans la contre-culture directement lié au débat cannabique, sans portée clinique.',
 '',
 'Synopsis institutionnel et quatre comédies plausibles ; aucune amélioration des études donnée comme réelle.',
 'Quête du duo conforme au synopsis officiel ; autres duos plausibles de comédies cannabiques.',
 'Mobile économique et contexte de dette/saisie conformes à la production ; quatre motivations comparables.',
 'Genre documentaire, réalisateur, usages récréatifs et répression vérifiés ; récit promotionnel sanitaire écarté.',
 'Commerce familial et intrigue de légalisation vérifiés dans la notice originale Netflix.',
 'Portrait de la protagoniste et contexte social conformes au synopsis Gaumont.',
 'Usage stigmatisant du mot documenté, distinct de son origine mexicaine et de son passage par anglais.',
 'Ancrage géographique du foyer de résine et rôle européen soutenus ; pas origine exclusive de toute résine.',
 'Comparaison récente de teneurs moyennes de saisies, explicitement limitée ; pas prévision de produit particulier.',
 'Nouveaux flux nord-américains explicitement cités ; quatre couples géographiques plausibles.',
 'Évolution du matériel destiné à la résine, pas procédure de sélection ni conseil de culture.',
 'Place sociale du cannabis soutenue par le rapport2026 ; ni innocuité ni légalité générale inférée.',
 'Traitement de fleurs pour qualité microbiologique ; autres objectifs de dépollution plausibles, sans protocole.',
 'Comparaison chimique sur les quatre matériels étudiés ; limites et conflit d’intérêt bien déclarés.',
 '',
 '',
 'Position de la commission distincte de son champ géographique déjà couvert ; conclusion historique non présentée comme sécurité actuelle.',
 '',
 'Noms pharmaceutiques anciens correctement distingués d’un cannabinoïde pur ; trois identités moléculaires plausibles comme confusions, et explication historique utile.',
 ''
];
function domainComment(q,n){
 if(n<8)return 'Lignée de cannabis à actifs, provenance ou histoire de sélection externe attribuée.';
 if(n>=23&&n<=24)return 'Traitement et composition de fleurs médicinales à cannabinoïdes, directement liés au produit à actifs.';
 if(n>=25)return 'Histoire du cannabis médicinal, des préparations à actifs ou de leur régime, sans validation thérapeutique actuelle.';
 if(n>=18&&n<=22)return 'Circuits de résine/herbe, composition saisie ou usages sociaux du cannabis à actifs.';
 return 'Culture, représentation ou débat public explicitement centré sur le cannabis récréatif.';
}
const items=batch.questions.map((q,n)=>({
 id:q.id,status:changes[q.id]?'changes_requested':'approved',domain:'active',domainComment:domainComment(q,n),
 comment:changes[q.id]||notes[n],contentHash:hash(q),
 sourceChecks:q.sourceIds.map(sid=>{const s=batch.sources.find(x=>x.id===sid);if(!s||!readings[sid])throw new Error(sid);return {sourceId:sid,url:s.url,locator:readings[sid][0],result:readings[sid][1],sourceHash:hash(s)};})
}));
const review={batchId:batch.batchId,reviewer:reader,reviewedAt:'2026-11-17',
 scope:'Première relecture indépendante de31questions, quatre choix, explications, éditoriaux et22notices ; aucune modification du lot auteur.',
 neighbourAudit:{index:base+'fact-index.jsonl',
 terms:['Jack Herer','White Widow','Northern Lights','Blueberry','Durban','Skunk1','Cannatonic','Hindu Kush','Actuel','18joint','Reefer Man','How High','Harold','Saving Grace','Family Business','Paulette','marijuana','Rif','irradiation','1937','commission','1925','Indicae','cannabine','puissance des lots'],
 openedNeighbours:['hemp-hc-012','hemp-hc-060','hemp-hs-hist-1937-law','hemp-hs-hist-1937-date','hemp-hs-hist-1937-exemptions','hemp-hs-hist-canada-federal'],
 distinctions:['Usage politique stigmatisant du mot distinct de l’emprunt mexicain et de sa langue relais.','Tax Act : maintien de l’usage médical sous contraintes distinct de l’identité du texte, du formulaire de transfert et de l’exclusion des tiges.','Commission indienne : position sur prohibition distincte du champ géographique de l’enquête.','White Widow : origine parentale distincte des deux observations de développement floral rb01.','Reefer Man : interprète musical distinct du film Reefer Madness rb02.','Irradiation : but microbiologique distinct de son effet observé sur profils chimiques.']},
 sourceReadings:batch.sources.map(s=>({sourceId:s.id,url:s.url,reader,date:'2026-11-17',access:s.access,locator:readings[s.id][0],result:readings[s.id][1]})),
 metadataNotes:['La page Sensi landrace est signée Steven Voser : auteur personnel à préciser si harmonisation de notice, organisation Sensi inchangée.','La date23juillet2020 de Jack Herer est présentée comme mise à jour.','La correction du locator de q2-rb04-pharmahistory affectera aussi le sourceHash de l’item cannabine déjà approuvé : recontrôler cette empreinte après modification de la notice.'],
 summary:{approved:items.filter(x=>x.status==='approved').length,changes_requested:items.filter(x=>x.status==='changes_requested').length,rejected:0,allFactsSupported:true},items};
for(const x of items){if(!x.comment)throw new Error('Missing comment '+x.id);if(!/^[a-f0-9]{64}$/.test(x.contentHash))throw new Error(x.id);}
fs.writeFileSync(base+'reviews/r-actives-b-04.json',JSON.stringify(review,null,2)+'\n');
console.log(JSON.stringify(review.summary));
