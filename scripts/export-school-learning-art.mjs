/** Offline imagegen assets: optimize static plates, and bake registered animation layers. */
import { mkdir, readFile, writeFile, copyFile, stat } from 'node:fs/promises';
import sharp from 'sharp';

const sources={"plant":"exec-d0201dc6-b555-46b3-8f2f-285abe23ea8c.png","molecules":"exec-5ec72ccb-230f-4d8b-83be-cd6526290302.png","profiles":"exec-c1c24b41-f998-4556-8921-ee0bd2cca588.png","genetics":"exec-97cc25fc-235a-4502-85e3-44c523a58ab0.png","history":"exec-3c99525f-433f-45c7-b101-fbdec7c834b1.png","uses":"exec-072691f0-a066-4f16-83dd-b493abc5356d.png","evidence":"exec-7933d178-7cc9-4b1f-ae00-824a364c09b0.png","biodiversity":"exec-bc074449-a273-4785-91ae-605beaea934b.png","law":"exec-848bd134-9dea-4157-8c9c-65785b9e7c09.png","prevention":"exec-5ace0f87-90fd-4477-8441-04d73ac6144b.png"};
const generated='C:/Users/sylva/.codex/generated_images/01a1cc9c-af01-71e0-a0e6-59f0eb060d0f';
const raw='output/school/artwork', dest='public/placard/school';
await mkdir(raw,{recursive:true});await mkdir(dest,{recursive:true});
const report=[];
for(const [id,file] of Object.entries(sources)){
  const input=`${raw}/${id}-source.png`;
  try { await stat(input); } catch { await copyFile(`${generated}/${file}`,input); }
  const image=`${dest}/course-${id}-v1.webp`,thumb=`${dest}/course-${id}-thumb-v1.webp`;
  await sharp(input).resize(1200,800,{fit:'fill'}).webp({quality:86}).toFile(image);
  await sharp(input).resize(480,320,{fit:'fill'}).webp({quality:82}).toFile(thumb);
  report.push({id,image,bytes:(await stat(image)).size,thumbnailBytes:(await stat(thumb)).size});
}
await import('./export-school-interior-art.mjs');
const {sprites}=JSON.parse(await readFile('src/components/placard/KqSchoolInterior.sprites.json','utf8'));
await writeFile(`${raw}/learning-art-verification.json`,JSON.stringify({plates:report,totalBytes:report.reduce((sum,item)=>sum+item.bytes+item.thumbnailBytes,0),sprites},null,2)+'\n');
console.log(JSON.stringify({plates:report.length,bytes:report.reduce((sum,item)=>sum+item.bytes+item.thumbnailBytes,0),sprites:sprites.length}));
