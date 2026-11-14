/** Offline delivery of the reviewed imagegen plate; no runtime generation. */
import {mkdir,copyFile,readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const original='C:/Users/sylva/.codex/generated_images/01a1cc9c-af01-71e0-a0e6-59f0eb060d0f/exec-3f09a3b0-a762-4df9-8f99-717ed473e48f.png';
const raw='output/school/artwork/botany-organs-source-v1.png',destination='public/placard/school/botany';
await mkdir('output/school/artwork',{recursive:true});await mkdir(destination,{recursive:true});
try{await stat(raw);}catch{await copyFile(original,raw);}
const {width,height}=await sharp(raw).metadata();
if(width!==1536||height!==1024)throw new Error('Unexpected reviewed plate size');
await sharp(raw).resize(1200,800).webp({quality:88}).toFile(`${destination}/organs-v1.webp`);
const panels=[['staminate',0,0],['pistillate',768,0],['stipules',0,512],['achene',768,512]];
for(const [name,left,top] of panels)await sharp(raw).extract({left,top,width:768,height:512}).webp({quality:90}).toFile(`${destination}/${name}-v1.webp`);
await writeFile('output/school/artwork/botany-art-export.json',JSON.stringify({source:original,raw,sha256:createHash('sha256').update(await readFile(raw)).digest('hex'),processing:'Lossy WebP optimization and exact quadrant crops; botanical content unchanged.',outputs:await Promise.all(['organs',...panels.map(panel=>panel[0])].map(async name=>({path:`${destination}/${name}-v1.webp`,bytes:(await stat(`${destination}/${name}-v1.webp`)).size})))},null,2));
console.log('Botany plate and four specimen crops exported');
