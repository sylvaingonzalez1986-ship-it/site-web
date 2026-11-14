"""One new access route per blocked variety; store original documents locally."""
from pathlib import Path
from urllib.request import Request,urlopen
from html.parser import HTMLParser
import json,hashlib,traceback
from PyPDF2 import PdfReader
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/encyclopedia-revision'
OUT.mkdir(parents=True,exist_ok=True)
tasks=[
('kush','https://www.laweekly.com/wp-content/uploads/2020/01/e-edition-041620-396221.pdf','pdf'),
('northern-lights','https://sensiseeds.com/en/blog/40-years-sensi-seeds/','html'),
('cookies','https://cannabisnow.com/cookies-crush/amp/','html'),
('gelato','https://cannabisnow.com/sherbinski-sitdown-gelato/amp/','html')]
class Extract(HTMLParser):
    def __init__(self):super().__init__();self.skip=0;self.text=[]
    def handle_starttag(self,tag,attrs):
        if tag in ('script','style','noscript'):self.skip+=1
        if tag in ('p','h1','h2','h3','br','li','article','section'):self.text.append('\n')
    def handle_endtag(self,tag):
        if tag in ('script','style','noscript'):self.skip=max(0,self.skip-1)
        if tag in ('p','h1','h2','h3','li','article','section'):self.text.append('\n')
    def handle_data(self,data):
        if not self.skip:self.text.append(data)
log=[]
for name,url,kind in tasks:
    row={'target':name,'attemptedUrl':url,'newRoute':'local download + PyPDF2 extraction' if kind=='pdf' else ('local HTTP extraction of primary publisher page' if name=='northern-lights' else 'primary publisher AMP endpoint'),'attemptedAt':'2026-11-14'}
    try:
        req=Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; QuizzShowSourceReview/1.0)'})
        with urlopen(req,timeout=60) as response:
            raw=response.read();row['finalUrl']=response.url;row['httpStatus']=response.status
        dest=OUT/f'varieties-{name}-source.{kind}'
        dest.write_bytes(raw);row.update(path=str(dest),bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
        if kind=='pdf':
            reader=PdfReader(dest);pages=[]
            for i,page in enumerate(reader.pages):pages.append(f'\n===== PDF PAGE {i+1} =====\n'+(page.extract_text() or ''))
            text='\n'.join(pages);row['pages']=len(reader.pages)
        else:
            parser=Extract();parser.feed(raw.decode('utf-8',errors='replace'))
            text='\n'.join(x.strip() for x in ''.join(parser.text).splitlines() if x.strip())
        txt=OUT/f'varieties-{name}-extracted.txt';txt.write_text(text,encoding='utf-8')
        row.update(extractedPath=str(txt),characters=len(text),result='downloaded-and-extracted-not-yet-reviewed')
    except Exception as exc:row.update(result='unavailable',error=str(exc))
    log.append(row);print(json.dumps(row,ensure_ascii=False),flush=True)
(OUT/'varieties-access-log.json').write_text(json.dumps(log,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
