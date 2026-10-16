import type { Stage } from '../../engine/stage';
import type { WorkEntry } from '../../engine/types';
import { PAL, TONE } from '../../components/paint/palette';
import { makeFigure } from '../../components/paint/figure';
import { lowTable, ticket, screen, bambooSlips } from '../../components/paint/props-room';
import { lacquerGround, glow, grain } from '../../components/paint/texture';
import { cloudScroll } from '../../components/paint/ornament';
import { rgba } from '../../components/paint/util';
import { lamp, token, doorEdge, rough, silk, rack, stroke, oval } from '../../assets/library/desk/paint';
import { woodTablet } from './tablets';

export interface DeskSceneEvidence { scheduleTitle: string; group: string; groupTurnAt: number; entries: { title: string }[]; memory: number }

type Rect = { x: number; y: number; w: number; h: number };
export function createDeskScene(stage: Stage, c: CanvasRenderingContext2D) {
  const mentor = makeFigure('mentor', { pose: 'sit-look', onDark: true, robe: PAL.lacquer2, seed: 9 });
  const other = makeFigure('ji', { pose: 'sit-write', onDark: true, robe: TONE.ochreDark, seed: 3 });
  let lastDepth = -1;
  const layout = () => {
    const narrow = stage.narrow, s = Math.min(stage.width / (narrow ? 600 : 1000), stage.height / 720);
    return { narrow, s, x: stage.width / 2, y: stage.height * .49, side: narrow ? 215 : 434, spread: narrow ? 135 : 225 };
  };
  const boxes = (depth: number): Record<string, Rect> => {
    const { x, y, s, side, narrow } = layout();
    const rect = (a: number, b: number, w: number, h: number) => ({ x: x + a * s, y: y + b * s, w: w * s, h: h * s });
    return {
      main: depth === 0 ? rect(-68, narrow ? -84 : -143, 129, 150) : depth === 1 ? rect(-42, -99, 193, 135) : depth === 2 ? rect(side - 35, -205, 72, 279) : rect(-53, -198, 108, 272),
      back: rect(-side - 24, -40, 48, 68),
      thought: rect(48, -17, 72, 44),
      next: rect(95, -170, 73, 230),
      group: rect(narrow ? -198 : -320, -223, 82, 145),
      memory: rect(narrow ? -150 : -184, -235, narrow ? 300 : 368, 126),
    };
  };
  function draw(depth: number, works: WorkEntry[], selected: number, uncertain: boolean, ready: boolean, drawerOpen: boolean, hovering: (id: string) => boolean, opened: boolean, evidence: DeskSceneEvidence) {
    const { x, y, s, side, spread, narrow } = layout(), t = stage.reducedMotion ? 0 : stage.time;
    const hot = hovering(['desk-in', 'desk-doing', 'desk-shelf-in', 'desk-open'][depth]!);
    if (lastDepth !== depth) { mentor.setPose(depth === 1 ? 'sit-look' : 'point', 400); mentor.setGaze(depth === 1 ? -.5 : -.2); lastDepth = depth; }
    lacquerGround(c, 0, 0, stage.width, stage.height, { tone: 'black', sheen: .28, seed: 9 });
    c.save(); c.translate(x, y); c.scale(s, s);
    // Worn floorboards and a thin gold inlay hold every object in one room.
    const floor = c.createLinearGradient(0, 35, 0, 280); floor.addColorStop(0, rgba(PAL.lacquer2, 0)); floor.addColorStop(.45, rgba(TONE.wallNight, .6)); floor.addColorStop(1, rgba(PAL.lacquer, 0));
    c.fillStyle = floor; c.fillRect(-600, 25, 1200, 330);
    for (let i = -3; i <= 3; i++) stroke(c, [[i * 92, 53], [i * 178, 300]], rgba(TONE.goldDark, .09));
    stroke(c, [[-side - 15, 182], [side + 15, 182]], rgba(PAL.gold, .15));
    for (const edge of [-1, 1]) cloudScroll(c, edge * (side - 25), -235, 23, { color: PAL.gold, alpha: .24, flip: edge as -1 | 1, seed: 9 });
    if (depth === 0) {
      glow(c, 25, 12, 230, PAL.millet, .12);
      const table = lowTable(c, 0, 140, narrow ? 488 : 650, { lit: .8 });
      // A reflected ribbon of lamplight follows the lacquer top.
      oval(c, 75, table.top - 2, 135, 6, rgba(PAL.gold, .07));
      lamp(c, narrow ? 150 : 220, table.top - 1, t, hot ? 1 : .67);
      ticket(c, -6, table.top - 41, 84, { glyph: '旱', flat: .69, angle: -.28, lift: hot ? .8 : 0, glow: hot ? .25 : .05, t, seal: 1 });
    } else if (depth === 1) {
      screen(c, -55, 72, narrow ? 390 : 560, 315, { lit: .24, panels: 3 });
      glow(c, -68, -105, 190, PAL.millet, .17);
      mentor.draw(c, -130, 79, 260, t);
      const table = lowTable(c, 16, 143, narrow ? 425 : 580, { lit: .7 });
      c.save(); c.translate(50, table.top - 10); c.transform(1, -.1, .35, .52, 0, 0);
      bambooSlips(c, 0, 0, 160, { open: 1, marks: !uncertain, n: 9 });
      // A single ink wash is an unfinished thought, never invented evidence.
      if (uncertain) stroke(c, [[-58, -51], [-40, -56], [-20, -55]], rgba(TONE.ink, .22), 2);
      c.restore();
      glow(c, -13, 40, 98, PAL.millet, .13);
      woodTablet(c, -13, 39, evidence.scheduleTitle, 1, true);
      lamp(c, narrow ? 176 : 235, table.top - 3, t, hot ? 1 : .76);
      // The blank silk end is also the existing next-thought action.
      c.fillStyle = PAL.silkDim; c.fillRect(58, 8, 50, 13);
      stroke(c, [[62, 14], [99, 13]], TONE.bambooDark, .8);
    } else if (depth === 2) {
      screen(c, 0, 70, narrow ? 485 : 800, 310, { lit: .32, panels: 4 });
      mentor.draw(c, -spread - 35, 94, narrow ? 175 : 218, t);
      other.draw(c, spread + 20, 94, narrow ? 175 : 218, t);
      for (const [i, id] of ['base', 'shuheng'].entries()) {
        const xx = i === 0 ? -spread : spread, w = works.find(w => w.director === id);
        const table = lowTable(c, xx, 150, narrow ? 236 : 365, { lit: .74 });
        glow(c, xx, table.top - 20, 115, PAL.millet, .15);
        c.save(); c.translate(xx, table.top - 7); if (narrow) c.scale(.74, .74);
        rough(c, 0, 0, w?.form, /3d/i.test(`${w?.intent} ${w?.title}`)); c.restore();
      }
      const slots = [0, 1, -1, 2, -2], position = evidence.memory % 5;
      const lightX = slots[position]! * (narrow ? 62 : 78);
      mentor.setGaze(Math.max(-1, Math.min(1, lightX / 180)));
      for (const i of evidence.entries.length ? [0, 1, 2, 3, 4] : [0]) {
        const item = evidence.entries[Math.floor(evidence.memory / 5) * 5 + i];
        const focused = i === position, neighbour = i === (position + 1) % 5;
        woodTablet(c, slots[i]! * (narrow ? 62 : 78), -220, item && (focused || neighbour) ? item.title : '', focused ? 1 : neighbour ? .5 : .12);
      }
      glow(c, lightX, -159, 78, PAL.millet, hovering('desk-memory-next') ? .3 : .17);
      lamp(c, lightX, -45, t, .9, true);
      doorEdge(c, side, 8, hot);
    } else {
      rack(c, narrow ? 410 : 660);
      const cardX = narrow ? -168 : -286;
      const turn = stage.reducedMotion ? 1 : Math.min(1, Math.max(0, (stage.time - evidence.groupTurnAt) / .4));
      c.save(); c.translate(cardX, -215); c.scale(Math.max(.035, Math.abs(Math.cos(turn * Math.PI))), 1);
      woodTablet(c, 0, 0, works.length ? evidence.group : '', hovering('desk-group-next') ? 1 : .8); c.restore();
      glow(c, 4, -45, 180, PAL.millet, .24);
      const count = Math.min(5, works.length);
      const order = Array.from({ length: count }, (_, i) => i - Math.floor(count / 2));
      for (const offset of order.filter(n => n !== 0).concat(0)) {
        if (!works.length) break;
        const w = works[(selected + offset + works.length) % works.length]!;
        const xx = offset * (narrow ? 81 : 123), yy = -199 + Math.abs(offset) * 10;
        silk(c, xx, yy, offset === 0 ? w.title : [...w.title.replace(/[《》·\s]/g, '')].slice(0, 2).join(''), w.sealed, offset === 0 ? 1 : .2, offset === 0 && hot ? .8 : 0);
      }
      if (works.length > 5) { for (const xx of [-1, 1]) for (let i = 0; i < 3; i++) stroke(c, [[xx * (narrow ? 200 : 309), -150 + i * 14], [xx * (narrow ? 206 : 315), -150 + i * 14]], TONE.goldDark); }
      if (!works.length) { silk(c, 0, -199, '', false, .45); }
      doorEdge(c, side, 8, hot || opened);
      lamp(c, narrow ? -198 : -320, 152, t, .75);
    }
    if (ready && depth > 0 && !drawerOpen) token(c, -side, 0, hovering('desk-back'));
    c.restore();
    grain(c, 0, 0, stage.width, stage.height, { kind: 'lacquer', amount: .11 });
    if (ready && !drawerOpen) {
      // A hanging narrow silk bookmark, never a text button.
      c.fillStyle = PAL.lacquer2; c.fillRect(stage.width - 31, stage.height * .4, 26, stage.height * .2);
      stroke(c, [[stage.width - 28, stage.height * .4], [stage.width - 28, stage.height * .6]], PAL.gold);
      for (let i = 0; i < 3; i++) stroke(c, [[stage.width - 23, stage.height * .45 + i * 11], [stage.width - 13, stage.height * .45 + i * 11]], TONE.bambooDark);
    }
  }
  return { boxes, draw };
}
