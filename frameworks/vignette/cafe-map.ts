// CAFEMAP：咖啡厅作为入口总览（第二次来访展开四站）
// ① 灯油台（导师在给谁分油、为什么，可倒油）
// ② 导演廊（基础导演/叔衡的工作台、毛坯、草稿与年谱）
// ③ 作品架（启用现有折叠的 shelf：作品与盖印状态）
// ④ 门（选中作品后推门＝新标签页进入）
// 遵循漆书汉画风格：物件而非文字标签、一屏一焦点、每屏≤1句≤30字、前3秒≤1个可做之事、100ms内反馈。

import { PAL, TONE } from '../../components/paint/palette';
import { glow } from '../../components/paint/texture';
import { flame } from '../../components/paint/light';
import { lowTable, mat } from '../../components/paint/props-room';
import { type C2D, clamp, easeOut, rgba } from '../../components/paint/util';
import type { Hypothesis } from '../../engine/mind/hypotheses';

export interface WorkItem {
  id?: string;
  form?: string;
  director?: string;
  title: string;
  sealed?: boolean;
  why?: string;
  url?: string;
}

export interface CafeMapState {
  t: number;
  stage: 'oil' | 'directors' | 'shelf' | 'door';
  oilPoured: boolean;
  draftDismissed: boolean;
  selectedWork: WorkItem | null;
  works: WorkItem[] | null;
  pourProgress: number; // 0..1
  inspectingDirectors: boolean;
  doorOpen: number; // 0..1
}

/** 读取 runs/index.json 数据；不存在时返回 null，不编造数据 */
export async function loadWorksIndex(actWorks?: WorkItem[] | null): Promise<WorkItem[] | null> {
  if (actWorks !== undefined) return actWorks;
  if (typeof window !== 'undefined' && (window as any).__runsIndex !== undefined) {
    const data = (window as any).__runsIndex;
    return Array.isArray(data) ? data : data?.works ?? null;
  }
  return null;
}


// All measurements below describe physical surfaces, never panel outlines.
function polygon(c: C2D, points: number[][], color: string) {
  c.fillStyle = color; c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x!, y!) : c.moveTo(x!, y!));
  c.closePath(); c.fill();
}

/** Frayed silk, rolled lower hem, woven fibres. No card border. */
function silk(c: C2D, x: number, y: number, w: number, h: number, ink = 0, edited = false) {
  c.save(); c.translate(x, y);
  polygon(c, [[2,2],[w+2,1],[w+3,h+3],[1,h+4]], 'rgba(0,0,0,.4)');
  polygon(c, [[0,1],[w*.32,0],[w*.7,1],[w,0],[w-1,h-3],[w*.7,h],[1,h-1]], '#b5a07a');
  c.strokeStyle = 'rgba(65,42,22,.18)'; c.lineWidth = .6;
  for (let yy=3; yy<h-2; yy+=3) { c.beginPath(); c.moveTo(1,yy); c.lineTo(w-1,yy+.6); c.stroke(); }
  c.fillStyle = '#d1bb8b'; c.fillRect(0,h-3,w,2);
  c.strokeStyle = rgba('#25190f', ink); c.lineWidth = Math.max(.8,w*.065);
  for(let yy=6; yy<h-6; yy+=7) { c.beginPath(); c.moveTo(w*.24,yy); c.lineTo(w*.67,yy+1); c.moveTo(w*.43,yy-2); c.lineTo(w*.43,yy+3); c.stroke(); }
  if(edited) {
    c.strokeStyle = '#d4bc8e'; c.lineWidth = 1.2;
    for(let i=0;i<4;i++){c.beginPath();c.moveTo(w*.12, h*.42+i*2);c.lineTo(w*.87,h*.35+i*2);c.stroke();}
    c.strokeStyle = rgba(PAL.cinnabar,.65); c.lineWidth=.8;
    c.beginPath();c.moveTo(w*.1,h*.5);c.lineTo(w*.9,h*.43);c.stroke();
  }
  c.restore();
}

function stamp(c: C2D, x: number, y: number, s: number) {
  c.save();c.translate(x,y);c.rotate(-.09);
  polygon(c, [[0,1],[s*.94,0],[s,s*.93],[1,s]], rgba(PAL.cinnabar,.9));
  c.strokeStyle='#c7a16b'; c.lineWidth=Math.max(.5,s*.09);
  c.beginPath();c.moveTo(s*.25,s*.2);c.lineTo(s*.25,s*.76);c.lineTo(s*.72,s*.76);
  c.moveTo(s*.5,s*.18);c.lineTo(s*.5,s*.58);c.lineTo(s*.8,s*.58);c.stroke();c.restore();
}

function beam(c: C2D, x: number, y: number, w: number, h: number, lit: number) {
  c.fillStyle='#302016';c.fillRect(x,y,w,h);
  polygon(c,[[x,y],[x+5,y-4],[x+w+5,y-4],[x+w,y]],'#5b3c26');
  polygon(c,[[x+w,y],[x+w+5,y-4],[x+w+5,y+h-4],[x+w,y+h]],'#1d140e');
  c.strokeStyle=rgba('#b78d50',.2+.24*lit);c.lineWidth=.7;
  c.beginPath();c.moveTo(x+1,y+1);c.lineTo(x+w-1,y+1);c.stroke();
  c.strokeStyle='rgba(13,8,4,.3)';
  c.beginPath();c.moveTo(x+2,y+h*.5);c.bezierCurveTo(x+w*.2,y+h*.1,x+w*.6,y+h*.8,x+w-1,y+h*.5);c.stroke();
}

export function drawOilStation(c: C2D,x: number,y: number,s: number,t: number,
  opts: { poured: boolean; pourProgress: number; budgetLamp: number; lampX: number; active: boolean; hypotheses?: Hypothesis[] }) {
  c.save(); const lit=opts.active?1:.48;
  glow(c,x,y-s*.24,s*.85,PAL.millet,opts.active?.23:.045);
  mat(c,x,y+4,s*1.15,s*.14,{lit:.45});
  const table=lowTable(c,x,y,s*1.12,{height:.25,lit});
  const top=table.top;
  // Three bronze oil cups: equal stems; allocation changes only the flame.
  const shares=[opts.poured?1.6:opts.budgetLamp,.8,.5];
  for(let i=0;i<3;i++){
    const lx=x+s*(-.19+i*.17)+(i===0?(opts.lampX-.29)*s*.15:0), ly=top-s*.09;
    c.fillStyle='#475342';c.beginPath();c.ellipse(lx,top-1,s*.062,s*.017,0,0,Math.PI*2);c.fill();
    c.fillRect(lx-s*.012,ly,s*.024,s*.09);
    c.fillStyle=PAL.bronze;c.beginPath();c.ellipse(lx,ly,s*.065,s*.024,0,0,Math.PI);c.fill();
    c.strokeStyle='#9b8c51';c.lineWidth=1.2;c.beginPath();c.ellipse(lx,ly,s*.067,s*.016,0,0,Math.PI*2);c.stroke();
    const fh=s*(.055+.09*clamp(shares[i]!/1.6));
    glow(c,lx,ly-fh*.5,s*.19,PAL.millet,.2*lit);
    flame(c,lx,ly-2,fh,t+i,.75+.25*lit,{seed:10+i,halo:false});
  }
  // Hypotheses stand in the left corner, confidence sets length and ink density.
  const rackX=x-s*.48, rackY=top-s*.035;
  beam(c,rackX,rackY-s*.31,s*.035,s*.34,lit);beam(c,rackX+s*.26,rackY-s*.31,s*.035,s*.34,lit);
  beam(c,rackX-s*.02,rackY-s*.27,s*.34,s*.025,lit);
  (opts.hypotheses??[]).slice(0,5).forEach((h,i)=>{
    const hh=s*(.19+.13*clamp(h.confidence));
    silk(c,rackX+s*(.035+i*.057),rackY-s*.27,s*.048,hh,.25+.65*h.confidence,h.status==='edited'||!!h.originalText);
  });
  // Earthenware pot lifts and tips toward the nearest cup, then settles back.
  const k=Math.sin(clamp(opts.pourProgress)*Math.PI);
  c.save();c.translate(x+s*.42-k*s*.12,top-s*.09-k*s*.15);c.rotate(-k*.68);
  const clay=c.createLinearGradient(-s*.09,0,s*.09,0);clay.addColorStop(0,'#301c13');clay.addColorStop(.4,'#85502c');clay.addColorStop(1,'#42271a');
  c.fillStyle=clay;c.beginPath();c.ellipse(0,0,s*.085,s*.105,0,0,Math.PI*2);c.fill();
  polygon(c,[[-s*.055,-s*.05],[-s*.17,-s*.085],[-s*.13,-s*.02],[-s*.06,s*.01]],'#724329');
  c.strokeStyle='#92663e';c.lineWidth=s*.018;c.beginPath();c.arc(0,-s*.08,s*.065,Math.PI*.85,Math.PI*2.15);c.stroke();
  if(k>.15){c.strokeStyle=rgba(TONE.goldLight,k*.9);c.lineWidth=1.7;c.beginPath();c.moveTo(-s*.16,-s*.06);c.quadraticCurveTo(-s*.23,s*.02,-s*.25,s*.19);c.stroke();}
  c.restore();c.restore();
}

/** Form-specific unfinished miniature, with its pen and unpressed seal. */
function maquette(c: C2D,x: number,y: number,s: number,form: string) {
  c.save();c.translate(x,y);c.strokeStyle='#b4a07a';c.lineWidth=1;
  if(form==='film'||form==='animation') {
    polygon(c,[[-s*.45,-s*.05],[s*.4,-s*.12],[s*.45,s*.08],[-s*.4,s*.16]],'#927950');
    for(let i=0;i<4;i++){const xx=-s*.35+i*s*.19;polygon(c,[[xx,-s*.01],[xx+s*.13,-s*.02],[xx+s*.14,s*.08],[xx,s*.09]],'#32281d');
      c.fillStyle='#d0bb8b';c.fillRect(xx,-s*.05,2,2);c.fillRect(xx,s*.12,2,2);}
  } else if(form==='gallery') {
    for(let i=2;i>=0;i--){c.save();c.translate(-s*.31+i*3,-s*.13-i*2);c.rotate(-.08+i*.08);silk(c,0,0,s*.56,s*.27,.35);c.restore();}
  } else if(form==='3d'||form==='spatial'||form==='studio') {
    const a=s*.22;const pts=[[-a,0],[0,a*.5],[a,0],[a,-a],[0,-a*1.5],[-a,-a]];
    c.beginPath();pts.forEach(([xx,yy],i)=>i?c.lineTo(xx!,yy!):c.moveTo(xx!,yy!));c.closePath();c.moveTo(0,a*.5);c.lineTo(0,-a*.5);c.lineTo(-a,-a);c.moveTo(0,-a*.5);c.lineTo(a,-a);c.stroke();
    c.strokeStyle='rgba(180,160,122,.45)';for(let i=1;i<3;i++){c.beginPath();c.moveTo(-a,-a+i*a/3);c.lineTo(0,-a*.5+i*a/3);c.lineTo(a,-a+i*a/3);c.stroke();}
  } else {
    polygon(c,[[-s*.4,0],[s*.18,-s*.13],[s*.43,s*.13],[-s*.2,s*.29]],'#8b7046');
    c.strokeStyle='#46331e';for(let i=1;i<5;i++){const u=i/5;c.beginPath();c.moveTo(-s*.4+s*.58*u,-s*.13*u);c.lineTo(-s*.2+s*.63*u,s*.29-s*.16*u);c.moveTo(-s*.4+s*.2*u,s*.29*u);c.lineTo(s*.18+s*.25*u,-s*.13+s*.26*u);c.stroke();}
    for(const [xx,yy] of [[-.16,.05],[.08,.08],[.04,-.01]]){c.fillStyle=xx!<0?'#201b14':'#bba77c';c.beginPath();c.ellipse(xx!*s,yy!*s,s*.033,s*.022,0,0,Math.PI*2);c.fill();}
  }
  stamp(c,s*.42,s*.03,s*.12);
  c.strokeStyle='#8e6740';c.lineWidth=2;c.beginPath();c.moveTo(-s*.42,s*.24);c.lineTo(s*.1,s*.31);c.stroke();
  polygon(c,[[s*.1,s*.29],[s*.19,s*.33],[s*.08,s*.34]],'#18120c');c.restore();
}

export function drawDirectorStation(c: C2D,x: number,y: number,s: number,t: number,
  opts: { dismissed: boolean; inspecting: boolean; active: boolean; forms?: string[] }) {
  c.save();const lit=opts.active?1:.43;
  glow(c,x,y-s*.3,s*.9,PAL.millet,opts.active?.2:.025);
  mat(c,x,y+s*.025,s*1.28,s*.13,{lit:.55*lit});
  // One pinned, crooked old sheet: ghost sketch, red revision, folded corner.
  c.save();c.translate(x-s*.07,y-s*.66);c.rotate(-.075);
  polygon(c,[[-s*.4,3],[s*.39,-2],[s*.42,s*.3],[-s*.37,s*.34]],'rgba(0,0,0,.45)');
  polygon(c,[[-s*.42,0],[s*.38,-4],[s*.4,s*.25],[s*.32,s*.33],[-s*.4,s*.31]],'#88704b');
  c.strokeStyle='rgba(54,34,17,.22)';c.lineWidth=.7;
  for(let i=0;i<16;i++){c.beginPath();c.moveTo(-s*.4,3+i*s*.019);c.lineTo(s*.37,1+i*s*.019);c.stroke();}
  c.strokeStyle='rgba(38,30,20,.6)';c.lineWidth=1;c.beginPath();c.moveTo(-s*.31,s*.22);c.lineTo(-s*.3,s*.09);c.lineTo(-s*.2,s*.07);c.lineTo(-s*.18,s*.23);c.moveTo(-s*.16,s*.16);c.lineTo(s*.23,s*.16);c.moveTo(-s*.03,s*.08);c.lineTo(-s*.03,s*.24);c.stroke();
  c.strokeStyle=rgba(PAL.cinnabar,.85);c.lineWidth=1.7;c.beginPath();c.moveTo(-s*.31,s*.25);c.bezierCurveTo(-s*.13,s*.21,s*.03,s*.05,s*.29,s*.1);c.lineTo(s*.24,s*.065);c.stroke();
  polygon(c,[[s*.32,s*.33],[s*.32,s*.25],[s*.4,s*.25]],'#c2a775');
  for(const xx of [-s*.36,s*.31]){c.fillStyle='#20170d';c.beginPath();c.arc(xx,s*.024,2,0,Math.PI*2);c.fill();c.fillStyle='#baa173';c.fillRect(xx-1,s*.024-1,1,1);}
  c.restore();
  for(let i=0;i<2;i++){
    const tx=x+(i?1:-1)*s*.32;
    const table=lowTable(c,tx,y,s*.59,{height:.35,lit:.6+.3*lit});
    if(!opts.dismissed||i===0)maquette(c,tx,table.top-s*.035,s*.51,opts.forms?.[i]??(i?'game':'film'));
  }
  c.restore();
}

export function drawShelfStation(c: C2D,x: number,y: number,w: number,h: number,t: number,
  opts: { works: WorkItem[] | null; selectedIndex: number; active: boolean }) {
  c.save();const lit=opts.active?1:.4;
  glow(c,x+w*.5,y+h*.5,h*.8,PAL.millet,opts.active?.2:.025);
  // Open-backed wooden stand; side rails recede, feet rest on the floor.
  const b=Math.max(5,w*.046), d=w*.12;
  for(const xx of [x+d,x+w-d])beam(c,xx,y-5,b,h,lit*.7);
  for(const xx of [x,x+w-b])beam(c,xx,y,b,h+b,lit);
  const items=opts.works??[], rows=Math.max(3,Math.ceil(items.length/8));
  const cols=Math.max(2,Math.ceil(items.length/rows));const rh=(h-b)/rows;
  for(let r=0;r<rows;r++){
    const yy=y+(r+1)*rh;
    polygon(c,[[x,yy],[x+d,yy-d*.5],[x+w,yy-d*.5],[x+w-b,yy]],'#59402a');
    beam(c,x,yy,w,b,lit);
  }
  if(!items.length){
    for(let i=0;i<3;i++){c.save();c.translate(x+w*(.17+i*.21),y+h*(i===2?.66:.3));c.rotate(-.15+i*.12);silk(c,0,0,w*.105,h*.18);c.restore();}
    c.fillStyle='rgba(202,180,130,.26)';for(let i=0;i<39;i++){const xx=x+b+((i*37)%97)/97*(w-b*2),yy=y+((i%3)+1)*rh-1;c.fillRect(xx,yy,.9,.6);}
  } else items.forEach((item,i)=>{
    const r=Math.floor(i/cols),col=i%cols,cw=(w-b*3)/cols;
    const sw=Math.min(cw*.67,w*.14),sh=rh*.72;
    const xx=x+b*1.6+col*cw+(cw-sw)*.5,yy=y+(r+1)*rh-sh;
    if(i===opts.selectedIndex&&opts.active)glow(c,xx+sw*.5,yy+sh*.5,rh*.9,PAL.millet,.28);
    c.save();c.translate(xx,yy);c.rotate((i%3-1)*.035);silk(c,0,0,sw,sh,.42);
    if(item.sealed)stamp(c,sw*.45,sh*.71,Math.max(3,Math.min(sw*.68,sh*.23)));
    else {c.strokeStyle='#8b7550';c.lineWidth=.9;c.beginPath();c.moveTo(-1,sh*.23);c.lineTo(sw+1,sh*.26);c.moveTo(sw*.45,sh*.23);c.bezierCurveTo(sw*.1,sh*.07,sw*.1,sh*.37,sw*.5,sh*.25);c.bezierCurveTo(sw*.9,sh*.1,sw*.9,sh*.4,sw*.5,sh*.25);c.lineTo(sw*.65,sh*.51);c.stroke();}
    c.restore();
  });
  c.restore();
}

// ============================================================
// ④ 门绘制（地标门、推门微光）
// ============================================================

export function drawDoorStation(
  ctx: C2D,
  x: number,
  y: number,
  w: number,
  h: number,
  t: number,
  opts: { open: number; active: boolean; hasUrl: boolean }
) {
  ctx.save();
  const open = opts.open;
  const lit = opts.active ? 1 : 0.7;

  // 门洞内光芒
  if (open > 0) {
    const glowGrad = ctx.createRadialGradient(x, y - h * 0.5, 0, x, y - h * 0.5, w * 1.4);
    glowGrad.addColorStop(0, rgba(TONE.goldLight, 0.65 * open));
    glowGrad.addColorStop(0.5, rgba(PAL.gold, 0.3 * open));
    glowGrad.addColorStop(1, rgba(PAL.gold, 0));
    ctx.fillStyle = glowGrad;
    ctx.fillRect(x - w * 1.5, y - h * 1.2, w * 3, h * 1.5);
  }

  // 门框
  ctx.fillStyle = '#18100b';
  ctx.strokeStyle = rgba(PAL.gold, 0.6 * lit);
  ctx.lineWidth = Math.max(1.5, w * 0.03);
  ctx.fillRect(x - w * 0.55, y - h, w * 1.1, h);
  ctx.strokeRect(x - w * 0.55, y - h, w * 1.1, h);

  // 门扉（左右两扇，开启时向内旋）
  const doorW = w * 0.5;
  const swing = easeOut(clamp(open));

  // 左扉
  ctx.save();
  ctx.translate(x - w * 0.5, y);
  ctx.scale(1 - swing * 0.7, 1);
  ctx.fillStyle = '#2c1a11';
  ctx.fillRect(0, -h, doorW, h);
  ctx.strokeRect(0, -h, doorW, h);
  ctx.restore();

  // 右扉
  ctx.save();
  ctx.translate(x + w * 0.5, y);
  ctx.scale(1 - swing * 0.7, 1);
  ctx.fillStyle = '#2c1a11';
  ctx.fillRect(-doorW, -h, doorW, h);
  ctx.strokeRect(-doorW, -h, doorW, h);
  ctx.restore();

  glow(ctx, x, y - h * 0.5, w * 1.2, PAL.millet, (0.15 + open * 0.45) * lit);
  ctx.restore();
}
