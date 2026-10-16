import type { Framework } from '../../app/context';
import type { Affordance } from '../../engine/affordance';
import { galleryAssets } from './assets';

const bounded = (v: number, hi: number) => Math.max(0, Math.min(hi, v));

/** A single draggable surface: plates are its contents, not competing buttons. */
export const gallery: Framework = {
  async run(act, ctx) {
    const { stage, aff, store, bus, lines } = ctx;
    const plates = act.elements.filter(e => e.asset);
    if (!plates.length) throw new Error(`gallery ${act.id} has no plates`);
    const layer = stage.layer('gallery', 30);
    const key = `gallery:${act.id}:position`;
    // Store a fractional plate index, so changing orientation preserves the work.
    const saved = store.get<unknown>(key, 0);
    let position = bounded(typeof saved === 'number' && Number.isFinite(saved) ? saved : 0, plates.length - 1);
    const restored = position;
    let selected = Math.round(position);
    let question = false;
    let finished = false;
    let fold: Affordance | undefined;
    let endTimer: ReturnType<typeof setTimeout> | undefined;
    let lastPoint: { x: number; y: number } | undefined;
    let touched = false;
    let flash = 0;
    let moves = 0;
    let reason = '';
    let resolve!: () => void;
    const done = new Promise<void>(r => { resolve = r; });
    const images = plates.map(p => {
      const url = galleryAssets[p.asset!];
      if (!url) throw new Error(`Unbundled gallery asset: ${p.asset}`);
      const image = new Image();
      image.src = url;
      return image;
    });
    const metrics = () => {
      const w = stage.width, h = stage.height, vertical = stage.narrow;
      const pw = vertical ? w - 40 : Math.min(w * .72, 960);
      const ph = Math.max(80, Math.min(h * .62, pw * .625));
      return { w, h, vertical, pw, ph, step: vertical ? ph + 115 : pw + 70, cx: w / 2, cy: h * .46 };
    };
    const current = () => bounded(Math.round(position), plates.length - 1);
    const caption = () => {
      const id = plates[selected]!.id;
      const line = act.lines.find(l => l.when === `${question ? 'after' : 'plate'}:${id}`);
      const text = [...(line?.text ?? plates[selected]!.represents)].slice(0, question ? 30 : 18).join('');
      void lines.say({ who: line?.who ?? '导师', text, charMs: 0, sticky: true, size: 'small',
        anchor: () => ({ x: stage.width / 2, y: Math.min(stage.height - 82, metrics().cy + metrics().ph / 2 + 48) }),
        width: () => Math.min(stage.width - 40, 560), source: { source: 'script' } });
      bus.log('world.event', { kind: question ? 'gallery.question' : 'gallery.plate', plate: id, position, text });
    };
    const persist = () => store.set(key, position);
    const finish = (why: string) => {
      if (finished) return;
      finished = true;
      reason = why;
      persist();
      bus.log('world.event', { kind: 'gallery.complete', reason, position });
      resolve();
    };
    const draw = () => {
      const { w, h, vertical, pw, ph, step, cx, cy } = metrics();
      const c = layer.ctx;
      layer.clear();
      c.fillStyle = '#191a18'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#555044'; c.lineWidth = 1;
      for (let i = 0; i < plates.length; i++) {
        const delta = (i - position) * step;
        const x = cx - pw / 2 + (vertical ? 0 : delta);
        const y = cy - ph / 2 + (vertical ? delta : 0);
        if (x + pw < 0 || x > w || y + ph < 0 || y > h) continue;
        c.save();
        c.globalAlpha = i === current() ? 1 : .25;
        c.fillStyle = performance.now() < flash && i === selected ? '#66543b' : '#28271f';
        c.fillRect(x - 9, y - 9, pw + 18, ph + 18);
        const image = images[i]!;
        if (image.complete && image.naturalWidth) {
          const scale = Math.min(pw / image.naturalWidth, ph / image.naturalHeight);
          const iw = image.naturalWidth * scale, ih = image.naturalHeight * scale;
          c.drawImage(image, x + (pw - iw) / 2, y + (ph - ih) / 2, iw, ih);
        }
        const responding = i === selected && performance.now() < flash;
        c.strokeStyle = responding ? '#efc773' : i === selected && question ? '#dbc899' : '#716853';
        c.lineWidth = responding ? 8 : i === selected && question ? 3 : 1;
        c.strokeRect(x - 9, y - 9, pw + 18, ph + 18);
        c.restore();
      }
      // The red seal is both a direction hint and immediate nonverbal feedback.
      const railY = h - 40, railW = Math.min(w - 80, 240), railX = (w - railW) / 2;
      c.strokeStyle = '#6b624e'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(railX, railY); c.lineTo(railX + railW, railY); c.stroke();
      c.fillStyle = performance.now() < flash ? '#ebbf75' : '#b3513f';
      c.fillRect(railX + position / Math.max(1, plates.length - 1) * railW - 5, railY - 5, 10, 10);
      c.strokeStyle = '#c7b78d'; c.lineWidth = 2;
      c.beginPath();
      if (vertical) { c.moveTo(w - 44, h - 43); c.lineTo(w - 37, h - 36); c.lineTo(w - 30, h - 43); }
      else { c.moveTo(w - 37, h - 47); c.lineTo(w - 30, h - 40); c.lineTo(w - 37, h - 33); }
      c.stroke();
      if (fold) {
        c.fillStyle = '#d8c8a1'; c.font = '15px "Songti SC",serif'; c.textAlign = 'right';
        c.fillText('收起', w - 26, 37);
        c.strokeStyle = '#b3513f'; c.beginPath(); c.moveTo(w - 70, 46); c.lineTo(w - 25, 46); c.stroke();
      }
    };
    const move = (next: number, input: string) => {
      if (finished) return;
      const before = position;
      position = bounded(next, plates.length - 1);
      question = false;
      selected = current();
      flash = performance.now() + 180;
      if (before !== position) {
        moves++;
        persist(); caption();
        bus.log('world.event', { kind: 'gallery.move', input, before, position, vertical: stage.narrow });
      }
      draw();
      clearTimeout(endTimer);
      if (position >= plates.length - 1 - .001 && next >= position) endTimer = setTimeout(() => finish('end'), 650);
    };
    const shape = () => ({ kind: 'rect' as const, x: 0, y: 58, w: stage.width, h: stage.height - 58 });
    const scroll = aff.add({ id: `${act.focus}-scroll`, label: '拖动展卷，点画追问；方向键翻阅',
      shape: shape(), represents: '作品架长卷', cursor: 'grab',
      onDrag(e) {
        if (e.phase === 'start') { lastPoint = { x: e.x, y: e.y }; touched = true; scroll.el.style.cursor = 'grabbing'; }
        if (e.phase === 'move') move(position - (stage.narrow ? e.dy : e.dx) / metrics().step, 'drag');
        if (e.phase === 'end') scroll.el.style.cursor = 'grab';
      },
      onActivate() {
        if (finished) return;
        const m = metrics();
        const p = touched && lastPoint ? lastPoint : { x: m.cx, y: m.cy };
        touched = false;
        if (p.y > m.h - 70) { move(position + 1, 'advance'); return; }
        const index = bounded(Math.round(position + (m.vertical ? p.y - m.cy : p.x - m.cx) / m.step), plates.length - 1);
        selected = index;
        question = true;
        flash = performance.now() + 240;
        caption(); draw();
      },
    });
    scroll.el.dataset.pulse = 'breath';
    scroll.el.setAttribute('aria-current', 'true');
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? metrics().step : 1;
      move(position + delta * unit / metrics().step, 'wheel');
    };
    const keyboard = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) {
        if (e.key === 'Enter' && e.target === fold?.el) return;
        e.preventDefault(); move(position + 1, 'key');
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) {
        e.preventDefault(); move(position - 1, 'key');
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault(); move(e.key === 'Home' ? 0 : plates.length - 1, 'key');
      }
    };
    stage.root.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', keyboard);
    const foldShape = () => ({ kind: 'rect' as const, x: stage.width - 90, y: 12, w: 78, h: 44 });
    const foldTimer = setTimeout(() => {
      if (finished) return;
      fold = aff.add({ id: 'gallery-fold', label: '收起作品架', shape: foldShape(), represents: '收起长卷', onActivate: () => finish('fold') });
      draw();
    }, 3100);
    const offResize = stage.onResize(() => { scroll.setShape(shape()); fold?.setShape(foldShape()); caption(); draw(); });
    images.forEach(image => { image.onload = draw; image.onerror = () => bus.log('world.event', { kind: 'gallery.asset-error', url: image.src }); });
    const offFrame = stage.onFrame(() => {
      // Only redraw the tiny feedback interval, never animate the artwork itself.
      if (performance.now() < flash + 30) draw();
    });
    caption(); draw();
    bus.log('world.event', { kind: 'gallery.restore', key, position, persistent: store.persistent, plates: plates.length });
    try { await done; } finally {
      clearTimeout(foldTimer); clearTimeout(endTimer);
      offResize(); offFrame(); scroll.remove(); fold?.remove();
      images.forEach(image => { image.onload = null; image.onerror = null; });
      stage.root.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', keyboard);
      lines.clear(); stage.removeLayer('gallery');
    }
    return { act: act.id, data: { reason, position, restored, moves, plates: plates.map(p => p.id),
      metrics: { galleryPosition: position, galleryMoves: moves },
      facts: [{ id: `${act.id}-closed`, text: reason === 'end' ? '作品架已展到底' : '作品架已收起', kind: 'delivery' }] } };
  },
};
