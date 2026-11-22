/** Run through audit-village-3d.mjs --character-quality [--baseline]. */
import assert from 'node:assert/strict';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { relative, resolve } from 'node:path';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { frameVillageSubject } from './fixtures/village-audit-camera.mjs';

const baseline = process.argv.includes('--baseline');
const humanFinish = process.argv.includes('--human-finish');
const studioOnly = process.argv.includes('--studio-only');
const desktopProbe = process.argv.includes('--desktop-probe');
const timingOnly = process.argv.includes('--timing-only');
const observerMobile = process.argv.includes('--observer-mobile');
const label = baseline ? 'before' : 'after';
const origin = process.env.VILLAGE_CHARACTER_ORIGIN ?? 'http://127.0.0.1:3618';
const outputRoot = resolve(process.env.VILLAGE_CHARACTER_AUDIT_DIR ?? 'output/village-character-quality');
const output = observerMobile ? resolve(outputRoot, 'observer-mobile')
  : timingOnly ? resolve(outputRoot, 'timing', label)
  : desktopProbe ? resolve(outputRoot, 'desktop-probe', label)
  : resolve(outputRoot, studioOnly ? (baseline ? 'review-draft-before' : 'review-draft') : label);
const worldPath = '/src/components/placard/world/';
const snapshotPath = '/' + relative(process.cwd(), outputRoot).replaceAll('\\', '/') + '/source-before/';
const studioPath = '/character-audit-stage';
const apiFixtures = {
  equipment: { activeRun: false, cashCents: 125000, readyLotCount: 0, availableFlowerCount: 0 },
  runs: { activeRun: null, activeRuns: [] },
  flowers: { flowers: [] },
};
const viewports = [{ width: 1440, height: 1000 }, { width: 844, height: 390 }, { width: 320, height: 568 }];
const ready = 'canvas[data-village-ready="true"][data-motion-state="running"][data-life-npcs]';
const report = {
  label, studioOnly, desktopProbe, observerMobile, origin, passed: false, requests: [], external: [], errors: [], performance: [], village: [], studio: [],
  sources: baseline ? 'Saved world sources from ' + snapshotPath : 'Current production world sources.',
  limits: 'Desktop headless Chrome at DPR 1. The landscape timing series uses touch emulation at DPR 2 with the production pixel budget. Captures use DPR 1. Frame intervals and CPU submission are measured; handset hardware and GPU execution time are not. Local API fixtures.',
};

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * fraction)];
}

async function configurePage(page) {
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (['data:', 'blob:'].includes(url.protocol)) return void request.continue();
    if (url.origin !== origin) {
      report.external.push(request.url());
      return void request.abort();
    }
    if (url.pathname === '/favicon.ico') return void request.respond({ status: 204 });
    if (url.pathname === studioPath) return void request.respond({
      status: 200, contentType: 'text/html',
      body: '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#e8dbc3}</style><title>Village character audit</title>',
    });
    if (url.pathname.startsWith('/api/')) {
      report.requests.push({ path: url.pathname, method: request.method() });
      const fixture = apiFixtures[url.pathname.split('/').at(-1)] ?? { items: [], total: 0, hasMore: false };
      return void request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) });
    }
    return void request.continue();
  });
}

async function mountVillage(page, viewport) {
  const mobile = viewport.width < 1000;
  await page.setViewport({ ...viewport, deviceScaleFactor: timingOnly && mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, isLandscape: mobile && viewport.width > viewport.height });
  await page.goto(origin, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForSelector(ready);
}

async function measureVillage(page, viewport, view='carte') {
  const systemBefore = cpus();
  const measurement = await page.$eval(ready, canvas => new Promise(resolve => {
    const samples = [], start = performance.now();
    const firstFrame = Number(canvas.dataset.renderFrames);
    let previous = firstFrame, animationFrames = 0;
    const collect = () => {
      animationFrames++;
      const data = canvas.dataset, frame = Number(data.renderFrames);
      if (frame !== previous) {
        samples.push({
          interval: Number(data.frameInterval), cpu: Number(data.renderSubmitMs), skipped: frame - previous - 1,
          drawCalls: Number(data.drawCalls), triangles: Number(data.triangles), geometries: Number(data.geometries), textures: Number(data.textures),
        });
        previous = frame;
      }
      if (performance.now() - start < 5000) requestAnimationFrame(collect);
      else resolve({ samples, elapsedMs: performance.now() - start, renderedFrames: previous - firstFrame, animationFrames });
    };
    requestAnimationFrame(collect);
  }));
  const systemAfter = cpus();
  let totalTime = 0, idleTime = 0;
  for (const [index, cpu] of systemAfter.entries()) {
    const prior = systemBefore[index];
    idleTime += cpu.times.idle - prior.times.idle;
    for (const key of Object.keys(cpu.times)) totalTime += cpu.times[key] - prior.times[key];
  }
  const { samples, elapsedMs, renderedFrames, animationFrames } = measurement;
  assert.ok(samples.length > 20, `Only ${samples.length} render samples for ${viewport.width}×${viewport.height}`);
  const values = key => samples.map(sample => sample[key]);
  const range = key => ({ min: Math.min(...values(key)), median: percentile(values(key), 0.5), max: Math.max(...values(key)) });
  const browser = await page.$eval(ready, canvas => {
    const gl = canvas.getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
      userAgent: navigator.userAgent,
      canvas: { width: canvas.width, height: canvas.height },
      heap: performance.memory ? { used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize } : null,
      visibility: document.visibilityState,
      focused: document.hasFocus(),
      devicePixelRatio,
    };
  });
  report.performance.push({
    viewport, view, ...browser, elapsedMs, renderedFrames, animationFrames, sampledFrames: samples.length,
    systemCpuBusyFraction: totalTime > 0 ? (totalTime - idleTime) / totalTime : null,
    skippedSamples: values('skipped').reduce((sum, skipped) => sum + skipped, 0), actualFps: 1000 * renderedFrames / elapsedMs,
    medianFps: 1000 / percentile(values('interval'), 0.5), frameP95Ms: percentile(values('interval'), 0.95),
    frameMaxMs: Math.max(...values('interval')), framesAbove50Ms: samples.filter(sample=>sample.interval>50).length,
    cpuMedianMs: percentile(values('cpu'), 0.5), cpuP95Ms: percentile(values('cpu'), 0.95),
    drawCalls: range('drawCalls'), triangles: range('triangles'), geometries: range('geometries'), textures: range('textures'),
  });
}

async function captureVillage(page, name) {
  const state = await page.$eval(ready, canvas => ({ time: Number(canvas.dataset.motionTime), npcs: JSON.parse(canvas.dataset.lifeNpcs) }));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: horizontal overflow`);
  await page.screenshot({ path: resolve(output, `${name}.png`) });
  report.village.push({ name, ...state });
}

async function observeVillage(page, id) {
  const menu = 'details:has([data-observe-life])';
  const activate = selector => page.viewport().hasTouch ? page.tap(selector) : page.click(selector);
  await activate(menu + ' summary');
  const option = `${menu}[open] [data-observe-life="${id}"]`;
  await page.waitForSelector(option, { visible: true });
  await activate(option);
  await page.waitForSelector(`canvas[data-life-observe="${id}"][data-camera-transition="idle"]`);
}

/** Repeat a fixed performance inside the live village, at the unmodified map/observer zoom.
 * The screenshot uses the production renderer, buildings and lights. The live routine resumes
 * immediately afterward; the normal pointer/dialogue tests exercise the unfrozen actors. */
async function captureVillagePose(page,id,name) {
  const prior = baseline ? null : JSON.parse(await readFile(resolve(outputRoot,'before',name+'.json'),'utf8'));
  const result=await page.$eval(ready,async(canvas,{id,worldPath,prior})=>{
    const T=await import('/@id/__x00__character-audit-three');
    const {scene,camera,gl}=T.fiberRoots.get(canvas).store.getState();
    const source=await import(worldPath+'village-'+id+'.ts');
    const factory={breton:'createVillageBreton',loic:'createVillageLoic',fisherman:'createVillageFisherman'}[id];
    const rig=source[factory](), live=scene.getObjectByName('village-'+id);
    const lens=camera.clone();
    const lights=[];scene.traverse(o=>{if(o.isLight)lights.push(o);});
    const lightValues=lights.map(l=>[l.color.getHex(),l.intensity]);
    const fixed=prior??{position:live.position.toArray(),orientation:live.rotation.y,camera:camera.position.toArray(),
      quaternion:camera.quaternion.toArray(),zoom:camera.zoom,lights:lightValues,phase:2.25};
    try {
      lens.position.fromArray(fixed.camera);lens.quaternion.fromArray(fixed.quaternion);lens.zoom=fixed.zoom;lens.updateProjectionMatrix();
      rig.object.position.fromArray(fixed.position);rig.object.rotation.y=fixed.orientation;
      const pose={activity:id==='loic'?'greeting':id==='fisherman'?'drinking':'playing',speed:0,stride:0,
        lookYaw:id==='loic'?.38:0,lookPitch:0,emphasis:.8,attention:id==='loic'?1:0,fishingPhase:'sip',phaseProgress:.8};
      for(let tick=0;tick<=fixed.phase*60;tick++)rig.update({time:tick/60,delta:1/60,reduced:false,quality:'high',visible:()=>true},pose);
      fixed.lights.forEach(([hex,intensity],i)=>{lights[i].color.setHex(hex);lights[i].intensity=intensity;});
      live.visible=false;live.parent.add(rig.object);gl.render(scene,lens);
      return {fixed,png:canvas.toDataURL('image/png').split(',')[1]};
    } finally {
      rig.dispose();live.visible=true;
      lightValues.forEach(([hex,intensity],i)=>{lights[i].color.setHex(hex);lights[i].intensity=intensity;});
      gl.render(scene,camera);
    }
  },{id,worldPath,prior});
  await writeFile(resolve(output,name+'.png'),Buffer.from(result.png,'base64'));
  await writeFile(resolve(output,name+'.json'),JSON.stringify(result.fixed));
}

/** Compare the saved and current player at a marked spot on the actual path. */
async function captureVillagePlayerPair(page) {
  const fixed = JSON.parse(await readFile(resolve(outputRoot, 'before/quartier-loic.json'), 'utf8'));
  const versions = await page.$eval(ready, async (canvas, { fixed, snapshotPath }) => {
    const { fiberRoots } = await import('/@id/__x00__character-audit-three');
    const { DEFAULT_CHANVRIER_APPEARANCE } = await import('/src/lib/arena-chanvrier.ts');
    const profile = { gender: 'female', clothing: 'blue', skin: 'copper', appearance: {
      ...DEFAULT_CHANVRIER_APPEARANCE, body: 'compact', top: 'mariniere', bottom: 'sailor-trousers', hair: 'braids',
    } };
    const modules = await Promise.all([
      import(snapshotPath.replace('source-before/', 'player-before/') + 'kq-grow-worker-model.ts'),
      import('/src/components/placard/kq-grow-worker-model.ts'),
    ]);
    const { scene, camera, gl } = fiberRoots.get(canvas).store.getState();
    const guide = scene.getObjectByName('village-loic'), lens = camera.clone();
    lens.position.fromArray(fixed.camera); lens.quaternion.fromArray(fixed.quaternion);
    lens.zoom = fixed.zoom; lens.updateProjectionMatrix();
    const lights = [];
    scene.traverse(node => { if (node.isLight) lights.push(node); });
    const liveLights = lights.map(l => [l.color.getHex(), l.intensity]);
    const rendered = [];
    try {
      fixed.lights.forEach(([color, intensity], i) => { lights[i].color.setHex(color); lights[i].intensity = intensity; });
      guide.visible = false;
      for (const version of modules) {
        const rig = version.createGrowWorker(profile, { tools: false });
        try {
          rig.object.position.fromArray(fixed.position); rig.object.rotation.y = fixed.orientation;
          rig.object.traverse(node => { node.castShadow = false; });
          rig.pose(.35, 1, null, 0, null, undefined, 1.25);
          guide.parent.add(rig.object); gl.render(scene, lens);
          rendered.push(canvas.toDataURL('image/png').split(',')[1]);
        } finally { rig.dispose(); }
      }
    } finally {
      guide.visible = true;
      liveLights.forEach(([color, intensity], i) => { lights[i].color.setHex(color); lights[i].intensity = intensity; });
      gl.render(scene, camera);
    }
    return rendered;
  }, { fixed, snapshotPath });
  for (const [i, version] of ['before', 'after'].entries()) {
    await writeFile(resolve(outputRoot, version, 'quartier-joueur.png'), Buffer.from(versions[i], 'base64'));
  }
}

async function captureMobileObservation(page) {
  const preceding = JSON.parse(await readFile(resolve(outputRoot, 'after/report.json'), 'utf8'));
  const reportRows = preceding.village.filter(({ name }) => name.startsWith('observe-') && name.endsWith('320x568'));
  assert.equal(reportRows.length, 3);
  await mountVillage(page, viewports[2]);
  report.observer = [];
  for (const previous of reportRows) {
    const id = previous.name.split('-')[1];
    await page.waitForFunction((selector, time) => Number(document.querySelector(selector)?.dataset.motionTime) >= time, {}, ready, previous.time - 0.55);
    await observeVillage(page, id);
    const sightline = await page.$eval(ready, async (canvas, id) => {
      const { Box3, Raycaster, Vector3, fiberRoots } = await import('/@id/__x00__character-audit-three');
      const { scene, camera } = fiberRoots.get(canvas).store.getState();
      const subject = scene.getObjectByName(`village-${id}`);
      const head = subject.getObjectByName(`${id}-head`);
      const feet = subject.getWorldPosition(new Vector3());
      const crown = new Box3().setFromObject(head).max.y;
      const buildings = [];
      scene.traverse(node => { if (node.userData.buildingKind) buildings.push(node); });
      const towardCamera = camera.getWorldDirection(new Vector3()).negate();
      const rect = canvas.getBoundingClientRect();
      const heights = [0.04, 0.21, 0.4, 0.61, 0.82, 0.98];
      const points = heights.map(height => {
        const world = feet.clone();
        world.y += (crown - feet.y) * height;
        const ray = new Raycaster(world, towardCamera, 0.02, camera.position.distanceTo(world));
        const blockers = ray.intersectObjects(buildings, true);
        const position = world.project(camera);
        return { yFraction: height, x: rect.x + (position.x + 1) * rect.width / 2, y: rect.y + (1 - position.y) * rect.height / 2, hits: blockers.length };
      });
      return { time: Number(canvas.dataset.motionTime), points, screenHeight: (points[0].y - points.at(-1).y) / (heights.at(-1) - heights[0]) };
    }, id);
    await captureVillage(page, previous.name);
    report.observer.push({ id, previous: { time: previous.time, x: previous.npcs[id].x, z: previous.npcs[id].z }, ...sightline });
  }
  for (const observation of report.observer) {
    assert.ok(observation.screenHeight > 100, `${observation.id}: character is under 100 CSS pixels tall`);
    assert.ok(observation.points.every(point => point.hits === 0), `${observation.id}: building blocks a body sample`);
  }
  const eyePosition = () => page.$eval(ready, async canvas => {
    const {fiberRoots,Vector3}=await import('/@id/__x00__character-audit-three');
    const {scene,camera}=fiberRoots.get(canvas).store.getState();
    const eye=scene.getObjectByName('loic-eyes').getWorldPosition(new Vector3()).project(camera);
    return {zoom:camera.zoom, x:eye.x, y:eye.y};
  });
  const fullLength=await eyePosition();
  const zoomIn='button[aria-label="Agrandir le village"]';
  for(let i=0;i<8;i++) await page.tap(zoomIn);
  await page.waitForSelector(zoomIn+':disabled');
  await page.waitForSelector('canvas[data-camera-transition="idle"]');
  const portrait=await eyePosition();
  assert.ok(portrait.zoom>2.3*fullLength.zoom && Math.abs(portrait.x)<.85 && Math.abs(portrait.y)<.85,'Eyes remain inside the manual close-up');
  await page.screenshot({path:resolve(output,'portrait-loic-320.png')});
  report.manualPortrait={fullLength,portrait};
  await page.tap('button[aria-label="Recentrer la vue isométrique"]');
  await page.waitForSelector('canvas[data-camera-transition="idle"][data-life-observe=""]');
}

async function configureStudio(page) {
  await page.evaluate(async ({ worldPath }) => {
    const [THREE, breton, fisherman, loic, animals] = await Promise.all([
      import('/@id/__x00__character-audit-three'),
      import(`${worldPath}village-breton.ts`), import(`${worldPath}village-fisherman.ts`),
      import(`${worldPath}village-loic.ts`), import(`${worldPath}village-animals.ts`),
    ]);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e8dbc3');
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    document.body.append(renderer.domElement);
    scene.add(new THREE.AmbientLight('#ffffff', 0.28));
    scene.add(new THREE.HemisphereLight('#fff3dd', '#708d7c', 1.25));
    const rim = new THREE.DirectionalLight('#c7e9ed', 0.55);
    rim.position.set(15, 14, -20);
    scene.add(rim);
    const sun = new THREE.DirectionalLight('#fff0cc', 2.7);
    sun.position.set(-12, 28, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.normalBias = 0.025;
    Object.assign(sun.shadow.camera, { left: -3, right: 3, bottom: -3, top: 3, near: 25, far: 43 });
    scene.add(sun);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#ccb98f', roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.015;
    floor.receiveShadow = true;
    scene.add(floor);
    const factories = { breton: breton.createVillageBreton, fisherman: fisherman.createVillageFisherman, loic: loic.createVillageLoic };
    let references;
    window.loadPortraitReferences = async path => {
      const [b, f, l] = await Promise.all(['breton','fisherman','loic'].map(id=>import(path+'village-'+id+'.ts')));
      references = { breton:b.createVillageBreton, fisherman:f.createVillageFisherman, loic:l.createVillageLoic };
    };
    const surface = { isWalkable: () => true, heightAt: () => 0 };
    const fps = 60;
    let actors, lastCamera;

    function frame(tick) {
      return { time: tick / fps, delta: 1 / fps, reduced: false, quality: 'high', visible: () => true };
    }

    function pose(spec, tick, from, duration, prior) {
      const progress = (tick - from) / Math.max(1, duration);
      return {
        activity: 'idle', speed: 0, stride: tick / fps * 6.5, lookYaw: 0, lookPitch: 0, emphasis: 0.85, attention: 0,
        fishingPhase: 'wait', phaseProgress: 0, ...spec,
        ...(spec.fishingPhase && spec.phaseProgress === undefined ? { phaseProgress: progress } : {}),
        ...(spec.attention && prior ? { attention: spec.attention * progress } : {}),
      };
    }

    function releaseActors() {
      actors?.object.removeFromParent();
      actors?.dispose();
      actors = undefined;
    }

    window.characterAuditRelease = () => {
      releaseActors();
      renderer.render(scene, lastCamera);
      return { ...renderer.info.memory };
    };

    window.characterAuditCapture = ({ actor, through, phases, yaw, vertical, targetY, neutral, reference }) => {
      releaseActors();
      actors = (reference ? references : factories)[actor]?.() ?? animals.createVillageAnimals(surface);
      const subject = factories[actor] ? actors.object : actors.object.getObjectByName(`village-animal-${actor}`);
      if (!subject) throw new Error(`No production rig for ${actor}`);
      if (factories[actor]) {
        subject.position.set(0, 0, 0);
        subject.rotation.y = 0;
      }
      let firstTick = 0;
      for (const [index, segment] of phases.entries()) {
        const lastTick = Math.round(segment.end * fps);
        const duration = segment.duration ? Math.round(segment.duration * fps) - 1 : lastTick - firstTick;
        for (let tick = firstTick; tick <= Math.min(through, lastTick); tick++) {
          actors.update(frame(tick), pose(segment.pose, tick, firstTick, duration, index > 0));
        }
        firstTick = lastTick + 1;
        if (lastTick >= through) break;
      }
      // Center the animal for framing while preserving its real gait and relative pose.
      subject.position.set(0, subject.position.y, 0);
      if (!factories[actor]) {
        subject.rotation.y = 0;
        for (const child of actors.object.children) child.visible = child === subject;
      }
      scene.add(actors.object);
      sun.color.set(neutral ? 0xffffff : 0xfff0cc);rim.color.set(neutral ? 0xffffff : 0xc7e9ed);
      sun.intensity=neutral ? 2.05 : 2.7;sun.position.set(...(neutral ? [-7,12,22] : [-12,28,18]));
      subject.traverse(node => { if (node.isMesh) node.castShadow = true; });
      const horizontal = vertical * innerWidth / innerHeight;
      const camera = new THREE.OrthographicCamera(-horizontal / 2, horizontal / 2, vertical / 2, -vertical / 2, 0.1, 50);
      camera.position.set(Math.sin(yaw) * 7, targetY + 1.65, Math.cos(yaw) * 7);
      camera.lookAt(0, targetY, 0);
      lastCamera = camera;
      renderer.render(scene, camera);
      return { time: through / fps, state: { ...subject.userData }, resource: { ...renderer.info.render, ...renderer.info.memory } };
    };

    window.characterAuditWalkToGreeting = async beforePath => {
      const [oldGuide, oldRoute, newRoute] = await Promise.all([import(beforePath+'village-loic.ts'),
        import(beforePath+'village-npc-routine.ts'), import(worldPath+'village-npc-routine.ts')]);
      releaseActors();
      const routePoints = [];
      for(let i=0;i<=6;i++)routePoints.push({x:0,z:i*.30});
      for(let i=1;i<=9;i++)routePoints.push({x:i*.30,z:1.80});
      const walkable = {isWalkable: (x,z) => (Math.abs(x)<.53 && z>-.55 && z<2.32) ||
        (Math.abs(z-1.8)<.53 && x>-.54 && x<3.24), heightAt:()=>0};
      const make = (factory,controller) => {
        const rig=factory(walkable.heightAt);
        const routine=controller('loic',walkable,[{samples:routePoints,width:.82}],[0,0,0],0);
        scene.add(rig.object);
        return {rig,routine,trail:[],distance:0,last:[0,0],afterRelease:0,maxSpeed:0};
      };
      const performers = [make(oldGuide.createVillageLoic,oldRoute.createVillageNpcRoutine),
        make(loic.createVillageLoic,newRoute.createVillageNpcRoutine)];
      const savedSize=renderer.getSize(new THREE.Vector2());
      const w=328,h=270;
      const result=document.createElement('canvas');result.width=w*2;result.height=h+34;
      const paint=result.getContext('2d');
      const camera=new THREE.OrthographicCamera(-2.06,2.06,1.70,-1.70,.1,30);
      camera.position.set(5.30,2.62,7.99); camera.lookAt(.95,.90,1.19);
      const frames=[];
      renderer.setSize(w*2,h,false);renderer.setScissorTest(true);
      sun.position.set(-12,28,18);sun.color.set(0xfff0cc);sun.intensity=2.7;
      rim.color.set(0xc7e9ed);
      try{
        for(let tick=0;tick<30*12;tick++){
          const time=tick/30, contact=time>=5.55 && time<8.45;
          const frame={time,delta:1/30,reduced:false,quality:'high',detail:1,visible:()=>true};
          for(const [i,p] of performers.entries()){
            const state=p.routine.update(frame,contact?[1.80,1.53,3.20]:undefined,contact?{type:'tutorial',emphasis:.8}:undefined);
            const moved=Math.hypot(state.position[0]-p.last[0],state.position[2]-p.last[1]);
            p.distance+=moved;if(time>=8.45)p.afterRelease+=moved;p.maxSpeed=Math.max(p.maxSpeed,state.pose.speed);
            p.last=[state.position[0],state.position[2]];
            p.rig.object.position.fromArray(state.position);p.rig.object.rotation.y=state.yaw;
            p.rig.update(frame,state.pose);
            if(tick%15===0)p.trail.push([time,...p.last,state.yaw,state.pose.speed,state.pose.activity]);
            if(tick%3)continue;
            performers.forEach((q,j)=>{q.rig.object.visible=i===j;});
            renderer.setViewport(i*w,0,w,h);renderer.setScissor(i*w,0,w,h);renderer.render(scene,camera);
          }
          if(tick%3)continue;
          paint.fillStyle='#f6ebd7';paint.fillRect(0,0,w*2,h+34);
          paint.drawImage(renderer.domElement,0,34);paint.fillStyle='#213d35';paint.font='16px system-ui';
          paint.fillText('Avant',12,23);paint.fillText('Apr'+String.fromCharCode(232)+'s',w+12,23);
          frames.push(result.toDataURL('image/png').split(',')[1]);
        }
      }finally{
        performers.forEach(p=>p.rig.dispose());renderer.setScissorTest(false);
        renderer.setSize(savedSize.x,savedSize.y,false);renderer.setViewport(0,0,savedSize.x,savedSize.y);
      }
      return {frames,stats:performers.map(({distance,afterRelease,maxSpeed,trail})=>({distance,afterRelease,maxSpeed,trail}))};
    };

    window.characterAuditAnimationCost = async snapshotPath => {
      const [oldBreton, oldFisherman, oldLoic, oldAnimals] = await Promise.all([
        import(`${snapshotPath}village-breton.ts`), import(`${snapshotPath}village-fisherman.ts`),
        import(`${snapshotPath}village-loic.ts`), import(`${snapshotPath}village-animals.ts`),
      ]);
      const createSet = (breton, fisherman, loic, animals) => [
        breton.createVillageBreton(), fisherman.createVillageFisherman(), loic.createVillageLoic(), animals.createVillageAnimals(surface),
      ];
      const rigs = { before: createSet(oldBreton, oldFisherman, oldLoic, oldAnimals), after: createSet(breton, fisherman, loic, animals) };
      const phases = ['wait', 'reach', 'sip', 'replace'];
      const frames = Array.from({ length: 240 }, (_, tick) => {
        const block = Math.floor(tick / 60), progress = tick % 60 / 59;
        const walk = { activity: 'walking', speed: 0.75 };
        const interaction = { attention: progress, lookYaw: 0.42, lookPitch: -0.06 };
        return {
          frame: frame(tick),
          breton: pose([walk, { activity: 'playing' }, { activity: 'singing', ...interaction }, walk][block], tick, 0, 240),
          fisherman: pose({
            activity: block === 0 ? 'fishing' : block === 3 ? 'observing' : 'drinking',
            fishingPhase: phases[block], phaseProgress: progress, ...(block === 3 ? interaction : {}),
          }, tick, 0, 240),
          loic: pose(block % 2 ? { activity: 'greeting', ...interaction } : walk, tick, 0, 240),
        };
      });
      const times = { before: [], after: [] };
      try {
        for (let series = 0; series < 15; series++) {
          for (const version of series % 2 ? ['after', 'before'] : ['before', 'after']) {
            const [musician, angler, guide, wildlife] = rigs[version];
            const start = performance.now();
            for (const next of frames) {
              musician.update(next.frame, next.breton);
              angler.update(next.frame, next.fisherman);
              guide.update(next.frame, next.loic);
              wildlife.update(next.frame);
            }
            if (series >= 4) times[version].push((performance.now() - start) / frames.length);
          }
        }
      } finally {
        for (const set of Object.values(rigs)) set.forEach(rig => rig.dispose());
      }
      return { framesPerSeries: frames.length, warmupSeries: 4, times };
    };
  }, { worldPath });
}

async function captureStudio(page) {
  const walk = [{ end: 4, pose: { activity: 'walking', speed: 0.75 } }];
  const rest = [{ end: 4, pose: { activity: 'idle' } }];
  const music = [{ end: 4, pose: { activity: 'playing' } }];
  const song = [{ end: 4, pose: { activity: 'singing', attention: 1, lookYaw: 0.44, lookPitch: -0.07 } }];
  const greeting = [{ end: 4, pose: { activity: 'greeting', attention: 1, lookYaw: 0.44 } }];
  const fishing = [
    { end: 1, pose: { activity: 'fishing', fishingPhase: 'wait' } },
    { end: 2.5, pose: { activity: 'drinking', fishingPhase: 'reach' } },
    { end: 5.6, duration: 3.1, pose: { activity: 'drinking', fishingPhase: 'sip' } },
    { end: 7.4, pose: { activity: 'drinking', fishingPhase: 'replace' } },
  ];
  const interruption = [...fishing.slice(0, 2), { ...fishing[2], end: 4.6 }, {
    end: 6, pose: { activity: 'greeting', fishingPhase: 'sip', phaseProgress: 2.1 / 3.1, attention: 1, lookYaw: 0.45, lookPitch: -0.09 },
  }];
  const studioCases = [
    ['breton', 'repos', rest, 1.5], ['breton', 'marche-1', walk, 1.15], ['breton', 'marche-2', walk, 1.64],
    ['breton', 'musique-1', music, 1.25], ['breton', 'musique-2', music, 1.6], ['breton', 'chant', song, 2.1],
    ['fisherman', 'attente', fishing, 0.8], ['fisherman', 'saisie', fishing, 2.3],
    ['fisherman', 'levee', fishing, 3.18], ['fisherman', 'gorgee', fishing, 4.6],
    ['fisherman', 'interruption-1', interruption, 4.95], ['fisherman', 'interruption-2', interruption, 6],
    ['fisherman', 'repose', fishing, 7.18],
    ['loic', 'repos', rest, 1.5], ['loic', 'marche-1', walk, 1.15], ['loic', 'marche-2', walk, 1.64], ['loic', 'salut', greeting, 2.1],
    ...['wolf', 'fox', 'weasel'].flatMap(actor => [[actor, 'veille', rest, 0.6], [actor, 'marche', rest, actor === 'weasel' ? 4 : 2.6]]),
  ];
  if(humanFinish){
    studioCases.push(['loic','salut-face',greeting,2.1,{yaw:0,vertical:2.20,targetY:1.02,neutral:true}],
      ['loic','salut-profil',greeting,2.1,{yaw:1.45,vertical:2.20,targetY:1.02,neutral:true}],
      ['breton','souffle-trois-quarts',music,1.6,{yaw:-.64,vertical:1.35,targetY:1.32,neutral:true}],
      ['fisherman','flexion-profil',fishing,4.6,{yaw:1.40,vertical:1.98,targetY:.91,neutral:true}]);
  }
  const firstFramePerActor = new Map();
  for (const [actor, name, phases, time, fixed] of studioCases) {
    const animal = ['wolf', 'fox', 'weasel'].includes(actor);
    const frame = {
      actor, phases, through: Math.round(time * 60), yaw: animal ? 0.83 : actor === 'fisherman' ? 0.57 : 0.34,
      vertical: animal ? actor === 'weasel' ? 1.04 : 1.7 : actor === 'fisherman' ? 2.35 : 2.5,
      targetY: animal ? actor === 'weasel' ? 0.29 : 0.44 : actor === 'fisherman' ? 0.83 : 1.02, ...fixed,
    };
    const pose = await page.evaluate(params => window.characterAuditCapture(params), frame);
    await page.screenshot({ path: resolve(output, `${actor}-${name}.png`) });
    const { yaw, vertical, targetY, neutral=false } = frame;
    report.studio.push({ actor, name, camera: { yaw, vertical, targetY, ...(neutral?{neutral}: {}) }, ...pose });
    if (!firstFramePerActor.has(actor)) firstFramePerActor.set(actor, frame);
  }
  const bottleLift = name => report.studio.find(pose => pose.actor === 'fisherman' && pose.name === name).state.bottleLift;
  assert.ok(bottleLift('gorgee') >= 0.98, 'The sequential sip did not reach the mouth');
  assert.ok(bottleLift('interruption-2') < 0.15, 'The sequential interruption did not lower the bottle');
  if (!baseline && !studioOnly) {
    report.studioLifecycle = await page.evaluate(frames => {
      const empty = window.characterAuditRelease(), cycles = [];
      for (let cycle = 0; cycle < 2; cycle++) {
        cycles.push(frames.map(frame => ({
          actor: frame.actor,
          mounted: window.characterAuditCapture(frame).resource,
          released: window.characterAuditRelease(),
        })));
      }
      return { empty, cycles, stable: cycles.every(cycle => cycle.every(({ released }) =>
        released.geometries === empty.geometries && released.textures === empty.textures)) };
    }, [...firstFramePerActor.values()]);
    assert.ok(report.studioLifecycle.stable, 'The renderer retained studio resources after disposal');
  }
}

async function motionProof(page){
  const {frames,stats}=await page.evaluate(path=>window.characterAuditWalkToGreeting(path),snapshotPath);
  assert(stats.every(v=>v.distance>1 && v.maxSpeed>.15 && v.afterRelease>.17),'Both guides must move and resume their route');
  assert(stats.every(v=>v.trail.some(t=>t.at(-1)==='greeting')),'The recorded route must include the interaction');
  const {default:sharp}=await import('sharp');
  await sharp(frames.map(frame=>Buffer.from(frame,'base64')),{join:{animated:true}}).gif({delay:100,loop:0,effort:3})
    .toFile(resolve(outputRoot,'marche-virage-salut.gif'));
  report.motionSequence={file:'marche-virage-salut.gif',seconds:12,fps:10,before:stats[0],after:stats[1]};
}

async function portraitSheet(page) {
  const {default:sharp}=await import('sharp');
  await page.evaluate(path=>window.loadPortraitReferences(path),snapshotPath);
  const portraits=[
    ['loic','Loïc',1.72,.23,'idle'],
    ['breton','Sonneur',1.67,-.48,'playing'],
    ['fisherman','Pêcheur',1.39,.55,'fishing'],
  ];
  const width=420, height=384, margin=10, gap=8, header=42, row=height+32;
  const canvasWidth=2*margin+3*width+2*gap, canvasHeight=header+2*row;
  const pieces=[], labels=[];
  for(const [i,[actor,label,targetY,yaw,activity]] of portraits.entries()) {
    const x=margin+i*(width+gap);
    labels.push(`<text x="${x}" y="28">${label}</text>`);
    for(const [j,version] of ['Avant','Après'].entries()) {
      const y=header+j*row;
      const phases=[{end:2,pose:{activity,fishingPhase:'wait'}}];
      await page.evaluate(frame=>window.characterAuditCapture(frame),{
        actor,phases,through:78,vertical:1.04,targetY,yaw,neutral:true,reference:j===0,
      });
      const input=await page.screenshot();
      pieces.push({input:await sharp(input).resize(width,height).png().toBuffer(),top:y+24,left:x});
      if(i===0) labels.push(`<text x="${x}" y="${y+18}" font-size="16">${version}</text>`);
    }
  }
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}"><g fill="#294641" font-family="Arial, sans-serif" font-size="21">${labels.join('')}</g></svg>`;
  pieces.push({input:Buffer.from(svg),top:0,left:0});
  await sharp({create:{width:canvasWidth,height:canvasHeight,channels:3,background:'#f4ecdc'}}).composite(pieces)
    .webp({quality:92}).toFile(resolve(outputRoot,'portraits-habitants.webp'));
}

async function measureAnimationCost(page) {
  try {
    await access(resolve(outputRoot, 'source-before/village-breton.ts'));
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  const { framesPerSeries, warmupSeries, times } = await page.evaluate(snapshotPath => window.characterAuditAnimationCost(snapshotPath), snapshotPath);
  const stats = samples => ({ medianMsPerFrame: percentile(samples, 0.5), p95MsPerFrame: percentile(samples, 0.95), samples });
  report.animationCpu = {
    workload: 'Three NPC rigs and all three animals. Same browser session, alternating order. Fixed 60 Hz timeline with culling disabled. No render, rig construction, disposal or screenshots in the timed interval.',
    framesPerSeries, warmupSeries, before: stats(times.before), after: stats(times.after),
  };
}

async function compareVillageCharacters() {
  const { default: sharp } = await import('sharp');
  const actors = [['joueur', 'Joueuse'], ['breton', 'Sonneur'], ['fisherman', 'Pêcheur'], ['loic', 'Loïc']];
  const size = 308, gap = 8, margin = 65, top = 49;
  const width = margin + actors.length * (size + gap), height = top + 2 * (size + gap);
  const crops = [], labels = [];
  const label = (x, y, name) => labels.push(`<text x="${x}" y="${y}" font-size="18" font-family="Arial,sans-serif" fill="#294641">${name}</text>`);
  label(7, top + size / 2, 'Avant');
  label(7, top + size * 1.5 + gap, 'Après');
  for (const [column, [id, name]] of actors.entries()) {
    const left = margin + column * (size + gap);
    label(left, 32, name);
    if (id !== 'joueur') {
      const camera = async version => JSON.parse(await readFile(resolve(outputRoot, version, `quartier-${id}.json`), 'utf8'));
      assert.deepEqual(await camera('before'), await camera('after'));
    }
    for (const [row, version] of ['before', 'after'].entries()) {
      const shot = sharp(resolve(outputRoot, version, `quartier-${id}.png`));
      const frame = await shot.metadata();
      const area = { left: Math.round((frame.width - size) / 2), top: Math.round((frame.height - size) / 2), width: size, height: size };
      crops.push({ input: await shot.extract(area).png().toBuffer(), left, top: top + row * (size + gap) });
    }
  }
  const captions = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${labels.join('')}</svg>`);
  await sharp({ create: { width, height, channels: 3, background: '#f4ecdc' } })
    .composite([{ input: captions, left: 0, top: 0 }, ...crops]).png().toFile(resolve(outputRoot, 'quartier-avant-apres.png'));
}

async function compareCaptures(page) {
  const beforeFolder = resolve(outputRoot, 'before');
  const beforeReport = await readFile(resolve(beforeFolder, 'report.json'), 'utf8').catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  const previous = beforeReport && JSON.parse(beforeReport);
  if (!previous?.passed) return;
  const labels = { breton: 'Sonneur', fisherman: 'Pêcheur', loic: 'Loïc', wolf: 'Loup', fox: 'Renard', weasel: 'Belette' };
  const phaseLabels = { levee: 'levée', gorgee: 'gorgée', repose: 'bouteille reposée' };
  const seconds = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const comparisons = [
    ['sonneur', report.studio.filter(({ actor }) => actor === 'breton')],
    ['pecheur', report.studio.filter(({ actor }) => actor === 'fisherman')],
    ['loic', report.studio.filter(({ actor }) => actor === 'loic')],
    ['animaux', report.studio.filter(({ actor }) => ['wolf', 'fox', 'weasel'].includes(actor))],
  ];
  report.comparisons = [];
  for (const [group, cases] of comparisons) {
    if (!cases.length) continue;
    const pairs = await Promise.all(cases.map(async ({ actor, name, time, camera }) => {
      const filename = `${actor}-${name}.png`;
      const prior = previous.studio.find(pose => pose.actor === actor && pose.name === name);
      assert.deepEqual({ time: prior?.time, camera: prior?.camera }, { time, camera }, `Studio frames differ for ${actor}/${name}; regenerate the baseline`);
      const images = await Promise.all([beforeFolder, output].map(dir => readFile(resolve(dir, filename), 'base64')));
      const phase = phaseLabels[name] ?? name.replaceAll('-', ' ');
      return { label: `${labels[actor]} · ${phase} · ${seconds.format(time)} s`, images };
    }));
    await page.setViewport({ width: 1440, height: 320, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>
      *{box-sizing:border-box}body{font:18px system-ui;color:#203d35;background:#f5ead5;margin:18px}
      main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
      section{display:grid;grid-template-columns:1fr 1fr;gap:6px}h2{grid-column:span 2;font-size:16px;margin:0}
      figure{margin:0}img{display:block;width:100%;aspect-ratio:700/640}figcaption{font-size:14px;padding-top:4px}
      </style><main></main>`);
    await page.evaluate(async items => {
      const grid = document.querySelector('main');
      for (const { label, images } of items) {
        const row = document.createElement('section'), heading = document.createElement('h2');
        heading.textContent = label;
        row.append(heading);
        for (let index = 0; index < images.length; index++) {
          const figure = document.createElement('figure'), image = document.createElement('img'), caption = document.createElement('figcaption');
          caption.textContent = index === 0 ? 'Avant' : 'Après';
          image.src = `data:image/png;base64,${images[index]}`;
          figure.append(image, caption);
          row.append(figure);
        }
        grid.append(row);
      }
      await Promise.all(Array.from(document.images, image => image.decode()));
    }, pairs);
    const filename = `comparaison-${group}.png`;
    await page.screenshot({ path: resolve(studioOnly ? output : outputRoot, filename), fullPage: true });
    report.comparisons.push(filename);
  }
}

await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: Launcher.getInstallations()[0], headless: true, userDataDir: resolve(output,'chrome'), args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage();
  await configurePage(page);
  if (timingOnly) {
    for (const viewport of viewports.slice(0, 2)) {
      await mountVillage(page, viewport);
      for (let repeat = 0; repeat < 3; repeat++) await measureVillage(page, viewport);
      if(humanFinish) {
        await frameVillageSubject(page,'player');
        await measureVillage(page,viewport,'observation-joueur');
      }
    }
  } else if (observerMobile) {
    await captureMobileObservation(page);
  } else if (desktopProbe) {
    await page.bringToFront();
    await mountVillage(page, viewports[0]);
    for (let series = 0; series < 3; series++) await measureVillage(page, viewports[0]);
    await captureVillage(page, 'village-1440x1000');
  } else if (!studioOnly) {
    for (const viewport of viewports) {
      await mountVillage(page, viewport);
      await measureVillage(page, viewport);
      await captureVillage(page, `village-${viewport.width}x${viewport.height}`);
      if(humanFinish && viewport.width>=844)await captureVillagePose(page,'loic','carte-loic-'+viewport.width);
      for (const id of viewport.width === 844 ? [] : ['breton', 'fisherman', 'loic']) {
        await observeVillage(page, id);
        await captureVillage(page, `observe-${id}-${viewport.width}x${viewport.height}`);
        if (humanFinish && viewport.width === 1440) {
          await captureVillagePose(page, id, 'quartier-' + id);
          if (!baseline && id === 'loic') await captureVillagePlayerPair(page);
        }
      }
    }
  }
  if (!timingOnly && !observerMobile && !desktopProbe && !process.argv.includes('--village-only')) {
    await page.setViewport({ width: 700, height: 640, deviceScaleFactor: 1 });
    await page.goto(`${origin}${studioPath}`, { waitUntil: 'networkidle0' });
    await configureStudio(page);
    await captureStudio(page);
    if (!baseline && !studioOnly) await measureAnimationCost(page);
    if (humanFinish && !baseline) { await portraitSheet(page); await motionProof(page); }
    if (!baseline) await compareCaptures(page);
    if (humanFinish && !baseline && !studioOnly) await compareVillageCharacters();
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.external, []);
  report.passed = true;
  console.log(`${label}: ${report.village.length} village captures, ${report.studio.length} studio poses`);
} finally {
  try { await browser.close(); } finally {
    await writeFile(resolve(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
}
