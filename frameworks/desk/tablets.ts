import { PAL, TONE } from '../../components/paint/palette';
import { rgba } from '../../components/paint/util';
import { titleGlyph, stroke, oval } from '../../assets/library/desk/paint';

// Original elongated single-line carvings. Uncarved title characters remain honest blanks.
const carvings: Record<string, string> = {
  全:'5,0 2,3 0,4/5,0 8,3 10,4/2,4 8,4/2,7 8,7/5,4 5,10/0,10 10,10',
  图:'0,0 10,0 10,10 0,10 0,0/4,1 2,4/3,2 7,2 5,5 2,6/4,4 8,6/3,7 5,8/5,8 7,9',
  处:'3,0 1,4/2,2 5,2 4,6 1,9/2,5 4,8 7,10 10,10/7,0 7,8/8,3 10,5',
  焦:'3,0 0,4/2,3 2,7 10,7/5,0 6,2/2,2 10,2/6,2 6,7/2,4 10,4/2,6 10,6/1,9 0,10/3,9 4,10/6,9 7,10/9,9 10,10',
  点:'5,0 5,4/5,2 10,2/2,4 8,4 8,7 2,7 2,4/1,9 0,10/3,9 4,10/6,9 7,10/9,9 10,10',
  初:'0,1 2,2/0,4 4,4 1,8/2,6 2,10/3,6 4,8/5,1 10,1 9,10 7,10/7,1 7,6 5,10',
  见:'2,0 8,0 8,6/2,0 2,6/5,2 5,6 3,9 0,10/6,6 6,10 10,10 10,8',
  事:'0,1 10,1/5,0 5,10 3,10/2,3 8,3 8,5 2,5 2,3/1,7 9,7 9,9 1,9/0,8 10,8',
  惜:'0,3 0,6/2,0 2,10/3,2 4,4/5,1 5,4/8,1 8,4/4,2 10,2/4,4 10,4/5,6 9,6 9,10 5,10 5,6/5,8 9,8',
  字:'4,0 6,1/0,2 10,2 10,4/0,2 0,4/2,4 8,4 5,6 5,10 3,10/0,7 10,7',
  如:'2,0 1,7 5,9/0,3 5,3 4,7 0,10/6,2 10,2 10,9 6,9 6,2',
  金:'5,0 2,3 0,4/5,0 8,3 10,4/2,4 8,4/0,6 10,6/5,4 5,10/2,7 3,9/8,7 7,9/0,10 10,10',
  物:'1,0 0,4/1,2 4,2/2,0 2,10/0,7 4,6/6,0 4,4/5,2 10,2 9,10 7,10/7,2 6,6 4,8/9,2 8,7 5,10',
  件:'3,0 0,5/2,3 2,10/6,0 4,4/5,2 10,2/7,0 7,10/4,6 10,6',
  说:'0,1 2,2/0,4 2,4 2,10 4,8/5,0 6,2/9,0 8,2/5,3 9,3 9,6 5,6 5,3/6,6 6,8 4,10/8,6 8,10 10,10 10,8',
  话:'0,1 2,2/0,4 2,4 2,10 4,8/5,1 10,0/8,1 8,5/4,4 10,4/5,6 10,6 10,10 5,10 5,6',
  明:'0,1 4,1 4,8 0,8 0,1/0,4 4,4/6,0 10,0 10,10 8,10/6,0 6,7 5,10/6,3 10,3/6,6 10,6',
  白:'4,0 3,2/1,2 9,2 9,10 1,10 1,2/1,6 9,6',
  应:'5,0 6,1/1,2 10,2/1,2 1,7 0,10/3,4 4,7/6,3 7,6/10,4 8,9/2,10 10,10',
  随:'0,0 3,0 2,3 3,5 2,7 1,7/0,0 0,10/4,1 5,2/4,4 5,4 5,8 7,10 10,10/6,2 10,2/8,0 6,5/7,4 10,4 10,9/7,4 7,9/7,6 10,6/7,8 10,8',
  为:'2,0 3,2/5,0 4,5 1,9/1,3 10,3 9,10 7,10/5,6 7,8',
  取:'0,1 5,1/1,1 1,9/4,1 4,10/1,4 4,4/1,7 4,7/0,9 5,8/6,2 10,2 9,7 6,10/6,3 7,7 10,10',
  舍:'5,0 2,3 0,4/5,0 8,3 10,4/2,4 8,4/0,6 10,6/5,3 5,6/2,8 8,8 8,10 2,10 2,8',
  地:'0,4 4,4/2,1 2,9/0,10 4,9/5,4 10,2 10,7 9,7/7,0 7,8/5,2 5,10 10,10 10,8',
  标:'0,3 4,3/2,0 2,10/2,4 0,7/2,4 4,6/5,1 10,1/4,4 10,4/7,4 7,10 5,10/5,6 4,9/9,6 10,9',
  变:'4,0 6,1/0,2 10,2/4,2 4,5/6,2 6,5/1,3 0,5/9,3 10,5/2,6 8,6 6,8 0,10/3,6 5,8 10,10',
  化:'3,0 0,5/2,3 2,10/6,0 6,10 10,10 10,8/10,2 8,5 4,7',
  镜:'1,0 0,3/1,2 4,2/0,4 4,4/0,6 4,6/2,4 2,10 4,8/5,1 10,1/7,0 8,1/5,3 10,3/6,4 9,4 9,7 6,7 6,4/6,6 9,6/7,7 6,9 4,10/8,7 8,10 10,10 10,9',
  言:'4,0 6,1/0,2 10,2/2,4 8,4/2,6 8,6/2,8 8,8 8,10 2,10 2,8',
  先:'3,0 1,4/2,2 9,2/5,0 5,5/0,5 10,5/3,5 3,8 0,10/7,5 7,10 10,10 10,8',
  给:'2,0 0,4 3,4/4,2 0,7 4,7/0,10 4,9/7,0 5,3/7,0 10,3/6,4 9,4/5,6 10,6 10,10 5,10 5,6',
  前:'2,0 3,2/8,0 7,2/0,2 10,2/1,4 5,4 5,10 3,10/1,4 1,10/1,6 5,6/1,8 5,8/7,4 7,8/9,3 9,10 7,10',
  改:'0,1 4,1 4,5 0,5 0,10 4,9/7,0 5,5/6,2 10,2/9,2 8,7 5,10/6,4 7,7 10,10',
  猜:'0,1 3,4 3,10 1,10/0,5 3,2/0,8 3,6/4,1 10,1/5,3 9,3/4,5 10,5/7,0 7,5/5,6 9,6 9,10 7,10/5,6 5,10/5,8 9,8',
  时:'0,2 4,2 4,8 0,8 0,2/0,5 4,5/5,3 10,3/8,0 8,10 6,10/5,5 6,7',
  自:'4,0 3,2/1,2 9,2 9,10 1,10 1,2/1,5 9,5/1,8 9,8',
  主:'4,0 6,1/1,3 9,3/2,6 8,6/5,3 5,10/0,10 10,10',
  峰:'0,3 0,9 4,9 4,3/2,0 2,9/7,0 5,3/6,1 9,1 7,4 5,5/6,3 10,5/5,6 10,6/6,8 10,8/7,5 7,10/5,10 10,10',
  尾:'1,0 9,0 9,3 1,3 1,0/1,3 1,7 0,10/3,5 9,4/3,7 9,6/2,9 10,8/6,4 6,10 10,10 10,9',
  留:'0,1 4,0/0,1 0,5 4,4/3,2 4,5/6,0 10,0 9,5 7,5/7,0 7,3 5,5/1,6 9,6 9,10 1,10 1,6/5,6 5,10/1,8 9,8',
  线:'2,0 0,4 3,4/4,2 0,7 4,7/0,10 4,9/5,3 10,2/5,6 10,5/7,0 7,6 8,9 10,10 10,8/10,4 8,7 5,10/9,0 10,1',
  收:'0,2 0,7 4,7/3,0 3,10/7,0 5,5/6,2 10,2/9,2 8,7 5,10/6,4 7,7 10,10',
  计:'0,1 2,2/0,4 2,4 2,10 4,8/4,4 10,4/7,0 7,10',
  划:'0,3 6,2/0,6 6,5/2,0 2,6 4,9 6,10 6,8/6,4 4,7 0,10/8,2 8,7/10,0 10,10 8,10',
  稿:'0,1 4,0/0,4 4,4/2,1 2,10/2,5 0,8/2,5 4,7/5,1 10,1/7,0 8,1/6,3 9,3 9,5 6,5 6,3/5,6 10,6 10,10 9,10/5,6 5,10/7,7 9,7 9,9 7,9 7,7',
  有:'0,2 10,2/4,0 3,4 0,7/3,4 9,4 9,10 7,10/3,4 3,10/3,6 9,6/3,8 9,8',
  度:'5,0 6,1/1,2 10,2/1,2 1,7 0,10/2,4 10,4/4,3 4,6 8,6 8,3/3,7 9,7 6,9 2,10/4,7 6,9 10,10',
  成:'1,2 10,2/1,2 1,7 0,10/2,4 5,4 4,8 2,8/6,0 6,5 8,9 10,10 10,8/10,4 8,7 5,10/9,0 10,1',
  习:'0,0 10,0 9,10 6,10/2,3 4,5/1,8 6,6',
  间:'0,0 2,1/0,3 0,10/3,1 10,1 10,10 8,10/3,4 7,4 7,8 3,8 3,4/3,6 7,6',
  开:'1,1 9,1/0,4 10,4/3,1 3,7 1,10/7,1 7,10',
  行:'3,0 0,4/3,4 0,8/2,6 2,10/5,1 9,1/4,4 10,4/8,4 8,10 6,10',
  游:'0,1 2,2/0,4 2,5/0,10 2,7/4,0 5,2/3,3 7,3/5,3 4,10/5,5 7,5 6,10 4,10/9,0 8,3 10,3/8,5 10,5 9,7 9,10/7,8 10,8',
  光:'5,0 5,5/1,1 3,3/9,1 7,3/0,5 10,5/3,5 3,8 0,10/7,5 7,10 10,10 10,8',
  影:'0,0 6,0 6,4 0,4 0,0/0,2 6,2/3,4 3,6/0,6 6,6/1,7 5,7 5,9 1,9 1,7/3,9 3,10/8,1 10,0/8,5 10,3/7,10 10,7',
  藏:'0,1 10,1/3,0 3,2/7,0 7,2/1,4 8,4/2,3 2,9 8,9/2,6 6,6 6,8 2,8/4,4 4,9/7,3 8,7 10,10/10,4 8,8 6,10/0,7 1,10',
  画:'0,0 10,0/2,2 8,2 8,8 2,8 2,2/5,2 5,8/2,5 8,5/0,3 0,10 10,10 10,3',
  立:'4,0 6,2/0,3 10,3/2,4 3,8/8,4 6,9/0,10 10,10',
  境:'0,4 3,4/2,1 2,9/0,10 4,9/5,1 10,1/7,0 8,1/5,3 10,3/6,4 9,4 9,7 6,7 6,4/6,6 9,6/7,7 6,9 4,10/8,7 8,10 10,10 10,9',
  谱:'0,0 2,1/0,3 2,3 2,10 4,8/5,0 6,2/9,0 8,2/4,3 10,3/6,3 6,6/8,3 8,6/4,6 10,6/5,7 9,7 9,10 5,10 5,7/5,9 9,9',
  博:'0,4 4,4/2,0 2,10/5,2 10,2/7,0 7,6/5,3 10,3 10,6 5,6 5,3/5,5 10,5/4,8 10,8/9,6 9,10 7,10/5,9 6,10/9,0 10,1',
  弈:'4,0 6,1/0,2 10,2/3,2 3,5/7,2 7,5/1,3 0,5/9,3 10,5/0,7 10,7/3,5 3,9 1,10/7,5 7,10',
  杼:'0,3 4,3/2,0 2,10/2,4 0,7/2,4 4,6/5,0 10,0 7,3/6,2 8,4/5,5 10,5 9,7/8,5 8,10 6,10',
  异:'1,0 8,0 8,3 1,3 1,5 9,5 9,4/0,7 10,7/3,5 3,8 1,10/7,5 7,10',
  形:'0,1 6,1/0,5 6,5/2,1 2,8 0,10/5,1 5,10/8,2 10,0/8,6 10,4/7,10 10,8',
  基:'1,1 9,1/2,3 8,3/1,5 9,5/3,1 3,7/7,1 7,7/2,8 0,10/8,7 10,10/5,5 5,10/0,10 10,10',
  衡:'3,0 0,4/3,4 0,8/2,6 2,10/5,0 7,2/4,3 8,3 8,6 4,6 4,3/4,5 8,5/5,7 7,7/5,8 5,10/7,8 7,10/9,0 10,2/9,4 10,6/9,7 9,10',
};
function carve(c: CanvasRenderingContext2D, ch: string, x: number, y: number, size: number) {
  const def = carvings[ch];
  if (!def) { titleGlyph(c, ch, x, y, size); return; }
  c.save(); c.translate(x - size / 2, y - size / 2); c.scale(size / 10, size / 8.3);
  for (const p of def.split('/')) stroke(c, p.split(' ').map(pt => pt.split(',').map(Number)), TONE.ink, .62);
  c.restore();
}
export function woodTablet(c: CanvasRenderingContext2D, x: number, y: number, title: string, lit = 1, horizontal = false) {
  c.save(); c.translate(x, y); c.globalAlpha = lit;
  const w = horizontal ? 160 : 53, h = horizontal ? 46 : 109;
  oval(c, 4, h + 4, w / 2, 5, rgba(PAL.lacquer, .65));
  c.fillStyle = TONE.bambooDark; c.fillRect(-w / 2 - 2, -2, w + 4, h + 4);
  c.fillStyle = PAL.silkDim; c.fillRect(-w / 2, 0, w, h);
  for (let n = 0; n < 4; n++) stroke(c, [[-w / 2 + 6 + n * w / 4, 3], [-w / 2 + 8 + n * w / 4, h - 4]], rgba(TONE.ochreDark, .13));
  stroke(c, [[-w / 2 + 5, 5], [w / 2 - 5, 5]], TONE.straw);
  const chars = [...title.replace(/[《》·\s]/g, '')].slice(0, horizontal ? 6 : 4);
  chars.forEach((ch, i) => carve(c, ch, horizontal ? (i - (chars.length - 1) / 2) * 22 : 0, horizontal ? 24 : 20 + i * 24, 17));
  c.restore();
}

/** L1 木牍旁两枚小签（刻「基」「衡」）：派活到基础导演或叔衡 */
export function assignTally(c: CanvasRenderingContext2D, x: number, y: number, ch: string, active = false, hover = false) {
  c.save(); c.translate(x, y);
  const w = 24, h = 48;
  oval(c, 0, h / 2 + 2, w / 2, 3, rgba(PAL.lacquer, .5));
  c.fillStyle = active ? PAL.gold : hover ? TONE.goldDark : TONE.bambooDark;
  c.beginPath();
  c.moveTo(-w / 2, -h / 2 + 6);
  c.lineTo(0, -h / 2);
  c.lineTo(w / 2, -h / 2 + 6);
  c.lineTo(w / 2, h / 2);
  c.lineTo(-w / 2, h / 2);
  c.closePath();
  c.fill();
  c.fillStyle = active ? PAL.silk : PAL.silkDim;
  c.beginPath();
  c.moveTo(-w / 2 + 2, -h / 2 + 7);
  c.lineTo(0, -h / 2 + 2);
  c.lineTo(w / 2 - 2, -h / 2 + 7);
  c.lineTo(w / 2 - 2, h / 2 - 2);
  c.lineTo(-w / 2 + 2, h / 2 - 2);
  c.closePath();
  c.fill();
  carve(c, ch, 0, 4, 15);
  if (active) {
    stroke(c, [[-w / 2 + 1, -h / 2 + 6], [0, -h / 2 + 1], [w / 2 - 1, -h / 2 + 6]], PAL.gold, 1.5);
  }
  c.restore();
}

/** L1 木牍下压着的竹简笺数：对应篇幅，不写字不写数字 */
export function bambooSlipsPiles(c: CanvasRenderingContext2D, x: number, y: number, count: number, state: 'next' | 'later' | 'dropped', hover = false) {
  c.save(); c.translate(x, y);
  const n = Math.max(1, Math.min(12, count));
  if (state === 'dropped') {
    // 案角一叠"先放着"：堆叠在案角
    oval(c, 0, 16, 28, 6, rgba(PAL.lacquer, .6));
    for (let i = 0; i < n; i++) {
      const ox = (i % 3 - 1) * 6, oy = i * 3;
      c.fillStyle = i === n - 1 && hover ? PAL.gold : TONE.bambooDark;
      c.fillRect(-22 + ox, -8 + oy, 44, 8);
      c.fillStyle = PAL.silkDim;
      c.fillRect(-20 + ox, -7 + oy, 40, 6);
      stroke(c, [[-10 + ox, -7 + oy], [-10 + ox, -1 + oy]], rgba(TONE.ochreDark, .3));
      stroke(c, [[10 + ox, -7 + oy], [10 + ox, -1 + oy]], rgba(TONE.ochreDark, .3));
    }
  } else if (state === 'later') {
    // 压后：移到木牍右侧
    oval(c, 0, 24, 22, 5, rgba(PAL.lacquer, .5));
    for (let i = 0; i < n; i++) {
      const ox = (i - n / 2) * 5, oy = (i % 2) * 3;
      c.fillStyle = hover ? PAL.gold : TONE.bambooDark;
      c.fillRect(-6 + ox, -18 + oy, 11, 40);
      c.fillStyle = PAL.silkDim;
      c.fillRect(-5 + ox, -17 + oy, 9, 38);
      stroke(c, [[-4 + ox, -6 + oy], [3 + ox, -6 + oy]], rgba(TONE.ochreDark, .4));
      stroke(c, [[-4 + ox, 10 + oy], [3 + ox, 10 + oy]], rgba(TONE.ochreDark, .4));
    }
  } else {
    // 接下来：整齐压在木牍下方
    const totalW = Math.min(140, Math.max(36, n * 14));
    const slipW = totalW / n;
    oval(c, 0, 32, totalW / 2 + 8, 5, rgba(PAL.lacquer, .5));
    for (let i = 0; i < n; i++) {
      const sx = -totalW / 2 + i * slipW + 1;
      c.fillStyle = hover ? PAL.gold : TONE.bambooDark;
      c.fillRect(sx, -6, slipW - 2, 42);
      c.fillStyle = PAL.silkDim;
      c.fillRect(sx + 1, -5, slipW - 4, 40);
      stroke(c, [[sx + 1, 16], [sx + slipW - 3, 16]], rgba(TONE.ochreDark, .3));
      stroke(c, [[sx + 1, 28], [sx + slipW - 3, 28]], rgba(TONE.ochreDark, .3));
    }
    stroke(c, [[-totalW / 2, 22], [totalW / 2, 22]], TONE.straw, 1.2);
  }
  c.restore();
}

export interface DirectorActivityProps {
  elapsed: number;
  reducedMotion: boolean;
  acts: { id: string; focus: string }[];
  tier: string;
  currentActId: string;
  tradeoffReason?: string;
  hasRehearsal: boolean;
  rehearsalFailed: boolean;
  dwellActIndex?: number;
  hoverTradeoff?: boolean;
}

/** L2 导演的"正在设计"：帛在案上铺开，分幕落笔、焦点、取舍淡痕、预演印、朱圈与卷帛牵线 */
export function directorSilkScroll(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, props: DirectorActivityProps, sideX: number) {
  c.save(); c.translate(x, y);
  // 帛身：底色与经纬暗纹
  oval(c, w / 2, h + 3, w / 2 + 4, 6, rgba(PAL.lacquer, .55));
  c.fillStyle = PAL.silkDim;
  c.fillRect(0, 0, w, h);
  for (let i = 1; i < 4; i++) {
    stroke(c, [[0, i * h / 4], [w - 12, i * h / 4]], rgba(TONE.ochreDark, .08));
  }
  // 左缘压平木条
  c.fillStyle = TONE.bambooDark;
  c.fillRect(-2, 0, 4, h);

  // 1. 分幕与落笔：0.4s 一笔
  const tierCapacity: Record<string, number> = { L0: 1, L1: 4, L2: 6, L3: 8, L4: 10 };
  const maxActs = tierCapacity[props.tier] ?? 4;
  const count = Math.min(props.acts.length, maxActs);
  const strokeSpacing = (w - 44) / Math.max(1, count);

  for (let i = 0; i < count; i++) {
    const strokeTime = i * 0.4;
    const landed = props.reducedMotion || props.elapsed >= strokeTime;
    if (!landed) continue;

    const sx = 20 + i * strokeSpacing;
    const sy = 12;
    const isFocus = props.acts[i]?.id === props.currentActId;
    const diffusing = !props.reducedMotion && props.elapsed - strokeTime <= 0.1;

    // 墨迹扩散反馈（<=100ms）
    if (diffusing) {
      oval(c, sx, sy + (h - 24) / 2, 8, 12, rgba(TONE.ink, .35 * (1 - (props.elapsed - strokeTime) / 0.1)));
    }

    // 落笔墨痕
    const strokeColor = isFocus ? PAL.gold : rgba(TONE.ink, .45);
    const strokeWidth = isFocus ? 2.5 : 1.5;
    stroke(c, [
      [sx, sy],
      [sx - 2, sy + (h - 24) * .35],
      [sx + 2, sy + (h - 24) * .7],
      [sx, sy + h - 24],
    ], strokeColor, strokeWidth);

    if (isFocus) {
      // 焦点那一笔更亮
      stroke(c, [[sx, sy + 4], [sx, sy + h - 28]], rgba(PAL.silk, .9), 1.2);
    }

    // 5. 记忆落点：你上次停留的地方被朱笔圈出
    if (props.dwellActIndex === i) {
      c.save();
      c.strokeStyle = PAL.cinnabar;
      c.lineWidth = 1.6;
      c.beginPath();
      c.ellipse(sx, sy + (h - 24) / 2, 8, (h - 20) / 2, -.1, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
  }

  // 3. 取舍留痕：被放弃的那一笔留一道淡痕
  if (props.tradeoffReason) {
    const fx = 20 + count * strokeSpacing;
    if (fx < w - 16) {
      stroke(c, [
        [fx, 14],
        [fx + 1, 14 + (h - 28) * .4],
        [fx - 1, 14 + (h - 28) * .8],
        [fx, h - 14],
      ], props.hoverTradeoff ? rgba(PAL.gold, .8) : rgba(TONE.ink, .2), props.hoverTradeoff ? 2 : 1);
      if (props.hoverTradeoff) {
        oval(c, fx, h / 2, 10, 14, rgba(PAL.gold, .15));
      }
    }
  }

  // 4. 预演：帛角一枚小朱印，失败时留重来划痕
  if (props.hasRehearsal) {
    const sealLanded = props.reducedMotion || props.elapsed >= count * 0.4;
    if (sealLanded) {
      const sealX = 16, sealY = h - 14;
      c.fillStyle = PAL.cinnabar;
      c.fillRect(sealX - 5, sealY - 5, 10, 10);
      c.fillStyle = PAL.lacquer;
      c.fillRect(sealX - 3, sealY - 3, 6, 6);
      c.fillStyle = PAL.cinnabar;
      c.fillRect(sealX - 1, sealY - 1, 2, 2);
      if (props.rehearsalFailed) {
        stroke(c, [[sealX - 7, sealY + 7], [sealX + 8, sealY - 7]], TONE.ink, 1.8);
      }
    }
  }

  // 6. 交接：帛右端卷起，一条细线牵到 L3
  c.fillStyle = TONE.bambooDark;
  c.fillRect(w - 10, -3, 10, h + 6);
  oval(c, w - 5, -3, 5, 3, PAL.gold);
  oval(c, w - 5, h + 3, 5, 3, PAL.gold);
  c.fillStyle = PAL.silkDim;
  c.fillRect(w - 8, -2, 6, h + 4);
  // 细线牵到架子 (以当前世界坐标连接)
  stroke(c, [[w - 4, h * .4], [w + 35, h * .2], [sideX - x, -80]], rgba(PAL.gold, .6), 1);

  c.restore();
}
