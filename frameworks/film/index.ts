import type { Framework } from '../../app/context';
import type { Affordance } from '../../engine/affordance';
import type { SfxName } from '../../engine/audio-api';
import type { Shot } from '../../engine/types';
import he from '../../assets/library/three-look-at-sky/shots/shot-01-he.png?url';
import sky from '../../assets/library/three-look-at-sky/shots/shot-02-sky.png?url';
import ji from '../../assets/library/three-look-at-sky/shots/shot-03-ji.png?url';
import tianbo from '../../assets/library/three-look-at-sky/shots/shot-04-tianbo.png?url';
import city from '../../assets/library/three-look-at-sky/shots/shot-05-city.png?url';

const images: Record<string, string> = Object.fromEntries([['01-he', he], ['02-sky', sky], ['03-ji', ji], ['04-tianbo', tianbo], ['05-city', city]].map(([id, url]) => [`three-look-at-sky/shots/shot-${id}.png`, url]));
const sounds = new Set<SfxName>(['soil', 'wind-gust', 'brush', 'gate-open', 'crowd']);

/** Playback has no RNG, model, or subtitle dependency. A hotspot can pause once per shot. */
export const film: Framework = {
  async run(act, ctx) {
    const shots = act.shots ?? [];
    if (!shots.length) throw new Error('film requires a shot table');
    const layer = ctx.stage.dom('film', 10);
    layer.style.background = '#15130f';
    const frame = document.createElement('div');
    frame.style.cssText = 'position:absolute;overflow:hidden;box-shadow:0 0 70px #0009;background:#242016';
    const image = document.createElement('img');
    image.alt = ''; // The spoken sentence and affordance supply the accessible content.
    image.draggable = false;
    image.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;will-change:transform';
    const glow = document.createElement('div');
    glow.style.cssText = 'position:absolute;inset:0;box-shadow:inset 0 0 0 0 #c29248;pointer-events:none';
    const marker = document.createElement('div');
    marker.style.cssText = 'position:absolute;box-sizing:border-box;border:1px solid #f0d79a90;border-radius:50%;background:#b78e3920;pointer-events:none';
    frame.append(image, marker, glow); layer.append(frame);
    let hotspotIndex = 0;
    let heldProgress: number | null = null;
    let index = 0, elapsed = 0, pause = 0, hit = false, pulse = 0;
    let active: Affordance | undefined;
    let current: Shot = shots[0]!;
    const clicked: string[] = [];
    let geometry = { left: 0, top: 0, w: 1, h: 1, scale: 1, dx: 0, dy: 0 };
    const anchor = () => ({ x: ctx.stage.width * (index % 2 ? 0.57 : 0.43), y: ctx.stage.height * (ctx.stage.narrow ? 0.84 : 0.91) });
    const say = (text: string, who = current.who ?? '') => {
      void ctx.lines.say({ who, text, anchor, width: () => ctx.stage.width * 0.8, ink: 'light', tone: 'narration', charMs: 0, sticky: true });
    };
    function layout() {
      const w = ctx.stage.width * 0.94, h = ctx.stage.height * 0.78;
      const ratio = image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : 1.5;
      const fw = Math.min(w, h * ratio), fh = fw / ratio;
      geometry = { ...geometry, left: (ctx.stage.width - fw) / 2, top: (ctx.stage.height * 0.84 - fh) / 2, w: fw, h: fh };
      Object.assign(frame.style, { left: `${geometry.left}px`, top: `${geometry.top}px`, width: `${fw}px`, height: `${fh}px` });
    }
    image.onload = layout;
    const start = () => {
      current = shots[index]!; elapsed = 0; pause = 0; hit = false; pulse = 0; heldProgress = null;
      active?.remove();
      image.src = images[current.image] ?? '';
      if (!images[current.image]) throw new Error(`Unbundled film image: ${current.image}`);
      layout();
      ctx.bus.log('world.event', { kind: 'film.shot', id: current.id, index, ms: current.ms, image: current.image, who: current.who });
      if (current.text) say(current.text); else ctx.lines.clear();
      if (sounds.has(current.sound as SfxName)) ctx.audio.sfx(current.sound as SfxName);
      hotspotIndex = 0;
      showHotspot();
    };
    const showHotspot = () => {
      const hotspot = current.hotspots?.[hotspotIndex];
      marker.style.display = hotspot ? '' : 'none';
      if (hotspot) active = ctx.aff.add({
        id: `film-${hotspot.id}`, label: '碰画中物', represents: hotspot.represents,
        shape: { kind: 'circle', x: ctx.stage.width * hotspot.x, y: ctx.stage.height * hotspot.y, r: 32 },
        onHover(on) {
          if (on) heldProgress = elapsed / current.ms;
          else if (!hit) heldProgress = null;
        },
        onActivate() {
          if (hit) return;
          hit = true; pause = 1200; pulse = 1;
          clicked.push(hotspot.id); active?.remove();
          glow.style.boxShadow = 'inset 0 0 0 10px #d3ac68';
          marker.style.background = '#e0b35bb0';
          ctx.audio.unlock(); ctx.audio.sfx('pickup');
          if (sounds.has(current.sound as SfxName)) ctx.audio.sfx(current.sound as SfxName);
          say(hotspot.represents, current.who);
          ctx.bus.log('world.event', { kind: 'film.hotspot', shot: current.id, id: hotspot.id, pauseMs: 1200 });
        },
      });
    };
    start();
    const offResize = ctx.stage.onResize(layout);
    return await new Promise(resolve => {
      const off = ctx.stage.onFrame((_t, dt) => {
        if (pause > 0) {
          pause = Math.max(0, pause - dt * 1000);
          if (!pause) {
            heldProgress = null;
            if (current.text) say(current.text);
            if (hotspotIndex + 1 < (current.hotspots?.length ?? 0)) {
              hotspotIndex++; hit = false; marker.style.background = '#b78e3920'; showHotspot();
            }
          }
        } else elapsed += dt * 1000;
        const p = Math.min(1, heldProgress ?? elapsed / current.ms);
        let scale = 1.04, dx = 0, dy = 0;
        if (!ctx.stage.reducedMotion) {
          if (current.move === 'zoom-in') scale = 1 + p * 0.07;
          if (current.move === 'zoom-out') scale = 1.07 - p * 0.07;
          if (current.move === 'pan-left') dx = (0.5 - p) * geometry.w * 0.035;
          if (current.move === 'pan-right') dx = (p - 0.5) * geometry.w * 0.035;
          if (current.move === 'tilt-up') dy = (p - 0.5) * geometry.h * 0.035;
        } else scale = 1;
        geometry = { ...geometry, scale, dx, dy };
        image.style.transform = `translate(${dx}px,${dy}px) scale(${scale})`;
        const hotspot = current.hotspots?.[hotspotIndex];
        if (hotspot) {
          const x = geometry.w / 2 + (hotspot.x - 0.5) * geometry.w * scale + dx;
          const y = geometry.h / 2 + (hotspot.y - 0.5) * geometry.h * scale + dy;
          const r = Math.max(24, hotspot.r * Math.min(geometry.w, geometry.h) * scale);
          Object.assign(marker.style, { left: `${x - r}px`, top: `${y - r}px`, width: `${r * 2}px`, height: `${r * 2}px`, opacity: hit ? String(pulse) : '0.75' });
          active?.setShape({ kind: 'circle', x: geometry.left + x, y: geometry.top + y, r });
        }
        if (pulse > 0 && !pause) { pulse = Math.max(0, pulse - dt * 3); glow.style.boxShadow = `inset 0 0 0 ${pulse * 10}px #d3ac68`; }
        if (elapsed >= current.ms) {
          index++;
          if (index < shots.length) { marker.style.background = '#b78e3920'; start(); }
          else {
            off(); offResize(); active?.remove(); ctx.lines.clear();
            ctx.audio.ambience('silence', 0); layer.remove(); ctx.stage.removeLayer('film');
            resolve({ act: act.id, data: { shots: shots.length, durationMs: shots.reduce((n, s) => n + s.ms, 0), hotspots: clicked } });
          }
        }
      });
    });
  },
};
