// 首次遇到的物件先有名字；心象的工具随真实经历展开。
import type { Approach, Rehearsal, Trait, Weights } from '../../engine/types';
import { approachName, type HeartLayout, weightY } from './drawing';

export function rehearsalText(rehearsal: Rehearsal, changedFrom?: Approach): string {
  const result = { give: '肯给粟', lend: '肯借粟', 'buy-land': '要买地', refuse: '会拒绝' }[rehearsal.predicted];
  return changedFrom && changedFrom !== rehearsal.approach
    ? `禾另猜他${result}。`
    : `禾猜他${result}。`;
}

export function createHeartLabels(root: HTMLElement) {
  const labels = new Map<string, HTMLElement>();
  const make = (id: string, text: string) => {
    const el = document.createElement('span');
    el.textContent = text;
    el.dataset.heartLabel = id;
    el.style.cssText = 'position:absolute;transform:translate(-50%,0);pointer-events:none;color:#f1e3c4;font:500 14px/1.4 "Noto Serif SC","Songti SC",serif;white-space:nowrap;letter-spacing:.08em;text-shadow:0 1px 4px #120d0b;';
    el.hidden = true;
    root.appendChild(el);
    labels.set(id, el);
  };
  make('title', '禾的设想');
  make('lord', '田伯');
  make('qing', '叙旧情'); make('li', '押田地'); make('ming', '请乡邻');
  make('weight-qing', '情'); make('weight-li', '利'); make('weight-ming', '名');
  make('go', '去叩门'); make('write', '念头');
  make('predicted', '设想'); make('actual', '实情');
  const place = (id: string, x: number, y: number, visible: boolean, opacity: number) => {
    const el = labels.get(id)!;
    el.hidden = !visible;
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    el.style.opacity = String(opacity);
  };
  return {
    render(layout: HeartLayout, state: { open: number; advanced: boolean; writing: boolean; canGo: boolean; canWrite: boolean; approaches: Approach[]; weights: Weights | null; compare: boolean }) {
      const { cx, cy, ri } = layout;
      const visible = state.open > 0.5 && !state.writing;
      const title = labels.get('title')!;
      title.textContent = state.compare ? '预想与实情' : state.advanced ? '禾的心' : '禾的设想';
      place('title', cx, cy - layout.r * 0.81, visible, state.open);
      place('lord', cx, cy + ri * 0.24, visible && !state.compare, state.open);
      const traits: Trait[] = ['qing', 'li', 'ming'];
      traits.forEach((trait, index) => {
        const token = layout.approach[index]!;
        place(trait, token.x, token.y + 25, visible && state.approaches.includes(trait), state.open);
        const p = layout.weights[trait];
        place(`weight-${trait}`, p.x, cy + weightY(ri, state.weights?.[trait] ?? 0.5) + 25, visible && state.advanced, state.open);
      });
      place('go', layout.go.x, layout.go.y + 26, visible && state.canGo, state.open);
      place('write', layout.write.x, layout.write.y + 22, visible && state.canWrite, state.open);
      place('predicted', cx, cy, false, state.open);
      place('actual', cx, cy, false, state.open);
    },
    destroy() { for (const el of labels.values()) el.remove(); labels.clear(); },
  };
}
