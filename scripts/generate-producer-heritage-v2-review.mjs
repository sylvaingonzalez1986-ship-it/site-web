import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Regenerate after changing the manifest; rendering card fronts is independent.
// Usage: node scripts/generate-producer-heritage-v2-review.mjs
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reviewDir = path.join(root, "output/heritage-producers");
const outputPath = path.join(reviewDir, "v2-review.html");
const manifest = JSON.parse(await readFile(path.join(root, "src/data/producer-heritage-cards.json"), "utf8"));
const references = {
  "HERITAGE-013": "HERITAGE-013.jpg",
  "HERITAGE-014": "HERITAGE-014.png",
  "HERITAGE-015": "HERITAGE-015.jpg",
  "HERITAGE-016": "HERITAGE-016.jpg",
  "HERITAGE-017": "HERITAGE-017.png",
  "HERITAGE-018": "HERITAGE-018.jpg",
  "HERITAGE-019": "HERITAGE-019.png",
};
const cards = Object.keys(references).map((code) => {
  const matches = manifest.cards.filter((card) => card.code === code);
  if (matches.length !== 1) throw new Error(`Une seule carte ${code} est requise dans le manifeste.`);
  const card = matches[0];
  if (!/^\/app\/kanab-quest\/card-fronts\/[a-z0-9-]+-v2\.webp$/.test(card.frontUrl)) {
    throw new Error(`${code} : recto v2 local attendu.`);
  }
  return card;
});
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);
const frontPath = (card) => path.relative(reviewDir, path.join(root, "public", card.frontUrl.slice(1))).split(path.sep).join("/");
const imagePanel = ({ title, url, alt, isFront }) => `<figure>
  <figcaption>${title}</figcaption>
  <a class="image-panel ${isFront ? "front" : "source"}" href="${escapeHtml(url)}" target="_blank" rel="noopener" aria-label="${escapeHtml(alt)} — ouvrir l’image complète">
    <img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" decoding="async" ${isFront ? 'width="1024" height="1536"' : ""} onerror="this.hidden=true;this.nextElementSibling.hidden=false">
    <span class="pending" hidden>${isFront ? "Recto v2 en attente de rendu. Recharge la page après sa création." : "Source officielle indisponible."}</span>
  </a>
  <a class="image-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">${isFront ? "Ouvrir le recto complet" : "Ouvrir la source"}<span aria-hidden="true"> ↗</span></a>
</figure>`;
const navigation = cards.map((card) => `<a href="#${card.code.toLowerCase()}">${escapeHtml(card.producerName)}</a>`).join("\n");
const articles = cards.map((card) => `<article id="${card.code.toLowerCase()}">
  <header class="card-heading"><p class="eyebrow">${card.code} · Version 2</p><h2>${escapeHtml(card.producerName)}</h2><p class="card-name">${escapeHtml(card.name)}</p></header>
  <div class="comparison">
    ${imagePanel({ title: "Source officielle", url: "references/" + references[card.code], alt: "Source officielle de " + card.producerName, isFront: false })}
    ${imagePanel({ title: "Carte Héritage v2", url: frontPath(card), alt: "Recto complet de la carte Héritage de " + card.producerName, isFront: true })}
  </div>
  <div class="ability"><p class="eyebrow">Capacité</p><p class="description">${escapeHtml(card.description)}</p><p class="timing">${escapeHtml(card.activationLabel)} · ${card.timing === "passive" ? "Passif" : "Une fois par culture"}</p><p class="drawback">${escapeHtml(card.drawback)}</p></div>
</article>`).join("\n");
const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Héritages v2 — Sources officielles et cartes</title>
  <style>
    @font-face{font-family:HeritageDisplay;src:url('../../public/fonts/invoice/BarlowCondensed-Bold.ttf') format('truetype');font-display:swap}
    @font-face{font-family:HeritageBody;src:url('../../public/fonts/invoice/SpaceGrotesk-Regular.ttf') format('truetype');font-display:swap}
    :root{color-scheme:light;--ink:#233628;--paper:#fff8e8;--gold:#e4bd51;--line:#d9cda8}
    *{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:20px}body{margin:0;background:var(--paper);color:var(--ink);font-family:HeritageBody,Arial,sans-serif;line-height:1.5}a{color:inherit}a:focus-visible{outline:3px solid #9b6900;outline-offset:4px}main{max-width:1460px;margin:auto;padding:40px 24px 64px}.page-heading{max-width:920px;margin-bottom:24px}.eyebrow{margin:0;color:#78621e;font-size:12px;font-weight:bold;letter-spacing:.09em;text-transform:uppercase}h1,h2{font-family:HeritageDisplay,'Arial Narrow',Arial,sans-serif;line-height:1.05;overflow-wrap:anywhere}h1{font-size:clamp(38px,5vw,64px);margin:12px 0 16px}h2{font-size:34px;margin:8px 0}.intro{font-size:17px;margin:0}.navigation{display:flex;flex-wrap:wrap;gap:8px;margin:24px 0 32px}.navigation a{display:inline-flex;align-items:center;min-height:44px;padding:8px 14px;border:1px solid var(--line);border-radius:999px;background:#fffdf7;text-decoration:none;font-size:13px}.navigation a:hover{background:#f0ddb0}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}article{min-width:0;overflow:hidden;border:1px solid var(--line);border-radius:18px;background:#fffdf6;padding:22px;box-shadow:0 5px 18px #23362809}.card-heading{padding-bottom:18px}.card-name{margin:0;font-size:16px}.comparison{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}figure{min-width:0;margin:0}figcaption{min-height:36px;font-size:12px;font-weight:bold;letter-spacing:.045em;text-transform:uppercase}.image-panel{display:flex;align-items:center;justify-content:center;width:100%;aspect-ratio:2/3;overflow:hidden;border:1px solid var(--line);border-radius:10px;background:#fff;text-decoration:none}.source{padding:12px;background:repeating-conic-gradient(#f1f0e9 0% 25%,#fff 0% 50%) 50% / 20px 20px}.image-panel img{display:block;width:100%;height:100%;object-fit:contain}.image-panel img[hidden],.pending[hidden]{display:none}.pending{padding:16px;text-align:center;font-size:14px;color:#626b5c}.image-link{display:inline-flex;align-items:center;min-height:44px;font-size:12px;text-underline-offset:3px;overflow-wrap:anywhere}.ability{margin-top:18px;padding:18px;border-radius:12px;background:#f5ebcf}.description{margin:8px 0 12px;font-size:17px;font-weight:bold}.timing{margin:0;font-size:12px;font-weight:bold}.drawback{margin:12px 0 0;padding-top:12px;border-top:1px solid #d7c895;color:#53604d;font-size:14px}.footer{margin:28px 0 0;font-size:13px;color:#62705c}
    @media(max-width:850px){.grid{grid-template-columns:minmax(0,1fr)}main{max-width:680px;padding:28px 16px 44px}}
    @media(max-width:430px){article{padding:14px}.comparison{gap:10px}.source{padding:6px}figcaption{font-size:10px;min-height:34px}h2{font-size:30px}.ability{padding:14px}.description{font-size:16px}.pending{padding:10px;font-size:12px}.image-link{font-size:11px}.navigation{gap:6px}.navigation a{padding:7px 11px;font-size:12px}}
    @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
  </style>
</head>
<body><main>
  <header class="page-heading"><p class="eyebrow">Carnet de dégustation · Revue des sept nouveaux Héritages</p><h1>Une identité, sa carte.</h1><p class="intro">Les logos et photos officiels sont présentés à côté des rectos complets. Ouvre chaque image pour vérifier les détails ; les capacités restent lisibles ci-dessous.</p></header>
  <nav class="navigation" aria-label="Aller à un producteur">${navigation}</nav>
  <section class="grid" aria-label="Comparaison des sources et des cartes Héritage">${articles}</section>
  <p class="footer">Les images sont liées aux fichiers locaux. Après le rendu des rectos v2, recharge cette page pour voir la comparaison complète.</p>
</main></body>
</html>
`;
await mkdir(reviewDir, { recursive: true });
await writeFile(outputPath, html, "utf8");
console.log(`${cards.length} comparaisons écrites : ${outputPath}`);
