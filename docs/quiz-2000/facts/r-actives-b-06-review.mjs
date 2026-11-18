import fs from 'node:fs';
import crypto from 'node:crypto';
const base='docs/quiz-2000/';
const batch=JSON.parse(fs.readFileSync(base+'batches/r-actives-b-06.json','utf8'));
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const reader='rebalance_products_sol';
const readings={
 'slh':['Genetics, lignes255–257','Page Green House ouverte : Lemon Skunk x Super Silver Haze explicitement affiché.'],
 'chocolope':['Introduction et Discovering the Roots, lignes56–64','Page DNA ouverte : date18avril2024, parents Chocolate Thai/Cannalope Haze et registre coffee-like effectivement lus.'],
 'nyc':['En-tête et Strain Description, lignes35–59','Soma original ouvert : pamplemousse rouge, citron vert et parenté Mexican/Afghani explicites.'],
 'amnesia':['Strain Description, lignes60–63','Soma original ouvert : Thai sticks/Cambodian/Laotian puis Jamaican Haze et Afghani-Hawaiian. Attribution commerciale respectée.'],
 'orange':['Orange Bud, buds are very sweet ; easy to grow Skunk','Dutch Passion ouvert : extensive Skunk selection, early80s et unique Skunk selection. Aucun conseil de culture retenu.'],
 'power':['What kind of genetics ; titre et paragraphe aroma','Dutch Passion ouvert : origine South Africa, introduction1997 et notes woody/spicy/earthy/floral.'],
 'jack':['À propos et Schéma de croissance, lignes167–172','Page originale Sensi régulière ouverte : Jack Herer, Super Skunk et Haze explicitement nommées.'],
 'sensi':['Titre et signature, lignes11–15 ; About this product','Notice de marque sur Leafly ouverte, SENSI STAR by Paradise Seeds confirmé.'],
 'cones':['FAQ, Are the pre-rolled cones empty ; What is a crutch','FAQ originale ouverte : cônes vides sans cannabis ; embout côté bouche, maintien de forme et limitation des fragments.'],
 'screen':['Best Kief Screen, lignes368–372','Billet fabricant ouvert, essai420VapeZone repris avec lien : tamis du modèle quatre parties et collecteur kief. Superlatifs écartés.'],
 'ganja':['§4.14, p.16 imprimée / PDF21','Rapport CIRC original ouvert : herbal cannabis, feuilles et sommités séchées, ganja ; distinction résine/huile explicite.'],
 'dagga':['Communiqué29octobre2021, paragraphe hemp and dagga','Page gouvernementale sud-africaine ouverte, emploi dagga et appartenance Cannabis confirmés. Aucune règle2021 actualisée par inférence.'],
 'thai':['Note3, dernière page / PDF7','Décision DOHA originale ouverte : définition comprenant des fleurs liées sur petites sections de bambou, parmi d’autres présentations.'],
 'roach':['Description Smithsonian de l’objet nmah_2045735, extrait primaire indexé','Ouvertures directes en cache miss ; recherche indépendante par titre exact obtient et permet de lire marijuana stub et petite pince évitant de brûler les doigts. Accès excerpt confirmé.'],
 'grinder':['p.1, liste des accessoires, lignes20–21','PDF institutionnel SAMHSA deux pages ouvert : grinder fragmente marijuana en petits morceaux.'],
 'afroman':['Table All Grammy Awards and Nominations, lignes46–56','Registre Recording Academy ouvert : Because I Got High, Afroman et nomination2002 effectivement lus.'],
 'sabbath':['Article19février2021, paragraphes Master of Reality et Sweet Leaf','Page du label ouverte : Black Sabbath, premier morceau Sweet Leaf et propos de Bill Ward sur marijuana. Citation antérieure identifiée comme telle.'],
 'sublime':['Description et Tracklist, lignes174–181','Notice Universal ouverte : album début1992 de Sublime, piste Smoke Two Joints explicitement listée.'],
 'reefer':['Synopsis production MIT, lignes15–19','Troupe universitaire : adaptation du film1936, musical comedy et satirical political commentary. Distinct du film culte.'],
 'toklas':['Synopsis AFI, lignes15–18','Notice AFI ouverte, synopsis Hal Erickson identifié : Sellers incarne avocat Harold Fine et mange hash brownies. Fiction seulement.'],
 'emerald':['§1.2.6 Other Crops, p.1-18 / PDF26','Rapport original ouvert : Humboldt, Mendocino et Trinity constituent Emerald Triangle. Couverture août2003, avec trois auteurs nommés.'],
 'backland':['Historical Context, PDF9–10 ; rappel PDF13','Rapport universitaire original ouvert : hippies/back to the land, migrations puis communautés et marchés locaux cannabiques.'],
 'hashbash':['Annonce20mars2026, lignes39–45','Université Michigan originale ouverte : Hash Bash sur le Diag, Ann Arbor. Seule localisation culturelle évaluée.'],
 'cup':['Article organisateur, lignes15–18','Récit original ouvert : premier concours à Amsterdam, date1988 donnée par cette version du récit ; coffeeshops comme motif.'],
 'jury':['Judging Process, lignes86–92','Page originale édition New York ouverte : customers, judge kits, notes numériques et scores désignant gagnants.'],
 'caurd':['PDFp4/index3, What does justice involved mean?','Présentation OCM originale ouverte : vie affectée par condamnation cannabis, y compris certaines familles ; conditions cumulatives vues p2–3.'],
 'ncaa':['PDFp19/index18, proposition2024-20','Rapport officiel25pages ouvert : retrait des cannabinoïdes des classes interdites, Adopted Final, DivisionI juin2024.'],
 'glassart':['About this Product, lignes39–44','Notice musée ouverte : ouvrage Susie J. Silbert avec ToledoMuseum, essor dans concerts Grateful Dead1980–1990.'],
 'cbg':['PDFp1 première phrase du résumé ; métadonnées PubMed39003387','PDF original coauteur ouvert : Cannabigerol(CBG). Date13juillet2024 recoupée par extrait PubMed original.'],
 'sleep':['Examples of THC side effects, lignes71–89 ; page details220','Page Santé Canada ouverte : feeling tired or sleepy explicitement listé ; date22janvier2026 confirmée.']
};
const changes={
 'hemp-q2-rb06-ganja-herbe':'Fait et distinction herbe/résine/huile soutenus. Remplacer le distracteur «boisson exclusivement faite de graines», éloigné de la typologie des préparations à actifs et affaibli par exclusivement. Une boisson traditionnelle contenant feuilles de cannabis serait une alternative réelle et de même nature, sans recette. Conserver une seule réponse conforme à la typologie citée.',
 'hemp-q2-rb06-reefer-adaptation-musicale':'Adaptation scénique musicale satirique et distinction du film original sont soutenues. Rééquilibrer les trois autres formes scéniques : «sans musique» et «conférence de prévention» donnent trop facilement l’unique genre explicitement satirique. Comparer quatre formes scéniques plausibles pouvant porter une satire, sans ajouter de précision comique au seul corrigé.',
 'hemp-q2-rb06-cannabis-cup-jury-public':'Le jury de consommateurs est bien soutenu et correctement situé. Retirer People’s Choice de l’énoncé : sa traduction donne presque directement le choix du public. L’édition new-yorkaise2025 suffit à désigner le cas ; conserver le nom du modèle dans l’explication si utile.',
 'hemp-q2-rb06-cbg-cannabigerol':'Sigle et nom soutenus. Apprentissage distinct de la classification parmi les cannabinoïdes testée par hemp-evidence-cannabinoide ; son explication développe déjà le nom, mais le critère testé était l’appartenance de famille. Harmoniser néanmoins editorial.subjectKey en cbg, clé existante du même composé, comme signalé par l’auteur ; cette modification nécessitera nouveau contentHash.'
};
const domain=q=>q.editorial.category==='varieties'?'Version commerciale de cannabis à actifs, ascendance ou profil sensoriel attribué.':q.id.endsWith('cbg-cannabigerol')?'Identité d’un cannabinoïde du cannabis.':q.id.endsWith('thc-fatigue-somnolence')?'Effet intrinsèque possible duTHC.':'Objet, préparation, œuvre, usage ou histoire sociale directement liés au cannabis à actifs.';
const items=batch.questions.map(q=>({id:q.id,status:changes[q.id]?'changes_requested':'approved',
 domain:'active',domainComment:domain(q),
 comment:changes[q.id]||'Fait distinct, corrigé unique, quatre choix, explication et niveau recevables après lecture de l’objet complet et des preuves indiquées.',
 contentHash:hash(q),sourceChecks:q.sourceIds.map(sid=>{
  const s=batch.sources.find(x=>x.id===sid),r=readings[sid.replace('q2-rb06-','')];
  if(!s||!r)throw Error(sid);
  return {sourceId:sid,url:s.url,locator:r[0],result:r[1],sourceHash:hash(s)};
 })}));
const review={batchId:batch.batchId,reviewer:reader,reviewedAt:'2026-11-17',
 scope:'Première relecture indépendante des35questions complètes, choix, explications, éditoriaux et30notices.29passages ouverts et un extrait primaire Smithsonian obtenu indépendamment. Lot auteur inchangé.',
 neighbourAudit:{index:base+'fact-index.jsonl',
  terms:['SuperLemonHaze','Chocolope','NYCDiesel','AmnesiaHaze','OrangeBud','PowerPlant','JackFlash','SensiStar','ganja','dagga','Thai sticks','roach','grinder','Afroman','SweetLeaf','Sublime','Reefer','Toklas','Emerald','HashBash','CannabisCup','CAURD','NCAA','CBG','fatigue','somnolence'],
  openedNeighbours:['hemp-evidence-cannabinoide','hemp-q2-ra02-cbg-acute-anxiety-human-exploratory-signal','hemp-q2-rb02-reefer-alarmisme','hemp-q2-rb02-reefer-film-culte','hemp-q2-rb03-toklas-livre-recettes','hemp-q2-rb03-gysin-contribution-toklas'],
  distinctions:['Les trois seconds faits de lignées concernent ascendance ou parfum, distincts des autres faits testés sur les mêmes versions.','Reefer : adaptation musicale distincte de l’alarmisme initial et de la réception ultérieure du film.','Toklas : acteur de la fiction distinct du livre et de son contributeur Gysin.','Grinder : fragmentation des fleurs distincte du compartiment récupérant kief ; le kief déjà défini en rp01 ne suffit pas à identifier le rôle de ce compartiment.','Roach : nom du reste de joint distinct de la fonction d’une pince dédiée ; même clé conservée.','CBG : nom développé distinct du critère de classification, mais clé commune cbg requise.','Somnolence intrinsèqueTHC distincte de l’interaction CBD/alcool et d’une preuve d’efficacité sur l’insomnie.','Aucune collision avec rp04 gelé : chillum/Volcano/DynaVap et EmeraldCup ne sont pas les objets ni la CannabisCup de ce lot.']},
 sourceReadings:batch.sources.map(s=>{const r=readings[s.id.replace('q2-rb06-','')];return {sourceId:s.id,url:s.url,reader,date:'2026-11-17',access:s.access,locator:r[0],result:r[1]};}),
 metadataNotes:['La couverture du rapport Humboldt nomme aussi MichaelRichardson, après TomHofweber et EllenHanson : complément bibliographique possible, sans incidence sur le fait.','L’article CannabisCup attribue1988 à son premier concours ; la question ne teste que la ville. L’année peut être omise de l’explication pour éviter un détail de chronologie non nécessaire.','Les termes génériques de documentKind dans le lot ne revendiquent pas faussement des recherches originales : pages commerciales, institutionnelles, catalogue et synthèse sont précisés par organizations/limitations.'],
 summary:{approved:items.filter(x=>x.status==='approved').length,changes_requested:items.filter(x=>x.status==='changes_requested').length,rejected:0,allFactsSupported:true},items};
for(const q of batch.questions){if(q.editorial.domain!=='active')throw Error(q.id);if(q.options.length!==4||q.options[q.answer]!==q.editorial.expectedAnswer)throw Error(q.id);}
for(const x of items){if(!/^[a-f0-9]{64}$/.test(x.contentHash)||x.sourceChecks.some(s=>!/^[a-f0-9]{64}$/.test(s.sourceHash)))throw Error(x.id);}
fs.writeFileSync(base+'reviews/r-actives-b-06.json',JSON.stringify(review,null,2)+'\n');
console.log(JSON.stringify(review.summary));
