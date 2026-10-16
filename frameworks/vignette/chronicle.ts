import type { Ctx } from '../../app/context';
import type { Affordance } from '../../engine/affordance';
import rules from '../../director/seed-memory/rules.json';

/** 固定在墙上的第一天草图；来访的改笔只叠在草图旁，旧稿一直在。 */
export function mountChronicle(ctx: Ctx) {
  let aff: Affordance | undefined;
  let previousFocus: HTMLElement | null = null;
  const layer = ctx.stage.dom('vignette-chronicle', 80);
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-label', '咖啡厅年谱：改前、改后、为什么');
  dialog.style.cssText = 'max-width:min(560px,82vw);max-height:70vh;overflow:auto;background:#241b13;color:#e8d8b7;border:1px solid #89704c;padding:24px;font:16px/1.8 "Songti SC",serif;pointer-events:auto;';
  const title = document.createElement('h2');
  title.textContent = '第一天与后来';
  dialog.append(title);
  const first = document.createElement('p');
  first.textContent = '第一天：座位与导师相对，灯在两人之间，票根放在案上。墙上的旧草图一直保留。';
  dialog.append(first);
  const history = ctx.record.changes ?? [];
  for (const change of history) {
    const entry = document.createElement('section');
    const heading = document.createElement('h3');
    heading.textContent = `第 ${change.visit} 次来访 · ${change.what}`;
    entry.append(heading);
    for (const text of [`改前：${change.before}`, `改后：${change.after}`, `为什么：${change.why}`, `依据来自第 ${change.visit - 1} 次来访（${new Date(change.since).toISOString()}）`]) {
      const p = document.createElement('p'); p.textContent = text; entry.append(p);
    }
    dialog.append(entry);
  }
  const rule = rules.rules.find(r => r.id === (history.at(-1)?.place === 'lamp' ? 'response' : 'revision-trace'))!;
  const source = document.createElement('p');
  source.textContent = `改稿遵循现有种子规则（并非声称规则发生了改写）：director/seed-memory/rules.json · v${rules.version} · ${rule.id}：${rule.text}`;
  dialog.append(source);
  const close = document.createElement('button');
  close.type = 'button'; close.textContent = '收起';
  close.style.cssText = 'font:inherit;color:inherit;background:#38291a;border:1px solid #89704c;padding:6px 20px;min-height:44px;cursor:pointer;';
  close.onclick = () => dialog.close();
  dialog.addEventListener('close', () => previousFocus?.isConnected && previousFocus.focus());
  dialog.append(close);
  layer.append(dialog);
  return {
    draw(c: CanvasRenderingContext2D, w: number, h: number, interactive: boolean) {
      const width = Math.min(w * 0.2, h * 0.32);
      const height = width * 0.65;
      const x = w * 0.37 - width / 2;
      const y = h * 0.285;
      c.save();
      c.fillStyle = '#7c6746'; c.globalAlpha = 0.7;
      c.fillRect(x, y, width, height);
      c.strokeStyle = '#322518'; c.lineWidth = 1;
      c.strokeRect(x + 4, y + 4, width - 8, height - 8);
      c.fillStyle = '#261d14'; c.font = `${Math.max(10, width * 0.085)}px "Songti SC",serif`;
      c.fillText('第一天', x + width * 0.08, y + height * 0.2);
      // 旧稿：座位、远灯、导师与案；新稿不盖住它。
      c.beginPath();
      c.moveTo(x + width * 0.14, y + height * 0.68); c.lineTo(x + width * 0.14, y + height * 0.4);
      c.lineTo(x + width * 0.27, y + height * 0.4); c.lineTo(x + width * 0.27, y + height * 0.68);
      c.moveTo(x + width * 0.44, y + height * 0.66); c.lineTo(x + width * 0.44, y + height * 0.43);
      c.moveTo(x + width * 0.37, y + height * 0.48); c.lineTo(x + width * 0.51, y + height * 0.48);
      c.moveTo(x + width * 0.62, y + height * 0.65); c.lineTo(x + width * 0.85, y + height * 0.65);
      c.stroke();
      const latest = history.at(-1);
      if (latest) {
        c.strokeStyle = '#612b21';
        c.setLineDash([3, 3]);
        c.strokeRect(x + width * 0.59, y + height * 0.38, width * 0.15, height * 0.32);
        c.setLineDash([]);
        c.fillStyle = '#612b21';
        c.fillText('改稿', x + width * 0.67, y + height * 0.22);
        c.fillText(latest.place === 'lamp' ? '灯挪近了' : '旧稿留着', x + width * 0.08, y + height * 0.9);
      }
      c.restore();
      if (interactive) {
        if (!aff) aff = ctx.aff.add({ id: 'visit-chronicle', label: '看墙上年谱，追问改前改后与为什么', shape: { kind: 'rect', x, y, w: width, h: height },
          onActivate() { previousFocus = document.activeElement as HTMLElement; dialog.showModal(); close.focus(); } });
        else aff.setShape({ kind: 'rect', x, y, w: width, h: height });
      }
    },
    remove() { aff?.remove(); dialog.remove(); ctx.stage.removeLayer('vignette-chronicle'); },
  };
}
