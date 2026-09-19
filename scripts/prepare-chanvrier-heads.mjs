import sharp from 'sharp';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
// Keep the common master frame: trimming would detach the hair from the face again.
const source=resolve('output/imagegen/sylvain-avatar-v4/source');
const target=resolve('public/contest/avatars/sylvain-v4');
await mkdir(target,{recursive:true});
const manifest={};
for(const file of (await readdir(source)).filter(name=>name.endsWith('.png'))){
  const input=await readFile(resolve(source,file));
  const info=await sharp(input).metadata();
  if(info.width!==info.height||!info.hasAlpha)throw new Error('Expected a square RGBA master: '+file);
  const name=file.replace('.png','.webp');
  await sharp(input).resize(768,768,{fit:'contain'}).webp({lossless:true}).toFile(resolve(target,name));
  manifest[name]={source:file,originalWidth:info.width,originalHeight:info.height,width:768,height:768};
}
await writeFile(resolve(source,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Prepared '+Object.keys(manifest).length+' complete heads and expression editions, with a shared frame.');
