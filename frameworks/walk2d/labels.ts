// 地点与动作先说得出名字，玩家才有下一步的预期。
import type { PlaceId } from '../../engine/types';

export function createSceneLabels(root: HTMLElement) {
  const elements = new Map<string, HTMLElement>();
  const add = (id: string, text: string) => {
    const el = document.createElement('span');
    el.textContent = text;
    el.style.cssText = 'position:absolute;transform:translate(-50%,-100%);pointer-events:none;font:500 14px/1.4 "Noto Serif SC","Songti SC",serif;color:#3b2a1e;white-space:nowrap;text-shadow:0 0 5px #e7d9b6;';
    el.dataset.sceneLabel = id;
    el.hidden = true;
    root.appendChild(el); elements.set(id, el);
  };
  add('he', '禾'); add('think', '替禾想办法'); add('ring', '叩门');
  add('lord', '田伯'); add('accept', '收下'); add('decline', '推开'); add('commit', '落承诺');
  const names: Record<PlaceId, string> = { home: '家', field: '田', well: '井', altar: '社', gate: '田家', road: '路' };
  for (const [id, name] of Object.entries(names)) add(id, name);
  const place = (id: string, x: number, y: number, visible: boolean, text?: string, light = false) => {
    const el = elements.get(id)!;
    if (text && el.textContent !== text) el.textContent = text;
    el.style.color = light ? '#f1e3c4' : '#3b2a1e';
    el.style.textShadow = light ? '0 1px 4px #120d0b,0 0 3px #120d0b' : '0 0 5px #e7d9b6';
    el.hidden = !visible;
    el.style.left = `${Math.round(x)}px`; el.style.top = `${Math.round(y)}px`;
  };
  return {
    render(state: { width: number; mirror: boolean; intro: boolean; playing: boolean; actor: { x: number; y: number }; places: Record<PlaceId, number>; ground: number; height: number; pendingGate: boolean; gateRings: number; gateOpen: number; ring: { x: number; y: number }; offer: 'lend' | 'buy-land' | null; commit: boolean }) {
      const visible = !state.mirror;
      const inView = (x: number) => x >= 16 && x <= state.width - 16;
      place('he', state.actor.x + state.height * 0.045, state.actor.y - state.height * 0.21, visible && inView(state.actor.x), undefined, state.pendingGate);
      place('think', state.actor.x, state.actor.y - state.height * 0.1, visible && state.intro);
      for (const [id, x] of Object.entries(state.places)) place(id, x, state.ground + 22, visible && state.playing && inView(x));
      place('ring', state.ring.x, state.ring.y + 46, visible && state.pendingGate, state.gateRings ? `叩门（${state.gateRings}/3）` : '叩门（三下）', true);
      place('lord', state.places.gate, state.ground - state.height * 0.26, visible && state.gateOpen > 0.3);
      place('accept', state.places.gate, state.ground - state.height * 0.28, visible && !!state.offer, state.offer === 'lend' ? '立券' : '交地');
      place('decline', state.places.gate + state.height * 0.18, state.ground - state.height * 0.22, visible && !!state.offer);
      place('commit', state.actor.x + state.height * 0.14, state.actor.y - state.height * 0.05, visible && state.commit);
    },
    destroy() { for (const el of elements.values()) el.remove(); elements.clear(); },
  };
}
