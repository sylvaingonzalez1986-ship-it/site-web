"""Write pedagogical copies; scientific review batches are read-only inputs."""
from pathlib import Path
import json,copy
ROOT=Path(__file__).resolve().parent
REPO=ROOT.parents[1]
SCI=REPO/'docs/encyclopedia-revision'
QUIZ={q['id']:q for q in json.loads((SCI/'baseline-quiz.json').read_text(encoding='utf-8'))}
for patch in json.loads((REPO/'src/lib/kanab-quest-hemp-quiz-reviewed.json').read_text(encoding='utf-8')):
    QUIZ[patch['id']].update(patch)
ALL_SOURCES={s['id']:s for p in (SCI/'batches').glob('*.json') for s in json.loads(p.read_text(encoding='utf-8')).get('sources',[])}
def isread(sid):
    s=ALL_SOURCES.get(sid,{})
    return any(e.get('status')!='not-reverified' and e.get('result') not in ('inaccessible','unavailable','not-reverified') and bool(e.get('sectionsOpened') or e.get('sections') or e.get('assertionsSupported') or e.get('supports')) for e in s.get('reviewEvidence',[]))
class Domain:
    def __init__(self,domain):
        self.domain=domain
        self.paths=sorted((SCI/'batches').glob(domain+'-*.json'))
        self.batches=[json.loads(p.read_text(encoding='utf-8')) for p in self.paths]
        for b in self.batches:
            for patch in b.get('quizPatches',[]):QUIZ[patch['id']].update(patch)
        self.articles=[a for b in self.batches for a in b['articles']]
        self.old=copy.deepcopy(self.articles)
        self.done=set();self.term_done=set();self.quiz_done=set()
    def article(self,index,lead,sections,question,terms,example,check,answer,details=None):
        a=self.articles[index];p=a['patch']
        assert len(sections)==len(p['sections']),(a['id'],len(sections),len(p['sections']))
        p['lead']=lead
        for s,(title,paragraphs) in zip(p['sections'],sections):
            s['title']=title;s['paragraphs']=paragraphs
            s['sourceIds']=list(dict.fromkeys(x for x in s['sourceIds'] if isread(x)))
        moved=[]
        for sid,block in (details or {}).items():
            s=next(s for s in p['sections'] if s['id']==sid)
            s['details']={'title':block[0],'paragraphs':block[1],'sourceIds':s['sourceIds'][:]}
            moved.append(sid)
        a['pedagogicalReview']={'reviewedAt':'2026-11-14','entryQuestion':question,'explainedTerms':terms,'example':example,'detailsMovedTo':moved,'comprehensionChecks':[{'question':check,'expectedAnswer':answer}],'quizIdsReviewed':a['quizIdsReviewed'][:], 'method':'Réécriture individuelle : définition, mécanisme, exemple ; réserves essentielles intégrées au passage concerné.'}
        self.done.add(a['id'])
    def term(self,tid,definition):
        found=False
        for b in self.batches:
            for t in b['termReviews']:
                if t['id']==tid:
                    t['definition']=definition;t['sourceIds']=[x for x in dict.fromkeys(t['sourceIds']) if isread(x)]
                    t['pedagogicalReview']={'definitionAndExampleRead':True};self.term_done.add(tid);found=True
        assert found,tid
    def quiz(self,qid,explanation):
        q=copy.deepcopy(QUIZ[qid]);q['explanation']=explanation
        a=next(a for a in self.articles if a['id']==q['articleId'])
        sourceIds=[sid for s in a['patch']['sections'] for sid in s['sourceIds']]
        q['sourceIds']=[sid for sid in q['sourceIds'] if sid in sourceIds and isread(sid)] or list(dict.fromkeys(sourceIds))[:2]
        for b in self.batches:
            if a in b['articles']:
                b['quizPatches']=[x for x in b['quizPatches'] if x['id']!=qid]+[q]
        self.quiz_done.add(qid)
    def caption(self,index,caption,alt=None):
        image=self.articles[index]['patch'].get('image')
        if image:image['caption']=caption
        if image and alt:image['alt']=alt
    def diagram(self,index,title,nodes,caption,after=None):
        d=self.articles[index]['patch'].get('diagram');assert d
        d['title']=title;d['nodes']=[{'label':x,'detail':y} for x,y in nodes];d['caption']=caption
        if after:d['afterSectionId']=after
    def write(self,complete=False):
        outdir=ROOT/'batches';outdir.mkdir(parents=True,exist_ok=True)
        for path,b in zip(self.paths,self.batches):
            aids={a['id'] for a in b['articles']}
            if not aids<=self.done:continue
            requiredterms={t['id'] for t in b['termReviews']}
            requiredquiz={q for a in b['articles'] for q in a['quizIdsReviewed']}
            if not requiredterms<=self.term_done or not requiredquiz<=self.quiz_done:continue
            sources=set()
            for a in b['articles']:
                p=a['patch'];sids=[x for s in p['sections'] for x in s['sourceIds']]
                if p.get('diagram'):sids+=p['diagram']['sourceIds']
                sids+=[sid for q in b['quizPatches'] if q['articleId']==a['id'] for sid in q['sourceIds']]
                p['sourceIds']=list(dict.fromkeys(sids));sources.update(sids)
                assert all(s['paragraphs'] and s['sourceIds'] for s in p['sections']),a['id']
            sources.update(s for t in b['termReviews'] for s in t['sourceIds'])
            b['sources']=[copy.deepcopy(ALL_SOURCES[s]) for s in ALL_SOURCES if s in sources]
            b['pedagogicalReview']={'reviewedAt':'2026-11-14','articles':len(b['articles']),'terms':len(b['termReviews']),'quizExplanations':len(b['quizPatches']),'scientificOriginalsModified':False}
            (outdir/path.name).write_text(json.dumps(b,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
            print(path.name,len(b['articles']),len(b['termReviews']),len(b['quizPatches']))
        if complete:
            assert len(self.done)==len(self.articles),(len(self.done),len(self.articles))
            assert {t['id'] for b in self.batches for t in b['termReviews']}<=self.term_done
            assert {q for a in self.articles for q in a['quizIdsReviewed']}<=self.quiz_done
            review={'domain':self.domain,'reviewedAt':'2026-11-14','articleIds':sorted(self.done),'termIds':sorted(self.term_done),'quizIds':sorted(self.quiz_done),'blockers':[{'id':a['id'],'blockers':a['blockers']} for a in self.articles if a['status']=='blocked'],'scientificOriginalsModified':False}
            (ROOT/'reviews').mkdir(exist_ok=True)
            (ROOT/f'reviews/{self.domain}.json').write_text(json.dumps(review,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
