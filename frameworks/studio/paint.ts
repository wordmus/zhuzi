import type { DirectorAck } from '../../engine/layers/types';
import type { Figure } from '../../components/paint/figure';
import { drawSmallLamp } from '../vignette/scene';

export interface StudioState {
  phase: 'commission' | 'plan' | 'board' | 'report';
  acts: DirectorAck['acts'];
  who: string;
  lamp: number;
  seal: boolean;
  received: boolean;
  progress: number;
  error: boolean;
  caught: boolean;
  receipts: number;
  pinned: number;
  archive: number;
}

export function studioLayout(w: number, h: number) {
  const narrow = w < h * .9;
  const desk = { x: w * (narrow ? .08 : .23), y: h * .43, w: w * (narrow ? .76 : .34), h: h * .34 };
  return { desk,
    caption: { x: desk.x + desk.w * .08, y: desk.y + desk.h * .21, w: desk.w * .84, h: desk.h * .34 },
    presence: { x: desk.x + desk.w * .19, y: desk.y + desk.h * .73, w: desk.w * .72, h: desk.h * .2 },
    action: { x: desk.x + desk.w * .1, y: desk.y + desk.h * .12, w: desk.w * .8, h: desk.h * .76 },
  };
}

function seal(c: CanvasRenderingContext2D, x: number, y: number, s: number, alpha = 1) {
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(-.12);
  c.strokeStyle = '#b74930'; c.fillStyle = '#ab412d'; c.lineWidth = Math.max(1, s * .08);
  c.strokeRect(-s / 2, -s / 2, s, s);
  // 回执图形，不以装饰汉字冒充玩家文字。
  c.beginPath(); c.moveTo(-s * .25, 0); c.lineTo(-s * .04, s * .23); c.lineTo(s * .29, -s * .23); c.stroke();
  c.restore();
}

function slip(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tone: string) {
  c.fillStyle = '#0f0b08'; c.fillRect(x + 4, y + 5, w, h);
  c.fillStyle = tone; c.fillRect(x, y, w, h);
  c.strokeStyle = '#796341'; c.lineWidth = 1; c.strokeRect(x + 3, y + 3, w - 6, h - 6);
}

/** 四件实物用同一张矮案；原咖啡厅地标不随焦点搬动。 */
export function paintStudio(c: CanvasRenderingContext2D, w: number, h: number, t: number, st: StudioState, director: Figure) {
  const { desk: d } = studioLayout(w, h);
  c.save();
  c.fillStyle = 'rgba(10,8,6,.37)'; c.fillRect(0, 0, w, h);
  const cx = d.x + d.w / 2, cy = d.y + d.h / 2;
  const light = c.createRadialGradient(cx, cy, 10, cx, cy, d.w * .72);
  light.addColorStop(0, 'rgba(214,166,85,.15)'); light.addColorStop(1, 'rgba(214,166,85,0)');
  c.fillStyle = light; c.fillRect(d.x - 60, d.y - 60, d.w + 120, d.h + 160);
  director.draw(c, d.x - w * .065, d.y + d.h * .94, Math.min(h * .34, w * .3), t);
  c.font = '17px "Kaiti SC","STKaiti",serif'; c.fillStyle = '#cbb381'; c.textAlign = 'center';
  c.fillText('叔衡', d.x - w * .07, d.y + d.h * 1.05);
  if (w >= h * .9) c.fillText('导师', w * .7, h * .4);
  c.fillStyle = '#352315'; c.fillRect(d.x, d.y + d.h * .9, d.w, d.h * .2);
  c.fillStyle = '#4f3420'; c.beginPath();
  c.moveTo(d.x - 12, d.y); c.lineTo(d.x + d.w + 12, d.y);
  c.lineTo(d.x + d.w + 28, d.y + d.h); c.lineTo(d.x - 28, d.y + d.h); c.closePath(); c.fill();
  c.strokeStyle = '#89663b'; c.lineWidth = 2; c.stroke();
  // 木纹只贴着案面走，不干扰唯一的信件。
  c.strokeStyle = 'rgba(215,178,111,.08)'; c.lineWidth = 1;
  for (let i = 1; i < 9; i++) { c.beginPath(); c.moveTo(d.x, d.y + d.h * i / 9); c.bezierCurveTo(cx, d.y + d.h * i / 9 - 8, cx, d.y + d.h * i / 9 + 8, d.x + d.w, d.y + d.h * i / 9); c.stroke(); }
  const paper = { x: d.x + d.w * .06, y: d.y + d.h * .1, w: d.w * .88, h: d.h * .78 };
  if (st.phase === 'commission') {
    slip(c, paper.x, paper.y, paper.w, paper.h, '#d1bc8c');
    // 左右帛轴，以及导师尚未放下的笔。
    c.fillStyle = '#8c6639';
    for (const x of [paper.x, paper.x + paper.w]) c.fillRect(x - 5, paper.y - 10, 10, paper.h + 20);
    c.strokeStyle = '#241c15'; c.lineWidth = 4; c.beginPath(); c.moveTo(paper.x + paper.w * .68, paper.y + paper.h * .8); c.lineTo(paper.x + paper.w * .9, paper.y + paper.h * .59); c.stroke();
    // 灯油来自这一次委托预算；不用数字写满画面。
    drawSmallLamp(c, d.x + d.w * .9, d.y - 12, 27 + st.lamp * 13, t);
  } else if (st.phase === 'plan') {
    slip(c, paper.x, paper.y, paper.w, paper.h, '#c6b182');
    const n = Math.max(1, st.acts.length), gap = Math.min(8, paper.w * .02);
    const sw = Math.min(45, (paper.w * .84 - gap * (n - 1)) / n);
    st.acts.slice(0, st.pinned).forEach((act, i) => {
      const x = paper.x + paper.w * .08 + i * (sw + gap), y = paper.y + paper.h * .62;
      slip(c, x, y, sw, paper.h * .27, act.framework === 'studio' ? '#ac6e3a' : '#a79464');
      c.fillStyle = '#342a1b'; c.beginPath(); c.arc(x + sw / 2, y + 5, 2.5, 0, Math.PI * 2); c.fill();
      // 每一条一对一对应真实 acts；框架用简单图形识别，窄屏不塞长幕名。
      c.strokeStyle = '#5a4930'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x + sw * .22, y + 18); c.lineTo(x + sw * .78, y + 18);
      if (act.framework === 'walk2d') c.lineTo(x + sw * .5, y + 30);
      else if (act.framework === 'vignette') { c.lineTo(x + sw * .78, y + 31); c.lineTo(x + sw * .22, y + 31); c.closePath(); }
      else c.lineTo(x + sw * .4, y + 30);
      c.stroke();
    });
    // 可按的大印，落下时才调用 receive。
    c.fillStyle = '#65422b'; c.fillRect(cx - 19, d.y + d.h * .81, 38, 21);
    c.fillStyle = '#b57c48'; c.fillRect(cx - 7, d.y + d.h * .76, 14, 16);
  } else if (st.phase === 'board') {
    slip(c, paper.x, paper.y, paper.w, paper.h, '#302d24');
    const actors = ['禾', '季', '田伯'];
    actors.forEach((name, i) => {
      const x = paper.x + paper.w * (.2 + i * .3), y = paper.y + paper.h * .53;
      const lit = name === st.who && st.received;
      c.fillStyle = lit ? '#d7bb7c' : '#74684e';
      c.beginPath(); c.arc(x, y - 30, 10, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(x - 17, y + 10); c.lineTo(x - 10, y - 14); c.lineTo(x + 10, y - 14); c.lineTo(x + 17, y + 10); c.closePath(); c.fill();
      c.font = '18px "Kaiti SC","STKaiti",serif'; c.textAlign = 'center'; c.fillStyle = lit ? '#f2dca9' : '#b29a6e'; c.fillText(name, x, y + 42);
      drawSmallLamp(c, x, paper.y + paper.h * .2, 28, t, !lit);
    });
    if (!st.received) {
      const i = Math.max(0, actors.indexOf(st.who)), p = st.progress;
      const x = d.x + 10 + (paper.x + paper.w * (.2 + i * .3) - d.x - 10) * p;
      const y = d.y + d.h * .95 + (paper.y + paper.h * .24 - d.y - d.h * .95) * p - Math.sin(p * Math.PI) * 35;
      c.save(); c.translate(x, y); c.rotate(-.4 + p * .4); slip(c, -20, -11, 40, 22, '#d1bc8c'); c.restore();
    }
    seal(c, d.x + d.w * .95, d.y + d.h * .97, 25);
  } else {
    // 接住后才压成一册移入旁架；此前完整报告仍留给人看。
    const a = st.archive;
    paper.x += (d.x + d.w * .99 - paper.x) * a;
    paper.y += d.h * .4 * a;
    paper.w *= 1 - .91 * a;
    paper.h *= 1 - .5 * a;
    const lift = st.caught ? -8 : Math.sin(t * 2) * 2;
    for (let i = 0; i < 11; i++) {
      const sw = paper.w / 11;
      slip(c, paper.x + i * sw, paper.y + lift + (i % 2) * 2, sw - 2, paper.h, i % 2 ? '#bdab76' : '#cbb988');
    }
    c.strokeStyle = '#5c3824'; c.lineWidth = 2;
    for (const y of [.14, .85]) { c.beginPath(); c.moveTo(paper.x - 7, paper.y + paper.h * y + lift); c.lineTo(paper.x + paper.w + 7, paper.y + paper.h * y + lift); c.stroke(); }
    if (st.error) {
      c.save(); c.setLineDash([4, 7]); c.strokeStyle = 'rgba(111,56,35,.38)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(paper.x + paper.w * .13, paper.y + paper.h * .65); c.lineTo(paper.x + paper.w * .83, paper.y + paper.h * .65); c.stroke(); c.restore();
      c.strokeStyle = '#4a5034'; c.lineWidth = 3; c.beginPath(); c.moveTo(paper.x + paper.w * .13, paper.y + paper.h * .7); c.lineTo(paper.x + paper.w * .57, paper.y + paper.h * .7); c.lineTo(paper.x + paper.w * .83, paper.y + paper.h * .6); c.stroke();
    }
    if (st.caught) {
      seal(c, paper.x + paper.w * .87, paper.y + paper.h * .77, 31);
      // 收妥后架上的旧简有了新一册，回执只画小印。
      c.fillStyle = '#634a30'; c.fillRect(d.x + d.w * .98, d.y + d.h * .5, 34, d.h * .48);
      for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? '#9a8658' : '#b19a66'; c.fillRect(d.x + d.w * .98 + i * 6, d.y + d.h * .52, 4, d.h * .42); }
    }
  }
  for (let i = 0; i < st.receipts; i++) seal(c, d.x + 9 + i * 17, d.y + d.h + 22, 11, .75);
  c.restore();
}
