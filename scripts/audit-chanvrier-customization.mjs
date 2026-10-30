// Real editor/avatar/savings components, isolated API fixtures, no external traffic.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, transformWithOxc } from 'vite';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const output = resolve(root, 'output/chanvrier-customization');
const origin = 'http://127.0.0.1:3217';
let profile = null, failSave = false, saveRequests = 0, saveDelay = 0;
let balance = 0, cash = 100000;
const errors = [], checks = [];
const entry = [
  "import React, { useState } from 'react';",
  "import { createRoot } from 'react-dom/client';",
  "import { ChanvrierProfileEditor } from '/src/components/contest/ChanvrierProfileEditor';",
  "import { ChanvrierAvatar } from '/src/components/contest/ChanvrierAvatar';",
  "import { ChanvrierSavingsPanel } from '/src/components/contest/ChanvrierSavingsPanel';",
  "import { createKqTutorialApi, KqTutorialApiProvider } from '/src/components/placard/KqTutorialApiContext';",
  "import { DEFAULT_CHANVRIER_APPEARANCE as defaults, CHANVRIER_APPEARANCE_OPTIONS as options, CHANVRIER_SKINS as skins, CHANVRIER_CLOTHES as clothes } from '/src/lib/arena-chanvrier';",
  "const tutorialApi = createKqTutorialApi((...args) => fetch(...args));",
  "window.__profileSaves = 0;",
  "function Gallery() {",
  "  const showcase = location.search === '?showcase';",
  "  return <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',background:'#f6e9c9',color:'#003f30'}}>{Array.from({length:showcase?6:24},(_,i)=>{",
  "    const appearance={...defaults};",
  "    for(const key of Object.keys(options)) appearance[key]=options[key][i%options[key].length].code;",
  "    const profile={gender:i%2?'female':'male',clothing:clothes[i%6].code,skin:skins[Math.floor(i/4)%6].code,appearance};",
  "    if(showcase){",
  "      Object.assign(appearance,{...defaults,hair:['crop','bob','curls','braids','quiff','ponytail'][i],hairColor:['black','chestnut','ginger','black','chestnut','black'][i],top:['tee','overalls','jacket','hoodie','shirt','apron'][i],bottom:['jeans','jeans','cargo','shorts','jeans','skirt'][i],bottomColor:['teal','blue','teal','berry','teal','teal'][i],shoes:['work','boots','sneakers','high-tops','work','boots'][i],shoeColor:'ochre',face:'oval',eyes:'almond',eyeColor:'brown',mouth:'grin',facialHair:'none',accessory:'none'});",
  "      profile.skin=['ivory','peach','ivory','brown','honey','copper'][i];",
  "      profile.clothing=['ochre','teal','sage','ochre','teal','berry'][i];",
  "    }",
  "    return <div key={i}><ChanvrierAvatar profile={profile} className='gallery-avatar'/><p style={{textAlign:'center'}}>{appearance.hair} · {appearance.top} · {profile.skin}</p></div>;",
  "  })}</div>;",
  "}",
  "function App() {",
  "  const [profile,setProfile]=useState(null), [open,setOpen]=useState(true);",
  "  return <main style={{maxWidth:700,margin:'20px auto'}}>",
  "    {profile?<><ChanvrierAvatar profile={profile}/><button id='edit' onClick={()=>setOpen(true)}>Personnaliser</button><ChanvrierSavingsPanel/></>:<button id='reopen' onClick={()=>setOpen(true)}>Créer un personnage</button>}",
  "    {open?<ChanvrierProfileEditor profile={profile} onClose={()=>setOpen(false)} onSaved={p=>{window.__profileSaves++;setProfile(p);setOpen(false)}}/>:null}",
  "  </main>;",
  "}",
  "createRoot(document.getElementById('root')).render(location.search==='?gallery'||location.search==='?showcase'?<Gallery/>:location.search==='?tutorial'?<KqTutorialApiProvider api={tutorialApi}><App/></KqTutorialApiProvider>:<App/>);",
].join('\n');

const server = await createServer({
  root, configFile: false, envDir: false, cacheDir: resolve(output, 'vite-cache'),
  define: { 'process.env': '{}' },
  resolve: { alias: { '@': resolve(root, 'src') } },
  optimizeDeps: { include: ['react', 'react-dom/client', 'lucide-react'], exclude: ['next/image'] },
  plugins: [{
    name: 'character-journey-audit',
    enforce: 'pre',
    resolveId(id) {
      if (id === 'avatar-entry') return '\0avatar-entry';
      if (id === 'next/image') return '\0fixture-image';
    },
    async load(id) {
      if (id === '\0avatar-entry') return (await transformWithOxc(entry, 'entry.tsx', {lang:'tsx',jsx:{runtime:'automatic'}})).code;
      if (id === '\0fixture-image') return "import React from 'react';export default function Image({fill,priority,unoptimized,quality,loader,...props}){return React.createElement('img',props)}";
    },
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith('/api/')) {
          res.setHeader('Content-Type', 'application/json');
          let raw = '';
          for await (const chunk of req) raw += chunk;
          const body = raw ? JSON.parse(raw) : {};
          if (req.url === '/api/arena/chanvrier') {
            saveRequests++;
            if (saveDelay) await new Promise(resolve => setTimeout(resolve, saveDelay));
            if (failSave) {
              res.statusCode = 503;
              return res.end(JSON.stringify({error:'Enregistrement indisponible.'}));
            }
            profile = body;
            return res.end(JSON.stringify({profile}));
          }
          if (req.url === '/api/arena/chanvrier/savings') {
            if (body.action === 'deposit') { cash -= body.amountCents; balance += body.amountCents; }
            if (body.action === 'withdraw') { cash += body.amountCents; balance -= body.amountCents; }
            return res.end(JSON.stringify({cashCents:cash,balanceCents:balance,interestCreditedCents:0,nextInterestAt:balance?new Date(Date.now()+86400000).toISOString():null,ratePercent:5,periodHours:24,maxBalanceCents:2000000000,replayed:false}));
          }
          res.statusCode = 404;
          return res.end('{}');
        }
        if (req.url?.split('?')[0] !== '/') return next();
        res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--font-display:Impact;--font-body:Arial}*{box-sizing:border-box}body{margin:0;background:#003f30;color:#fff8e8;font-family:Arial}button,input{font:inherit}</style><div id="root"></div><script type="module" src="/@id/__x00__avatar-entry"></script></html>');
      });
    },
  }],
  server: { host: '127.0.0.1', port: 3217, strictPort: true, hmr: false, watch: null },
});

let browser, page, currentCheck = 'initialization';
const report = () => writeFile(resolve(output, 'report.json'), JSON.stringify({passed:!errors.length&&checks.every(check=>check.passed),checks,errors,fixture:'Real profile editor, avatar and savings; local Vite API only; external traffic blocked'},null,2));
try {
  await mkdir(output, {recursive:true});
  await server.listen();
  browser = await puppeteer.launch({executablePath:Launcher.getInstallations()[0],headless:true,args:['--no-sandbox','--disable-gpu']});
  page = await browser.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => errors.push(error.stack ?? error.message));
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.setRequestInterception(true);
  page.on('request', request => void(request.url().startsWith(origin)||request.url().startsWith('data:')?request.continue():request.abort()));

  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const click = async selector => {
    await page.$eval(selector, element => element.scrollIntoView({block:'center',behavior:'instant'}));
    await page.click(selector);
    await settle();
  };
  const clickText = async text => {
    const handle = await page.evaluateHandle(text => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === text), text);
    assert.ok(handle.asElement(), 'button: '+text);
    await handle.asElement().evaluate(element => element.scrollIntoView({block:'center',behavior:'instant'}));
    await handle.asElement().click();
    await handle.dispose();
    await settle();
  };
  const clickChoice = async selector => {
    await click(selector);
    assert.equal(await page.$eval(selector, element => element.getAttribute('aria-pressed')), 'true');
  };
  const step = async expected => {
    await page.waitForSelector('dialog[open][data-profile-step="'+expected+'"]');
    await settle();
    assert(await page.$eval('dialog', dialog => dialog.contains(document.activeElement)), expected+': focus stays inside the modal');
  };
  const screenshot = async name => {
    await page.$eval('dialog', element => { element.scrollTop=0; });
    await settle();
    await page.screenshot({path:resolve(output, name+'.png')});
  };
  const noOverflow = async label => {
    assert(await page.$eval('dialog', element => element.scrollWidth <= element.clientWidth + 1), label+': no dialog horizontal overflow');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label+': no document horizontal overflow');
  };
  const assertView = async label => {
    await page.waitForFunction(label => {
      const button = [...document.querySelectorAll('dialog button')].find(button => button.textContent.trim() === label);
      const canvas = document.querySelector('dialog canvas[data-avatar-state="ready"]');
      return button?.getAttribute('aria-pressed') === 'true' && canvas?.height === (label === 'Zoom visage' ? 768 : 1280);
    }, {timeout:30000}, label);
  };
  const nickname = async value => {
    await click('input[autocomplete="nickname"]');
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.type('input[autocomplete="nickname"]', value);
  };
  const next = async expected => { await click('[data-profile-next]'); await step(expected); };
  const back = async expected => { await click('[data-profile-back]'); await step(expected); };
  const run = async (name, fn) => {
    currentCheck = name;
    await fn();
    checks.push({name,passed:true});
    await report();
    console.log('PASS '+name);
  };

  for (const width of [1440,390,320]) {
    await run('creation-'+width, async () => {
      const initialRequests = saveRequests;
      await page.setViewport({width,height:width<1000?844:1000});
      await page.goto(origin, {waitUntil:'networkidle0'});
      await step('inheritance');
      const story = await page.$eval('dialog', element => element.textContent);
      for (const fragment of ['grand-père','maison','grange','indoor']) assert(story.includes(fragment), 'Inheritance mentions '+fragment);
      assert.equal(await page.$eval('[data-profile-next]', element=>element.textContent.trim()), 'Créer mon personnage');
      await noOverflow('inheritance-'+width);
      await screenshot('inheritance-'+width);
      await next('look');
      assert(await page.$eval('[data-profile-next]', element=>element.disabled), 'Empty nickname cannot advance');
      await nickname('é');
      assert(await page.$eval('[data-profile-next]', element=>element.disabled), 'Invalid nickname cannot advance');
      await page.keyboard.press('Tab');
      assert.equal(await page.$eval('input[autocomplete="nickname"]', element=>element.getAttribute('aria-invalid')), 'true', 'Invalid nickname explains the field error after blur');
      await page.keyboard.press('Enter');
      await step('look');
      assert.equal(saveRequests, initialRequests, 'No API save during draft stages');
      await nickname('Camille29');
      assert.equal(await page.$eval('[data-profile-next]', element=>element.textContent.trim()), 'Choisir ma spécialité');
      await assertView('Zoom visage');
      if (width === 1440) {
        await clickText('En pied'); await assertView('En pied');
        await clickText('Cheveux'); await assertView('Zoom visage');
        const variants = new Set();
        for (const name of ['Court','Banane','Carré','Long','Boucles','Afro','Tresses','Chignon','Queue de cheval','Crête','Rasé court','Sans cheveux']) {
          await clickChoice('[aria-label="Coupe de cheveux : '+name+'"]');
          await page.waitForSelector('dialog canvas[data-avatar-state="ready"]');
          variants.add(await page.$eval('dialog canvas[role="img"]', element=>element.toDataURL()));
        }
        assert.equal(variants.size,12,'Every haircut renders a distinct appearance');
        await clickChoice('[aria-label="Coupe de cheveux : Boucles"]');
        await clickChoice('[aria-label="Couleur des cheveux et de la barbe : Roux"]');
        await clickText('Visage'); await assertView('Zoom visage');
        for (const [label,names] of [['Forme du visage',['Ovale','Rond','Carré','Allongé','Anguleux','Cœur']],['Nez',['Fin','Rond','Large']]]) {
          const variants = new Set();
          for (const name of names) {
            await clickChoice('[aria-label="'+label+' : '+name+'"]');
            await page.waitForSelector('dialog canvas[data-avatar-state="ready"]');
            variants.add(await page.$eval('dialog canvas[role="img"]', element=>element.toDataURL()));
          }
          assert.equal(variants.size,names.length,label+': every choice updates the preview');
        }
        await clickChoice('[aria-label="Couleur des yeux : Vert"]');
        await clickText('Accessoires'); await assertView('Zoom visage');
      }
      await noOverflow('look-face-'+width);
      await screenshot('look-face-'+width);
      await clickText('Tenue'); await assertView('En pied');
      await clickChoice('[aria-label="Haut : Veste"]');
      await clickChoice('[aria-label="Bas : Cargo"]');
      await clickChoice('[aria-label="Chaussures : Baskets"]');
      await noOverflow('look-outfit-'+width);
      await screenshot('look-outfit-'+width);
      await back('inheritance');
      await next('look');
      assert.equal(await page.$eval('input[autocomplete="nickname"]', element=>element.value),'Camille29','Back preserves nickname');
      await clickText('Tenue');
      assert.equal(await page.$eval('[aria-label="Haut : Veste"]', element=>element.getAttribute('aria-pressed')),'true','Back preserves appearance');
      await next('strength');
      const treasurer = await page.evaluateHandle(()=>[...document.querySelectorAll('dialog button')].find(button=>button.textContent.includes('Trésorier')));
      assert(treasurer.asElement(),'Treasurer specialty is offered');
      await treasurer.asElement().click();
      await treasurer.dispose();
      await settle();
      await noOverflow('strength-'+width);
      await screenshot('strength-'+width);
      await next('review');
      assert.equal(saveRequests,initialRequests,'Review does not save before explicit confirmation');
      assert.equal(await page.evaluate(()=>window.__profileSaves),0,'onSaved has not run during the draft');
      assert(await page.$eval('[data-profile-next]', element=>element.disabled),'Definitive specialty requires confirmation');
      await noOverflow('review-'+width);
      await screenshot('review-'+width);
      await back('strength');
      assert(await page.$$eval('dialog button[aria-pressed="true"]', buttons=>buttons.some(button=>button.textContent.includes('Trésorier'))),'Back preserves specialty');
      await next('review');
      await click('input[name="confirm-strength"]');
      assert(!(await page.$eval('[data-profile-next]', element=>element.disabled)),'Confirmed review can save');
      if (width === 1440) {
        await back('strength');
        await next('review');
        assert(await page.$eval('input[name="confirm-strength"]', element=>element.checked),'Unchanged specialty retains its confirmation');
        await back('strength');
        await page.evaluate(()=>[...document.querySelectorAll('dialog button')].find(button=>button.textContent.includes('Bricoleur')).click());
        await next('review');
        assert(!(await page.$eval('input[name="confirm-strength"]', element=>element.checked)),'Changing specialty resets definitive-choice confirmation');
        assert(await page.$eval('[data-profile-next]', element=>element.disabled),'A different specialty needs explicit confirmation');
        await back('strength');
        await page.evaluate(()=>[...document.querySelectorAll('dialog button')].find(button=>button.textContent.includes('Trésorier')).click());
        await next('review');
        await click('input[name="confirm-strength"]');
        failSave = true;
        await click('[data-profile-next]');
        await page.waitForSelector('[role="alert"]');
        await step('review');
        assert.equal(await page.evaluate(()=>window.__profileSaves),0,'Failed save never calls onSaved');
        assert((await page.$eval('[role="alert"]',element=>element.textContent)).includes('Enregistrement indisponible.'));
        await screenshot('review-save-error');
        failSave = false;
      }
      const requestsBeforeSubmit = saveRequests;
      saveDelay = 200;
      await page.$eval('[data-profile-next]', button=>{button.click();button.click();});
      await page.waitForSelector('dialog[open]', {hidden:true});
      await page.waitForSelector('#edit');
      saveDelay = 0;
      assert.equal(saveRequests,requestsBeforeSubmit+1,'Double click produces only one save');
      assert.equal(await page.evaluate(()=>window.__profileSaves),1,'Only final successful save calls onSaved');
      assert.equal(profile.strength,'treasurer');
      assert.deepEqual([profile.appearance.top,profile.appearance.bottom,profile.appearance.shoes],['jacket','cargo','sneakers']);
      if(width===1440) assert.deepEqual([profile.appearance.hair,profile.appearance.face,profile.appearance.nose,profile.appearance.eyeColor],['curls','heart','wide','green']);

      await click('#edit');
      await step('look');
      assert.equal(await page.$eval('[data-profile-next]',element=>element.textContent.trim()),'Vérifier mes changements');
      assert.equal(await page.$('[data-profile-back]'),null,'Editing starts directly with appearance');
      await nickname('Camille30');
      await next('review');
      assert.equal(await page.$('input[name="confirm-strength"]'),null,'Existing specialty does not need reconfirmation');
      assert.equal(await page.$eval('[data-profile-next]',element=>element.textContent.trim()),'Enregistrer mon profil');
      await noOverflow('edit-review-'+width);
      await screenshot('edit-review-'+width);
      await back('look');
      assert.equal(await page.$eval('input[autocomplete="nickname"]',element=>element.value),'Camille30');
      await next('review');
      await click('[data-profile-next]');
      await page.waitForSelector('dialog[open]',{hidden:true});
      assert.equal(profile.nickname,'Camille30');
      assert.equal(profile.strength,'treasurer','Editing leaves permanent specialty unchanged');
      await click('#edit');
      await step('look');
      for (let index=0;index<8;index++) {
        await page.keyboard.press('Tab');
        assert(await page.$eval('dialog',dialog=>dialog.contains(document.activeElement)),'Keyboard focus remains in modal');
      }
      await page.keyboard.press('Escape');
      await page.waitForSelector('dialog[open]',{hidden:true});
      assert.equal(await page.evaluate(()=>document.activeElement?.id),'edit','Close restores focus to opener');
    });
  }

  await run('savings-regression', async () => {
    await click('[aria-expanded="false"]');
    await page.waitForSelector('input[inputmode="decimal"]');
    await page.type('input[inputmode="decimal"]','100,25');
    await clickText('Déposer');
    await page.waitForFunction(()=>document.body.textContent.includes('déposés sur ton livret'));
    assert.equal(balance,10025); assert.equal(cash,89975);
    await page.type('input[inputmode="decimal"]','25');
    await clickText('Retirer');
    await page.waitForFunction(()=>document.body.textContent.includes('retirés vers ta trésorerie'));
    assert.equal(balance,7525); assert.equal(cash,92475);
    await page.screenshot({path:resolve(output,'savings-320.png')});
  });

  await run('tutorial-isolation', async () => {
    await page.goto(origin+'/?tutorial',{waitUntil:'networkidle0'});
    await step('look');
    const content = await page.$eval('dialog',element=>element.textContent);
    assert(!content.includes('grand-père'),'Tutorial skips real inheritance introduction');
    assert(!content.includes('kit de départ'),'Tutorial does not promise a real starter kit');
    await nickname('Demo29');
    await next('strength');
    await noOverflow('tutorial-strength-320');
    await next('review');
    assert(!(await page.$eval('dialog',element=>element.textContent)).includes('kit de départ'));
    await noOverflow('tutorial-review-320');
    await screenshot('tutorial-review-320');
    await click('input[name="confirm-strength"]');
    await click('[data-profile-next]');
    await page.waitForSelector('dialog[open]',{hidden:true});
    assert.equal(await page.evaluate(()=>window.__profileSaves),1);
  });

  await run('avatar-galleries', async () => {
    await page.setViewport({width:1800,height:1800});
    await page.goto(origin+'/?gallery',{waitUntil:'networkidle0'});
    await page.addStyleTag({content:'.gallery-avatar{width:100%;height:380px;object-fit:contain}'});
    await page.waitForFunction(()=>document.querySelectorAll('canvas[data-avatar-state="ready"]').length===24);
    await page.screenshot({path:resolve(output,'avatar-gallery.png'),fullPage:true});
    await page.setViewport({width:1800,height:550});
    await page.goto(origin+'/?showcase',{waitUntil:'networkidle0'});
    await page.addStyleTag({content:'.gallery-avatar{width:100%;height:460px;object-fit:contain}'});
    await page.waitForFunction(()=>document.querySelectorAll('canvas[data-avatar-state="ready"]').length===6);
    await page.screenshot({path:resolve(output,'sylvain-v5-preview.png'),fullPage:true});
  });
  assert.deepEqual(errors,[],'No browser runtime error');
  console.log('PASS: inheritance → appearance → specialty → review at 320/390/1440; draft/back, validation, confirmation, error/retry, single submission, editing, keyboard focus, tutorial isolation, avatar variants, savings. Screenshots: output/chanvrier-customization');
} catch (error) {
  checks.push({name:currentCheck,passed:false,error:String(error.stack??error)});
  await page?.screenshot({path:resolve(output,'failed-'+currentCheck+'.png'),fullPage:true}).catch(()=>{});
  if (page) await writeFile(resolve(output,'failed-'+currentCheck+'-text.txt'),await page.evaluate(()=>document.body.innerText).catch(()=>''));
  throw error;
} finally {
  await report();
  await browser?.close();
  await server.close();
}
