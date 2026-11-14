/** Bake the existing SVG cuts into one transparent texture for HTML compositing.
 * No painting is generated or altered: the original pixels and registered masks
 * remain the source. Run after changing a shape in KqPlacardMap.scene.ts.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { MAP_CLEAN_REGIONS, MAP_SCENERY, MAP_CLEAN_PLATE } from '../src/components/placard/KqPlacardMap.scene.ts';
import { KQ_PLACARD_MAP_SCENE } from '../src/components/placard/KqPlacardMap.geometry.ts';

const sceneWidth=1536, sceneHeight=1024, atlasWidth=512, padding=2;
const original=await readFile(`public${KQ_PLACARD_MAP_SCENE.image}`);
const backing=await readFile(`public${MAP_CLEAN_PLATE}`);
const items=[];
async function cut(id,kind,source,region,path){
  const mask=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${region.width}" height="${region.height}" viewBox="${region.x} ${region.y} ${region.width} ${region.height}"><path d="${path}" fill="white"/></svg>`);
  const masked=await sharp(source).ensureAlpha().composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
  const {data,info}=await sharp(masked).trim({threshold:0}).png().toBuffer({resolveWithObject:true});
  const buffer=await sharp(data).extend({top:padding,bottom:padding,left:padding,right:padding,background:'#00000000'}).png().toBuffer();
  items.push({id,kind,x:region.x-(info.trimOffsetLeft??0)-padding,y:region.y-(info.trimOffsetTop??0)-padding,
    width:info.width+padding*2,height:info.height+padding*2,buffer});
}
for(const piece of MAP_SCENERY)await cut(piece.id,'art',original,{x:0,y:0,width:sceneWidth,height:sceneHeight},piece.shape);
for(const region of MAP_CLEAN_REGIONS){
  const piece=MAP_SCENERY.find(piece=>piece.id===region.id);
  if(!piece||!('patch' in piece))throw new Error(`Missing backing mask: ${region.id}`);
  const source=await sharp(backing).extract({left:region.atlasX,top:0,width:region.width,height:region.height}).png().toBuffer();
  await cut(region.id,'back',source,region,piece.patch);
}
let x=0,y=0,rowHeight=0;
for(const item of items){
  if(x+item.width>atlasWidth){x=0;y+=rowHeight;rowHeight=0;}
  item.atlasX=x;item.atlasY=y;x+=item.width;rowHeight=Math.max(rowHeight,item.height);
}
const atlasHeight=y+rowHeight;
const data=await sharp({create:{width:atlasWidth,height:atlasHeight,channels:4,background:'#00000000'}})
  .composite(items.map(item=>({input:item.buffer,left:item.atlasX,top:item.atlasY}))).webp({lossless:true,effort:6}).toBuffer();
const hash=createHash('sha256').update(data).digest('hex').slice(0,12);
const asset=`/placard/map/living-v2/scenery-${hash}.webp`;
await mkdir('public/placard/map/living-v2',{recursive:true});
await writeFile(`public${asset}`,data);
const manifest={asset,width:atlasWidth,height:atlasHeight,bytes:data.length,items:items.map(({id,kind,x,y,width,height,atlasX,atlasY})=>({id,kind,x,y,width,height,atlasX,atlasY}))};
await writeFile('src/components/placard/KqPlacardMap.sprites.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({asset,width:atlasWidth,height:atlasHeight,bytes:data.length,pieces:items.length}));
