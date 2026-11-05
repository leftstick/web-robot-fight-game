import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';
const root='D:/codes/web-robot-fight-game';
const out=process.env.TEMP;
const chars=['player','thug_mohawk','thug_mask','thug_bald','rusher','gunner','sniper','shield','heavy','biker'];
const bosses=['boss_steam','boss_crane','boss_warden','boss_rail'];
async function sheet(name,frames,scale,rowH){
  const img=await loadImage(path.join(root,'assets',name+'.png'));
  const fw=name.startsWith('boss')?112:64;
  const w=frames.length*fw*scale;
  const c=createCanvas(w,rowH); const x=c.getContext('2d');
  x.imageSmoothingEnabled=false;
  x.fillStyle='#0b1219'; x.fillRect(0,0,w,rowH);
  x.fillStyle='#7fe9ff'; x.font='12px sans-serif';
  x.fillText(name,4,14);
  frames.forEach((f,i)=>{ x.drawImage(img,f*fw,0,fw,fw, i*fw*scale, rowH-fw*scale-2, fw*scale, fw*scale); });
  return c;
}
const c1=createCanvas(960, chars.length*210); const x1=c1.getContext('2d'); x1.fillStyle='#070b10'; x1.fillRect(0,0,960,chars.length*210);
for(let i=0;i<chars.length;i++){ const c=await sheet(chars[i],[0,6,12,17,20],3,210); x1.drawImage(c,0,i*210); }
fs.writeFileSync(path.join(out,'sprite-preview-chars.png'), c1.toBuffer('image/png'));
const c2=createCanvas(900, bosses.length*240); const x2=c2.getContext('2d'); x2.fillStyle='#070b10'; x2.fillRect(0,0,900,bosses.length*240);
for(let i=0;i<bosses.length;i++){ const c=await sheet(bosses[i],[0,4,8,12],2,240); x2.drawImage(c,0,i*240); }
fs.writeFileSync(path.join(out,'sprite-preview-boss.png'), c2.toBuffer('image/png'));
console.log(path.join(out,'sprite-preview-chars.png'), path.join(out,'sprite-preview-boss.png'));
