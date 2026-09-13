// Deterministic balancing sample. The strategy never looks ahead at random rerolls.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
const vite=await createServer({configFile:false,envDir:false,resolve:{alias:{"@":path.resolve("src")}},server:{middlewareMode:true,watch:null}});
let game;
try {game=await vite.ssrLoadModule("/src/lib/kanab-quest-game.ts");} finally {await vite.close();}
const {KQ_CARDS,KQ_BUDDIES,canPlayKqCard,playKqCard,rollKqDice,resolveKqStage,advanceKqStage,startKqGame,previewKqResolution}=game;
const rank={failure:0,fragile:1,success:2,critical:3};
const common=KQ_CARDS.filter(c=>c.rarity==="common"&&c.category!=="pbi").map(c=>c.code);
const profiles=[
  {name:"Sans cartes, Buddie commun",rarity:"common",codes:[]},
  {name:"Deck commun, Buddie commun",rarity:"common",codes:common},
  {name:"Deck complet, Buddie commun",rarity:"common",codes:KQ_CARDS.map(c=>c.code)},
  {name:"Deck complet, Buddie légendaire",rarity:"legendary",codes:KQ_CARDS.map(c=>c.code)},
];
const value=state=>{const result=previewKqResolution(state);return rank[result.outcome]*10+result.sparks-state.pressure*.2;};
const report=[];
for(const profile of profiles){
  let quality=0,contest=0,burns=0,failures=0;
  for(let seed=0;seed<1500;seed++){
    let state=startKqGame(seed,{varietyCode:KQ_BUDDIES.find(b=>b.rarity===profile.rarity).code,deckCodes:profile.codes,collectionCodes:profile.codes,startedAt:"2026-09-13T00:00:00Z"});
    for(let step=0;step<6;step++){
      const priorities=["BOTTE-004","BOTTE-025","BOTTE-032","BOTTE-017","BOTTE-014","BOTTE-015","BOTTE-036","BOTTE-003","BOTTE-026","BOTTE-020","BOTTE-031","BOTTE-016","BOTTE-005","BOTTE-013","BOTTE-029","BOTTE-033","BOTTE-027","BOTTE-034"];
      const preparation=priorities.map(code=>KQ_CARDS.find(c=>c.code===code)).find(c=>canPlayKqCard(state,c).allowed);
      if(preparation)state=playKqCard(state,preparation.code);
      state=rollKqDice(state);
      const candidates=KQ_CARDS.filter(c=>c.timing==="after-roll"&&!["reroll-two-low","thermal-check"].includes(c.effect)&&canPlayKqCard(state,c).allowed)
        .map(card=>({card,next:playKqCard(state,card.code)})).filter(({next})=>value(next)>value(state))
        .sort((a,b)=>value(b.next)-value(a.next)||a.card.xpCost-b.card.xpCost);
      if(candidates[0])state=candidates[0].next;
      state=resolveKqStage(state);state=advanceKqStage(state);
    }
    if(state.phase!=="complete")throw new Error("Run did not finish");
    quality+=state.quality;contest+=Number(state.quality>=10);burns+=state.usedCards.length;failures+=state.history.filter(h=>h.outcome==="failure").length;
  }
  report.push({profile:profile.name,runs:1500,averageQuality:+(quality/1500).toFixed(2),contestPercent:+(100*contest/1500).toFixed(1),averageCardsUsed:+(burns/1500).toFixed(2),averageFailedStages:+(failures/1500).toFixed(2)});
}
await mkdir("output/placard-indoor-deck",{recursive:true});
await writeFile("output/placard-indoor-deck/balance.json",JSON.stringify(report,null,2));
console.table(report);
