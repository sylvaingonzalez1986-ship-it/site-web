/** Run using audit-village-3d.mjs --avatar-turntable. The same framing also runs on the baseline checkout. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

export async function run({ origin, output }) {
  const browser = await puppeteer.launch({
    executablePath: Launcher.getInstallations()[0], headless: true, userDataDir: join(output, 'chrome'),
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });
    await page.goto(origin);
    const result = await page.evaluate(async (captureMotion) => {
      const T = await import('/@id/__x00__turntable-three');
      const { createGrowWorker } = await import('/src/components/placard/kq-grow-worker-model.ts');
      const { DEFAULT_CHANVRIER_APPEARANCE: base } = await import('/src/lib/arena-chanvrier.ts');
      const makeProfile = (look = {}, skin = 'honey', gender = 'male') => ({
        gender, skin, clothing: 'teal', appearance: {
          ...base, face: 'round', nose: 'round', top: 'mariniere', bottom: 'sailor-trousers', shoes: 'deck-shoes',
          dyes: { top: '#f5e3be', stripe: '#204858', bottom: '#225369', shoes: '#c78c3e' }, ...look,
        },
      });
      const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(320, 360);
      renderer.setClearColor('#f3e9d6');
      renderer.toneMapping = T.ACESFilmicToneMapping;
      const scene = new T.Scene();
      const key = new T.DirectionalLight('#fff9f0', 2.25);
      key.position.set(-3, 4, 6);
      scene.add(new T.HemisphereLight('#fff8ec', '#c6ab8c', 1.6), key);
      const camera = new T.OrthographicCamera(-1, 1, 1, -1, .1, 20);
      const frame = (y, span, yaw, width = 320) => {
        renderer.setSize(width, 360);
        camera.top = span / 2; camera.bottom = -camera.top;
        camera.right = camera.top * width / 360; camera.left = -camera.right;
        camera.position.set(Math.sin(yaw) * 4, y + .11, Math.cos(yaw) * 4);
        camera.lookAt(0, y, 0); camera.updateProjectionMatrix();
      };
      const gl = renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const report = { graphics: ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL), profiles: [], timings: [] };
      const images = {};
      const photo = (name) => {
        renderer.render(scene, camera);
        images[name] = renderer.domElement.toDataURL('image/png').split(',')[1];
      };
      function inspect(model, name) {
        const materials = new Set(), geometry = new Set(), textures = new Set();
        const buffers = new Set();
        let bones = 0, joints = 0, triangles = 0, invalidComponents = 0, vertexBytes = 0, uvMeshes = 0;
        model.object.traverseVisible(n => {
          if (n.isBone) bones++;
          if (n.isGroup) joints++;
          if (!n.isMesh) return;
          const g = n.geometry;
          triangles += (g.index?.count ?? g.attributes.position.count) / 3;
          const list = Array.isArray(n.material) ? n.material : [n.material];
          list.forEach(m => {
            materials.add(m); Object.values(m).filter(v => v?.isTexture).forEach(t => textures.add(t));
          });
          if (geometry.has(g)) return;
          geometry.add(g);
          if (g.attributes.uv) uvMeshes++;
          for (const target of Object.values(g.morphAttributes).flat()) {
            if (target.count !== g.attributes.position.count) throw Error('Morph topology: ' + n.name);
          }
          const attributes = [...Object.values(g.attributes), ...Object.values(g.morphAttributes).flat()];
          if (g.index) attributes.push(g.index);
          for (const a of attributes) {
            if (buffers.has(a.array)) continue;
            buffers.add(a.array);
            vertexBytes += a.array.byteLength;
            for (const v of a.array) if (!Number.isFinite(v)) invalidComponents++;
          }
        });
        report.profiles.push({ name, triangles, calls: renderer.info.render.calls, materials: materials.size,
          geometries: geometry.size, textures: textures.size, bones, groups: joints, vertexBytes, uvMeshes, invalidComponents });
      }
      const ref = makeProfile();
      const times = [];
      for (let i = 0; i < 6; i++) {
        const start = performance.now(), m = createGrowWorker(ref, { tools: false });
        times.push(performance.now() - start); m.dispose();
      }
      report.constructionMs = times;
      const actor = createGrowWorker(ref);
      scene.add(actor.object);
      frame(.91, 1.98, 0); photo('corps'); inspect(actor, 'Maël');
      frame(1.44, .61, 0); photo('face');
      frame(1.44, .61, .64); photo('trois-quarts');
      frame(1.44, .61, Math.PI / 2); photo('profil');
      frame(.91, 1.98, Math.PI); photo('dos');
      frame(.91, 1.98, .52);
      actor.pose(.34, 1, null, 0, null, undefined, .65); photo('marche');
      actor.pose(0, 0, 'inspect', .5, 2, undefined, .65); photo('inspection');
      actor.pose(0, 0, null, 0, null);
      frame(1.44, .61, .12);
      if (actor.setExpression) for (const id of ['neutral', 'smile', 'surprise', 'focus']) {
        actor.setExpression(id, 1); photo(id);
      }
      actor.setExpression?.('neutral', 0);
      actor.pose(0, 0, null, 0, null, undefined, 2.58); photo('clignement');
      actor.pose(0, 0, null, 0, null);
      const outfits = [
        ['maree', makeProfile({ body: 'broad', hair: 'quiff', facialHair: 'beard', jacket: 'raincoat', headwear: 'souwester',
          dyes: { jacket: '#d2983c', headwear: '#d2983c', bottom: '#324d58' } }, 'brown')],
        ['bigoudene', makeProfile({ body: 'compact', hair: 'braids', top: 'embroidered-vest', bottom: 'pleated-skirt',
          headwear: 'bigouden-coif', accessory: 'brooch', dyes: { top: '#593d54', accent: '#c89a49' } }, 'copper', 'female')],
        ['atelier', makeProfile({ body: 'regular', hair: 'curls', top: 'apron', bottom: 'skirt', shoes: 'clogs',
          dyes: { top: '#819178', accent: '#eacfa6' } }, 'ebony', 'female')],
      ];
      const actors = [actor];
      actor.object.removeFromParent();
      for (const [name, profile] of outfits) {
        const extra = createGrowWorker(profile, { tools: false });
        scene.add(extra.object); frame(.95, 2.14, .48); photo(name); inspect(extra, name);
        extra.object.removeFromParent(); actors.push(extra);
      }
      const second = createGrowWorker(ref, { tools: false });
      second.object.position.x = .39; actor.object.position.x = -.39;
      scene.add(actor.object, second.object); frame(.91, 1.98, 0, 460);
      const half = document.createElement('canvas');
      half.width = 230; half.height = 360;
      const crop = (left) => {
        half.getContext('2d').drawImage(renderer.domElement, left, 0, 230, 360, 0, 0, 230, 360);
        return half.toDataURL();
      };
      renderer.render(scene, camera);
      const beforeLeft = crop(0), beforeRight = crop(230);
      actor.updateAppearance(makeProfile({ dyes: { top: '#833d49', stripe: '#ce9b51', bottom: '#343f55' } }));
      photo('duo');
      report.independent = beforeRight === crop(230) && beforeLeft !== crop(0);
      second.dispose();
      const raf = () => new Promise(r => requestAnimationFrame(r));
      for (const count of [1,4]) {
        for (let i = 0; i < count; i++) {
          actors[i].object.position.x = (i - (count - 1) / 2) * .72;
          scene.add(actors[i].object);
        }
        frame(.94, 2.14, 0, 640);
        const samples = [], cpu = [];
        let prev = await raf();
        for (let i = 0; i < 85; i++) {
          const now = await raf(), start = performance.now();
          for (let j = 0; j < count; j++) actors[j].pose(i * .02, 1, null, 0, null, undefined, i / 60);
          renderer.render(scene, camera);
          if (i >= 10) { samples.push(now - prev); cpu.push(performance.now() - start); }
          prev = now;
        }
        samples.sort((a,b) => a-b); cpu.sort((a,b) => a-b);
        report.timings.push({ count, samples: samples.length, medianMs: samples[37], p95Ms: samples[71],
          submitMedianMs: cpu[37], submitP95Ms: cpu[71], calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
          residentTextures: renderer.info.memory.textures, residentGeometries: renderer.info.memory.geometries });
      }
      photo('groupe');
      actors.forEach(m => m.dispose());
      if (captureMotion) {
        const model = createGrowWorker(ref);
        scene.add(model.object); frame(.91, 1.98, .2);
        let distance = 0;
        for (let i = 0; i < 72; i++) {
          const t = i / 12;
          const stride = Math.max(0, Math.min(1, (t - 1) * 4, (3.45 - t) * 4));
          const heading = Math.max(0, Math.min(1, (t - .95) / .75, (5.9 - t) / .75));
          const activity = t >= 3.5 && t < 5.2;
          const phase = activity ? (t - 3.5) / 1.7 : 0;
          const turn = t > .95 && t < 1.7 ? .46 : t > 5.15 && t < 5.9 ? -.46 : 0;
          distance += stride * 1.48 / 12;
          model.object.rotation.y = heading * .8;
          model.pose(distance, stride, activity ? 'inspect' : null, phase, 2, undefined, t + 2, turn);
          photo('mouvement/' + String(i).padStart(2, '0'));
        }
        model.dispose();
      }
      renderer.dispose();
      return { report, images };
    }, process.argv.includes('--avatar-motion'));
    result.report.browser = await browser.version();
    if (process.argv.includes('--avatar-motion')) await mkdir(join(output, 'mouvement'), { recursive: true });
    for (const [name, data] of Object.entries(result.images)) await writeFile(join(output, name + '.png'), Buffer.from(data, 'base64'));
    await writeFile(join(output, 'mesures.json'), JSON.stringify(result.report, null, 2));
    assert.ok(result.report.independent, 'Changing actor A changed the pixels on actor B');
    assert.ok(result.report.profiles.every(p => !p.invalidComponents), 'Non-finite geometry');
    console.log(JSON.stringify(result.report));
  } finally {
    await browser.close();
  }
}
