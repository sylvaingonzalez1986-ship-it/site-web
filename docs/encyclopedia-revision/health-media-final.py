import runpy
from pathlib import Path
m=runpy.run_path(str(Path(__file__).with_name('health-media.py')))
tasks={'File:Signs and Symptoms of Powdery Mildew on Hop Leaves.jpg':'podosphaera-hop.jpg','File:Basilikum Pythium-1--Roswitha Ulrich.jpg':'pythium-basil.jpg'}
r=m['api'](action='query',titles='|'.join(tasks),prop='imageinfo',iiprop='url|extmetadata',iiurlwidth=960)
for p in r['query']['pages'].values():
    m['download'](p['title'],tasks[p['title']],p['imageinfo'][0])
