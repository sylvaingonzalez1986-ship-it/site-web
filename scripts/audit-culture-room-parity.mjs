import assert from "node:assert/strict";
import {writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import sharp from "sharp";

const map="svg[data-warehouse-map]";
const camera="[data-grow-camera]";
const angles=[0,90,180,270];
const near=(actual,expected,tolerance,message)=>assert.ok(Math.abs(actual-expected)<=tolerance,
  message+" ("+actual+" / "+expected+", ±"+tolerance+")");

// Centres read off the original overhead-room-renovated-v1 artwork, in its 1024 px image.
// Buildings and their projection are checked independently of the product's registration helper.
const artworkPoints={
  "south-door":[512,947],"north-extractor":[425,62],"north-power":[643,66],"west-power":[78,331],
  "north-light-west":[212,71],"north-light-east":[803,71],"west-lamp":[78,512],"east-lamp":[944,512],
  "frame-nw":[38,38],"frame-ne":[986,38],"frame-sw":[40,960],"frame-se":[984,958],
};

function readOverhead(svg){
  const g=svg.dataset,cell=Number(g.gridCellSize),ox=Number(g.gridOriginX),oy=Number(g.gridOriginY);
  const columns=Number(g.gridColumns),rows=Number(g.gridRows);
  const world=(x,y)=>({x:(x-ox)/cell-columns/2,z:(y-oy)/cell-rows/2});
  const rect=n=>({x:n.x.baseVal.value,y:n.y.baseVal.value,w:n.width.baseVal.value,h:n.height.baseVal.value});
  const placement=node=>{
    const r=rect(node);return {...world(r.x+r.w/2,r.y+r.h/2),w:r.w/cell,d:r.h/cell};
  };
  const localMatrix=node=>svg.getScreenCTM().inverse().multiply(node.getScreenCTM());
  const zones=Array.from(svg.querySelectorAll("g[data-zone-id]"),zone=>{
    const box=zone.querySelector(":scope > rect[fill='transparent']");
    const oriented=zone.querySelector("[data-plan-fixtures]");
    const matrix=oriented&&localMatrix(oriented);
    const number=zone.querySelector("[data-zone-number]"),nm=localMatrix(number);
    const buddie=zone.querySelector("[data-zone-buddie] image");
    const equipment=Array.from(zone.querySelectorAll("[data-plan-fixture]"),node=>{
      const bounds=rect(node);
      const p=new DOMPoint(bounds.x+bounds.w/2,bounds.y+bounds.h/2).matrixTransform(localMatrix(node));
      return {kind:node.dataset.planFixture,...world(p.x,p.y)};
    });
    return {id:zone.dataset.zoneId,kind:zone.dataset.zoneKind,...placement(box),
      number:number.dataset.zoneNumber,portrait:buddie?.getAttribute("href")??null,
      rotation:matrix?((Math.round(Math.atan2(-matrix.b,matrix.a)*180/Math.PI)+360)%360):null,
      uprightNumber:Math.abs(nm.b)+Math.abs(nm.c)<.0001&&nm.a>0&&nm.d>0,equipment};
  });
  const partitions=Array.from(svg.querySelectorAll("[data-partition-id]"),wall=>{
    const box=wall.querySelector("rect[stroke='#172923'][stroke-width='1']");
    return {id:wall.dataset.partitionId,kind:"partition",...placement(box)};
  });
  const art=svg.querySelector("[data-warehouse-room-artwork]");
  return {zones:[...zones,...partitions],art:{href:art.getAttribute("href"),...rect(art)},cell,ox,oy,columns,rows,
    width:svg.viewBox.baseVal.width,height:svg.viewBox.baseVal.height};
}

function readWorld(){
  const nodes=Array.from(document.querySelectorAll("[data-grow-footprint]"));
  const bounds=nodes[0].ownerSVGElement.viewBox.baseVal;
  const labels=Array.from(document.querySelectorAll("[data-grow-zone-label]"),n=>{
    const portrait=n.querySelector("span"),url=portrait&&getComputedStyle(portrait).backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
    return {id:n.dataset.growZoneLabel,number:n.textContent.trim(),selected:n.dataset.selected==="true",
      portrait:url?new URL(url[1],location.href).pathname:null};
  });
  return {width:bounds.width,height:bounds.height,labels,zones:nodes.map(n=>({id:n.dataset.growFootprint,x:+n.dataset.worldX,z:+n.dataset.worldZ,
    w:+n.dataset.width,d:+n.dataset.depth,kind:n.dataset.kind,rotation:+n.dataset.rotation,
    points:Array.from(n.points,p=>({x:p.x,y:p.y}))})),
    landmarks:Array.from(document.querySelectorAll("[data-grow-landmark]"),n=>({
      id:n.dataset.growLandmark,x:+n.dataset.worldX,z:+n.dataset.worldZ,sx:+n.getAttribute("cx"),sy:+n.getAttribute("cy")
    }))};
}

function verifyEquipment(top,meshes){
  let checked=0;
  for(const zone of top.zones.filter(z=>z.kind==="culture")){
    for(const kind of ["lighting","air"]){
      const placed=zone.equipment.filter(p=>p.kind===kind),rendered=meshes.filter(p=>p.zone===zone.id&&p.kind===kind);
      assert.ok(placed.length>0,zone.id+" SVG "+kind);
      assert.equal(rendered.length,placed.length,zone.id+" installed "+kind+" count");
      const remaining=[...rendered];
      for(const p of placed){
        const n=remaining.findIndex(q=>Math.hypot(p.x-q.x,p.z-q.z)<.035);
        assert.ok(n>=0,zone.id+" "+kind+" fixture "+JSON.stringify(p)+" / "+JSON.stringify(remaining));
        remaining.splice(n,1);checked++;
      }
    }
  }
  return checked;
}

async function stationCrops(png,layout,overhead){
  const meta=await sharp(png).metadata(),sx=meta.width/layout.width,sy=meta.height/layout.height;
  const out={};
  for(const id of ["culture-3","drying","storage"]){
    const item=layout.zones.find(z=>z.id===id);
    let x,y,w,h;
    if(overhead){
      x=layout.ox+(item.x-item.w/2+layout.columns/2)*layout.cell;
      y=layout.oy+(item.z-item.d/2+layout.rows/2)*layout.cell;
      w=item.w*layout.cell;h=item.d*layout.cell;
    }else{
      const xs=item.points.map(p=>p.x),ys=item.points.map(p=>p.y);
      x=Math.min(...xs);w=Math.max(...xs)-x;
      const floorTop=Math.min(...ys);y=floorTop-w*.46;h=Math.max(...ys)-y;
    }
    const left=Math.max(0,Math.floor(x*sx)),top=Math.max(0,Math.floor(y*sy));
    const width=Math.min(meta.width-left,Math.round(w*sx)),height=Math.min(meta.height-top,Math.round(h*sy));
    out[id]=await sharp(png).extract({left,top,width,height}).resize(104,104,{fit:"contain",background:"#f6eedf"}).removeAlpha().png().toBuffer();
  }
  return out;
}

async function pixelDifferences(samples){
  const results=[];
  for(const width of [1440,390])for(const kind of ["culture-3","drying","storage"])for(const side of ["plan","room"]){
    const items=await Promise.all(samples.filter(s=>s.width===width).map(async x=>({
      angle:x.angle,raw:await sharp(x.crops[side][kind]).removeAlpha().raw().toBuffer()
    })));
    for(let a=0;a<4;a++)for(let b=a+1;b<4;b++){
      let changed=0;
      for(let i=0;i<items[a].raw.length;i+=3)if([0,1,2].some(c=>Math.abs(items[a].raw[i+c]-items[b].raw[i+c])>22))changed++;
      results.push({width,kind,side,from:items[a].angle,to:items[b].angle,changed,total:104*104});
    }
  }
  return results;
}

async function objectSheet(samples,width){
  const w=208,h=130,header=54,rows=["culture-3","drying","storage"],labels=["Culture","Séchoir","Stockage"];
  const layers=[],labelsSvg=[];
  for(const [row,id] of rows.entries()){
    for(const [column,entry] of samples.filter(v=>v.width===width).entries()){
      if(!row)labelsSvg.push('<text x="'+(column*w+12)+'" y="22">'+entry.angle+'°</text><text x="'+(column*w+12)+'" y="45">Plan</text><text x="'+(column*w+112)+'" y="45">Salle</text>');
      labelsSvg.push('<text x="'+(column*w+5)+'" y="'+(header+h*row+18)+'">'+labels[row]+'</text>');
      for(const [i,side] of ["plan","room"].entries())layers.push({input:entry.crops[side][id],left:column*w+104*i,top:header+h*row+23});
    }
  }
  const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="'+(4*w)+'" height="'+(header+3*h)+'"><g font-family="Arial" font-size="15" fill="#172923">'+labelsSvg.join("")+'</g></svg>');
  return sharp({create:{width:4*w,height:header+3*h,channels:3,background:"#f6eedf"}})
    .composite([{input:svg,left:0,top:0},...layers]).png().toBuffer();
}

async function writeComparisonIndex(output){
  const html=`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Plan et salle de culture</title><style>
*{box-sizing:border-box}body{margin:0;background:#f6eedf;color:#172923;font:1rem/1.5 system-ui,sans-serif}
main{max-width:1450px;margin:auto;padding:1rem clamp(1rem,3vw,3rem)}
h1{font-size:clamp(1.7rem,4vw,2.8rem);margin:.2em 0}p{max-width:72ch}
form{display:flex;gap:1rem;flex-wrap:wrap;align-items:end;margin:1.2em 0}
label{display:grid;font-weight:650;gap:.3em}select{font:inherit;color:inherit;padding:.45em;min-height:44px}
figure{margin:0}figure img{display:block;width:100%;height:auto;border:1px solid #7b897b}a{color:#075348}
nav{display:flex;flex-wrap:wrap;gap:.5rem 1rem;margin:1rem 0}figcaption{margin-top:.4rem}
</style><main><h1>Plan et salle de culture</h1><p>Chaque paire montre le même aménagement sauvegardé dans le plan de l’entrepôt et dans sa salle 3D. La culture au nord-est, le séchoir et la réserve suivent l’orientation indiquée.</p>
<form><label>Écran<select id="width"><option value="1440">Ordinateur · 1440 px</option><option value="390">Mobile · 390 px</option></select></label>
<label>Orientation<select id="angle"><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label></form>
<figure><a id="open" href="parity-1440-0.png"><img id="compare" src="parity-1440-0.png" alt="Plan vu du dessus à gauche et salle isométrique à droite"></a><figcaption id="caption" aria-live="polite"></figcaption></figure>
<nav aria-label="Examiner les détails"><a id="details" href="rotation-details-1440.png">Voir les postes aux quatre angles</a><a href="parity-saved-wall-390.png">Cloison après enregistrement</a><a href="report.json">Rapport de contrôle</a></nav></main>
<script>const w=document.getElementById('width'),a=document.getElementById('angle');function show(){const file='parity-'+w.value+'-'+a.value+'.png';document.getElementById('compare').src=file;document.getElementById('open').href=file;document.getElementById('details').href='rotation-details-'+w.value+'.png';document.getElementById('caption').textContent='Capture à '+w.value+' px · Orientation '+a.value+'°';}document.querySelector('form').addEventListener('change',show);show();</script></html>`;
  await writeFile(resolve(output,"index.html"),html);
}

function verifyModel(top,scene,saved){
  assert.match(top.art.href,/overhead-room-renovated-v1\.webp$/);
  assert.equal(top.zones.length,scene.zones.length);
  for(const item of top.zones){
    const iso=scene.zones.find(x=>x.id===item.id);assert.ok(iso,item.id);
    assert.equal(item.kind,iso.kind);
    for(const key of ["x","z","w","d"])near(item[key],iso[key],.0001,item.id+" "+key);
    if(item.kind==="partition")continue;
    const zone=[...saved.zones,...saved.serviceZones].find(z=>z.id===item.id);
    assert.equal(item.uprightNumber,true,"Upright zone number "+item.id);
    assert.equal(iso.rotation,zone.rotation??0);
  }
  assert.ok(scene.labels.some(label=>label.id==="culture-1"&&label.selected&&label.portrait),"Selected culture exposes its Buddie portrait");
  for(const label of scene.labels){
    const item=top.zones.find(z=>z.id===label.id);assert.ok(item);
    assert.equal(label.number,String(item.number).padStart(2,"0"),"Same station number "+item.id);
    assert.equal(label.portrait,item.portrait,"Same assigned Buddie artwork "+item.id);
  }
}

function verifyLandmarks(top,scene){
  const anchor=scene.zones[0],[a,b,,d]=anchor.points;
  const minX=anchor.x-anchor.w/2,minZ=anchor.z-anchor.d/2;
  const toScreen=(x,z)=>({x:a.x+(x-minX)*(b.x-a.x)/anchor.w+(z-minZ)*(d.x-a.x)/anchor.d,
    y:a.y+(x-minX)*(b.y-a.y)/anchor.w+(z-minZ)*(d.y-a.y)/anchor.d});
  const results=[];
  for(const [id,[u,v]] of Object.entries(artworkPoints)){
    const expectedX=(top.art.x+u/1024*top.art.w-top.ox)/top.cell-top.columns/2;
    const expectedZ=(top.art.y+v/1024*top.art.h-top.oy)/top.cell-top.rows/2;
    const marker=scene.landmarks.find(m=>m.id===id);assert.ok(marker,"3D landmark "+id);
    near(marker.x,expectedX,.25,id+" registered artwork X");near(marker.z,expectedZ,.25,id+" registered artwork Z");
    const screen=toScreen(marker.x,marker.z);
    near(marker.sx,screen.x,1.5,id+" camera X");near(marker.sy,screen.y,1.5,id+" camera Y");
    results.push({id,x:marker.x,z:marker.z,differenceM:+Math.hypot(marker.x-expectedX,marker.z-expectedZ).toFixed(3)});
  }
  return results;
}

async function pairImage(left,right,width){
  const w=width<800?390:700,h=width<800?375:500,head=36;
  const fitted=img=>sharp(img).resize({width:w,height:h,fit:"contain",background:"#f6eedf"}).png().toBuffer();
  const [one,two]=await Promise.all([fitted(left),fitted(right)]);
  const title=Buffer.from('<svg width="'+w*2+'" height="'+head+'" xmlns="http://www.w3.org/2000/svg"><g font-family="Arial" font-size="19" fill="#192f28"><text x="12" y="25">Plan d’aménagement</text><text x="'+(w+12)+'" y="25">Salle de culture</text></g></svg>');
  return sharp({create:{width:2*w,height:h+head,channels:3,background:"#f6eedf"}})
    .composite([{input:title,left:0,top:0},{input:one,left:0,top:head},{input:two,left:w,top:head}]).png().toBuffer();
}

async function cropRoomMargins(image,scene){
  const meta=await sharp(image).metadata(),sx=meta.width/scene.width,sy=meta.height/scene.height;
  const frame=scene.landmarks.filter(m=>m.id.startsWith("frame-"));
  if(frame.length!==4)return image;
  const zone=scene.zones[0],side=zone.points[1],corner=zone.points[0];
  const scale=Math.abs((side.x-corner.x)/zone.w)/.8;
  const left=Math.max(0,Math.floor((Math.min(...frame.map(m=>m.sx))-.35*scale)*sx));
  const top=Math.max(0,Math.floor((Math.min(...frame.map(m=>m.sy))-2.75*scale)*sy));
  const right=Math.min(meta.width,Math.ceil((Math.max(...frame.map(m=>m.sx))+.35*scale)*sx));
  const bottom=Math.min(meta.height,Math.ceil((Math.max(...frame.map(m=>m.sy))+.4*scale)*sy));
  return sharp(image).extract({left,top,width:right-left,height:bottom-top}).png().toBuffer();
}

export async function checkWarehouseParity({page,output,viewport,visit,state,geometry,reveal,tap,pass,screenshots}){
  const settle=()=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  const shots=[];
  async function referencePlan(){
    assert.equal(await page.$(map),null,"The warehouse itself has only the isometric viewport");
    await page.evaluate(()=>window.mountReferencePlan());
    await page.waitForSelector(map);await reveal(map);await settle();
    const zoomOut="[data-warehouse-action='zoom-out']";
    if(await page.$(zoomOut))for(let n=0;n<10&&!await page.$eval(zoomOut,b=>b.disabled);n++)await tap(zoomOut);
    await reveal(map);await settle();
  }
  async function observe(){
    await reveal(camera);await page.waitForFunction(()=>document.querySelector("[data-grow-camera]")?.dataset.renderer!=="loading");
    if(await page.$eval(camera,n=>n.dataset.renderer)!=="webgl"){
      const reason=await page.evaluate(async()=>{
        try{
          const [{createRoomRenderer},{getKqWarehouseSpatialLayout},{getWarehouseRoomZones}]=await Promise.all([
            import("/src/components/placard/KqGrowRoomRenderer.ts"),import("/src/lib/kanab-quest-warehouse-spatial.ts"),
            import("/src/components/placard/culture-room-state.ts")]);
          const fixture=window.inspectFixture(),engine=createRoomRenderer(document.createElement("canvas"),()=>{});
          try{engine.update({layout:getKqWarehouseSpatialLayout(fixture.plan),zones:getWarehouseRoomZones(fixture.plan,fixture.activeRuns,null,fixture.stockGrams),
            selected:"culture-1",actorTargetId:"culture-1",inspectAtRest:false,camera:{x:0,z:0,zoom:1},width:390,height:310,visible:false,motion:false,reducedMotion:false});}finally{engine.dispose();}
          return "Renderer fell back to the drawing";
        }catch(e){return String(e.stack??e);}
      });
      throw Error(reason);
    }
    await tap("[data-grow-reset]");await reveal(camera);await settle();
  }
  await page.emulateMediaFeatures([{name:"prefers-reduced-motion",value:"reduce"}]);
  const samples=[];
  for(const width of [1440,390]){
    await viewport(width);
    for(const angle of angles){
      const scenario="parity-"+angle;await visit(scenario);await observe();
      const saved=(await state()).plan;
      await geometry(saved);
      const world=await page.evaluate(readWorld);
      const meshes=await page.evaluate(()=>window.inspectWorkshopMeshes());
      const isoShot=await (await page.$(camera)).screenshot();
      await referencePlan();
      const overhead=await page.$eval(map,readOverhead);
      const topShot=await (await page.$(map)).screenshot();
      const file="parity-"+width+"-"+angle+".png";
      await writeFile(resolve(output,file),await pairImage(topShot,await cropRoomMargins(isoShot,world),width));screenshots.push(file);
      verifyModel(overhead,world,saved);
      const crops={plan:await stationCrops(topShot,overhead,true),room:await stationCrops(isoShot,world,false)};
      samples.push({width,angle,overhead,world,meshes,crops});
      shots.push(file);
      await page.evaluate(()=>window.unmountReferencePlan());
    }
  }
  await writeFile(resolve(output,"coordinates.json"),JSON.stringify(samples.map(({crops,...s})=>s),null,2));
  for(const width of [1440,390]){
    const file="rotation-details-"+width+".png";await writeFile(resolve(output,file),await objectSheet(samples,width));screenshots.push(file);
  }
  const differences=await pixelDifferences(samples);
  await writeFile(resolve(output,"rotation-pixels.json"),JSON.stringify(differences,null,2));
  pass("Seven zone footprints and both partitions match across eight isometric views and their standalone reference plans",{captures:shots});

  // Use the real edit controls, quote and PATCH receipt. A fresh page reads the installed plan back.
  const old=await state(),wall="east-divider",before=old.plan.partitions.find(w=>w.id===wall);
  await reveal(camera);
  const wallPoint=await page.$eval('[data-grow-footprint="'+wall+'"]',node=>{
    const [a,,b]=Array.from(node.points);
    const p=new DOMPoint((a.x+b.x)/2,(a.y+b.y)/2).matrixTransform(node.getScreenCTM());
    return {x:p.x,y:p.y};
  });
  await page.touchscreen.tap(wallPoint.x,wallPoint.y);
  await tap("[data-warehouse-wall-rotate]");await tap("[data-warehouse-cell-save]");
  await page.waitForFunction(r=>window.inspectFixture().revision>r,{},old.revision);
  assert.equal((await state()).calls.filter(c=>c.method==="PATCH"&&c.status===200).length,1);
  const next=await state();assert.notEqual(next.plan.partitions.find(w=>w.id===wall).axis,before.axis);
  await page.waitForSelector("[data-warehouse-cell-menu]",{hidden:true});
  await observe();
  await page.reload({waitUntil:"domcontentloaded"});await page.waitForSelector(camera);await observe();
  assert.deepEqual((await state()).plan,next.plan);const updated=await page.evaluate(readWorld);
  assert.ok((await state()).calls.some(c=>c.method==="GET"&&c.path.endsWith("/warehouse")));
  assert.equal((await state()).calls.filter(c=>c.method==="PATCH").length,0);
  const isoShot=await (await page.$(camera)).screenshot();await referencePlan();
  const svg=await page.$eval(map,readOverhead);verifyModel(svg,updated,next.plan);
  const partition=updated.zones.find(x=>x.id===wall);assert.equal(partition.rotation,0);assert.ok(partition.w>partition.d);
  const file="parity-saved-wall-390.png";await writeFile(resolve(output,file),await pairImage(await (await page.$(map)).screenshot(),await cropRoomMargins(isoShot,updated),390));screenshots.push(file);
  await writeComparisonIndex(output);
  pass("A partition turns through the isometric editing dialog and reloads with the saved orientation",{before:before.axis,after:"x",revision:next.revision});

  for(const sample of samples){
    for(const id of ["culture-3","drying","storage"]){
      const item=sample.overhead.zones.find(z=>z.id===id);
      assert.equal(item.rotation,sample.angle,"Rendered SVG sprite orientation for "+id+" at "+sample.angle+"° / "+sample.width+" px");
    }
    verifyLandmarks(sample.overhead,sample.world);
    verifyEquipment(sample.overhead,sample.meshes);
  }
  pass("Four real sprite rotations agree with Three while zone labels stay upright");
  pass("Readable 3D zone badges and assigned Buddie portraits match the numbered SVG controls",
    {visibleBadges:samples.map(s=>({width:s.width,angle:s.angle,count:s.world.labels.length}))});
  pass("Twelve registered wall, door, light and frame landmarks share image and world positions",
    {landmarks:verifyLandmarks(samples[0].overhead,samples[0].world)});
  pass("Actual SVG lamp and extractor centres match the world matrices of the same Three fixture bodies",
    {comparisons:samples.reduce((sum,s)=>sum+verifyEquipment(s.overhead,s.meshes),0),toleranceM:.035});
  assert.ok(differences.every(d=>d.changed>=12),"Each rendered orientation must differ from the other three, including the 180° service fronts: "+
    JSON.stringify(differences.filter(d=>d.changed<12)));
  pass("The crop, dryer and storage visibly differ pair by pair across four angles in both views at both widths",
    {pairs:differences.length,minChangedPixels:Math.min(...differences.map(d=>d.changed)),pixelsPerComparison:104*104});
}
