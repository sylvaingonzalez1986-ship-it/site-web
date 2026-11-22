import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

// Run against the local --avatar-studio --preview fixture, using its production renderer.
const origin = process.env.CHANVRIER_STUDIO_ORIGIN || 'http://127.0.0.1:3618';
const output = resolve(process.env.CHANVRIER_STUDIO_AUDIT_DIR || 'output/chanvrier-studio');
const phase = process.argv.includes('--baseline') ? 'avant' : 'apres';
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: Launcher.getInstallations()[0], headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.isNavigationRequest()) void request.respond({ contentType: 'text/html', body: '<!doctype html><title>Vues de contrôle</title>' });
    else if (new URL(request.url()).origin === origin) void request.continue();
    else void request.abort();
  });
  await page.goto(origin);
  const result = await page.evaluate(async () => {
    const { createChanvrierWorkshopRenderer } = await import('/src/components/contest/chanvrier-workshop-renderer.ts');
    const { CHANVRIER_STUDIO_CAMERA_POSITION: offset } = await import('/src/components/contest/chanvrier-studio-light.ts');
    const { getChanvrierAppearance } = await import('/src/lib/arena-chanvrier.ts');
    const canvas = document.createElement('canvas');
    const board = document.createElement('canvas');
    const w = 278, h = 296;
    const profiles = [
      ['Maël • marinière', 'honey', {face:'round', eyes:'almond', hair:'crop', hairColor:'chestnut', nose:'round', mouth:'smile', eyeColor:'brown'}],
      ['Boucles • peau ébène', 'ebony', {face:'cheeked', eyes:'bright', hair:'curls', hairColor:'black', nose:'wide', mouth:'grin', eyeColor:'amber'}],
      ['Carré long • teint cuivré', 'copper', {face:'heart', eyes:'relaxed', hair:'long', hairColor:'black', nose:'small', mouth:'calm', eyeColor:'green'}],
      ['Lunettes • cheveux roux', 'ivory', {face:'oval', eyes:'round', hair:'quiff', hairColor:'ginger', accessory:'round-glasses', nose:'round', mouth:'smile', eyeColor:'blue'}],
    ];
    const views = [['Silhouette', 'full', 0], ['Face', 'portrait', 0], ['Trois quarts', 'portrait', -.69], ['Profil', 'portrait', -Math.PI/2]];
    board.width = w * views.length; board.height = (h + 32) * profiles.length;
    const ctx = board.getContext('2d');
    ctx.fillStyle = '#f7edda'; ctx.fillRect(0, 0, board.width, board.height);
    const base = {gender:'male', clothing:'teal', skin:'honey'};
    const studio = createChanvrierWorkshopRenderer(canvas, base, () => { throw Error('Contexte WebGL perdu'); });
    try {
      studio.resize(w, h);
      for (const [row, [name,skin,options]] of profiles.entries()) {
        const profile = {...base, skin};
        profile.appearance = {...getChanvrierAppearance(profile), ...options, top:'mariniere', bottom:'jeans', shoes:'work', dyes:{top:'#eee3c8', accent:'#305d63', bottom:'#30525a'}};
        studio.updateAppearance(profile);
        for (const [column,[label,view,angle]] of views.entries()) {
          studio.updateFrame({ view, rotation:Math.atan2(offset[0],offset[2])+angle, walking:false });
          const x = column*w, y = row*(h+32);
          await new Promise(done => requestAnimationFrame(() => { ctx.drawImage(canvas,x,y,w,h); done(); }));
          ctx.fillStyle='#21443c';ctx.fillRect(x,y+h,w,32);
          ctx.fillStyle='#fff7e7';ctx.font='15px Arial';ctx.fillText(column===0?name:label,x+12,y+h+21);
        }
      }
      return board.toDataURL('image/webp', .94).split(',')[1];
    } finally { studio.dispose(); }
  });
  await writeFile(resolve(output, phase + '-vues.webp'), Buffer.from(result, 'base64'));
} finally { await browser.close(); }
