/** Original scene props. Every position is in the desk's local, responsive paint space. */
import { PAL, TONE } from '../../../components/paint/palette';
import { flame } from '../../../components/paint/light';
import { glow, grain } from '../../../components/paint/texture';
import { cloudScroll, drawGlyph, seal } from '../../../components/paint/ornament';
import { rgba, type C2D } from '../../../components/paint/util';

export function stroke(c: C2D, pts: number[][], color: string = PAL.gold, width = 1) {
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x!, y!) : c.moveTo(x!, y!)); c.stroke();
}
export function oval(c: C2D, x: number, y: number, rx: number, ry: number, color: string) {
  c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
}
export function lamp(c: C2D, x: number, y: number, t: number, lit = .75, hanging = false) {
  if (hanging) { stroke(c, [[x, -270], [x, y - 75]], TONE.goldDark); }
  glow(c, x, y - 35, 160, PAL.millet, .15 + lit * .12);
  oval(c, x, y + 3, 27, 7, PAL.lacquer);
  stroke(c, [[x - 22, y], [x + 22, y]], TONE.goldDark, 3);
  stroke(c, [[x, y], [x, y - 55]], PAL.bronze, 7);
  oval(c, x, y - 56, 23, 6, PAL.bronze); oval(c, x, y - 59, 20, 3, TONE.goldDark);
  flame(c, x, y - 61, 26, t, lit);
}
/** A ring and a left-facing bronze tooth: the physical way back. */
export function token(c: C2D, x: number, y: number, lit = false) {
  c.save(); c.translate(x, y); if (lit) glow(c, 0, 0, 70, PAL.gold, .3);
  stroke(c, [[0, -48], [0, -23]], TONE.straw, 2);
  c.fillStyle = PAL.bronze; c.beginPath(); c.moveTo(-19, -20); c.lineTo(19, -16); c.lineTo(18, 25); c.lineTo(-18, 29); c.closePath(); c.fill();
  c.strokeStyle = PAL.gold; c.lineWidth = 1; c.stroke();
  stroke(c, [[8, -8], [-8, 4], [8, 15]], TONE.goldLight, 2);
  oval(c, 0, -14, 2, 2, PAL.lacquer); c.restore();
}
export function doorEdge(c: C2D, x: number, y: number, lit = false) {
  c.fillStyle = PAL.lacquer2; c.fillRect(x - 30, y - 240, 66, 295);
  stroke(c, [[x - 26, y + 55], [x - 26, y - 240], [x + 36, y - 248]], TONE.goldDark, 5);
  stroke(c, [[x + 13, y - 223], [x + 13, y + 48]], rgba(PAL.gold, lit ? .95 : .35), lit ? 4 : 1);
  if (lit) glow(c, x + 12, y - 90, 130, PAL.millet, .35);
  cloudScroll(c, x - 4, y - 204, 16, { color: PAL.gold, alpha: .55 });
}
/** Raw media are identifiable without a status caption. No entry => an empty loom. */
export function rough(c: C2D, x: number, y: number, form?: string, three = false) {
  c.save(); c.translate(x, y); c.scale(1, .65);
  if (!form) { stroke(c, [[-65, 0], [65, 0]], TONE.bambooDark, 3); c.restore(); return; }
  if (three) {
    for (const k of [0, 1, 2]) {
      const a = k * 19;
      stroke(c, [[-32 + a, -50], [-32 + a, 12], [8 + a, -10], [8 + a, -72], [-32 + a, -50]], PAL.gold);
      stroke(c, [[-32, -50 + a], [6, -12 + a], [46, -34 + a]], TONE.goldDark);
    }
  } else if (form === 'film') {
    c.fillStyle = TONE.ochreDark; c.fillRect(-85, -38, 170, 61);
    for (let i = 0; i < 4; i++) {
      c.strokeStyle = PAL.silkDim; c.strokeRect(-78 + i * 42, -29, 34, 40);
      stroke(c, [[-74 + i * 42, 6], [-65 + i * 42, -17], [-49 + i * 42, 4]], PAL.silkDim);
      for (const yy of [-34, 17]) { c.fillStyle = PAL.lacquer; c.fillRect(-70 + i * 42, yy, 6, 3); }
    }
  } else if (form === 'game') {
    c.fillStyle = TONE.bambooDark; c.fillRect(-68, -60, 136, 100);
    for (let i = 0; i < 5; i++) {
      stroke(c, [[-57 + i * 28, -50], [-57 + i * 28, 29]], PAL.lacquer);
      stroke(c, [[-57, -50 + i * 20], [55, -50 + i * 20]], PAL.lacquer);
    }
    oval(c, -28, -10, 8, 8, PAL.cinnabar); oval(c, 28, 10, 8, 8, PAL.lacquer);
  } else {
    for (let i = 2; i >= 0; i--) {
      c.fillStyle = i === 0 ? PAL.silk : PAL.silkDim; c.fillRect(-65 + i * 8, -54 - i * 8, 122, 83);
      stroke(c, [[-55 + i * 8, 11 - i * 8], [-22, -28], [3, -7], [30, -36], [48, 10]], TONE.ochreDark, 1.5);
    }
  }
  c.restore();
}

// Hand-authored monoline paths, on a 10×10 square. These are drawings, never canvas text.
// Composed radicals preserve the title while giving it elongated seal-script proportions.
const glyphs: Record<string, string> = {
  咖:'1,2 1,8 3,8 3,2 1,2/4,3 8,3 8,8 6,9/6,1 5,7 4,9/9,3 9,8 10,8 10,3 9,3',
  啡:'0,3 0,8 2,8 2,3 0,3/5,1 5,9/8,1 8,9/3,3 5,3/3,5 5,5/3,7 5,7/8,3 10,3/8,5 10,5/8,7 10,7',
  厅:'1,9 2,7 2,1 10,1/3,4 10,4/7,4 7,9 5,9',
  入:'4,1 5,5 2,9/5,5 8,9',
  口:'1,1 9,1 9,9 1,9 1,1',
  总:'2,0 4,2/8,0 6,2/2,3 8,3 8,6 2,6 2,3/1,8 0,9/3,7 3,10 8,10 8,8/5,7 6,8/9,7 10,9',
  览:'1,0 1,4/3,0 3,4/6,0 4,3/5,2 10,2/6,3 9,4/2,5 8,5 8,8/2,8 2,5/5,6 5,8 2,10/6,8 6,10 10,10 10,8',
  机:'1,3 4,3/3,0 3,10/3,4 0,8/3,5 5,7/6,1 9,1 9,9 10,9/6,1 6,7 4,10',
  器:'1,0 4,0 4,3 1,3 1,0/6,0 9,0 9,3 6,3 6,0/0,5 10,5/5,3 4,5 1,7/5,5 9,7/8,4 9,4/1,7 4,7 4,10 1,10 1,7/6,7 9,7 9,10 6,10 6,7',
  仪:'3,0 0,5/2,3 2,10/6,0 7,2/4,3 6,7 10,10/9,2 8,7 4,10',
  表:'5,0 5,5/2,1 8,1/2,3 8,3/0,5 10,5/5,5 1,8/3,7 3,10 6,9/6,6 8,9 10,10/9,6 7,8',
  作:'3,0 0,5/2,3 2,10/6,0 4,4/5,2 10,2/6,2 6,10/6,5 9,5/6,8 9,8',
  品:'3,0 7,0 7,4 3,4 3,0/0,6 4,6 4,10 0,10 0,6/6,6 10,6 10,10 6,10 6,6',
  架:'0,2 5,2 5,5 3,5/2,0 2,3 0,5/7,1 10,1 10,5 7,5 7,1/0,7 10,7/5,5 5,10/4,7 0,10/6,7 10,10',
  三:'2,1 8,1/3,5 7,5/1,9 9,9',
  人:'5,0 4,5 1,10/5,3 7,7 10,10',
  看:'2,0 8,0/1,2 9,2/0,4 10,4/5,0 3,6 0,8/3,6 8,6 8,10 3,10 3,6/3,8 8,8',
  天:'2,1 8,1/0,4 10,4/5,1 5,5 2,9/5,5 8,9',
  东:'1,2 9,2/5,0 2,6 9,6/5,4 5,10 3,10/2,8 0,10/8,8 10,10',
  郊:'0,2 6,2/3,0 4,2/2,4 0,6/4,4 6,6/1,6 3,8 6,10/5,6 3,8 0,10/7,0 10,0 8,4 10,6 9,8 7,8/7,0 7,10',
  第:'2,0 0,3/1,1 4,1/3,1 3,3/7,0 5,3/6,1 10,1/8,1 9,3/1,4 9,4 9,6 1,6 0,8 9,8 9,10 7,10/5,4 5,10/5,8 1,10',
  一:'1,5 9,5',
  次:'0,2 2,3/0,8 3,5/5,0 4,4/5,2 10,2 9,5/7,4 6,8 3,10/7,6 8,8 10,10',
  来:'1,2 9,2/0,6 10,6/5,0 5,10/2,3 3,5/8,3 7,5/4,6 1,9/6,6 9,9',
  访:'0,1 2,2/0,4 2,4 2,10 4,8/6,0 7,2/4,3 10,3/7,3 6,7 4,10/6,5 9,5 8,10 6,10',
  导:'1,0 8,0 8,3 1,3 1,5 9,5 9,4/0,7 10,7/7,5 7,10 5,10/2,8 3,9',
  师:'0,2 0,7/2,0 2,7 0,10/4,1 10,1/7,1 7,10/4,3 10,3 10,8 9,8/4,3 4,8',
  台:'4,0 1,4 9,4 7,1/2,6 8,6 8,10 2,10 2,6',
  案:'5,0 6,1/1,2 9,2 9,4/1,2 1,4/0,4 10,4/4,3 2,6 7,7/8,4 6,6 1,7/0,8 10,8/5,7 5,10/4,8 1,10/6,8 9,10',
  上:'5,0 5,9/5,4 9,4/1,9 10,9',
  回:'0,0 10,0 10,10 0,10 0,0/3,3 7,3 7,7 3,7 3,3',
  信:'3,0 0,5/2,3 2,10/6,0 7,1/4,2 10,2/5,4 9,4/5,6 9,6/5,8 9,8 9,10 5,10 5,8',
  五:'1,1 9,1/4,1 3,9/2,4 8,4 8,9/0,9 10,9',
  十:'0,4 10,4/5,0 5,10',
  年:'3,0 1,4/2,2 10,2/3,5 9,5/3,5 3,8/0,8 10,8/6,2 6,10',
  长:'4,0 4,10 7,8/9,1 6,4/0,5 10,5/5,5 7,8 10,10',
  卷:'3,0 4,2/8,0 7,2/1,3 9,3/0,5 10,5/5,1 3,5 0,7/7,5 10,7/3,6 7,6 7,8 5,8/3,6 3,10 9,10 9,8',
  '3':'1,1 8,1 8,5 4,5/8,5 8,9 1,9', D:'1,0 1,10 6,10 9,7 9,3 6,0 1,0',
};
export function titleGlyph(c: C2D, text: string, x: number, y: number, size: number) {
  [...text.replace(/[《》·\s]/g, '')].slice(0, 6).forEach((ch, i) => {
    const yy = y + i * size * 1.3;
    if (ch === '旱' || ch === '禾') { drawGlyph(c, ch, x, yy, size, { style: 'seal' }); return; }
    c.save(); c.translate(x - size / 2, yy - size / 2); c.scale(size / 10, size / 8.3);
    const def = glyphs[ch];
    if (def) for (const p of def.split('/')) stroke(c, p.split(' ').map(pt => pt.split(',').map(Number)), TONE.ink, .62);
    else { // A blank reserved for an uncarved title, never a made-up ideograph.
      stroke(c, [[1, 0], [9, 0], [9, 9], [1, 9]], TONE.bambooDark, .35);
    }
    c.restore();
  });
}
export function silk(c: C2D, x: number, y: number, title: string, sealed: boolean, lit: number, lift = 0) {
  c.save(); c.translate(x + lift * 13, y - lift * 18); c.rotate(-.025 - lift * .05);
  oval(c, 4, 244 + lift * 18, 39, 9, rgba(PAL.lacquer, .8));
  c.fillStyle = PAL.silkDim; c.fillRect(-34, 0, 68, 235);
  const g = c.createLinearGradient(-34, 0, 34, 0); g.addColorStop(0, TONE.bambooDark); g.addColorStop(.12, PAL.silk); g.addColorStop(.8, PAL.silkDim); g.addColorStop(1, TONE.bambooDark);
  c.fillStyle = g; c.fillRect(-34, 0, 68, 235);
  grain(c, -34, 0, 68, 235, { kind: 'silk', amount: .2 });
  stroke(c, [[-27, 4], [-27, 228]], rgba(TONE.goldDark, .6));
  for (let i = 0; i < 8; i++) stroke(c, [[-30 + i * 9, 234], [-29 + i * 9, 240 + i % 3]], PAL.silkDim, .8);
  titleGlyph(c, title, 0, 27, 19);
  c.fillStyle = TONE.bambooDark; c.fillRect(-40, -3, 80, 6);
  if (sealed) seal(c, 12, 207, 25, { glyph: '禾', angle: -.07 });
  else {
    stroke(c, [[-38, 185], [38, 181], [-38, 178], [38, 190]], TONE.straw, 2);
    stroke(c, [[0, 184], [-12, 199], [-18, 191], [0, 184], [14, 199], [19, 190], [0, 184], [5, 216]], TONE.straw, 1.6);
  }
  if (lit < 1) { c.fillStyle = rgba(PAL.lacquer, 1 - lit); c.fillRect(-41, -4, 83, 246); }
  c.restore();
}
export function rack(c: C2D, width: number) {
  c.fillStyle = PAL.lacquer2;
  c.beginPath(); c.moveTo(-width / 2, -210); c.lineTo(width / 2, -230); c.lineTo(width / 2 + 32, -215); c.lineTo(-width / 2 + 28, -194); c.closePath(); c.fill();
  for (const x of [-width / 2, width / 2]) {
    c.fillStyle = TONE.ochreDark; c.fillRect(x, -216, 15, 380);
    stroke(c, [[x + 3, -209], [x + 3, 158]], TONE.goldDark);
    for (let i = 0; i < 3; i++) { stroke(c, [[x + 6, -170 + i * 91], [x + 11, -150 + i * 91], [x + 8, -110 + i * 91]], rgba(PAL.lacquer, .6)); }
  }
  stroke(c, [[-width / 2, 121], [width / 2 + 14, 121]], TONE.ochreDark, 12);
  stroke(c, [[-width / 2, -211], [width / 2 + 12, -231]], PAL.gold, 1.3);
  stroke(c, [[-width / 2, 127], [width / 2 + 12, 127]], TONE.goldDark);
}
