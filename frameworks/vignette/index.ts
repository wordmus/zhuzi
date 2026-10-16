import type { Ctx, Framework } from '../../app/context';
import type { Ending } from '../../engine/types';
import { TONE } from '../../components/paint/palette';
import { ticket as paintTicket } from '../../components/paint/props-room';
import { sceneDoor, sceneRoom, makeRoomCast, type RoomCast } from '../../components/paint/samples';
import { clamp, easeOut, lerp } from '../../components/paint/util';
import type { Affordance, AffShape, DragEvent } from '../../engine/affordance';
import { drawReturnScene, drawSeat, drawSmallLamp, makeMentor, updateMentorLook, type ReturnLayout } from './scene';
import { currentLampX, prepareVisitChanges } from './visit-changes';
import { mountChronicle } from './chronicle';
import { getOrInitHypotheses, type Hypothesis } from '../../engine/mind/hypotheses';
import { mountBooks } from '../../components/books';
import { drawOilStation, drawDirectorStation, drawShelfStation, drawDoorStation, loadWorksIndex, type WorkItem } from './cafe-map';

const MAX_LINE = 30;

function shortLine(text: string) {
  return [...text.trim()].slice(0, MAX_LINE).join('');
}

function lineText(ctx: Ctx, id: string, fallback: string) {
  const raw = ctx.plan.acts.flatMap((a) => a.lines).find((line) => line.id === id)?.text ?? fallback;
  return shortLine(raw);
}

function copyCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  out.getContext('2d')!.drawImage(source, 0, 0);
  return out;
}

function leaveWindowLight(stage: Ctx['stage']) {
  stage.removeLayer('vignette-window-glow');
  const root = stage.dom('vignette-window-glow', 31);
  const glow = document.createElement('div');
  glow.setAttribute('aria-hidden', 'true');
  glow.style.cssText = 'position:absolute;left:85.2%;top:41.8%;width:min(30vw,15vh);height:min(30vw,15vh);transform:translate(-50%,-50%);border-radius:50%;pointer-events:none;background:radial-gradient(circle,rgba(255,206,115,.42) 0%,rgba(224,138,58,.2) 34%,rgba(201,128,58,.08) 58%,rgba(201,128,58,0) 100%);filter:blur(2px);';
  root.appendChild(glow);
  if (!stage.reducedMotion && typeof glow.animate === 'function') {
    glow.animate([{ opacity: 0.58, filter: 'blur(2px)' }, { opacity: 0.96, filter: 'blur(4px)' }, { opacity: 0.58, filter: 'blur(2px)' }], { duration: 1800, iterations: Infinity, easing: 'ease-in-out' });
  }
}

function focusPulse(a: Affordance, t: number, reduced: boolean, strength = 1) {
  a.el.dataset.pulse = 'breath';
  a.el.setAttribute('aria-current', 'true');
  const wave = reduced ? 0.55 : 0.35 + 0.25 * (1 + Math.sin(t * 2.7));
  a.el.style.borderRadius = a.el.dataset.shape === 'circle' ? '50%' : '10px';
  a.el.style.boxShadow = `0 0 ${8 + wave * 14}px ${TONE.goldLight}${Math.round((0.22 + wave * 0.3) * 255).toString(16).padStart(2, '0')}, inset 0 0 0 1px rgba(230,200,120,${0.18 + wave * 0.28})`;
  a.el.style.opacity = String(0.6 + wave * 0.32 * strength);
}

function rectAround(x: number, y: number, w: number, h: number, pad = 10): AffShape {
  return { kind: 'rect', x: x - w / 2 - pad, y: y - h / 2 - pad, w: w + pad * 2, h: h + pad * 2 };
}

function setShapeIfChanged(cache: Map<Affordance, string>, a: Affordance, shape: AffShape) {
  const key = JSON.stringify(shape);
  if (cache.get(a) === key) return;
  cache.set(a, key);
  a.setShape(shape);
}

function doorRect(w: number, h: number): AffShape {
  const gy = h * 0.86;
  const wallH = Math.min(h * 0.46, w * (w < h ? 0.9 : 0.62));
  const dh = wallH * 0.8;
  const dw = dh * 0.64;
  return { kind: 'rect', x: w / 2 - dw / 2 - 12, y: gy - dh - 10, w: dw + 24, h: dh + 20 };
}

async function runThreshold(act: Parameters<Framework['run']>[0], ctx: Ctx) {
  const { stage, aff, lines, audio } = ctx;
  stage.removeLayer('reveal');
  stage.removeLayer('vignette');
  stage.removeLayer('vignette-window-glow');
  const layer = stage.layer('vignette', 20);
  const cast: RoomCast = makeRoomCast();
  const owned: Affordance[] = [];
  const shapeCache = new Map<Affordance, string>();
  let openedAt = 0;
  let doorHover = 0;
  let pickedAt = 0;
  let picked = false;
  let completed = false;
  let litCount = 0;
  let greetStarted = false;
  let greetRevealed = false;
  let ticketAff: Affordance | null = null;
  let dragLift = 0;
  let layout: ReturnType<typeof sceneRoom> | null = null;
  let visibleTicket = { x: stage.width / 2, y: stage.height * 0.65, w: 48 };
  const motion = stage.reducedMotion ? 0.25 : 1;

  const isExpanded = ctx.visit.n >= 2 || ctx.plan.intent.id === 'cafe-map';
  let station: 'oil' | 'directors' | 'shelf' | 'door' = 'oil';
  let oilPoured = ctx.store.get<boolean>('mentor.lamp.poured', false);
  let pourAnimStart = 0;
  let draftDismissed = ctx.store.get<boolean>('director.draft.dismissed', false);
  let inspectingDirectors = false;
  let worksList: WorkItem[] | null = (act.cafeMap?.works as WorkItem[]) ?? null;
  let selectedWork: WorkItem | null = worksList && worksList.length > 0 ? worksList[0]! : null;
  let exitDoorOpen = 0;
  let exitDoorPushedAt = 0;
  let oilAff: Affordance | null = null;
  let directorsAff: Affordance | null = null;
  let shelfAff: Affordance | null = null;
  let exitDoorAff: Affordance | null = null;

  if (isExpanded) {
    void loadWorksIndex((act.cafeMap?.works as WorkItem[]) ?? null).then((w) => {
      worksList = w;
      (window as any).__runsIndex = w;
      if (w && w.length > 0 && !selectedWork) selectedWork = w[0]!;
    });
  }

  const previous = ctx.visit.previous;
  const changes = prepareVisitChanges(ctx);
  const chronicle = mountChronicle(ctx);
  const books = mountBooks(ctx);
  (window as any).__books = books;
  const hypotheses = isExpanded ? getOrInitHypotheses(ctx.store, { previous, current: ctx.record }) : [];
  let readHypothesis = -1;
  let hypothesisHoverAt = 0;
  let hypothesisSaid = -1;
  const sayHypothesis = () => {
    const h = ctx.store.get<Hypothesis[]>('mentor.hypotheses', hypotheses)[readHypothesis];
    if (!h || !greetRevealed) return;
    hypothesisSaid = readHypothesis;
    lines.clear();
    void lines.say({ who: '导师', text: shortLine(h.text), anchor: () => layout?.mentor.top ?? { x: stage.width * .64, y: stage.height * .36 }, tone: 'mentor', sticky: true, source: { source: 'script' } });
  };
  const inspectHypothesis = () => { if (isExpanded && readHypothesis >= 0) sayHypothesis(); };
  stage.root.addEventListener('pointerdown', inspectHypothesis);
  let glance = 0;
  let pointer = { x: -1, y: -1 };
  let lastFrameAt = performance.now();
  const trackPointer = (e: PointerEvent) => {
    const rect = stage.root.getBoundingClientRect();
    pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const leavePointer = () => { pointer = { x: -1, y: -1 }; };
  stage.root.addEventListener('pointermove', trackPointer);
  stage.root.addEventListener('pointerleave', leavePointer);
  const previousEnding = ctx.store.get<Ending | null>('ending.last', null);
  const revisiting = !!previous?.ending && previousEnding?.id === previous.ending;
  const elapsedDays = Math.floor(ctx.visit.sinceMs / 86_400_000);
  const greet = changes[0]?.attribution ?? (revisiting && previousEnding
    ? shortLine(elapsedDays >= 1 ? previousEnding.echo.replaceAll('{days}', String(elapsedDays)) : previousEnding.mentorLine)
    : ctx.plan.director.rules.includes('first-loop-readable') ? '帮禾借点粟，让一家人过冬。'
      : lineText(ctx, 'greet', '来了，墨还没干。'));
  const doorAff = aff.add({
    id: 'door',
    label: '推门',
    shape: doorRect(stage.width, stage.height),
    key: 'Enter',
    represents: '推开通往机器的夜门',
    onHover(on) {
      doorHover = on ? 1 : 0;
      if (on) audio.sfx('hover', { gain: 0.24 });
    },
    onActivate() {
      if (openedAt) return;
      openedAt = performance.now();
      doorAff.setEnabled(false);
      if (isExpanded) doorAff.el.style.boxShadow = 'none';
      audio.unlock();
      audio.sfx('door-creak');
      audio.ambience('night', 0.18, 420);
    },
  });
  doorAff.el.dataset.pulse = 'breath';
  doorAff.el.setAttribute('aria-current', 'true');
  owned.push(doorAff);

  let resolveRun!: () => void;
  const done = new Promise<void>((resolve) => (resolveRun = resolve));
  const setTicketShape = () => {
    if (!ticketAff) return;
    setShapeIfChanged(shapeCache, ticketAff, rectAround(visibleTicket.x, visibleTicket.y, visibleTicket.w, visibleTicket.w * 2.4, 18));
  };
  const offResize = stage.onResize(() => {
    setShapeIfChanged(shapeCache, doorAff, doorRect(stage.width, stage.height));
    setTicketShape();
  });
  const triggerPick = () => {
    if (!ticketAff || picked) return;
    picked = true;
    ctx.record.skipped = (ctx.record.skipped ?? []).filter(id => id !== 'ticket');
    ctx.record.activated = [...new Set([...(ctx.record.activated ?? []), 'ticket'])];
    pickedAt = performance.now();
    ticketAff.setEnabled(false);
    audio.sfx('pickup');
    audio.sfx('shimmer', { gain: 0.2 });
  };

  const offFrame = stage.onFrame(() => {
    const w = stage.width;
    const h = stage.height;
    const now = performance.now();
    const frameMs = Math.min(100, now - lastFrameAt);
    lastFrameAt = now;
    const t = stage.time;
    const c = layer.ctx;
    layer.clear();

    if (!openedAt) {
      sceneDoor(c, w, h, t, { hover: doorHover, open: 0, omen: 0.28 });
      focusPulse(doorAff, t, stage.reducedMotion, 0.86);
      return;
    }

    const elapsed = Math.max(0, (now - openedAt) / 1000);
    const zoom = 1 + easeOut(clamp(elapsed / (0.92 * motion))) * 0.13;
    const doorMix = clamp(elapsed / (1.16 * motion));
    if (doorMix < 1) {
      c.save();
      c.translate(w / 2, h / 2);
      c.scale(zoom, zoom);
      c.translate(-w / 2, -h / 2);
      sceneDoor(c, w, h, t, { hover: 0, open: easeOut(clamp(elapsed / (0.78 * motion))), omen: 0.28 });
      c.restore();
    }

    const roomAlpha = easeOut(clamp((elapsed - 0.18 * motion) / (1.02 * motion)));
    const lights: number[] = Array(15).fill(0);
    const lightStart = 0.82 * motion;
    const lightStep = 0.34 * motion;
    const lampOrder = [0, 3, 6, 10, 14];
    while (litCount < 5 && elapsed >= lightStart + litCount * lightStep) {
      audio.sfx('lamp', { index: litCount, gain: 0.36 });
      litCount++;
    }
    for (let i = 0; i < litCount; i++) lights[lampOrder[i]!] = 1;

    const lookAt = 2.38 * motion;
    if (elapsed >= lookAt && cast.mentor.pose !== 'sit-look') updateMentorLook(cast.mentor, true);
    if (changes.length && elapsed >= lookAt && glance === 0) {
      cast.mentor.setGaze(changes[0]!.place === 'lamp' ? -0.85 : 0.75);
      glance = 1;
    } else if (glance === 1 && elapsed >= lookAt + 1.1 * motion) {
      cast.mentor.setGaze(null); glance = 2;
    }
    if (isExpanded && litCount >= 5) cast.mentor.setGaze(station === 'oil' ? -.85 : station === 'directors' ? -.4 : .8);
    const write = clamp(elapsed / (0.9 * motion));
    const ticketPush = easeOut(clamp((elapsed - 2.54 * motion) / (0.76 * motion)));
    const lift = picked ? clamp((now - pickedAt) / (260 * motion)) : dragLift;
    c.save();
    c.globalAlpha = roomAlpha;
    layout = sceneRoom(c, w, h, t, cast, {
      lit: lights,
      write,
      ticketPush,
      ticketGlow: 0.18 + Math.sin(t * 1.8) * 0.08 + (picked ? 0.72 : 0),
      ticketLift: lift,
    });
    const ticketW = Math.max(layout.ticket.w, Math.min(w * 0.065, h * 0.11));
    const painted = isExpanded ? layout.ticket : paintTicket(c, layout.ticket.x, layout.ticket.y, ticketW, {
      lift,
      glow: 0.22 + Math.sin(t * 1.8) * 0.08 + (picked ? 0.72 : 0),
      t,
      glyph: '旱',
      write: 1,
    });
    if (litCount >= 5) {
      const seatSize = Math.min(h * 0.17, w * 0.18);
      drawSeat(c, w * 0.17, h * 0.94, seatSize);
      drawSmallLamp(c, w * currentLampX(ctx), h * 0.94 - seatSize * 0.08, seatSize * 0.82, t);
      if (!isExpanded) {
        chronicle.draw(c, w, h, elapsed > 4 && greetRevealed);
        books.draw(c, w, h, elapsed > 4 && greetRevealed);
      }
      const head = cast.mentor.anchors.head;
      if (document.visibilityState === 'visible' && Math.abs(pointer.x - head.x) < seatSize * 0.65 && pointer.y > head.y - seatSize * 0.2 && pointer.y < head.y + seatSize * 1.6) {
        ctx.record.dwell.mentor = Math.round((ctx.record.dwell.mentor ?? 0) + frameMs);
      }
    }
    c.restore();
    visibleTicket = { x: painted.x, y: painted.y, w: ticketW };

    if (isExpanded && litCount >= 5) {
      const floorY = h * 0.7;
      const oilX = w * 0.22;
      const oilY = floorY + h * 0.04;
      const oilS = Math.min(w * 0.24, h * 0.27);

      const dirX = w * 0.44;
      const dirY = floorY + h * 0.03;
      const dirS = Math.min(w * 0.22, h * 0.24);

      const shelfX = w * 0.68;
      const shelfY = floorY - h * 0.30;
      const shelfW = Math.min(w * 0.125, 175);
      const shelfH = Math.min(h * 0.32, 220);

      const doorStationX = w * 0.89;
      const doorStationY = floorY + h * 0.01;
      const doorStationW = Math.min(h * 0.26, w * 0.22);
      const doorStationH = Math.min(h * 0.46, w * 0.38);

      const pourProgress = pourAnimStart ? clamp((now - pourAnimStart) / 450) : (oilPoured ? 1 : 0);
      if (exitDoorPushedAt) exitDoorOpen = clamp((now - exitDoorPushedAt) / (400 * motion));

      const rackX = oilX - oilS * .48, rackY = oilY - oilS * .25 - oilS * .0504 - oilS * .305;
      const near = pointer.x >= rackX && pointer.x <= rackX + oilS * .31 && pointer.y >= rackY && pointer.y <= rackY + oilS * .34;
      const hi = near ? Math.min(hypotheses.length - 1, Math.max(0, Math.floor((pointer.x - rackX - oilS * .035) / (oilS * .057)))) : -1;
      if (hi !== readHypothesis) { readHypothesis = hi; hypothesisHoverAt = now; hypothesisSaid = -1; }
      if (hi >= 0 && hypothesisSaid !== hi && now - hypothesisHoverAt >= 800) sayHypothesis();
      drawOilStation(c, oilX, oilY, oilS, t, {
        poured: oilPoured,
        pourProgress,
        budgetLamp: ctx.store.get<Record<string, number>>('mentor.lamps', {})[ctx.plan.intent.id]
          ?? (ctx.layers.letters().find(letter => letter.kind === 'commission')?.payload as any)?.budget?.lamp ?? 1,
        lampX: currentLampX(ctx),
        active: station === 'oil' || !!oilAff?.hovering,
        hypotheses: ctx.store.get<Hypothesis[]>('mentor.hypotheses', hypotheses),
      });
      drawDirectorStation(c, dirX, dirY, dirS, t, {
        dismissed: draftDismissed,
        inspecting: inspectingDirectors,
        active: station === 'directors' || !!directorsAff?.hovering,
        forms: ['base', 'shuheng'].map(id => worksList?.find(w => w.director === id)?.form ?? ctx.plan.intent.form),
      });
      drawShelfStation(c, shelfX, shelfY, shelfW, shelfH, t, {
        works: worksList,
        selectedIndex: selectedWork && worksList ? worksList.indexOf(selectedWork) : -1,
        active: station === 'shelf' || !!shelfAff?.hovering,
      });
      drawDoorStation(c, doorStationX, doorStationY, doorStationW, doorStationH, t, {
        open: exitDoorOpen,
        active: station === 'door',
        hasUrl: Boolean(selectedWork?.url),
      });
    }

    if (!greetStarted && elapsed >= lookAt && litCount >= 5) {
      greetStarted = true;
      const anchor = () => layout?.mentor.top ?? { x: stage.width * 0.64, y: stage.height * 0.36 };
      void lines.say({ who: '导师', text: greet, anchor, tone: 'mentor', sticky: true, source: { source: 'script' }, holdMs: 4000 }).then(() => {
        greetRevealed = true;
      });
    }

    if (!isExpanded) {
      if (!ticketAff && elapsed >= 3.05 * motion && greetRevealed && layout) {
        ctx.record.skipped = [...new Set([...(ctx.record.skipped ?? []), 'ticket'])];
        ticketAff = aff.add({
          id: 'ticket',
          label: '拿起票根',
          shape: rectAround(visibleTicket.x, visibleTicket.y, visibleTicket.w, visibleTicket.w * 2.4, 18),
          key: 'Enter',
          represents: '拿起写着旱字的帛票根',
          onActivate: triggerPick,
          onDrag(e: DragEvent) {
            if (e.phase === 'start') dragLift = 0.12;
            else if (e.phase === 'move') dragLift = clamp(Math.max(0.12, -e.dy / Math.max(30, stage.height * 0.12)), 0, 0.82);
            else {
              if (e.dy < -14) triggerPick();
              else dragLift = 0;
            }
          },
        });
        ticketAff.el.dataset.pulse = 'breath';
        ticketAff.el.setAttribute('aria-current', 'true');
        owned.push(ticketAff);
      }

      if (ticketAff) {
        setTicketShape();
        focusPulse(ticketAff, t, stage.reducedMotion, 0.8);
      }

      if (picked && now - pickedAt >= 300 * motion && !completed) {
        completed = true;
        ctx.handoff.frame = copyCanvas(layer.canvas);
        ctx.handoff.ticket = { ...visibleTicket };
        lines.clear();
        audio.ambience('city', 0.12, 700);
        resolveRun();
      }
    } else {
      // isExpanded: 四站按序导引展开
      const floorY = h * 0.7;
      const oilX = w * 0.22;
      const oilY = floorY + h * 0.04;
      const oilS = Math.min(w * 0.24, h * 0.27);

      const dirX = w * 0.44;
      const dirY = floorY + h * 0.03;
      const dirS = Math.min(w * 0.22, h * 0.24);

      const shelfX = w * 0.68;
      const shelfY = floorY - h * 0.30;
      const shelfW = Math.min(w * 0.125, 175);
      const shelfH = Math.min(h * 0.32, 220);

      const doorStationX = w * 0.89;
      const doorStationY = floorY + h * 0.01;
      const doorStationW = Math.min(h * 0.26, w * 0.22);
      const doorStationH = Math.min(h * 0.46, w * 0.38);

      const unlockDoor = () => {
        if (exitDoorAff) return;
        exitDoorAff = aff.add({
          id: 'door',
          label: '推门进入',
          shape: rectAround(doorStationX, doorStationY - doorStationH / 2, doorStationW, doorStationH, 16),
          key: 'Enter',
          represents: '推门：新标签页进入作品',
          onActivate() {
            if (exitDoorPushedAt) return;
            exitDoorPushedAt = performance.now();
            exitDoorOpen = 0.2;
            exitDoorAff?.setEnabled(false);
            audio.sfx('door-creak');
            if (selectedWork?.url) {
              try { window.open(selectedWork.url, '_blank'); } catch {}
            }
            void lines.say({
              who: '导师',
              text: selectedWork?.url ? '门开了，走吧。' : '这件还没开门。',
              anchor: () => ({ x: doorStationX, y: doorStationY - doorStationH * 0.5 }),
              tone: 'mentor',
              sticky: true,
              source: { source: 'script' },
            });
          },
        });
        exitDoorAff.el.dataset.pulse = 'breath';
        exitDoorAff.el.setAttribute('aria-current', 'true');
        owned.push(exitDoorAff);
      };

      const unlockShelf = () => {
        if (shelfAff) return;
        shelfAff = aff.add({
          id: 'shelf',
          label: '翻看作品架',
          shape: rectAround(shelfX + shelfW / 2, shelfY + shelfH / 2, shelfW, shelfH, 12),
          key: '3',
          represents: '作品架：作品与盖印状态',
          onActivate() {
            audio.sfx('hover');
            if (!worksList || worksList.length === 0) {
              void lines.say({
                who: '导师',
                text: '架子还空着。',
                anchor: () => ({ x: shelfX + shelfW / 2, y: shelfY - 10 }),
                tone: 'mentor',
                sticky: true,
                source: { source: 'script' },
              });
            } else {
              selectedWork = worksList[0]!;
              ctx.handoff.selectedWork = selectedWork;
              void lines.say({
                who: '导师',
                text: '选了这件，推门便能进去。',
                anchor: () => ({ x: shelfX + shelfW / 2, y: shelfY - 10 }),
                tone: 'mentor',
                sticky: true,
                source: { source: 'script' },
              });
            }
            station = 'door';
            shelfAff?.setEnabled(false);
            unlockDoor();
          },
        });
        shelfAff.el.dataset.workCount = String(worksList?.length ?? 0);
        shelfAff.el.setAttribute('aria-description', worksList?.length ? `${worksList.length} 件作品，朱印表示已盖印，麻绳表示毛坯。` : '空架上只有白简和薄尘。');
        shelfAff.el.dataset.pulse = 'breath';
        shelfAff.el.setAttribute('aria-current', 'true');
        owned.push(shelfAff);
      };

      const unlockDirectors = () => {
        if (directorsAff) return;
        directorsAff = aff.add({
          id: 'directors',
          label: '看工作台',
          shape: rectAround(dirX, dirY - dirS * 0.1, dirS * 1.1, dirS * 0.6, 14),
          key: '2',
          represents: '导演廊：看基础导演与叔衡的工作台与毛坯',
          onActivate() {
            inspectingDirectors = true;
            audio.sfx('hover');
            void lines.say({
              who: '导师',
              text: '基础导演与叔衡，草稿钉在墙上。',
              anchor: () => ({ x: dirX, y: dirY - dirS * 0.3 }),
              tone: 'mentor',
              sticky: true,
              source: { source: 'script' },
            });
            station = 'shelf';
            directorsAff?.setEnabled(false);
            unlockShelf();
          },
        });
        directorsAff.el.dataset.pulse = 'breath';
        directorsAff.el.setAttribute('aria-current', 'true');
        owned.push(directorsAff);
      };

      if (!oilAff && elapsed >= 3.05 * motion && greetRevealed && layout) {
        oilAff = aff.add({
          id: 'lamp-oil',
          label: '倒油',
          shape: rectAround(oilX, oilY - oilS * 0.1, oilS * 0.9, oilS * 0.6, 12),
          key: '1',
          represents: '灯油台：倒油（调整各世界/作品份额）',
          onActivate() {
            oilPoured = true;
            pourAnimStart = performance.now();
            ctx.store.set('mentor.lamp.poured', true);
            ctx.store.set('mentor.lamps', { ...ctx.store.get<Record<string, number>>('mentor.lamps', {}), [ctx.plan.intent.id]: 1.6, 'han-act1': .8 });
            audio.sfx('lamp', { index: 2, gain: 0.4 });
            void lines.say({
              who: '导师',
              text: '分了油，这盏就亮些。',
              anchor: () => ({ x: oilX, y: oilY - oilS * 0.3 }),
              tone: 'mentor',
              sticky: true,
              source: { source: 'script' },
            });
            station = 'directors';
            oilAff?.setEnabled(false);
            unlockDirectors();
          },
        });
        oilAff.el.dataset.pulse = 'breath';
        oilAff.el.setAttribute('aria-current', 'true');
        owned.push(oilAff);
      }

      if (station === 'oil' && oilAff) {
        setShapeIfChanged(shapeCache, oilAff, rectAround(oilX, oilY - oilS * 0.1, oilS * 0.9, oilS * 0.6, 12));
        oilAff.el.setAttribute('aria-current', 'true');
        oilAff.el.style.boxShadow = 'none';
      } else if (station === 'directors' && directorsAff) {
        setShapeIfChanged(shapeCache, directorsAff, rectAround(dirX, dirY - dirS * 0.1, dirS * 1.1, dirS * 0.6, 14));
        directorsAff.el.setAttribute('aria-current', 'true');
        directorsAff.el.style.boxShadow = 'none';
      } else if (station === 'shelf' && shelfAff) {
        setShapeIfChanged(shapeCache, shelfAff, rectAround(shelfX + shelfW / 2, shelfY + shelfH / 2, shelfW, shelfH, 12));
        shelfAff.el.setAttribute('aria-current', 'true');
        shelfAff.el.style.boxShadow = 'none';
      } else if (station === 'door' && exitDoorAff) {
        setShapeIfChanged(shapeCache, exitDoorAff, rectAround(doorStationX, doorStationY - doorStationH / 2, doorStationW, doorStationH, 16));
        exitDoorAff.el.setAttribute('aria-current', 'true');
        exitDoorAff.el.style.boxShadow = 'none';
      }

      if (exitDoorPushedAt && now - exitDoorPushedAt >= 320 * motion && !completed) {
        completed = true;
        ctx.handoff.frame = copyCanvas(layer.canvas);
        lines.clear();
        audio.ambience('night', 0.1, 600);
        resolveRun();
      }
    }
  });

  try {
    await done;
  } finally {
    offFrame();
    offResize();
    stage.root.removeEventListener('pointerdown', inspectHypothesis);
    stage.root.removeEventListener('pointermove', trackPointer);
    stage.root.removeEventListener('pointerleave', leavePointer);
    chronicle.remove();
    books.remove();
    for (const a of owned) a.remove();
  }
  return { act: act.id, data: { affordances: isExpanded ? ['door', 'lamp-oil', 'directors', 'shelf'] : ['door', 'ticket'], ticket: ctx.handoff.ticket, frame: Boolean(ctx.handoff.frame) } };
}

function returnPlaceLine(placeRaw: string, durationMs: number) {
  const names: Record<string, string> = { gate: '田伯门口', field: '东郊', well: '井边', home: '家', altar: '社树下', road: '路口' };
  const place = names[placeRaw] ?? [...placeRaw.trim()].slice(0, 8).join('');
  const howLong = durationMs >= 60_000 ? '很久' : '一会儿';
  return shortLine(`叔衡说，你上回在${place}停了${howLong}。`);
}

async function runReturn(act: Parameters<Framework['run']>[0], ctx: Ctx) {
  const { stage, aff, lines, audio, store } = ctx;
  stage.removeLayer('vignette');
  stage.removeLayer('reveal');
  stage.removeLayer('vignette-return-input');
  stage.removeLayer('vignette-window-glow');
  const layer = stage.layer('vignette', 30);
  const mentor = makeMentor();
  const previous = ctx.visit.previous;
  prepareVisitChanges(ctx);
  const chronicle = mountChronicle(ctx);
  const books = mountBooks(ctx);
  const priorEnding = store.get<Ending | null>('ending.last', null);
  const ending = ctx.handoff.ending as Ending | undefined;
  const world = ctx.handoff.world;
  if (ending) {
    ctx.record.ending = ending.id;
    ctx.record.endingFact = ending.fact.text;
    store.set('ending.last', ending);
  }
  const elapsedDays = Math.floor(ctx.visit.sinceMs / 86_400_000);
  const echo = previous && priorEnding && priorEnding.id === previous.ending
    ? shortLine(elapsedDays >= 1 ? priorEnding.echo.replaceAll('{days}', String(elapsedDays)) : priorEnding.mentorLine)
    : '';
  const priorPlace = previous?.longestPlace ? returnPlaceLine(previous.longestPlace, previous.longestPlaceMs ?? 0) : '';
  const priorFrame = ctx.handoff.frame instanceof HTMLCanvasElement ? ctx.handoff.frame : null;
  const ticketStart = ctx.handoff.ticket as { x: number; y: number; w: number } | undefined;
  const owned: Affordance[] = [];
  const shapeCache = new Map<Affordance, string>();
  const nativeLayer = stage.dom('vignette-return-input', 70);
  const input = document.createElement('input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.maxLength = 20;
  input.readOnly = true;
  input.value = ctx.record.name ?? '';
  input.setAttribute('aria-label', '称呼，可留空');
  input.dataset.aff = 'name-text';
  input.style.cssText = 'position:absolute;box-sizing:border-box;pointer-events:none;background:transparent;border:0;outline:0;color:#1a110c;font:500 clamp(18px,2vw,24px) "Noto Serif SC","Songti SC",serif;letter-spacing:.12em;text-align:center;padding:2px 12px;visibility:hidden;';
  nativeLayer.appendChild(input);

  let layout: ReturnLayout | null = null;
  let inputAff: Affordance | null = null;
  let penAff: Affordance | null = null;
  let doorAff: Affordance | null = null;
  let forgetAff: Affordance | null = null;
  let inputReady = false;
  let nameResolved = false;
  let forgetting = false;
  let forgettingAt = 0;
  let lampForgotten = false;
  let closingAt = 0;
  let doorClosed = false;
  let sealedDone = false;
  let doorDone = false;
  let resolveRun!: () => void;
  let resolveName: ((name: string | null) => void) | null = null;
  let resolveClose: (() => void) | null = null;
  let resolveSealed!: () => void;
  const sealed = new Promise<void>((resolve) => (resolveSealed = resolve));
  const done = new Promise<void>((resolve) => (resolveRun = resolve));
  const motion = stage.reducedMotion ? 0.25 : 1;
  const startAt = performance.now();
  const mentorLine = ending?.mentorLine ? shortLine(ending.mentorLine) : '这一程，记在这里。';
  const askName = lineText(ctx, 'ask-name', '怎么称呼你？');
  const thread = lineText(ctx, 'thread', '季那边，听说也有人敲门。');

  const cornerTicket = () => ({ x: stage.width * 0.88, y: stage.height * 0.84, w: Math.max(18, Math.min(stage.width * 0.055, stage.height * 0.075)) });
  const resizeControls = () => {
    if (!layout) return;
    const r = layout.nameField;
    input.style.left = `${r.x}px`;
    input.style.top = `${r.y}px`;
    input.style.width = `${r.w}px`;
    input.style.height = `${r.h}px`;
    if (inputAff) setShapeIfChanged(shapeCache, inputAff, { kind: 'rect', ...r });
    if (penAff) setShapeIfChanged(shapeCache, penAff, { kind: 'rect', ...layout.pen });
    if (forgetAff) setShapeIfChanged(shapeCache, forgetAff, { kind: 'circle', x: layout.seatLamp.x, y: layout.seatLamp.y, r: Math.max(22, layout.seatLamp.r) });
    if (doorAff) setShapeIfChanged(shapeCache, doorAff, { kind: 'rect', ...layout.door });
  };
  const offResize = stage.onResize(resizeControls);

  const finishName = (value: string | null) => {
    if (!inputReady || nameResolved) return;
    nameResolved = true;
    const trimmed = value?.trim() ?? '';
    ctx.record.name = trimmed || undefined;
    input.readOnly = true;
    input.style.visibility = 'hidden';
    inputAff?.remove();
    penAff?.remove();
    resolveName?.(trimmed || null);
  };
  const onInputKey = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      if (inputAff) inputAff.el.click();
      else finishName(input.value);
    } else if (event.key === 'Escape' && penAff) {
      event.preventDefault();
      event.stopPropagation();
      penAff.el.click();
    }
  };
  input.addEventListener('keydown', onInputKey);

  const offFrame = stage.onFrame(() => {
    const w = stage.width;
    const h = stage.height;
    const now = performance.now();
    const elapsed = (now - startAt) / 1000;
    const travel = easeOut(clamp(elapsed / (1.35 * motion)));
    const seal = easeOut(clamp((elapsed - 1.42 * motion) / (0.7 * motion)));
    if (seal >= 1 && !sealedDone) {
      sealedDone = true;
      audio.sfx('seal');
      mentor.setPose('sit-look', 420);
      resolveSealed();
    }

    layer.clear();
    const c = layer.ctx;
    c.fillStyle = '#120d0b';
    c.fillRect(0, 0, w, h);
    if (priorFrame && travel < 1) {
      c.save();
      c.globalAlpha = 1 - travel;
      c.drawImage(priorFrame, 0, 0, w, h);
      c.restore();
    }

    const transfer = closingAt ? easeOut(clamp((now - closingAt) / (0.62 * motion))) : 0;
    const corner = cornerTicket();
    const deskX = layout?.ticket.x ?? w * 0.55;
    const deskY = layout?.ticket.y ?? h * 0.81;
    const deskW = Math.max(26, Math.min(w * 0.1, h * 0.14));
    const startW = ticketStart?.w ?? deskW;
    const movingW = lerp(lerp(startW, deskW, travel), corner.w, transfer);
    const fromX = ticketStart?.x ?? w * 0.62;
    const fromY = ticketStart?.y ?? h * 0.62;
    const xAfterTravel = lerp(fromX, deskX, travel);
    const yAfterTravel = lerp(fromY, deskY, travel);
    const ticketX = lerp(xAfterTravel, corner.x, transfer);
    const ticketY = lerp(yAfterTravel, corner.y, transfer);
    c.save();
    c.globalAlpha = priorFrame ? travel : 1;
    layout = drawReturnScene(c, w, h, mentor, {
      t: stage.time,
      revisiting: !!previous,
      doorOpen: closingAt ? 0.72 * (1 - transfer) : 0.72,
      ticketX,
      ticketY,
      ticketW: movingW,
      ticketOpacity: 0,
      ticketGlow: 0,
      ticketLift: 0,
      seal,
      nameEntry: inputReady && !nameResolved,
      showSlips: !!previous,
      lampDim: lampForgotten,
      lampX: currentLampX(ctx),
      cornerTicket: 0,
    });
    c.restore();
    // 年谱是追问入口：等主线可关门后再开放，不抢走问称呼时唯一的动作。
    if (!ctx.handoff.forgetVisit) {
      chronicle.draw(c, w, h, elapsed > 3 && !!doorAff);
      books.draw(c, w, h, elapsed > 3 && !!doorAff);
    }
    paintTicket(c, ticketX, ticketY, movingW, { lift: 0, glow: 0.22 + (seal >= 1 ? 0.28 : 0), seal, glyph: '旱', flat: 0, t: stage.time, write: 1 });

    if (inputReady && !nameResolved) {
      resizeControls();
      if (elapsed >= 3 * motion && !penAff && layout) {
        penAff = aff.add({ id: 'pen', label: '放下笔，跳过称呼', shape: { kind: 'rect', ...layout.pen }, represents: '不留下称呼', onActivate: () => finishName(input.value) });
        owned.push(penAff);
      }
      if (inputAff) focusPulse(inputAff, stage.time, stage.reducedMotion, 0.75);
    }
    if (forgetting && now - forgettingAt > 6500) {
      forgetting = false;
      forgetAff?.setLabel('吹灭座旁灯，忘掉本机记忆');
    }
    if (forgetAff && layout && !lampForgotten) {
      setShapeIfChanged(shapeCache, forgetAff, { kind: 'circle', x: layout.seatLamp.x, y: layout.seatLamp.y, r: Math.max(22, layout.seatLamp.r) });
      if (forgetting) focusPulse(forgetAff, stage.time, stage.reducedMotion, 1.05);
      else forgetAff.el.style.boxShadow = `0 0 ${5 + (stage.reducedMotion ? 0 : Math.sin(stage.time * 2) * 2)}px rgba(201,162,74,.3)`;
    }
    if (doorAff && layout) {
      setShapeIfChanged(shapeCache, doorAff, { kind: 'rect', ...layout.door });
      focusPulse(doorAff, stage.time, stage.reducedMotion, 0.85);
    }
    if (closingAt && transfer >= 1 && !doorDone) {
      doorDone = true;
      doorClosed = true;
      ctx.handoff.ticket = corner;
      ctx.handoff.frame = copyCanvas(layer.canvas);
      leaveWindowLight(stage);
      resolveClose?.();
      resolveRun();
    }
  });

  const say = async (who: string, text: string) => {
    await lines.say({ who, text: shortLine(text), anchor: () => layout?.mentor ?? { x: stage.width * 0.66, y: stage.height * 0.35 }, tone: 'mentor', sticky: true, holdMs: 3200, source: { source: 'script' } });
  };
  const dialogue = async () => {
    await sealed;
    await say('导师', mentorLine);
    await say('导师', askName);
    if (performance.now() - startAt < 3000) {
      await new Promise<void>(resolve => {
        const off = stage.onFrame(() => {
          if (performance.now() - startAt < 3000) return;
          off();
          resolve();
        });
      });
    }
    inputReady = true;
    input.style.visibility = 'visible';
    const field = layout?.nameField;
    if (field) {
      inputAff = aff.add({
        id: 'name',
        label: '写下称呼',
        shape: { kind: 'rect', ...field },
        key: 'Enter',
        represents: '在帛上写下称呼，可留空',
        onActivate() {
          if (nameResolved) return;
          if (document.activeElement === input) finishName(input.value);
          else {
            input.readOnly = false;
            input.focus();
          }
        },
      });
      inputAff.el.dataset.pulse = 'breath';
      inputAff.el.setAttribute('aria-current', 'true');
      owned.push(inputAff);
      resizeControls();
    }
    const name = await new Promise<string | null>((resolve) => (resolveName = resolve));
    if (name) ctx.record.name = name;

    if (previous) {
      if (echo) await say('导师', echo);
      if (priorPlace) await say('导师', priorPlace);
    }
    await say('导师', thread);

    const closeDone = new Promise<void>((resolve) => (resolveClose = resolve));
    doorAff = aff.add({
      id: 'door',
      label: '关门',
      shape: layout ? { kind: 'rect', ...layout.door } : doorRect(stage.width, stage.height),
      key: 'Enter',
      represents: '关门，带着未完的线离开',
      onActivate() {
        if (closingAt) return;
        closingAt = performance.now();
        doorAff?.setEnabled(false);
        forgetAff?.setEnabled(false);
        audio.sfx('door-close');
        audio.ambience('night', 0.08, 600);
      },
    });
    owned.push(doorAff);

    const lamp = layout?.seatLamp;
    if (lamp) {
      forgetAff = aff.add({
        id: 'seat-lamp',
        label: '吹灭座旁灯，忘掉本机记忆',
        shape: { kind: 'circle', x: lamp.x, y: lamp.y, r: Math.max(22, lamp.r) },
        represents: '咖啡厅里二次确认后清除本机来访记忆',
        onActivate() {
          if (lampForgotten || closingAt) return;
          const now = performance.now();
          if (!forgetting || now - forgettingAt > 6500) {
            forgetting = true;
            forgettingAt = now;
            forgetAff?.setLabel('再吹一次，清除本机记忆');
            audio.sfx('hover', { gain: 0.36 });
            void lines.say({ who: '导师', text: '再吹一次，便忘掉这段相识。', anchor: () => layout?.seatLamp ?? { x: stage.width * 0.3, y: stage.height * 0.8 }, tone: 'mentor', sticky: true, source: { source: 'script' } });
            return;
          }
          lampForgotten = true;
          forgetting = false;
          ctx.handoff.forgetVisit = true;
          store.forget();
          ctx.record.name = undefined;
          delete ctx.record.ending;
          delete ctx.record.endingFact;
          delete ctx.record.longestPlace;
          delete ctx.record.longestPlaceMs;
          ctx.record.dwell = {};
          ctx.record.changes = [];
          delete ctx.record.skipped;
          delete ctx.record.activated;
          chronicle.remove();
          forgetAff?.setEnabled(false);
          audio.sfx('wind-gust');
          void lines.say({ who: '导师', text: '灯灭了，旧事不再留存。', anchor: () => layout?.seatLamp ?? { x: stage.width * 0.3, y: stage.height * 0.8 }, tone: 'mentor', sticky: true, source: { source: 'script' } });
        },
      });
      owned.push(forgetAff);
    }
    await closeDone;
  };

  let dialogueError: unknown;
  void dialogue().catch((err) => {
    dialogueError = err;
    resolveRun();
  });
  try {
    await done;
  } finally {
    offFrame();
    offResize();
    input.removeEventListener('keydown', onInputKey);
    chronicle.remove();
    books.remove();
    stage.removeLayer('vignette-return-input');
    for (const a of owned) a.remove();
    lines.clear();
  }
  if (dialogueError) throw dialogueError;
  return { act: act.id, data: { affordances: ['name', 'pen', 'seat-lamp', 'door'], ending: ending?.id, world: Boolean(world), echo: Boolean(echo), memoryForgotten: lampForgotten } };
}

export const vignette: Framework = {
  async run(act, ctx) {
    if (act.id === 'return') return runReturn(act, ctx);
    return runThreshold(act, ctx);
  },
};
