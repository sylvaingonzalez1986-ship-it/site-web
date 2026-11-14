import json,pathlib,re
root=pathlib.Path('C:/lesiteinternetquitue')
folder=root/'docs/encyclopedia-vulgarisation/batches'
groups={'cannabinoids':['cannabinoids-%02d.json'%i for i in range(1,9)],'history':['history-01.json'],'regulation':['regulation-01.json']}
for domain,names in groups.items():
 batches=[json.loads((folder/n).read_text(encoding='utf8')) for n in names]
 aa=[a for b in batches for a in b['articles']]
 public=[]
 for a in aa:
  p=a['patch'];public.append(p['lead'])
  for s in p['sections']:
   public+=s['paragraphs']
   public+=s.get('details',{}).get('paragraphs',[])
  public+=[p['diagram']['title'],p['diagram']['caption']]
 for b in batches:
  public += [q['explanation'] for q in b['quizPatches']]
 text=' '.join(public)
 assert not any(bad in text for bad in ['dossier initial','éditeur refusé','CAPTCHA','de l’tableau',',-cholestérol','\ufffd'])
 assert not re.search(r'\w\?\w',text),'accent remplacé'
 report=dict(domain=domain,reviewedAt='2026-11-14',scope='Réécriture pédagogique individuelle, réutilisant les preuves scientifiques déjà relues.',batchFiles=names,articleIds=[a['id'] for a in aa],termIds=[t['id'] for b in batches for t in b['termReviews']],quizIds=[q['id'] for b in batches for q in b['quizPatches']],counts=dict(articles=len(aa),terms=sum(len(b['termReviews']) for b in batches),quizExplanations=sum(len(b['quizPatches']) for b in batches)),checks=['Lecture des nouveaux textes, exemples, titres et légendes ; termes définis lors de leur introduction.','Anciennes ancres de sections conservées directement ou dans anchorIds ; diagrammes après les éléments expliqués.','Références de sections et questions incluses dans la fiche ; indices de réponse conservés.','Statuts et blocages scientifiques conservés ; aucune nouvelle recherche générale ni modification des originaux.'],difficulties=[])
 if domain=='cannabinoids':
  report['difficulties']=['Trois blocages scientifiques maintenus : origines/découvertes, position carboxyle du THCA-B et détails complets CBG2026.','Les notices ont été regroupées en trois sections avec titres adaptés, pour éviter les réserves répétées. Les études distinguent comparaison, résultat principal et limites spécifiques.']
 if domain=='history':
  report['difficulties']=['Les 90 réponses sont enseignées dans les deux fiches, subdivisées par type de trace et rôle juridique. Les informations rapportées par une synthèse restent attribuées à celle-ci.','Correction grammaticale de « de l’tableau » en « du tableau » dans les quiz concernés, sans changement d’indice ou de réponse scientifique.']
 if domain=='regulation':report['difficulties']=['Les neuf questions de conservation, absentes des patches scientifiques initiaux, sont reprises depuis le quiz courant.','Territoires, dates de vérification et catégories juridiques maintenus ; les seuils de composition ne sont pas présentés comme des autorisations.']
 out=root/'docs/encyclopedia-vulgarisation/reviews'/f'{domain}.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 print(domain,report['counts'])
