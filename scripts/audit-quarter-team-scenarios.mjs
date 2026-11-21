import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function createQuarterTeamFixture(server) {
  const engine = await server.ssrLoadModule("/src/lib/kanab-quest-staff.ts");
  const start = "2026-11-18T08:00:00.000Z";
  let raw, mutations, reads, clock;
  const receipts = new Map();
  const snapshot = () => engine.projectKqStaffSnapshot(raw);
  function reset() {
    raw = { state: engine.createKqStaffState(start), revision: 0, serverNow: start, cashCents: 500000,
      context: { businessStartedAt: start, cultureWorkVersion: 1, processingWorkVersion: 1, dayPlanVersion: 1, weeklyPlanVersion: 1,
        activeRuns: [], processingBatches: [], processingJobs:[{id:"rest-job",flowerId:"Lot étalon",status:"passive",createdAt:start}],
        supplierInvoices: [], instagramFollowers: 10, shopPartners: 1, reputation: 100, teamWork: [] } };
    for (const code of ["anna","mael"]) {
      const candidate = snapshot().candidates.find(row => row.code === code);
      raw.state = engine.applyKqStaffCommand(raw, { action: "hire", candidateCode: code, contract: "cdi", weeklyHours: 35,
        durationMonths: 0, reason: "permanent", expectedMonthlyCostCents: engine.getKqStaffMonthlyCost(candidate,35).totalCents }, code).state;
    }
    raw.state.playerWorkDays["1"] = { usedHours: 0.5 };
    raw.state.playerActions = { day: 1, entries: [{ at: start, hours: 0.5, domain: "storage", action: "place" }] };
    receipts.clear(); mutations = 0; reads = 0; clock = null;
  }
  reset();
  return { reset, snapshot, mutations: () => mutations, reads: () => reads,
    approachNextDay() {
      clock = { from: Date.parse(snapshot().calendar.nextDayAt) - 2000, receivedAt: null };
    },
    async handle(request) {
      let status = 200, body;
      try {
        if (request.method() === "POST") {
          const data = JSON.parse(request.postData());
          assert.equal(data.expectedOwnerId,"world-audit-player");
          if (receipts.has(data.requestKey)) body = receipts.get(data.requestKey);
          else {
            const action = engine.parseKqStaffCommand(data);
            const result = engine.applyKqStaffCommand(raw,action,randomUUID());
            raw = { ...raw, state: result.state, cashCents: raw.cashCents-result.debitCents, revision: raw.revision+1 };
            body=snapshot(); receipts.set(data.requestKey,body); mutations++;
          }
        } else {
          assert.equal(request.method(),"GET");
          reads++;
          if (clock) {
            clock.receivedAt ??= Date.now();
            raw.serverNow = new Date(clock.from + Date.now() - clock.receivedAt).toISOString();
            raw.state = engine.advanceKqStaff(raw).state;
          }
          body=snapshot();
        }
      } catch (error) { status=400; body={error:error.message}; }
      await request.respond({status, contentType:"application/json", body:JSON.stringify(body)});
    },
  };
}

export async function auditQuarterTeam({ page, visit, screenshot, assertNoOverflow, results, fixture }) {
  page.setDefaultTimeout(18000);
  const person = id => `[data-team-person="${id}"]`;
  const free = id => page.$eval(`[data-team-free="${id}"]`, node => node.textContent);
  const planRow = id => `[data-team-plan-id="${id}"]`;
  const durationDialog = 'dialog[data-activity-duration-dialog][open]';
  const durationRange = `${durationDialog} input[type="range"]`;
  async function activate(selector) {
    const button = await page.waitForSelector(selector,{visible:true});
    await button.evaluate(node => node.scrollIntoView({block:"center",inline:"center",behavior:"instant"}));
    if(page.viewport().hasTouch) await button.tap();
    else { await button.focus(); await page.keyboard.press("Enter"); }
    await button.dispose();
  }
  async function showPanel() {
    await page.waitForSelector("[data-team-panel]");
    if (page.viewport().width < 1000) {
      await activate("[data-team-open]");
      await page.waitForSelector("dialog[open] [data-team-person]");
    }
    await page.waitForSelector(person("anna"),{visible:true});
  }
  async function select(label, value) {
    const field=await page.waitForFunction(label=>[...document.querySelectorAll("[data-team-form] label")].find(node=>node.firstChild.textContent===label)?.querySelector("select"),{},label);
    await field.asElement().select(value); await field.dispose();
  }
  async function duration(value) {
    const trigger = '[data-team-form] [data-activity-duration]';
    if (await page.$(trigger)) {
      const before = fixture.mutations();
      await activate(trigger); await page.waitForSelector(durationRange, { visible: true });
      const min = await page.$eval(durationRange, node => Number(node.min));
      await page.focus(durationRange); await page.keyboard.press('Home');
      for (let i = 0; i < (value - min) * 2; i++) await page.keyboard.press('ArrowRight');
      assert.equal(await page.$eval(durationRange, node => node.valueAsNumber), value);
      await activate(`${durationDialog} [data-app-dialog-body] button`);
      await page.waitForSelector(durationDialog, { hidden: true });
      await page.waitForFunction(selector => document.activeElement?.matches(selector), {}, trigger);
      assert.equal(fixture.mutations(), before, 'Applying a duration only edits the draft');
      return;
    }
    const selector="[data-team-form] input[type=number]";
    await page.focus(selector); await page.keyboard.press("Home"); await page.keyboard.down("Shift"); await page.keyboard.press("End"); await page.keyboard.up("Shift");
    await page.keyboard.type(String(value));
  }
  const plans=()=>fixture.snapshot().state.dayPlans??[];
  async function confirm(expected) {
    const before=fixture.mutations();
    await page.waitForSelector("dialog[data-staff-confirmation][open]",{visible:true});
    await activate("[data-staff-confirm-submit]");
    await page.waitForSelector("dialog[data-staff-confirmation][open]",{hidden:true});
    assert.equal(fixture.mutations(),before+1,"One confirmed command yields one receipt");
    if(expected!==undefined) assert.equal(plans().length,expected);
  }
  const save=async count=>{await activate("[data-team-form] button[type=submit]");await confirm(count);await page.waitForSelector("[data-team-form]",{hidden:true});};
  async function add(kind,hours) {
    await activate("[data-team-add]"); await select("Activité",kind); await duration(hours);
  }
  async function checkFit(width) {
    await assertNoOverflow("Quartier équipe "+width);
    const over=await page.$$eval("[data-team-panel] :is(article,fieldset,form,dialog)", nodes=>nodes.filter(node=>node.checkVisibility()&&node.scrollWidth>node.clientWidth+2).map(node=>[node.tagName,node.scrollWidth,node.clientWidth]));
    assert.deepEqual(over,[],"The member register fits the panel");
    const small=await page.$$eval("[data-team-panel] :is(button,input,select)",nodes=>nodes.filter(node=>node.checkVisibility()&&!node.disabled&&node.getBoundingClientRect().height<43.9).map(node=>node.textContent));
    assert.deepEqual(small,[],"Team controls have a 44 px touch target");
  }
  for(const [width,requestedWorld] of [[320,"2d"],[390,"3d"],[1440,"2d"],[1440,"3d"]]) {
    fixture.reset();
    await page.setViewport({width,height:width===320?690:width===390?844:900,isMobile:width<1000,hasTouch:width<1000,deviceScaleFactor:1});
    await visit("starter",`world=${requestedWorld}&entryGate=1`);
    await page.waitForSelector('[data-placard-world="3d"]');
    if (width < 1000) {
      const meter = '[data-team-player-time] [role="meter"]';
      await page.waitForSelector(meter, { visible: true });
      assert.equal(await page.$eval(meter, node => node.getAttribute('aria-valuenow')), '11.5');
    }
    await showPanel();
    assert.match(await page.$eval(person("player"), node => node.textContent), /VillageAudit/);
    await page.waitForSelector(person("player") + ' canvas[data-avatar-state="ready"]');
    assert.deepEqual(await page.$$eval("[data-team-person]",nodes=>nodes.map(node=>node.dataset.teamPerson)),["player","anna","mael"]);
    assert.equal(await free("player"),"11,5 h libres");assert.equal(await free("anna"),"7 h libres");
    assert.match(await page.$eval("[data-team-panel] details",node=>node.textContent),/Délais autonomes.*sans mobiliser.*Lot étalon/s);
    if (width >= 1000) {
      const x = await page.$eval("[data-team-panel]",node=>node.getBoundingClientRect().left);
      assert(x>width*0.5,"Desktop panel appears to the right of the map");
    }
    await activate(person("player"));
    assert.match(await page.$eval("[data-team-task]",node=>node.textContent),/Ranger un lot.*Stockage.*0,5 h/);
    await checkFit(width);
    await screenshot(`quarter-team-from-${requestedWorld}-${width}`);
    if (requestedWorld==="3d" && width===1440) {
      const initialReads = fixture.reads();
      fixture.approachNextDay();
      await page.evaluate(() => {
        for (const name of ["kq:player-work-updated", "kq:equipment-updated", "kq:staff-updated"]) window.dispatchEvent(new Event(name));
      });
      await page.waitForFunction(() => document.querySelector("[data-team-panel] header")?.textContent.includes("jour 2"));
      assert.equal(await free("player"), "12 h libres");
      assert.equal(fixture.reads() - initialReads, 2, "One coalesced update and one read at the game-day boundary");
      assert.equal(fixture.mutations(), 0, "Calendar refresh never starts a task");
      await activate("[data-team-close]"); await page.waitForSelector("[data-team-open]");
      results.push({scenario:"desktop-3d-placement-and-rollover",width,requestedWorld,world:"3d",dayBoundaryReads:2});continue;
    }
    await add("communication",2); await save(1);
    const first=plans()[0].id;
    assert.equal(await free("player"),"9,5 h libres");
    await add("administration",1); await save(2);
    const second=plans()[1].id;
    await activate(planRow(second)+" [data-team-edit]"); await select("Ordre d’exécution",first); await save(2);
    assert.deepEqual(plans().map(plan=>plan.id),[second,first]);
    await activate(planRow(second)+" [data-team-edit]"); await select("Personne","anna"); await select("Journée","2"); await duration(3); await checkFit(width);
    await screenshot(`quarter-team-edit-${width}`); await save(2);
    assert.equal(await free("player"),"9,5 h libres");
    await page.reload({waitUntil:"networkidle0"});await showPanel();await activate(person("anna"));
    assert.match(await page.$eval(planRow(second),node=>node.textContent),/Jour 2 · 3 h/);
    await activate(planRow(second)+" [data-team-edit]");await select("Journée","1");await save(2);
    assert.equal(await free("anna"),"4 h libres");
    await activate(planRow(second)+" [data-team-remove]"); await page.waitForSelector("[data-staff-confirm-close]");await activate("[data-staff-confirm-close]");
    assert.equal(plans().length,2);
    await activate(planRow(second)+" [data-team-remove]");await confirm(1);
    assert.equal(await free("anna"),"7 h libres");
    await add("communication",1);await activate('[data-team-mode="now"]');await save(1);
    assert.equal(await free("anna"),"6 h libres");
    assert.match(await page.$eval('[data-member-id=anna] [data-team-task]',node=>node.textContent),/En cours/);
    await activate(person("player")); await activate(planRow(first)+" [data-team-start]"); await confirm(0);
    await page.waitForSelector(`[data-team-task="${first}"]`);
    assert.match(await page.$eval(`[data-team-task="${first}"]`,node=>node.textContent),/En cours/);
    assert.equal(await free("player"),"9,5 h libres");
    await add("communication",1);await activate('[data-team-mode="now"]');
    assert.equal(await page.$eval("[data-team-form] button[type=submit]",node=>node.disabled),true);
    assert.match(await page.$eval("[data-team-form] [role=status]",node=>node.textContent),/travaille|occupé|créneau/i);
    await activate('[data-team-mode="plan"]'); await activate('[data-team-form] [data-activity-duration]');
    await page.waitForSelector(durationRange); await page.focus(durationRange); await page.keyboard.press('End');
    assert.equal(await page.$eval(durationRange, node => node.valueAsNumber), 9.5, 'The selector cannot go past the available hours');
    await page.keyboard.press('Escape'); await page.waitForSelector(durationDialog, { hidden: true });
    await activate("[data-team-close]");await page.waitForSelector("[data-team-open]");
    await page.waitForFunction(()=>document.activeElement===document.querySelector("[data-team-open]"));
    await activate('button[aria-label="Ouvrir le bilan de ma partie"]');
    const quarterMeter = '[data-player-work-status] [role="meter"]';
    await page.waitForSelector(quarterMeter, { visible: true });
    assert.equal(await page.$eval(quarterMeter, node => node.getAttribute('aria-valuenow')), '9.5');
    await visit('starter', 'view=staff');
    await page.waitForSelector('[data-placard-stage="staff"]');
    assert.equal(await page.$('[data-player-work-status], [data-team-player-time], [data-activity-duration-dialog]'), null);
    await visit('starter', 'view=workshop&section=processing');
    await page.waitForSelector('[data-placard-stage="workshop"]');
    assert.equal(await page.$('[data-player-work-status], [data-team-player-time], [data-activity-duration-dialog]'), null);
    results.push({scenario:"quarter-team-lifecycle",width,requestedWorld,world:"3d",keyboard:width>=1000,touch:width<1000,mutations:fixture.mutations(),persistedAfterReload:true,scopedWorkdayMeter:true,activityDurationDialog:true});
  }
}
