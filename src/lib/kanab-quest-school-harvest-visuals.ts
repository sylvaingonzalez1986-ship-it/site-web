/** Public, unremunerated reasoning exercises. No production settings or predicted yields. */
export const HARVEST_RESULTS = [
 {id:'gross',title:'Quantité récoltée',measure:'Peser une masse identifiée, avec sa surface et sa période.',limit:'L’eau, les impuretés et les refus peuvent changer le classement.'},
 {id:'dry',title:'Matière sèche',measure:'Relier masse et humidité mesurée sur une base annoncée.',limit:'Un équivalent de matière sèche est un calcul, pas un objectif de dessiccation.'},
 {id:'saleable',title:'Produit commercialisable',measure:'Appliquer des critères explicites au bon lot et au bon débouché.',limit:'Une masse récoltée n’est pas entièrement vendable ; un refus n’est pas toujours un danger sanitaire.'},
 {id:'regularity',title:'Homogénéité',measure:'Examiner plusieurs prélèvements et la variabilité du lot.',limit:'Une moyenne peut masquer des zones différentes ; l’échantillonnage compte.'},
 {id:'health',title:'État sanitaire',measure:'Relier observations et contrôles adaptés au risque envisagé.',limit:'Une photographie, une odeur ou une valeur isolée ne certifient pas l’innocuité.'},
 {id:'processing',title:'Aptitude à la transformation',measure:'Définir les propriétés utiles au produit : graines, fibres ou autre destination autorisée.',limit:'La qualité pour une transformation n’est pas automatiquement celle d’une autre.'},
 {id:'loss',title:'Pertes',measure:'Définir les étapes et compter des catégories sans recouvrement.',limit:'Une perte d’eau n’est pas nécessairement une perte de matière sèche.'},
 {id:'cost',title:'Coût',measure:'Décrire les dépenses incluses et l’unité de comparaison.',limit:'Des dépenses partielles ne donnent ni coût complet ni marge.'},
 {id:'work',title:'Travail',measure:'Compter les heures et observer leur répartition et les contraintes.',limit:'Un total d’heures ne décrit pas à lui seul la pénibilité ou les pics de charge.'},
 {id:'resources',title:'Ressources',measure:'Suivre eau, énergie et matériels avec leurs unités et leur périmètre.',limit:'Des kWh ne sont ni des émissions mesurées ni un bilan environnemental complet.'},
] as const;
export const HARVEST_PLAN_FIELDS = [
 {id:'question',title:'Question et critère',options:[
  {id:'defined',label:'Comparer deux organisations sur la fraction de graines cassées, avec une même méthode annoncée.',correct:true,feedback:'Le critère et la comparaison sont définis avant de connaître les résultats.'},
  {id:'best',label:'Trouver la méthode qui améliore tout, sans choisir de critère.',correct:false,feedback:'Un résultat vague permet de changer les règles après avoir vu les données.'},
 ]},
 {id:'units',title:'Unités expérimentales',options:[
  {id:'independent',label:'Prévoir plusieurs unités indépendantes pour chaque organisation.',correct:true,feedback:'Les répétitions indépendantes renseignent la variabilité entre unités.'},
  {id:'paired',label:'Prévoir des blocs comparables avec les deux organisations dans chaque bloc.',correct:true,feedback:'Les blocs peuvent limiter une hétérogénéité identifiée ; l’affectation reste à organiser.'},
  {id:'subsamples',label:'Peser plusieurs fois le même échantillon et appeler cela plusieurs répétitions.',correct:false,feedback:'Ces répétitions de mesure ne créent pas de nouvelles unités expérimentales.'},
 ]},
 {id:'allocation',title:'Affectation et référence',options:[
  {id:'random',label:'Garder une référence et répartir aléatoirement les modalités dans le plan adapté.',correct:true,feedback:'La référence et la randomisation réduisent certains biais, sans garantir à elles seules un résultat.'},
  {id:'seasons',label:'Comparer une méthode l’an dernier à une autre cette année, sur une autre parcelle.',correct:false,feedback:'Saison, parcelle et méthode changent ensemble : leur effet est confondu.'},
 ]},
 {id:'measures',title:'Mesure et suivi',options:[
  {id:'common',label:'Prévoir les mêmes prélèvements et mesures, conserver les écarts, noter travail et ressources.',correct:true,feedback:'Les méthodes communes rendent les résultats interprétables ; les écarts ne sont pas effacés.'},
  {id:'winner',label:'Ne retenir que le meilleur résultat et oublier les valeurs gênantes.',correct:false,feedback:'Sélectionner les données après coup fausse la conclusion.'},
 ]},
] as const;
export const HARVEST_CASE_DOCUMENTS = [
 {id:'specification',title:'Cahier des critères',question:'Les règles de classement sont-elles identiques ?',text:'Exercice fictif : le client applique en 2026 des critères de tri plus stricts qu’en 2025. Le dossier n’a pas recalculé les deux lots avec une grille commune.',limit:'Une hausse des refus peut résulter en partie du changement de critères, sans prouver une dégradation physique.',sourceIds:['harvest-tool-grain-quality']},
 {id:'sampling',title:'Fiches de prélèvement',question:'Les échantillons représentent-ils la même chose ?',text:'En 2025, le rapport décrit un échantillon composite. En 2026, seul un prélèvement en surface du lot est décrit. L’odeur et la proportion de grains cassés n’ont pas été observées avec une méthode commune.',limit:'La différence peut inclure un effet d’échantillonnage. Il faut comparer des bases et des méthodes adaptées.',sourceIds:['harvest-tool-sampling','harvest-tool-analysis']},
 {id:'handling',title:'Carnet de manutention',question:'Quelles opérations ont changé ?',text:'Le carnet mentionne une nouvelle organisation et davantage de transferts. Les masses, l’état des grains et les incidents ne sont pas relevés aux mêmes étapes.',limit:'Des dommages de manutention sont une hypothèse à examiner, pas une cause démontrée par la seule succession des événements.',sourceIds:['harvest-tool-grain-quality','harvest-tool-records']},
 {id:'storage',title:'Journal du local',question:'Que sait-on des conditions de conservation ?',text:'Des interruptions de suivi sont notées. Une observation mentionne de la condensation sur une paroi, sans mesure représentative dans les graines ni analyse confirmant une atteinte.',limit:'Cette information justifie de rechercher l’hétérogénéité et les conditions réelles ; elle ne prouve pas une moisissure dans tout le lot.',sourceIds:['harvest-tool-grain-quality','harvest-tool-records']},
 {id:'context',title:'Parcelle et saison',question:'Peut-on attribuer la différence à une seule cause ?',text:'Le lot 2026 provient d’une autre parcelle et d’une autre saison. Le nom de variété est le même, mais l’historique des semences, du sol et de l’état sanitaire est incomplet.',limit:'Le nom ne garantit pas une performance fixe ; plusieurs facteurs restent confondus dans l’avant/après.',sourceIds:['harvest-tool-experiment','harvest-tool-records']},
 {id:'advert',title:'Promesse commerciale',question:'Ce document apporte-t-il une mesure ?',text:'Une publicité fictive affirme : « Le même nom de variété garantit la même qualité, et une odeur agréable prouve un bon lot. » Aucun résultat sur les graines étudiées n’est joint.',limit:'Ni un nom ni une note aromatique ne remplacent une caractérisation adaptée aux graines et à leur destination.',sourceIds:['harvest-tool-analysis','harvest-tool-grain-quality']},
] as const;
export const HARVEST_CASE_HYPOTHESES = [
 {id:'sampling',title:'Une comparaison biaisée par le prélèvement',valid:true,evidence:['sampling'],feedback:'Les méthodes diffèrent : un nouvel échantillonnage comparable pourrait confirmer ou réduire cette explication.'},
 {id:'criteria',title:'Un classement modifié par les critères commerciaux',valid:true,evidence:['specification'],feedback:'Une grille commune pourrait montrer quelle part des refus vient du classement.'},
 {id:'handling',title:'Des dommages liés à la manutention',valid:true,evidence:['handling'],feedback:'Comparer l’état des graines à des étapes tracées permettrait d’examiner cette hypothèse.'},
 {id:'storage',title:'Des conditions de conservation hétérogènes',valid:true,evidence:['storage'],feedback:'Des observations et mesures représentatives sont nécessaires pour apprécier cette possibilité.'},
 {id:'toxin',title:'Une toxine précise est déjà prouvée par l’odeur',valid:false,evidence:[],feedback:'L’odeur ne démontre ni l’identité ni la concentration d’une toxine. Une hypothèse n’est pas un résultat analytique.'},
 {id:'deficiency',title:'Une carence est confirmée ; il faut ajouter un intrant',valid:false,evidence:[],feedback:'Le dossier ne permet pas ce diagnostic. Un apport ne se justifie pas depuis cette seule baisse de qualité signalée.'},
] as const;
export const HARVEST_CASE_ACTIONS = [
 {id:'observe',title:'Compléter les observations et les analyses adaptées avant de modifier la pratique.',reason:'uncertainty',feedback:'Une information utile peut éviter une intervention sans cause étayée. Observer davantage est ici une décision recevable.'},
 {id:'hold',title:'Conserver l’identité du lot, le mettre en attente et vérifier les conditions signalées.',reason:'precaution',feedback:'La mise en attente est proportionnée au dossier incertain ; elle ne signifie pas qu’un contaminant soit déjà démontré.'},
 {id:'add',title:'Ajouter un intrant à la parcelle parce que l’odeur a changé.',reason:null,feedback:'Cette réponse relie un symptôme non spécifique à une intervention sans confirmation.'},
] as const;
export const HARVEST_CASE_REASONS = [
 {id:'uncertainty',text:'Les observations et méthodes ne permettent pas encore d’attribuer la différence ; préciser les preuves peut changer la décision.'},
 {id:'precaution',text:'La destination et la sécurité restent à vérifier ; préserver le lot et sa traçabilité permet une décision révisable.'},
 {id:'guarantee',text:'Une intervention supplémentaire garantit une amélioration dans toutes les situations.'},
] as const;
export const HARVEST_CASE_FOLLOWUPS = [
 {id:'measure',title:'Prévoir des prélèvements comparables, les mêmes critères et des relevés aux étapes identifiées.',reason:'same-basis',feedback:'Le suivi vise à distinguer les hypothèses. Conserver aussi les résultats qui les contredisent.'},
 {id:'trial',title:'Préparer un essai distinct avec référence, répétitions indépendantes et critères définis avant les résultats.',reason:'test',feedback:'Un essai adapté peut examiner une hypothèse. Il ne remplace pas l’évaluation sanitaire du lot présent.'},
 {id:'winner',title:'Conserver seulement la prochaine valeur qui paraît meilleure.',reason:null,feedback:'Cette sélection après coup empêcherait de mesurer honnêtement le résultat.'},
] as const;
export const HARVEST_CASE_FOLLOWUP_REASONS = [
 {id:'same-basis',text:'Une méthode commune et des repères tracés peuvent départager un effet de mesure et une évolution réelle.'},
 {id:'test',text:'Comparer dans un plan adapté réduit certaines confusions, tout en gardant la variabilité et les limites visibles.'},
 {id:'certainty',text:'Un seul résultat favorable démontre un effet universel.'},
] as const;
export type HarvestCaseState={requested:string[];hypotheses:string[];evidence:Record<string,string>;action:string;reason:string;followup:string;followupReason:string;checked:boolean};
export function evaluateHarvestCase(state:HarvestCaseState) {
 const scope=['specification','sampling'].every(id=>state.requested.includes(id));
 const hypotheses=new Set(state.hypotheses).size>=2&&state.hypotheses.every(id=>{
  const h=HARVEST_CASE_HYPOTHESES.find(item=>item.id===id);return h?.valid&&state.requested.includes(state.evidence[id])&&(h.evidence as readonly string[]).includes(state.evidence[id]);
 });
 const action=HARVEST_CASE_ACTIONS.find(a=>a.id===state.action);
 const followup=HARVEST_CASE_FOLLOWUPS.find(f=>f.id===state.followup);
 const actionValid=Boolean(action?.reason&&action.reason===state.reason);
 const followupValid=Boolean(followup?.reason&&followup.reason===state.followupReason);
 return {scope,hypotheses,action:actionValid,followup:followupValid,passed:scope&&hypotheses&&actionValid&&followupValid};
}
export const HARVEST_REVISION_LINKS = [
 {label:'Histoire : le débouché change le critère',course:'history',passage:'history-brittany-1'},
 {label:'Botanique : identifier matière et variété',course:'plant',passage:'botany-diversity-1'},
 {label:'Terpènes : une odeur ne suffit pas',course:'molecules',passage:'terpenes-vocabulary-1'},
 {label:'Cannabinoïdes : lire une preuve analytique',course:'evidence',passage:'cannabinoids-identity-2'},
 {label:'Culture : contexte et compromis',course:'genetics',passage:'cultivation-axes-1'},
 {label:'Santé : plusieurs causes possibles',course:'biodiversity',passage:'health-causes-2'},
 {label:'Sol : interpréter une mesure',course:'uses',passage:'soil-analysis-1'},
 {label:'Produits : le certificat et son lot',course:'profiles',passage:'products-quality-2'},
] as const;
