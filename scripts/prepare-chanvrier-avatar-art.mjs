// Package image-generator sprite sheets for the avatar renderer; no drawing or replacement art.
import sharp from 'sharp';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const source=resolve('output/imagegen/sylvain-avatar-v3/source');
const target=resolve('public/contest/avatars/sylvain-v3');
await mkdir(target,{recursive:true});
const manifest={};
// The generated sheets have slightly uneven gutters; preserve whole silhouettes.
const horizontalBounds={};
const regions={
 'hair-crop':[50,95,355,320], 'hair-quiff':[380,40,680,315],
 'hair-bob':[725,110,1050,380], 'hair-long':[1060,85,1448,404],
 'hair-curls':[50,435,357,682], 'hair-afro':[367,390,724,700],
 'hair-braids':[728,460,1085,775], 'hair-bun':[1100,411,1405,715],
 'hair-ponytail':[20,790,398,1040], 'hair-mohawk':[440,742,705,974],
 'hair-buzz':[787,802,1066,990],
 'shoes-boots':[20,650,402,875], 'shoes-sneakers':[405,695,768,875],
 'shoes-high-tops':[769,650,1144,875], 'shoes-work':[1146,695,1520,875],
};
async function sheet(name,cols,rows,keys,bounds){
 const input=await readFile(resolve(source,name+'.png'));
 const meta=await sharp(input).metadata();
 const full=await sharp(input).ensureAlpha().raw().toBuffer();
 for(let i=0;i<keys.length;i++){
  if(!keys[i])continue;
  const col=i%cols,row=Math.floor(i/cols);
  let [x0,x1]=horizontalBounds[keys[i]]??[Math.round(col*meta.width/cols),Math.round((col+1)*meta.width/cols)];
  let y0=bounds?.[row]??Math.round(row*meta.height/rows),y1=bounds?.[row+1]??Math.round((row+1)*meta.height/rows);
  if(regions[keys[i]])[x0,y0,x1,y1]=regions[keys[i]];
  let left=x1,top=y1,right=x0,bottom=y0;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(full[(y*meta.width+x)*4+3]>100){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(right<=left||bottom<=top)throw new Error('Empty generated sprite: '+keys[i]);
  const rect={left,top,width:right-left+1,height:bottom-top+1};
  await sharp(input).extract(rect).webp({lossless:true}).toFile(resolve(target,keys[i]+'.webp'));
  manifest[keys[i]]={sheet:name,...rect};
 }
}
await sheet('heads',3,2,['head-oval','head-round','head-square','head-heart','head-long','head-angular']);
await sheet('tops',3,2,['top-overalls','top-tee','top-hoodie','top-jacket','top-shirt','top-apron']);
await sheet('lower',4,2,['bottom-jeans','bottom-cargo','bottom-shorts','bottom-skirt','shoes-boots','shoes-sneakers','shoes-high-tops','shoes-work'],[0,615,1024]);
await sheet('hair',4,3,['hair-crop','hair-quiff','hair-bob','hair-long','hair-curls','hair-afro','hair-braids','hair-bun','hair-ponytail','hair-mohawk','hair-buzz',null],[0,403,775,1086]);
await sheet('features',4,4,['eyes-almond','eyes-round','eyes-relaxed','eyes-bright','eyebrows-natural','eyebrows-thick','eyebrows-arched','nose-small','nose-round','nose-wide','mouth-smile','mouth-grin','mouth-calm','facialHair-stubble','facialHair-beard','facialHair-moustache']);
await sheet('accessories',2,2,['accessory-glasses','accessory-round-glasses','accessory-earrings','accessory-scarf']);
await writeFile(resolve(source,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Prepared ${Object.keys(manifest).length} generated sprites in ${target}`);
