import json,pathlib
r=pathlib.Path('C:/lesiteinternetquitue/docs/encyclopedia-revision/batches')
for p in list(r.glob('cannabinoids-*.json'))+list(r.glob('history-*.json')):
 d=json.loads(p.read_text(encoding='utf-8'))
 for s in d['sources']:
  if s['id']=='qh-sci-cb1-catalogue':s['author']='Lisa A. Matsuda, Stephen J. Lolait, Michael J. Brownstein, Alice C. Young et Tom I. Bonner'
  if s['id']=='qh-culture-merriam':s['author']='Rédaction de Merriam-Webster'
  if s['id']=='qh-hist-csa-policy':s['author']='Drug Enforcement Administration'
  if s['id']=='qh-hist-un1961-depositary':s['author']='Secrétaire général des Nations unies, dépositaire'
  if s['id']=='qh-hist-laguardia':
   s['author']='Mayor’s Committee on Marihuana ; New York Academy of Medicine'
   s['organization']='Mayor’s Committee on Marihuana / New York Academy of Medicine (rapport numérisé)'
  if s['id']=='qh-hist-anslinger':s['published']='non indiquée'
 for a in d['articles']:
  a['questions']=[('Quelle identité, origine et quel niveau de preuve caractérisent Les phytocannabinoïdes ?' if q=='Quelle identit?, origine et quel niveau de preuve caract?risent Les phytocannabinoïdes ?' else q) for q in a['questions']]
  if d['domain']=='history':a['questions']=[q['prompt'] for q in d['quizPatches'] if q['articleId']==a['id']]
 p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Métadonnées et corruptions identifiées corrigées explicitement, sans remplacement aveugle.')
