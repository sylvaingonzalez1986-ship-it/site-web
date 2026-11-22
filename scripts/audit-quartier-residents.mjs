import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

// Optional relative source directory holds a frozen copy of world/ for matched before views.
const world = process.env.PNJ_WORLD || 'src/components/placard/world';
const output = resolve(process.env.PNJ_OUTPUT || 'output/pnj-quartier');
const phase = process.argv.includes('--avant') ? 'avant' : 'apres';
await mkdir(output, { recursive: true });
const server = await createServer({
  configFile: false, envDir: false, logLevel: 'error',
  resolve: { alias: { '@': resolve('src') }, dedupe: ['three', 'react'] },
  cacheDir: resolve('output/pnj-vite'), optimizeDeps: { entries: [], include: ['react','react-dom/client','react/jsx-runtime','three','three/addons/utils/BufferGeometryUtils.js','three/addons/geometries/RoundedBoxGeometry.js'] },
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null },
  plugins: [{ name: 'portrait-review', resolveId(id, importer) {
    if (id === 'review-three') return '\0review-three';
    if (id === 'review-react') return '\0review-react';
    if (importer?.endsWith('/pnj-reference-source/KqStaffPortrait.tsx') && id === '../contest/ChanvrierAvatar') return resolve('src/components/contest/ChanvrierAvatar.tsx');
  },
    load(id) {
      if (id === '\0review-three') return 'export * from "three"';
      if (id === '\0review-react') return 'export {default as React} from "react"; export {createRoot} from "react-dom/client";';
    } }],
});

async function captureRoster(source) {
  const TH = await import('/@id/__x00__review-three');
  const load = file => import('/' + source + '/' + file + '.ts');
  const [loic, breton, fisherman, forest, art, interiors] = await Promise.all(
    ['village-loic','village-breton','village-fisherman','village-korrigans','interior-art','interior-rooms'].map(load));
  const renderer = new TH.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  const size = 252;
  renderer.setSize(size, size);
  renderer.toneMapping = TH.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const scene = new TH.Scene();
  scene.background = new TH.Color('#f4e7d3');
  scene.add(new TH.HemisphereLight('#fff4de', '#b5a38b', 1.65), new TH.AmbientLight(0xffffff,.32));
  const key = new TH.DirectionalLight('#fff4e4',2.05);
  key.position.set(-3,5,5); scene.add(key);
  const rim = new TH.DirectionalLight('#e0ede9',.85);
  rim.position.set(3,3,-4); scene.add(rim);
  const cam = new TH.OrthographicCamera(-1,1,1,-1,.01,20);
  const frame = { time:1.25, delta:1/60, reduced:false, quality:'high', visible:()=>true };
  const pose = { speed:0, stride:0, lookYaw:0, lookPitch:0, emphasis:.6, attention:0, fishingPhase:'wait', phaseProgress:.6 };
  const metrics = {}, sheets = {};
  let board, ctx, row;
  const labels = ['Silhouette', 'Face', 'Trois quarts', 'Profil'];
  function newSheet(rows) {
    board = document.createElement('canvas'); board.width = size*4; board.height = (size+30)*rows;
    ctx = board.getContext('2d'); row = 0;
  }
  function save(name) { sheets[name] = board.toDataURL('image/webp',.94).split(',')[1]; }
  function draw(label, subject, face, closeSpan, fullY, fullSpan, facing = 0) {
    scene.add(subject);
    for (const [i,yaw] of [.29,0,.65,1.48].entries()) {
      const target = face.clone();
      const span = i ? closeSpan : fullSpan;
      if (!i) target.y = fullY;
      cam.left = cam.bottom = -span/2; cam.top = cam.right = span/2;
      const angle = yaw + (i ? facing : 0);
      cam.position.copy(target).add(new TH.Vector3(Math.sin(angle)*5, .34, Math.cos(angle)*5));
      cam.lookAt(target); cam.updateProjectionMatrix();
      renderer.render(scene,cam);
      if (!i) metrics[label] = { calls:renderer.info.render.calls, triangles:renderer.info.render.triangles };
      const x=i*size, y=row*(size+30);
      ctx.drawImage(renderer.domElement,x,y);
      const pixels = ctx.getImageData(x,y,size,size).data;
      if (!pixels.some((v,index)=>index%4===0 && Math.abs(v-pixels[0])>28))
        throw Error('Personnage hors champ : '+label+' / '+labels[i]);
      ctx.fillStyle='#284740';ctx.fillRect(x,y+size,size,30);
      ctx.fillStyle='#fff3dc';ctx.font='16px Arial';ctx.fillText(i ? labels[i] : label,x+10,y+size+20);
    }
    subject.removeFromParent(); row++;
  }
  newSheet(3);
  for (const [label,factory,activity,head] of [
    ['Loïc',loic.createVillageLoic,'greeting','loic-head'],
    ['Sonneur',breton.createVillageBreton,'playing','breton-face-pivot'],
    ['Pêcheur',fisherman.createVillageFisherman,'fishing','fisherman-head']]) {
    const rig = factory();
    rig.object.position.set(0,0,0); rig.object.rotation.y=0;
    for (let i=0;i<72;i++) rig.update({...frame,time:i/60},{...pose,activity});
    const face = rig.object.getObjectByName(head).localToWorld(new TH.Vector3(0,.238,.005));
    draw(label,rig.object,face,.85,.97,2.22);
    rig.dispose();
  }
  save('habitants');
  newSheet(7);
  for (const [label,id,station,x,y,z,span] of [
    ['Banquier','bank','bank',-.52,1.76,-.31,1.06],
    ['Bureau du personnel','office',null,1.65,1.48,-2.46,.94],
    ['Comptabilité','office','accounts',-.1,1.48,-.46,.94],
    ['Juge','arena',null,-.65,1.85,-2.65,1.12],
    ['Loïc au marché','market',null,-3.02,1.63,-2.68,1.10],
    ['Loïc à la boutique','shop',null,-2.36,1.63,-3.19,1.10],
    ['Accueil Collection','collection','host',0,1.52,0,.86]]) {
    const room = interiors.createInteriorRoom(id);
    const group = station ? art.createInteriorObjectArt(room.objects.find(o=>o.id===station),id) : art.createInteriorRoomArt(room,{cutaway:true});
    const resident = station === 'host' ? group : group.getObjectByName('daytime-resident');
    if (!resident) throw Error('Habitant introuvable : '+label);
    group.updateMatrixWorld(true);
    const position = resident.localToWorld(new TH.Vector3(x,y,z));
    scene.attach(resident);
    let facing = 0;
    resident.traverse(node=>{
      if (node.name.endsWith('-interior-portrait') || node.name === 'loic-head') {
        const direction = node.getWorldDirection(new TH.Vector3());
        facing = Math.atan2(direction.x,direction.z);
      }
    });
    draw(label,resident,position,span,y*.66,2.18,facing);
    if (resident !== group) group.add(resident);
    art.disposeInteriorArt(group);
  }
  save('comptoirs');
  newSheet(3);
  const trio=forest.createVillageKorrigans({heightAt:()=>0});
  trio.update(frame,'idle',1);
  for (const [code,label] of [['garance','Garance'],['canard','Canard'],['ocre','Ocre']]) {
    const dancer = trio.object.getObjectByName('korrigan-'+code);
    dancer.position.set(0,0,0); dancer.rotation.y=0; scene.add(dancer);
    draw(label,dancer,new TH.Vector3(0,1.43,.06),1.24,.98,2.22);
    trio.object.add(dancer);
  }
  trio.dispose(); save('korrigans');
  renderer.dispose(); renderer.forceContextLoss();
  return {sheets,metrics};
}

async function captureStaff(source) {
  const staffPath = source.slice(0,source.lastIndexOf('/')) + '/KqStaffPortrait.tsx';
  const [{getKqStaffAvatarProfile},{renderChanvrierSnapshot},{KQ_STAFF_CANDIDATES}] = await Promise.all([
    import('/'+staffPath), import('/src/components/contest/chanvrier-snapshot.ts'), import('/src/lib/kanab-quest-staff-recruitment.ts')]);
  const board = document.createElement('canvas'), w=200;
  board.width=4*w; board.height=Math.ceil(KQ_STAFF_CANDIDATES.length/4)*(w+30);
  const ctx=board.getContext('2d'); ctx.fillStyle='#f4e7d3';ctx.fillRect(0,0,board.width,board.height);
  const signal=new AbortController().signal;
  const profiles = KQ_STAFF_CANDIDATES.map(person=>({name:person.name,profile:getKqStaffAvatarProfile(person)}));
  const visitor = source === 'src/components/placard/world'
    ? (await import('/src/components/placard/kq-grow-worker-profile.ts')).GROW_ROOM_VISITOR
    : {gender:'male',skin:'peach',clothing:'sage'};
  profiles.push({name:'Visiteur de la serre',profile:visitor});
  for (const [i,{name,profile}] of profiles.entries()) {
    const stamp=await renderChanvrierSnapshot({profile,view:'portrait',width:w},signal);
    const x=i%4*w,y=Math.floor(i/4)*(w+30);
    ctx.drawImage(stamp,x,y,w,w);
    ctx.fillStyle='#284740'; ctx.fillRect(x,y+w,w,30);
    ctx.fillStyle='#fff3dc'; ctx.font='16px Arial'; ctx.fillText(name,x+10,y+w+20);
  }
  return board.toDataURL('image/webp',.94).split(',')[1];
}

async function captureTrimTeams() {
  const [{createKqTrimRoomRenderer},{getKqStaffAvatarProfile},{KQ_STAFF_CANDIDATES}] = await Promise.all([
    import('/src/components/placard/KqTrimRoomRenderer.ts'), import('/src/components/placard/KqStaffPortrait.tsx'),
    import('/src/lib/kanab-quest-staff-recruitment.ts')]);
  const w=480, h=312, canvas=document.createElement('canvas'), board=document.createElement('canvas');
  Object.assign(canvas.style,{width:w+'px',height:h+'px'}); document.body.append(canvas);
  board.width=w*2; board.height=(h+32)*2;
  const ctx=board.getContext('2d'); ctx.fillStyle='#f4e7d3';ctx.fillRect(0,0,board.width,board.height);
  const room=createKqTrimRoomRenderer(canvas,()=>{throw Error('Contexte de la salle de trim perdu');});
  try {
    for (let i=0;i<KQ_STAFF_CANDIDATES.length;i+=3) {
      const team=KQ_STAFF_CANDIDATES.slice(i,i+3);
      room.update(team.map(person=>({id:person.code,working:true,mode:'manual',profile:getKqStaffAvatarProfile(person)})),false);
      const x=(i/3%2)*w,y=Math.floor(i/6)*(h+32);
      ctx.drawImage(canvas,x,y,w,h);
      ctx.fillStyle='#284740';ctx.fillRect(x,y+h,w,32); ctx.fillStyle='#fff3dc';ctx.font='16px Arial';
      ctx.fillText(team.map(person=>person.name).join(' · '),x+10,y+h+21);
    }
    return board.toDataURL('image/webp',.94).split(',')[1];
  } finally { room.dispose();canvas.remove(); }
}

let browser;
try {
  await server.listen();
  browser = await puppeteer.launch({executablePath:Launcher.getInstallations()[0], headless:true, args:['--no-sandbox','--enable-unsafe-swiftshader']});
  const page=await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request',req=>req.isNavigationRequest() ? void req.respond({contentType:'text/html',body:'<!doctype html><title>PNJ du Quartier</title>'}) : void req.continue());
  await page.goto(server.resolvedUrls.local[0]);
  const {sheets,metrics}=await page.evaluate(captureRoster,world);
  for (const [name,bytes] of Object.entries(sheets)) await writeFile(resolve(output,phase+'-'+name+'.webp'),Buffer.from(bytes,'base64'));
  await writeFile(resolve(output,phase+'-mesures.json'),JSON.stringify(metrics,null,2)+'\n');
  const staff=await page.evaluate(captureStaff,world);
  await writeFile(resolve(output,phase+'-recrues.webp'),Buffer.from(staff,'base64'));
  if (phase === 'apres') {
    const teams = await page.evaluate(captureTrimTeams);
    await writeFile(resolve(output,'equipe-atelier.webp'),Buffer.from(teams,'base64'));
    await page.evaluate(async () => {
      const [{React,createRoot},{GrowRoomActor}] = await Promise.all([
        import('/@id/__x00__review-react'), import('/src/components/placard/KqGrowRoomActor.tsx')]);
      window.React = React;
      const host = document.createElement('main'); document.body.append(host);
      createRoot(host).render(React.createElement('svg',{viewBox:'0 0 400 320',width:400,height:320},
        React.createElement(GrowRoomActor,{index:0,stage:1,event:{id:1,zoneId:'zone',gesture:'water'},motion:false,visible:true,left:0,width:400})));
    });
    await page.waitForFunction(() => {
      const sprite = document.querySelector('[data-grow-actor="visitor"][data-actor-state="water"] canvas');
      return sprite?.getContext('2d').getImageData(0,0,sprite.width,sprite.height).data.some((v,i)=>i%4===3 && v>200);
    });
  }
} finally {
  await browser?.close(); await server.close();
}
