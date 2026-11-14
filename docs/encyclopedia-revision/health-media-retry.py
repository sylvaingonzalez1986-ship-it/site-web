import json,time,runpy
from pathlib import Path
m=runpy.run_path(str(Path(__file__).with_name('health-media.py')))
tasks={'File:Ostrinia nubilalis (European corn borer), Arnhem, the Netherlands.jpg':'ostrinia.jpg','File:Phytoseiulus persimilis.png':'phytoseiulus.png','File:Chrysoperla carnea s.l. - (larva), Arnhem, the Netherlands.jpg':'chrysoperla.jpg'}
cache=m['api'](action='query',titles='|'.join(tasks),prop='imageinfo',iiprop='url|extmetadata',iiurlwidth=330)
for p in cache['query']['pages'].values():
    if p['title'] not in tasks: continue
    try: m['download'](p['title'],tasks[p['title']],p['imageinfo'][0])
    except Exception as e: print(p['title'],str(e))
    time.sleep(2)
try:
    r=m['api'](action='query',titles='File:5438919-PPT-broad mite (Polyphagotarsonemus latus).jpg',prop='imageinfo',iiprop='url|extmetadata',iiurlwidth=330)
    p=next(iter(r['query']['pages'].values()))
    m['download'](p['title'],'broad-mite-egg.jpg',p['imageinfo'][0])
except Exception as e: print('broad-mite-egg',str(e))
