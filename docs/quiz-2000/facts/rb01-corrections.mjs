import fs from 'node:fs';
const path='docs/quiz-2000/batches/r-actives-b-01.json';
const b=JSON.parse(fs.readFileSync(path,'utf8'));
const get=s=>b.questions.find(q=>q.id==='hemp-q2-rb01-'+s);
function change(s,prompt,options,extra={}){const q=get(s);q.prompt=prompt;q.options=options;q.answer=0;Object.assign(q,extra);q.editorial.expectedAnswer=options[0];}
get('glandes-monoterpenes').topicId='molecules';
get('fecondation-sesquiterpenes').topicId='molecules';
change('pollen-hermaphrodite-fonctionnel','Quelle observation Punja et Holmes rapportent-ils sur le pollen d’inflorescences hermaphrodites de cannabis ?',[
 'Des grains germent et forment un tube','Les grains restent fermés sans tube','Les grains éclatent avant de former un tube','Les grains se vident sans croissance du tube'],{level:2});
get('pollen-hermaphrodite-fonctionnel').editorial.difficultyRationale='Résultat de viabilité du pollen étudié, nécessitant de distinguer présence et fonction reproductrice.';
get('descendance-hermaphrodite-femelle').level=2;
get('descendance-hermaphrodite-femelle').editorial.difficultyRationale='Résultat génétique spécialisé d’une descendance étudiée ; distinction entre sexe génétique et organes floraux.';
change('glandes-maturation-asynchrone','Quelle répartition des stades de développement observe-t-on parmi les glandes d’une même bractée de cannabis ?',[
 'Des stades différents mélangés sur la surface','Un stade unique pour toute la surface','Des stades successifs en cercles concentriques','Un stade propre à chaque moitié de bractée']);
change('gouttes-resine-tetes-collees','Quelle conséquence physique des gouttes de résine à la surface des glandes de cannabis a été observée ?',[
 'Le collage de plusieurs têtes glandulaires','L’enroulement des pieds autour des têtes','Le gonflement des pieds en sphères','L’aplatissement des têtes en écailles']);
change('glandes-fragilite-manipulation','Quelle altération des glandes résineuses de cannabis peut accompagner les manipulations après récolte ?',[
 'Des têtes abîmées ou détachées de leur pied','Des pieds ramifiés portant de nouvelles têtes','Des têtes fusionnées au tissu interne de la feuille','Des pieds allongés après le détachement de la fleur']);
change('fleur-apport-sucres-glandes',get('fleur-apport-sucres-glandes').prompt,[
 'Les tissus de la fleur','Les seules grandes feuilles éloignées de la fleur','Les cellules des têtes elles-mêmes','Les cellules du pied des glandes principalement']);
change('densite-glandes-pas-dosage','Pourquoi compter les glandes de deux fleurs de cannabis ne suffit-il pas à comparer leur teneur en cannabinoïdes ?',[
 'Leur taille et leur maturité diffèrent aussi','Les cannabinoïdes se trouvent surtout dans les stigmates','Les tiges internes contiennent l’essentiel des cannabinoïdes','Les têtes glandulaires stockent surtout du pollen']);
change('sans-cannabinoides-autres-phenols','Quel rôle des cannabis très pauvres en cannabinoïdes est recherché dans certaines études contrôlées ?',[
 'Imiter l’aspect et l’odeur sans le même profil cannabinoïde','Fournir le même profil cannabinoïde avec une autre odeur','Fournir le même profil cannabinoïde sous une autre forme','Masquer l’odeur tout en conservant les mêmes cannabinoïdes']);
const old20=get('oxidocyclases-cbca');
change('oxidocyclases-cbca','Quelle source de THCA Allen et ses collègues identifient-ils comme la plus probable dans les cannabis à dominante CBD ?',[
 'Une activité secondaire de la CBDA synthase','Une conversion spontanée du CBD par la lumière','Une synthèse du THCA par les terpène synthases','Une transformation du CBN pendant la floraison'],{level:3,topicId:'evidence',explanation:'La CBDA synthase forme surtout du CBDA, mais peut aussi produire du THCA. Cette activité secondaire aide à comprendre pourquoi une plante à dominante CBD peut contenir du THCA même sans THCA synthase fonctionnelle.'});
old20.id='hemp-q2-rb01-cbdas-sous-produit-thca';
old20.sourceIds=['q2-rb01-allen26-sideproduct'];old20.subjectKey='cannabis-cbdas-thca-side-product';
Object.assign(old20.editorial,{subject:'Origine enzymatique du THCA dans les profils à dominante CBD',subjectKey:old20.subjectKey,property:'Production secondaire de THCA par la CBDA synthase',learningObjective:'Comprendre pourquoi dominante CBD ne signifie pas absence biologique de THCA.',factKey:'cannabis-cbdas-thca-side-product',sourceEvidence:[{sourceId:'q2-rb01-allen26-sideproduct',locator:'Discussion §3.1, paragraphes « The origin of THCA » et « The most likely source »',support:'La production secondaire de THCA par CBDAS est présentée comme la source la plus probable dans les cultivars CBD sans THCAS fonctionnelle.'}]});
const source=structuredClone(b.sources.find(s=>s.id==='q2-rb01-allen26'));source.id='q2-rb01-allen26-sideproduct';source.passage='Discussion §3.1 : origine du THCA dans les plantes CBD sans THCAS fonctionnelle ; §3.6 : implications.';source.limitation='Interprétation enzymatique étayée par la littérature et la concordance des rapports ; aucune garantie de teneur pour un produit particulier.';source.consultation={reader:'rebalance_classify_b',date:'2026-11-17',locator:source.passage,result:'Passage intégral rouvert le 17 novembre. CBDAS est identifiée comme source la plus probable du THCA secondaire ; aucune valeur ni méthode de fabrication n’est reprise.'};b.sources.push(source);
const old26=get('fleur-terminale-meristeme');
change('fleur-terminale-meristeme','À la surface du cannabis, quels poils sont directement associés à la production de résine riche en cannabinoïdes ?',[
 'Les trichomes glandulaires à tête sécrétrice','Les poils simples sans tête sécrétrice','Les poils absorbants présents sur les racines','Les poils cystolithiques à base minéralisée'],{level:1,explanation:'Les glandes à tête sécrétrice fabriquent et stockent des cannabinoïdes et des terpènes. Les poils cystolithiques, également présents sur le cannabis, ne participent pas à cette biosynthèse.'});
old26.id='hemp-q2-rb01-poils-glandulaires-resine';old26.sourceIds=['q2-rb01-alberti25'];old26.articleId='ref-trichomes';old26.subjectKey='cannabis-glandular-vs-cystolithic-hairs';
Object.assign(old26.editorial,{subject:'Poils glandulaires distincts des poils cystolithiques',subjectKey:old26.subjectKey,property:'Structures sécrétrices de cannabinoïdes et terpènes',learningObjective:'Distinguer les poils qui produisent la résine des autres poils visibles sur le cannabis.',factKey:'cannabis-glandular-not-cystolithic-cannabinoid-biosynthesis',difficultyRationale:'Distinction concrète entre glandes résineuses et autres poils de surface ; vocabulaire expliqué dans les choix.',sourceEvidence:[{sourceId:'q2-rb01-alberti25',locator:'Introduction §1.2, paragraphe suivant la liste des trois types glandulaires',support:'Les poils cystolithiques sont non glandulaires et ne sont impliqués ni dans la biosynthèse des cannabinoïdes ni dans celle des terpènes.'}]});
b.sources=b.sources.filter(s=>b.questions.some(q=>q.sourceIds.includes(s.id)));
fs.writeFileSync(path,JSON.stringify(b,null,2)+'\n');
const counts=Object.fromEntries([1,2,3,4].map(l=>[l,b.questions.filter(q=>q.level===l).length]));
const issues=[];for(const q of b.questions){if(q.prompt.length>150||q.explanation.length>240||q.options.some(x=>x.length>75)||new Set(q.options).size!==4)issues.push(q.id);}
console.log(JSON.stringify({questions:b.questions.length,sources:b.sources.length,levels:counts,issues}));
