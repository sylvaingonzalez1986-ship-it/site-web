"""Read original Commons metadata and fetch only commercially reusable photos."""
from pathlib import Path
import urllib.request, urllib.parse, json, re, html, sys, time
ROOT=Path(__file__).parent
DEST=ROOT.parents[1]/'public/placard/reference/health'
DEST.mkdir(parents=True,exist_ok=True)
def get(url):
    return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'QuizzShowReferenceReview/1.0'}),timeout=30).read()
def clean(s): return html.unescape(re.sub('<[^>]*>','',s or '')).strip()
def api(**kw):
    return json.loads(get('https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode({'format':'json',**kw})))
def search(term):
    r=api(action='query',generator='search',gsrsearch=term,gsrnamespace=6,gsrlimit=4,prop='imageinfo',iiprop='url|extmetadata')
    for p in r.get('query',{}).get('pages',{}).values():
        ii=p.get('imageinfo',[{}])[0];m=ii.get('extmetadata',{})
        print(json.dumps({'term':term,'file':p['title'],'license':clean(m.get('LicenseShortName',{}).get('value')),'author':clean(m.get('Artist',{}).get('value')),'description':clean(m.get('ImageDescription',{}).get('value'))[:400]},ensure_ascii=False))
def download(title,name,entry=None):
    if entry is None:
        r=api(action='query',titles=title,prop='imageinfo',iiprop='url|extmetadata')
        entry=next(iter(r['query']['pages'].values()))['imageinfo'][0]
    ii=entry;m=ii['extmetadata']
    lic=clean(m.get('LicenseShortName',{}).get('value'))
    if 'NC' in lic or 'ND' in lic or not any(x in lic for x in ('CC BY','CC0','Public domain')):
        print('NOT DOWNLOADED: incompatible or uncertain license',title,lic);return
    if not (DEST/name).exists():
        (DEST/name).write_bytes(get(ii.get('thumburl') or ii['url'].split('?')[0]))
    out={'file':title,'src':'/placard/reference/health/'+name,'sourceUrl':ii['descriptionurl'],'originalUrl':ii['url'],'author':clean(m.get('Artist',{}).get('value')),'license':lic,'licenseUrl':m.get('LicenseUrl',{}).get('value') or 'https://commons.wikimedia.org/wiki/Commons:Copyright_rules_by_territory/United_States#Federal_government_works','description':clean(m.get('ImageDescription',{}).get('value')),'date':clean(m.get('DateTimeOriginal',{}).get('value')),'credit':clean(m.get('Credit',{}).get('value')),'metadataReadAt':'2026-11-14','imageViewed':False}
    path=ROOT/'health-media-manifest.json'
    manifest=json.loads(path.read_text(encoding='utf-8')) if path.exists() else []
    manifest=[x for x in manifest if x['src']!=out['src']]+[out]
    path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:out[k] for k in ('src','author','license','description')},ensure_ascii=False))
if __name__=='__main__':
    if sys.argv[1]=='search':
        for term in sys.argv[2:]: search(term)
    elif sys.argv[1]=='batch':
        tasks=[
            ('File:Myzus persicae.jpg','myzus-persicae.jpg'),
            ('File:5368119-PPT-broad mite (Polyphagotarsonemus latus).jpg','broad-mite-micro.jpg'),
            ('File:Frankliniella occidentalis 5364132-LGPT.jpg','thrips-occidentalis.jpg'),
            ('File:Trialeurodes vaporariorum 01.JPG','trialeurodes.jpg'),
            ('File:Bemisia tabaci from USDA 1.jpg','bemisia.jpg'),
            ('File:Helicoverpa zea larva.jpg','helicoverpa.jpg'),
            ('File:Ostrinia nubilalis (European corn borer), Arnhem, the Netherlands.jpg','ostrinia.jpg'),
            ('File:Grapholita delineana.jpg','grapholita.jpg'),
            ('File:Psylliodes attenuata (10.3897-BDJ.12.e120340) Figure 1a.jpg','psylliodes.jpg'),
            ('File:Deroceras reticulatum Ireland 2021.jpg','deroceras.jpg'),
            ('File:Columba palumbus ssp. palumbus.jpg','columba.jpg'),
            ('File:Sclerotinia sclerotiorum sclerortia.jpg','sclerotia.jpg'),
            ('File:Rhizoctonia hyphae 160X.png','rhizoctonia.png'),
            ('File:Phytoseiulus persimilis.png','phytoseiulus.png'),
            ('File:Aphid mummy - Aphidae - Braconidae (24484947320).jpg','aphid-mummy.jpg'),
            ('File:Chrysoperla carnea s.l. - (larva), Arnhem, the Netherlands.jpg','chrysoperla.jpg'),
            ('File:Coccinella septempunctata, larva eating aphids.jpg','coccinella-larva.jpg')]
        r=api(action='query',titles='|'.join(t for t,n in tasks),prop='imageinfo',iiprop='url|extmetadata',iiurlwidth=960)
        (ROOT/'health-commons-cache.json').write_text(json.dumps(r,ensure_ascii=False),encoding='utf-8')
        pages={p['title']:p for p in r.get('query',{}).get('pages',{}).values()}
        for title,name in tasks:
            try: download(title,name,pages[title]['imageinfo'][0])
            except Exception as e: print('FAILED',title,str(e))
            time.sleep(1)
    else: download(sys.argv[2],sys.argv[3])
