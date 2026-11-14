import json,pathlib,copy
root=pathlib.Path('C:/lesiteinternetquitue')
science=root/'docs/encyclopedia-revision/batches'
target=root/'docs/encyclopedia-vulgarisation/batches'
names=['cannabinoids-%02d.json'%i for i in range(1,9)]+['history-01.json','regulation-01.json']
batches={n:json.loads((science/n).read_text(encoding='utf8')) for n in names}
articles={a['id']:a for b in batches.values() for a in b['articles']}
baseline=json.loads((root/'docs/encyclopedia-revision/baseline-quiz.json').read_text(encoding='utf8'))
quiz={q['id']:q for q in baseline}
for b in batches.values():
 for q in b['quizPatches']:quiz[q['id']]={**quiz.get(q['id'],{}),**q}
for q in json.loads((root/'src/lib/kanab-quest-hemp-quiz-reviewed.json').read_text(encoding='utf8')):quiz[q['id']]={**quiz.get(q['id'],{}),**q}
def setarticle(aid,lead,sections,question,terms,example,checks,titles=None):
 a=articles[aid];a['patch']['lead']=lead
 assert len(sections)==len(a['patch']['sections']),(aid,len(sections))
 for i,(sec,body) in enumerate(zip(a['patch']['sections'],sections)):
  sec['paragraphs']=body if isinstance(body,list) else [body]
  if titles:sec['title']=titles[i]
 a['pedagogicalReview']=dict(reviewedAt='2026-11-14',entryQuestion=question,explainedTerms=terms,example=example,movedDetails=[],comprehensionChecks=checks,quizIdsReviewed=[q['id'] for q in quiz.values() if q.get('articleId')==aid])
def diagram(aid,title,nodes,caption,after=None,kind=None):
 a=articles[aid];d=a['patch']['diagram'];d['title']=title;d['nodes']=[dict(label=l,detail=t) for l,t in nodes];d['caption']=caption
 d['afterSectionId']=after or a['patch']['sections'][0]['id']
 if kind:d['kind']=kind
def details(aid,index,paragraphs,title='Pour aller plus loin'):
 s=articles[aid]['patch']['sections'][index]
 s['details']=dict(title=title,paragraphs=paragraphs,sourceIds=s['sourceIds'][:])
 articles[aid]['pedagogicalReview']['movedDetails'].append(s['id'])
def write(name):
 b=batches[name];ids={a['id'] for a in b['articles']}
 b['quizPatches']=[{k:copy.deepcopy(q[k]) for k in ['id','prompt','options','answer','explanation','articleId','sourceIds'] if k in q} for q in quiz.values() if q.get('articleId') in ids]
 for a in b['articles']:
  assert 'pedagogicalReview' in a,a['id']
  a['questions']=[q['prompt'] for q in b['quizPatches'] if q['articleId']==a['id']] or [a['pedagogicalReview']['entryQuestion']]
  a['quizIdsReviewed']=[q['id'] for q in b['quizPatches'] if q['articleId']==a['id']]
  for q in b['quizPatches']:
   if q['articleId']==a['id']:assert set(q['sourceIds'])<=set(a['patch']['sourceIds']),(q['id'],q['sourceIds'])
 from language import polish_batch
 polish_batch(b)
 (target/name).write_text(json.dumps(b,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 print(name,len(ids),'fiches',len(b['quizPatches']),'quiz')
