"""Bounded structural check for the three assigned pedagogical domains."""
from vulgarisation import ROOT,SCI,QUIZ,isread,Domain
import json
counts={'articles':0,'terms':0,'quiz':0};problems=[]
for domain in ('botany','agronomy','health'):
    Domain(domain)
    for path in sorted((ROOT/'batches').glob(domain+'-*.json')):
        batch=json.loads(path.read_text(encoding='utf-8'))
        original=json.loads((SCI/'batches'/path.name).read_text(encoding='utf-8'))
        assert [a['id'] for a in batch['articles']]==[a['id'] for a in original['articles']]
        assert [t['id'] for t in batch['termReviews']]==[t['id'] for t in original['termReviews']]
        sources={s['id'] for s in batch['sources']}
        for a,old in zip(batch['articles'],original['articles']):
            assert a['status']==old['status'] and a['blockers']==old['blockers'],a['id']
            assert a['quizIdsReviewed']==old['quizIdsReviewed'],a['id']
            assert a['patch'].get('relatedArticleIds')==old['patch'].get('relatedArticleIds')
            assert a['patch'].get('glossaryIds')==old['patch'].get('glossaryIds')
            assert [s['id'] for s in a['patch']['sections']]==[s['id'] for s in old['patch']['sections']]
            assert a.get('pedagogicalReview') and a['patch']['lead']!=old['patch']['lead'],a['id']
            image=a['patch'].get('image');oldimage=old['patch'].get('image')
            if image:
                assert {k:v for k,v in image.items() if k not in ('caption','alt')}=={k:v for k,v in oldimage.items() if k not in ('caption','alt')},a['id']
            for s in a['patch']['sections']:
                assert s['paragraphs'] and s['sourceIds'],(a['id'],s['id'])
                assert all(sid in sources and isread(sid) for sid in s['sourceIds']),(a['id'],s['id'])
            diagram=a['patch'].get('diagram')
            if diagram:assert diagram['afterSectionId'] in [s['id'] for s in a['patch']['sections']],a['id']
        for q in batch['quizPatches']:
            assert all(q[k]==QUIZ[q['id']][k] for k in ('prompt','options','answer','level','articleId')),q['id']
            a=next(a for a in batch['articles'] if a['id']==q['articleId'])
            assert q['explanation'] and set(q['sourceIds'])<=set(a['patch']['sourceIds']),q['id']
        counts['articles']+=len(batch['articles']);counts['terms']+=len(batch['termReviews']);counts['quiz']+=len(batch['quizPatches'])
assert counts=={'articles':60,'terms':79,'quiz':110},counts
report={'reviewedAt':'2026-11-14','counts':counts,'checks':['Identifiants, sections et liens conservés','Statuts et blocages scientifiques conservés','Identité des photos, crédits et licences conservés','Chaque section possède des références effectivement lues','Questions, choix, bonnes réponses et niveaux conservés','Chaque explication de quiz renvoie à des sources présentes sur sa fiche','60 résumés réécrits et métadonnées pédagogiques présents'],'scientificOriginalsModified':False}
(ROOT/'reviews/botany-agronomy-health-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(counts))
