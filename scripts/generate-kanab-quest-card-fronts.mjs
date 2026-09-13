import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createServer } from "vite";

const ROOT = process.cwd();
const ART_DIR = path.join(ROOT, "public", "app", "kanab-quest", "cards");
const OUT_DIR = path.join(ROOT, "public", "app", "kanab-quest", "card-fronts");
const WIDTH = 1024;
const HEIGHT = 1536;
GlobalFonts.registerFromPath(path.join(ROOT, "public/fonts/invoice/BarlowCondensed-Bold.ttf"), "ArenaDisplay");
GlobalFonts.registerFromPath(path.join(ROOT, "public/fonts/invoice/SpaceGrotesk-Bold.ttf"), "ArenaBody");

const categoryStyle = {
  substrate: { label: "SUBSTRAT", color: "#b98345", dark: "#66411f", icon: "SOL" },
  pbi: { label: "AUXILIAIRE PBI", color: "#65bfd0", dark: "#105c6a", icon: "PBI" },
  equipment: { label: "ÉQUIPEMENT", color: "#e98a3c", dark: "#7a3514", icon: "OUTIL" },
  "know-how": { label: "SAVOIR-FAIRE", color: "#6fbd78", dark: "#245b2d", icon: "TECH" },
  luck: { label: "COUP DE CHANCE", color: "#b98bcc", dark: "#623775", icon: "D6" },
  heritage: { label: "HÉRITAGE", color: "#e4bd51", dark: "#68470e", icon: "∞" },
};

const rarityStyle = {
  common: { label: "COMMUNE", color: "#e9e2d4" },
  uncommon: { label: "PEU COMMUNE", color: "#b9dce2" },
  rare: { label: "RARE", color: "#efd36b" },
  epic: { label: "ÉPIQUE", color: "#d1a5e5" },
};

const timingLabels = {
  passive: "PASSIF",
  "before-roll": "AVANT LE LANCER",
  "after-roll": "APRÈS LE LANCER",
  "once-per-run": "1 FOIS PAR CULTURE",
};

// Load the real catalogue and artwork map: generated fronts must match playable cards.
const vite = await createServer({ configFile: false, envDir: false, resolve: { alias: { "@": path.resolve("src") } }, server: { middlewareMode: true, watch: null } });
let supportCards, heritageCards, artworkByCode, frontByCode, cardGuide, cardRole;
try {
  const game = await vite.ssrLoadModule("/src/lib/kanab-quest-game.ts");
  const heritage = await vite.ssrLoadModule("/src/lib/kanab-quest-heritage.ts");
  const artwork = await vite.ssrLoadModule("/src/lib/kanab-quest-artwork.ts");
  const guide = await vite.ssrLoadModule("/src/lib/kanab-quest-card-guide.ts");
  supportCards = game.KQ_CARDS;
  heritageCards = heritage.KQ_HERITAGE_CARDS.map((card) => ({ ...card, category: "heritage", xpCost: 0 }));
  artworkByCode = Object.fromEntries(Object.entries(artwork.KQ_CARD_ILLUSTRATIONS).map(([code, file]) => [code, path.basename(file)]));
  frontByCode = artwork.KQ_CARD_ARTWORK;
  cardGuide = guide.getKqCardGuide;
  cardRole = guide.getKqCardRole;
} finally { await vite.close(); }

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function fillStroke(ctx, fill, stroke, width = 4) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

function fitText(ctx, text, maxWidth, startSize, minSize, weight = 900) {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px Arial`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  } while (size > minSize);
  return minSize;
}

function wrapText(ctx, text, maxWidth, maxLines) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  const consumed = lines.join(" ").split(/\s+/).length;
  if (consumed < words.length) {
    let last = lines.at(-1) ?? "";
    while (ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.trim()}…`;
  }
  return lines;
}

function drawCover(ctx, image, x, y, width, height, focalY = 0.5) {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = Math.min(image.height - sourceHeight, Math.max(0, image.height * focalY - sourceHeight / 2));
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function slugFromArtwork(file) {
  const base = path.parse(file).name;
  const versioned = base.match(/^(.*)-v(\d+)$/);
  if (!versioned) return `${base}-front`;
  return `${versioned[1]}-front-v${process.env.KQ_CARD_FRONT_VERSION?.trim() || versioned[2]}`;
}

async function renderCard(card) {
  if (card.category !== "heritage") return renderArenaSupportCard(card);
  const category = categoryStyle[card.category];
  const rarity = card.category === "heritage" ? null : rarityStyle[card.rarity];
  const artFile = artworkByCode[card.code];
  if (!category || (card.category !== "heritage" && !rarity) || !artFile) throw new Error(`Métadonnées incomplètes pour ${card.code}`);
  const art = await loadImage(path.join(ART_DIR, artFile));
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#111512";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  roundedRect(ctx, 28, 28, 968, 1480, 72);
  fillStroke(ctx, "#f3c746", "#111512", 9);
  roundedRect(ctx, 50, 50, 924, 1436, 58);
  fillStroke(ctx, category.color, "#111512", 8);
  roundedRect(ctx, 70, 70, 884, 1396, 46);
  fillStroke(ctx, "#f8f0dc", "#111512", 8);

  roundedRect(ctx, 92, 92, card.category === "heritage" ? 840 : 670, 82, 24);
  fillStroke(ctx, category.dark, "#111512", 5);
  ctx.fillStyle = "#fff8e8";
  ctx.font = "900 29px Arial";
  ctx.textBaseline = "middle";
  ctx.fillText(category.label, 124, 133);

  if (rarity) {
    roundedRect(ctx, 785, 102, 125, 62, 18);
    fillStroke(ctx, rarity.color, "#111512", 4);
    ctx.fillStyle = "#111512";
    const raritySize = fitText(ctx, rarity.label, 105, 19, 12);
    ctx.font = `900 ${raritySize}px Arial`;
    ctx.textAlign = "center";
    ctx.fillText(rarity.label, 847, 133);
    ctx.textAlign = "left";
  }

  ctx.save();
  roundedRect(ctx, 92, 194, 840, 730, 30);
  ctx.clip();
  drawCover(ctx, art, 92, 194, 840, 730, artFile.includes("-producer-") ? 0.35 : 0.5);
  ctx.restore();
  roundedRect(ctx, 92, 194, 840, 730, 30);
  ctx.strokeStyle = "#111512";
  ctx.lineWidth = 7;
  ctx.stroke();

  roundedRect(ctx, 114, 942, 126, 126, 63);
  fillStroke(ctx, category.color, "#111512", 6);
  ctx.fillStyle = "#111512";
  ctx.textAlign = "center";
  ctx.font = category.icon.length > 3 ? "900 21px Arial" : "900 38px Arial";
  ctx.fillText(category.icon, 177, 1005);
  ctx.textAlign = "left";

  ctx.fillStyle = "#111512";
  const titleSize = fitText(ctx, card.name.toUpperCase(), 650, 54, 32);
  ctx.font = `900 ${titleSize}px Arial`;
  ctx.fillText(card.name.toUpperCase(), 265, 976);
  ctx.font = "900 23px Arial";
  ctx.fillStyle = category.dark;
  ctx.fillText(`${timingLabels[card.timing] ?? card.timing.toUpperCase()} · ${card.code}`, 267, 1024);

  roundedRect(ctx, 92, 1092, 840, 250, 28);
  fillStroke(ctx, "#fffaf0", "#111512", 5);
  ctx.fillStyle = "#111512";
  ctx.font = "900 25px Arial";
  ctx.fillText(card.category === "heritage" ? "POUVOIR PERMANENT" : "EFFET DE JEU", 124, 1137);
  // Support fronts expose timing, scope and a real limitation, like the live UI.
  const guide = card.category === "heritage" ? null : cardGuide(card);
  const effectText = guide ? guide.benefit : card.description;
  let effectSize = guide ? 27 : 34;
  let lines;
  do {
    ctx.font = `700 ${effectSize}px Arial`;
    lines = wrapText(ctx, effectText, 760, 100);
    if (lines.length <= (guide ? 3 : 4)) break;
    effectSize -= 1;
  } while (effectSize >= 20);
  if (lines.length > (guide ? 3 : 4)) throw new Error(`Texte trop long : ${card.code}`);
  lines.forEach((line, index) => ctx.fillText(line, 124, 1180 + index * (guide ? 31 : 43)));
  if (guide) {
    ctx.fillStyle = category.dark;
    ctx.font = "900 20px Arial";
    ctx.fillText(guide.scope.toUpperCase(), 267, 1070);
    ctx.fillStyle = "#74432a";
    ctx.font = "700 21px Arial";
    const limits = wrapText(ctx, `LIMITE : ${guide.risk}`, 760, 100);
    if (limits.length > 2) throw new Error(`Limite trop longue : ${card.code}`);
    limits.forEach((line, index) => ctx.fillText(line, 124, 1280 + index * 26));
  }

  const costLabel = card.category === "heritage"
    ? "NE BRÛLE JAMAIS"
    : card.xpCost === 0
      ? "PASSIF · BRÛLE AU DÉPART"
      : `${card.xpCost} XP · BRÛLE À L’UTILISATION`;
  roundedRect(ctx, 92, 1360, 840, 78, 22);
  fillStroke(ctx, category.dark, "#111512", 5);
  ctx.fillStyle = "#fff8e8";
  ctx.font = "900 18px Arial";
  ctx.fillText(card.category === "heritage" ? "HÉRITAGES DE CONCOURS" : "LA BOTTE DU CHANVRIER", 122, 1399);
  ctx.textAlign = "right";
  ctx.fillText(costLabel, 902, 1399);
  ctx.textAlign = "left";

  const png = canvas.toBuffer("image/png");
  const slug = process.env.KQ_CARD_FRONT_VERSION ? slugFromArtwork(artFile) : path.basename(frontByCode[card.code], ".webp");
  const pngPath = path.join(OUT_DIR, `${slug}.png`);
  const webpPath = path.join(OUT_DIR, `${slug}.webp`);
  if (process.env.KQ_CARD_WRITE_PNG === "1") await writeFile(pngPath, png);
  await sharp(png).webp({ quality: 90, effort: 5 }).toFile(webpPath);
  return { code: card.code, pngPath, webpPath };
}

function drawRoleIcon(ctx, icon, x, y) {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = "#103b2e"; ctx.fillStyle = "#103b2e";
  ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath();
  if (icon === "shield") { ctx.moveTo(0,-23);ctx.lineTo(22,-14);ctx.lineTo(18,8);ctx.quadraticCurveTo(12,20,0,26);ctx.quadraticCurveTo(-12,20,-18,8);ctx.lineTo(-22,-14);ctx.closePath();ctx.stroke(); }
  if (icon === "check") {ctx.moveTo(-21,0);ctx.lineTo(-5,17);ctx.lineTo(23,-19);ctx.stroke();}
  if (icon === "search") {ctx.arc(-5,-5,17,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(8,8);ctx.lineTo(24,24);ctx.stroke();}
  if (icon === "star") {for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?12:25;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.stroke();}
  if (icon === "dice") {ctx.roundRect(-24,-24,48,48,5);ctx.stroke();for(const [a,b]of[[-12,-12],[12,-12],[0,0],[-12,12],[12,12]]){ctx.beginPath();ctx.arc(a,b,3.5,0,Math.PI*2);ctx.fill();}}
  if (icon === "bug") {ctx.ellipse(0,3,13,20,0,0,Math.PI*2);ctx.stroke();for(const y0 of[-12,2,16]){ctx.beginPath();ctx.moveTo(-24,y0-5);ctx.lineTo(-12,y0);ctx.moveTo(12,y0);ctx.lineTo(24,y0-5);ctx.stroke();}ctx.beginPath();ctx.moveTo(-7,-18);ctx.lineTo(-13,-26);ctx.moveTo(7,-18);ctx.lineTo(13,-26);ctx.stroke();}
  ctx.restore();
}

async function renderArenaSupportCard(card) {
  const role = cardRole(card), guide = cardGuide(card), rarity = rarityStyle[card.rarity];
  const artFile = artworkByCode[card.code];
  const art = await loadImage(path.join(ART_DIR, artFile));
  const canvas = createCanvas(WIDTH, HEIGHT), ctx = canvas.getContext("2d");
  const ink = "#103b2e", paper = "#fffaf1";
  const block = (x,y,w,h,fill,stroke=ink,line=5) => {ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);if(line){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.strokeRect(x,y,w,h);}};
  const text = (value,x,y,size,color=ink,font="ArenaBody") => {ctx.font=`700 ${size}px ${font}`;ctx.fillStyle=color;ctx.fillText(value,x,y);};
  const fitted = (value,x,y,width,size,min,color=ink,font="ArenaBody") => {while(size>min){ctx.font=`700 ${size}px ${font}`;if(ctx.measureText(value).width<=width)break;size--;}if(ctx.measureText(value).width>width)throw new Error(`Titre débordant : ${card.code} / ${value}`);text(value,x,y,size,color,font);};
  const paragraph = (value,x,y,width,size,maxLines,lineHeight,color=ink) => {
    let lines;do{ctx.font=`700 ${size}px ArenaBody`;lines=wrapText(ctx,value,width,100);if(lines.length<=maxLines)break;size--;}while(size>=24);
    if(lines.length>maxLines)throw new Error(`Texte débordant : ${card.code}`);
    lines.forEach((line,i)=>text(line,x,y+i*lineHeight,size,color));
  };
  ctx.textBaseline="middle";
  block(0,0,WIDTH,HEIGHT,ink,ink,0);
  block(22,22,980,1492,paper,role.color,12);
  block(45,45,934,1446,paper,ink,5);
  // A single role-coloured edge replaces the stacked ornamental rings.
  block(46,46,18,1444,role.color,ink,0);
  block(64,46,914,132,ink,ink,0);
  text("LA BOTTE  /  L’ARÈNE",86,74,23,"#f4c43d");
  fitted(card.name.toUpperCase(),86,126,708,57,35,paper,"ArenaDisplay");
  block(827,62,133,99,"#f4c43d",paper,3);
  ctx.textAlign="center";text(String(card.xpCost),893,99,60);text("XP",893,142,24);ctx.textAlign="left";
  // Keep the original illustration and its original crop/position exactly.
  ctx.save();roundedRect(ctx,92,194,840,730,30);ctx.clip();drawCover(ctx,art,92,194,840,730,.5);ctx.restore();
  roundedRect(ctx,92,194,840,730,30);ctx.strokeStyle=ink;ctx.lineWidth=7;ctx.stroke();
  block(64,947,914,75,role.color,ink,5);drawRoleIcon(ctx,role.icon,112,984);
  fitted(role.label.toUpperCase(),158,984,785,57,38,ink,"ArenaDisplay");
  block(64,1034,914,51,ink,ink,0);
  text(guide.timing.toUpperCase(),86,1060,32,paper,"ArenaDisplay");
  ctx.textAlign="right";text(categoryStyle[card.category].label,952,1060,25,role.color,"ArenaDisplay");ctx.textAlign="left";
  fitted(guide.scope.toUpperCase(),86,1114,867,27,22,"#315846");
  block(78,1138,12,145,role.color,ink,0);
  paragraph(guide.benefit,108,1160,828,32,4,36);
  ctx.setLineDash([7,7]);ctx.strokeStyle="#b2baa7";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(86,1311);ctx.lineTo(954,1311);ctx.stroke();ctx.setLineDash([]);
  text("À SAVOIR",86,1337,23,"#74432a");
  paragraph(guide.risk,86,1370,866,25,2,29,"#74432a");
  block(64,1433,914,57,ink,ink,0);
  const level = ["common","uncommon","rare","epic"].indexOf(card.rarity)+1;
  for(let i=0;i<4;i++){ctx.save();ctx.translate(91+i*21,1462);ctx.rotate(Math.PI/4);block(-5,-5,10,10,i<level?rarity.color:ink,rarity.color,2);ctx.restore();}
  text(rarity.label,185,1462,22,rarity.color);
  ctx.textAlign="right";text("1 USAGE · "+card.code,953,1462,23,paper);ctx.textAlign="left";
  const slug=process.env.KQ_CARD_FRONT_VERSION?slugFromArtwork(artFile):path.basename(frontByCode[card.code],".webp");
  const webpPath=path.join(OUT_DIR,`${slug}.webp`),pngPath=path.join(OUT_DIR,`${slug}.png`),png=canvas.toBuffer("image/png");
  if(process.env.KQ_CARD_WRITE_PNG==="1")await writeFile(pngPath,png);
  await sharp(png).webp({quality:90,effort:5}).toFile(webpPath);
  return {code:card.code,webpPath,pngPath};
}

await mkdir(OUT_DIR, { recursive: true });
const requestedCodes = new Set(
  (process.argv.length > 2 ? process.argv.slice(2) : (process.env.KQ_CARD_CODES ?? "").split(","))
    .map((code) => code.trim())
    .filter((code) => Boolean(code) && code !== "--support-only"),
);
const results = [];
for (const card of [...supportCards, ...(process.argv.includes("--support-only") ? [] : heritageCards)].filter((card) => requestedCodes.size === 0 || requestedCodes.has(card.code))) {
  results.push(await renderCard(card));
}
console.log(`Cartes générées : ${results.length} rectos WebP dans ${OUT_DIR}`);
