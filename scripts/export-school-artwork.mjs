/** Integrate generated edits only inside the two approved building regions. */
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const dir = 'output/school/artwork';
await mkdir(dir, { recursive: true });
const original = 'public/placard/map/placard-world-sylvain-v6.webp';
const edited = `${dir}/map-edited.png`;
const mask = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024"><path fill="white" d="M130 770L265 645L280 645L280 582L379 582L379 649L450 652L510 710L535 930L130 930Z"/><path fill="white" d="M746 743L908 743L916 848L749 858Z"/><path fill="white" d="M924 716L974 701Q980 700 982 708L989 757Q989 763 981 766L941 779Q932 779 930 770L923 726Q922 719 924 716Z"/></svg>');
const overlay = await sharp(edited).resize(1536,1024).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
await sharp(original).composite([{ input: overlay }]).webp({ lossless: true }).toFile('public/placard/map/placard-world-school-v7.webp');
await sharp(`${dir}/school-transparent.png`).resize(512,512,{fit:'inside'}).webp({quality:90,alphaQuality:100}).toFile('public/placard/ui/school-v1.webp');
const before=await sharp(original).ensureAlpha().raw().toBuffer();
const after=await sharp('public/placard/map/placard-world-school-v7.webp').ensureAlpha().raw().toBuffer();
const alpha=await sharp(mask).ensureAlpha().raw().toBuffer();
let outsideChanges=0;
for(let i=0;i<before.length;i+=4) if(alpha[i+3]===0 && (before[i]!==after[i]||before[i+1]!==after[i+1]||before[i+2]!==after[i+2]))outsideChanges++;
if(outsideChanges)throw new Error(`${outsideChanges} pixels changed outside the building masks`);
await writeFile(`${dir}/verification.json`,JSON.stringify({outsideChangedPixels:outsideChanges,map:'public/placard/map/placard-world-school-v7.webp',vignette:'public/placard/ui/school-v1.webp'},null,2)+'\n');
console.log('School map and vignette exported; zero changed pixels outside building masks.');
