import assert from "node:assert/strict";
import { resolve } from "node:path";

export async function checkSpatialCare({page,output,viewport,visit,state,reveal,tap,pass,pose,screenshots,chooseCareProduct,pressCareCell}) {
  const product="CARE-APHIDIUS";
  const primary="[data-culture-primary-action]";
  for (const [width,height,touch] of [[320,690,true],[390,844,true],[844,390,true],[1440,900,false]]) {
    await viewport(width,height,touch);
    await visit("pbi-"+width);
    await page.waitForSelector('[data-grow-camera][data-renderer="webgl"]');
    const initial=await state();
    if(width<=390) {
      const buttons=await page.$$eval("[data-grow-posts] button",nodes=>nodes.map(node=>{
        const bounds=node.getBoundingClientRect(), text=document.createRange();
        text.selectNodeContents(node);
        const label=text.getBoundingClientRect();
        return {top:Math.round(bounds.top),inside:bounds.left>=0 && bounds.right<=innerWidth && label.left>=bounds.left-1 && label.right<=bounds.right+1};
      }));
      assert.equal(buttons.length,4);
      assert.ok(buttons.every(b=>b.inside));
      assert.equal(new Set(buttons.map(b=>b.top)).size,2);
    }
    if(width===390){
      await page.$eval("[data-culture-room]",node=>node.scrollIntoView({block:"start",behavior:"instant"}));
      const shown=await page.evaluate(()=>{
        const link=document.querySelector("[data-room-show-dice]").getBoundingClientRect();
        return {zoom:Number(document.querySelector("[data-grow-camera]").dataset.zoom),top:link.top,bottom:link.bottom,height:innerHeight};
      });
      assert.equal(shown.zoom,1);
      assert.ok(shown.top>=0 && shown.bottom<=shown.height,"The overview and its shortcut fit together on the 390 px phone");
      const file="smartphone-salle-390.png";
      await page.screenshot({path:resolve(output,file)});
      screenshots.push(file);
    }
    const unchanged=async()=>{
      const live=await state();
      assert.deepEqual(live.game,initial.game);
      assert.deepEqual(live.care,initial.care);
      assert.equal(live.cash,initial.cash);
      assert.equal(live.calls.filter(c=>c.method==="POST").length,0);
    };
    if(touch){
      await tap("[data-room-show-dice]");
      await page.waitForFunction(()=>document.activeElement?.matches("[data-culture-decision]"));
      for(const offset of [0,120,-65]){
        const geometry=await page.evaluate(offset=>{
          window.scrollBy({top:offset,behavior:"instant"});
          const bar=document.querySelector("[data-culture-actionbar]");
          const tray=document.querySelector("[data-culture-decision] [data-motion-phase]");
          return {barTop:bar.getBoundingClientRect().top,trayBottom:tray.getBoundingClientRect().bottom,
            position:getComputedStyle(bar).position,overflow:document.documentElement.scrollWidth-innerWidth};
        },offset);
        assert.ok(geometry.barTop>=geometry.trayBottom-.5,"The roll bar follows the dice tray at scroll offset "+offset);
        assert.ok(["static","relative"].includes(geometry.position));
        assert.ok(geometry.overflow<=0);
      }
      await tap("[data-dice-show-room]");
      await page.waitForFunction(()=>!!document.activeElement?.closest("[data-culture-room]"));
      await unchanged();
      pass("Room and dice shortcuts preserve the turn and keep the roll below its tray at "+width+" × "+height);
    }
    await chooseCareProduct();
    assert.equal((await page.$$("[data-pbi-cell]")).length,6);
    assert.equal((await page.$$("[data-affected-plant]")).length,1);
    assert.equal(await page.$eval(primary,n=>n.getClientRects().length),0);
    const snap=async(name,selector)=>{
      await (await page.$(selector)).screenshot({path:resolve(output,name)});
      screenshots.push(name);
    };
    if(width===320){
      await tap("[data-grow-zoom-in]");
      await tap("[data-grow-zoom-in]");
      await snap("choix-case-320.png","[data-culture-room]");
    }
    if(width===320){
      await tap("[data-pbi-instructions] button");
      await page.waitForSelector("[data-pbi-instructions]",{hidden:true});
      await unchanged();
      await chooseCareProduct();
      await page.reload({waitUntil:"domcontentloaded"});
      await page.waitForSelector("[data-culture-room]");
      assert.equal(await page.$("[data-pbi-instructions]"),null);
      await unchanged();
      await chooseCareProduct();
    }
    // The desktop exercise deliberately treats an uninfested zone. Only the untreated
    // aphid focus can expand at resolution. Other viewports release on the marked cell.
    const offTarget=width===1440;
    const target=offTarget?{zoneId:"culture-1",x:1,y:0}:{zoneId:"culture-2",x:0,y:1};
    const key=[target.zoneId,target.x,target.y].join(":");
    if(width===390){
      await tap("[data-grow-zoom-in]");
      await tap("[data-grow-zoom-in]");
    }
    await pressCareCell(key);
    await pose("pbi");
    await page.waitForSelector('[data-pbi-deposit="'+key+'"]');
    const live=await state();
    assert.equal(live.game.phase,"prepare");
    assert.equal(live.game.care.applications.length,1);
    assert.deepEqual(live.game.care.applications[0].target,target);
    assert.equal(live.game.care.problems[0].plants.length,1);
    assert.equal(live.careArea[product],5);
    assert.equal(live.care[product],0);
    assert.equal(live.cash,initial.cash);
    assert.deepEqual(live.calls.filter(c=>c.method==="POST").map(c=>[c.body.productCode,c.body.target,c.status]),[[product,target,200]]);
    if(width===390)await snap("depot-pbi-390.png","[data-culture-room]");
    await page.reload({waitUntil:"domcontentloaded"});
    await page.waitForSelector("[data-culture-room]");
    const resumed=await state();
    assert.equal(resumed.calls.filter(c=>c.method==="POST").length,0);
    assert.deepEqual(resumed.game,live.game);
    assert.deepEqual(resumed.careArea,live.careArea);
    await page.waitForSelector('[data-pbi-covered="'+key+'"]');
    if(offTarget){
      await tap('[data-culture-tab="play"]');
      await tap(primary);await page.waitForSelector('[data-culture-phase="rolled"]');
      await tap(primary);await page.waitForSelector('[data-culture-phase="resolved"]');
      const resolved=await state();
      const plants=resolved.game.care.problems.find(p=>p.code==="APHIDS")?.plants;
      assert.ok(plants?.length>1,"A release elsewhere leaves this focus free to spread");
      assert.ok(plants.every(p=>p.zoneId==="culture-2"));
      await reveal("[data-grow-camera]");
      assert.equal((await page.$$("[data-affected-plant]")).length,plants.length);
      await snap("propagation-1440.png","[data-culture-room]");
      pass("Untreated focus advances to a neighbouring plant at the next actual dice resolution",{plants,treated:target});
    }
    pass("Product, projected square metre, personalized release and persistent stock at "+width+" × "+height,{target,remainingM2:live.careArea[product],touch});
  }
  await viewport(390,844,true);
  const inputs=[["CARE-VERMICOMPOST","spread"],["CARE-COMPOST-TEA","pour"],["CARE-ORGANIC-FEED","pour"],["CARE-SEAWEED","pour"]];
  for(const [code,gesture] of inputs){
    await visit("interventions-"+code);
    const before=await state();
    await chooseCareProduct(code);
    assert.deepEqual((await state()).care,before.care);
    await pressCareCell("culture-1:2:0");
    assert.equal(await pose(gesture,gesture==="spread"?"lombricompost-390":undefined),"culture-1");
    await page.waitForSelector('[data-input-deposit="culture-1:2:0"]');
    const after=await state();
    assert.deepEqual(after.game.care.applications.at(-1).target,{zoneId:"culture-1",x:2,y:0});
    assert.equal(after.careArea[code],5);
    assert.equal(after.cash,before.cash);
    assert.equal(after.calls.filter(c=>c.method==="POST").length,1);
    pass("Input placed on one chosen square metre with its tool",{code,gesture});
  }
  await tap('[data-culture-tab="care"]');
  await tap('[data-care-section="intervention"]');
  const beforeCleaning=await state();
  await tap("[data-care-basic]");
  await page.waitForSelector("[data-care-waiting]");
  await pose("sweep","nettoyage-390");
  const cleaned=await state();
  assert.equal(cleaned.game.care.lastBasicCareStage,0);
  assert.equal(cleaned.cash,beforeCleaning.cash-6*500);
  assert.deepEqual(cleaned.careArea,beforeCleaning.careArea);
  assert.equal(cleaned.game.phase,beforeCleaning.game.phase);
  assert.equal(await page.evaluate(()=>!!document.activeElement?.closest("[data-culture-room]")),true);
  pass("Paid warehouse cleaning returns to the room and sweeps the aisle once");
}
