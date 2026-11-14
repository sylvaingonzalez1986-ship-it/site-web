import json,pathlib,copy
r=pathlib.Path('C:/lesiteinternetquitue/docs/encyclopedia-revision')
base=json.loads((r/'assignments/cannabinoids.json').read_text(encoding='utf-8-sig'))
p=r/'batches/cannabinoids-04.json';b=json.loads(p.read_text(encoding='utf-8'))
a=next(a for a in b['articles'] if a['id']=='record-cannabinoid-thcv')
sid='cb-thcv-human-2016'
s=copy.deepcopy(next(s for s in base['sources'] if s['id']==sid))
u='https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=27573936,42575778&retmode=xml'
s.update(url='https://pubmed.ncbi.nlm.nih.gov/27573936/',verifiedAt='2026-11-14',access='abstract',passage='Résumé original PMID 27573936, quatre AbstractText de la réponse EUtils XML : objectif, méthodes, résultats, conclusion ; 62 sujets, cinq bras, 13 semaines, HDL principal inchangé.',limitation='Résumé original réellement lu via EUtils HTTP dans exec, après signalement de ce point d’accès par la contrelectrice terpenes. La page PubMed et le document intégral n’ont pas été accessibles dans le lecteur web. Pas de tableaux, d’effectifs par bras ou de détail des événements indésirables vérifiés au-delà du résumé.')
s['reviewEvidence']=[dict(url=u,openedAt='2026-11-14',sections='PubmedArticle PMID 27573936 : ArticleTitle et quatre AbstractText complets',result='Réponse XML récupérée sur le réseau public par urllib.request dans exec et texte effectivement affiché et lu ; essai pilote confirmé. Le lecteur web ne rendait pas cet endpoint.',supports='Population sans insulinothérapie ; 62 sujets randomisés, cinq bras, 13 semaines ; HDL inchangé et signaux secondaires glycémiques ; associations sans effet significatif sur les critères dans le résumé.',access='abstract')]
b['sources']=[x for x in b['sources'] if x['id']!=sid]+[s]
a['patch']['sourceIds']=list(dict.fromkeys(a['patch']['sourceIds']+[sid]))
a['sourceIdsReviewed']=list(dict.fromkeys(a['sourceIdsReviewed']+[sid]))
human=next(x for x in a['patch']['sections'] if x['id']=='human')
human['paragraphs']=['L’essai pilote randomisé en double aveugle de Jadoon et ses collègues porte sur 62 adultes atteints de diabète de type 2 sans insulinothérapie, répartis entre cinq groupes durant 13 semaines : CBD, THCV, deux associations de ces molécules ou placebo. Le groupe THCV reçoit 5 mg deux fois par jour ; cette quantité décrit l’expérience et ne constitue pas un conseil d’utilisation. Le critère principal, la concentration de HDL-cholestérol, n’est pas amélioré.','Le résumé rapporte une diminution de la glycémie à jeun sous THCV par rapport au placebo, avec une différence estimée de −1,2 mmol/L, ainsi que d’autres signaux métaboliques secondaires. Les associations ne modifient pas significativement les critères rapportés. Le petit effectif réparti en cinq groupes et les nombreux critères explorés appellent une confirmation ; ces résultats ne démontrent ni un traitement établi du diabète ni une propriété amaigrissante.']
human['sourceIds']=[sid]
risk=next(x for x in a['patch']['sections'] if x['id']=='risks')
risk['paragraphs']=['Le résumé décrit CBD et THCV comme bien tolérés pendant cet essai pilote. Il ne fournit pas ici le détail des événements indésirables, ni une sécurité chronique dans d’autres populations. Un signal sur un critère secondaire métabolique ne justifie pas les slogans de perte de poids ; l’exposition et les associations doivent être étudiées spécifiquement.']
risk['sourceIds']=[sid]
dia=a['patch']['diagram']
next(n for n in dia['nodes'] if n['label']=='Humain')['detail']='62 sujets, cinq bras, 13 semaines : HDL principal inchangé ; signaux métaboliques secondaires à confirmer.'
dia['sourceIds']=list(dict.fromkeys(dia['sourceIds']+[sid]))
a['status']='ready-for-integration';a['blockers']=[]
a['findings']=[f for f in a['findings'] if 'essai diabète non déclaré' not in f]
a['findings'].append('Blocage documentaire du résumé levé par lecture directe EUtils, après contrelecture terpenes ; référence clinique attribuée aux sections humain et risques, distincte de la source cellulaire Zagzoog. Texte intégral et tableaux non lus.')
b['sensitivePoints'].append('THCV : résumé Jadoon2016 désormais directement lu via EUtils ; ne pas confondre critère principal HDL négatif et signaux secondaires, ni les données du THCV avec celles d’un médicament au CBD. Pas de détail clinique au-delà de l’abstract.')
p.write_text(json.dumps(b,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

p=r/'batches/cannabinoids-08.json';b=json.loads(p.read_text(encoding='utf-8'))
a=next(a for a in b['articles'] if a['id']=='record-study-hhc-metabolites-2026')
res=next(x for x in a['patch']['sections'] if x['id']=='results')
res['paragraphs'].append('Pour M2, les auteurs envisagent aussi une impureté déjà présente dans le produit, car son profil temporel ressemble à celui des épimères HHC ; cette hypothèse n’a pas été testée sur le produit initial. Un signal détecté après exposition n’est donc pas automatiquement un métabolite formé dans l’organisme.')
a['findings'].append('Contrelecture chimique puis relecture directe du PDF, section Limitations : hypothèse d’une impureté préexistante pour M2 rendue visible ; attribution métabolique non présentée comme certaine.')
s=next(s for s in b['sources'] if s['id']=='can-study-hhc26')
s['reviewEvidence'].append(dict(url='https://www.nature.com/articles/s41598-026-62767-x.pdf',openedAt='2026-11-14',sections='Section Limitations, 7e page du PDF (index 6), passage sur M2 et conservation ; Conclusions, page suivante.',result='PDF ouvert et passage lu directement : présence initiale possible de M2 dans le produit, non testée.',supports='Hypothèse d’impureté pour M2, distincte d’un métabolite démontré ; prudence sur les marqueurs de consommation.',access='excerpt'))
b['sensitivePoints'].append('M2 HHC2026 : peut provenir d’une impureté initiale, hypothèse non vérifiée. Ne pas présenter les trois signaux M1–M3 comme trois structures pleinement identifiées et nécessairement biosynthétisées in vivo.')
p.write_text(json.dumps(b,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Corrections ciblées uniquement : THCV lot04 et M2 HHC2026 lot08.')
