/** Run through audit-village-3d.mjs --character-quality [--baseline]. */
import assert from 'node:assert/strict';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { resolve } from 'node:path';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const baseline = process.argv.includes('--baseline');
const studioOnly = process.argv.includes('--studio-only');
const desktopProbe = process.argv.includes('--desktop-probe');
const observerMobile = process.argv.includes('--observer-mobile');
const label = baseline ? 'before' : 'after';
const origin = process.env.VILLAGE_CHARACTER_ORIGIN ?? 'http://127.0.0.1:3618';
const outputRoot = resolve('output/village-character-quality');
const output = observerMobile ? resolve(outputRoot, 'observer-mobile')
  : desktopProbe ? resolve(outputRoot, 'desktop-probe', label)
  : resolve(outputRoot, studioOnly ? (baseline ? 'review-draft-before' : 'review-draft') : label);
const worldPath = '/src/components/placard/world/';
const snapshotPath = '/output/village-character-quality/source-before/';
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
  sources: baseline ? 'Saved world sources at output/village-character-quality/source-before, loaded through Vite at the original module paths.' : 'Current production world sources.',
  limits: 'Desktop headless Chrome, DPR 1. Mobile sizes emulate the viewport and touch, not device hardware. The 5 s measurements check actual render submissions and CPU time, not GPU execution. API fixtures and all studio work are local.',
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
  await page.setViewport({ ...viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, isLandscape: mobile && viewport.width > viewport.height });
  await page.goto(origin, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForSelector(ready);
}

async function measureVillage(page, viewport) {
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
    viewport, ...browser, elapsedMs, renderedFrames, animationFrames, sampledFrames: samples.length,
    systemCpuBusyFraction: totalTime > 0 ? (totalTime - idleTime) / totalTime : null,
    skippedSamples: values('skipped').reduce((sum, skipped) => sum + skipped, 0), actualFps: 1000 * renderedFrames / elapsedMs,
    medianFps: 1000 / percentile(values('interval'), 0.5), frameP95Ms: percentile(values('interval'), 0.95),
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
  await page.click('summary');
  await page.click(`[data-observe-life="${id}"]`);
  await page.waitForSelector(`canvas[data-life-observe="${id}"][data-camera-transition="idle"]`);
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

    window.characterAuditCapture = ({ actor, through, phases, yaw, vertical, targetY }) => {
      releaseActors();
      actors = factories[actor]?.() ?? animals.createVillageAnimals(surface);
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
      subject.traverse(node => { if (node.isMesh) node.castShadow = true; });
      const horizontal = vertical * innerWidth / innerHeight;
      const camera = new THREE.OrthographicCamera(-horizontal / 2, horizontal / 2, vertical / 2, -vertical / 2, 0.1, 50);
      camera.position.set(Math.sin(yaw) * 7, targetY + 1.65, Math.cos(yaw) * 7);
      camera.lookAt(0, targetY, 0);
      lastCamera = camera;
      renderer.render(scene, camera);
      return { time: through / fps, state: { ...subject.userData }, resource: { ...renderer.info.render, ...renderer.info.memory } };
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
  const firstFramePerActor = new Map();
  for (const [actor, name, phases, time] of studioCases) {
    const animal = ['wolf', 'fox', 'weasel'].includes(actor);
    const frame = {
      actor, phases, through: Math.round(time * 60), yaw: animal ? 0.83 : actor === 'fisherman' ? 0.57 : 0.34,
      vertical: animal ? actor === 'weasel' ? 1.04 : 1.7 : actor === 'fisherman' ? 2.35 : 2.5,
      targetY: animal ? actor === 'weasel' ? 0.29 : 0.44 : actor === 'fisherman' ? 0.83 : 1.02,
    };
    const pose = await page.evaluate(params => window.characterAuditCapture(params), frame);
    await page.screenshot({ path: resolve(output, `${actor}-${name}.png`) });
    const { yaw, vertical, targetY } = frame;
    report.studio.push({ actor, name, camera: { yaw, vertical, targetY }, ...pose });
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
  executablePath: Launcher.getInstallations()[0], headless: true, args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage();
  await configurePage(page);
  if (observerMobile) {
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
      for (const id of viewport.width === 844 ? [] : ['breton', 'fisherman', 'loic']) {
        await observeVillage(page, id);
        await captureVillage(page, `observe-${id}-${viewport.width}x${viewport.height}`);
      }
    }
  }
  if (!observerMobile && !desktopProbe && !process.argv.includes('--village-only')) {
    await page.setViewport({ width: 700, height: 640, deviceScaleFactor: 1 });
    await page.goto(`${origin}${studioPath}`, { waitUntil: 'networkidle0' });
    await configureStudio(page);
    await captureStudio(page);
    if (!baseline && !studioOnly) await measureAnimationCost(page);
    if (!baseline) await compareCaptures(page);
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
