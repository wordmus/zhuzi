import type { Letter, Presence } from '../../engine/layers/types';
import { PAL, TONE } from '../../components/paint/palette';
import { drawGlyph, GLYPH_CHARS } from '../../components/paint/ornament';

/** 物件只刻一个篆意字；字库未收录时明确留空框。 */
export function paintPresence(c: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }, progress = 1) {
  const p = Math.max(0, Math.min(1, progress));
  c.save(); c.translate(box.x, box.y - (1 - p) * 42); c.globalAlpha *= p;
  c.fillStyle = PAL.lacquer; c.fillRect(4, 5, box.w, box.h);
  c.fillStyle = TONE.bamboo; c.fillRect(0, 0, box.w, box.h);
  c.strokeStyle = TONE.bambooDark; c.lineWidth = 1.5; c.strokeRect(3, 3, box.w - 6, box.h - 6);
  const size = box.h * .38, glyphX = box.h / 2;
  if (GLYPH_CHARS.includes('言')) drawGlyph(c, '言', glyphX, box.h / 2, size, { color: TONE.ink, style: 'seal' });
  else { c.strokeStyle = TONE.ink; c.strokeRect(glyphX - size / 2, (box.h - size) / 2, size, size); }
  c.restore();
}

/** 全文另折起，不占主屏；原始字段名可检查，没记录的字段连标题也没有。 */
export function presenceDetail(letter: Letter<Presence>, onClose?: () => void): () => void {
  const previousFocus = document.activeElement as HTMLElement | null;
  const dialog = document.createElement('dialog');
  dialog.dataset.presenceFull = letter.id;
  dialog.setAttribute('aria-label', '呈现的信');
  dialog.style.cssText = `box-sizing:border-box;width:min(520px,90vw);max-height:80vh;overflow:auto;border:1px solid ${PAL.gold};background:${PAL.lacquer};color:${PAL.silk};font:17px/1.9 "Songti SC",serif;padding:30px;`;
  const title = document.createElement('p'); title.textContent = '呈现 → 导演'; dialog.append(title);
  for (const field of ['shape', 'withheld', 'cost', 'sentence'] as const) {
    if (!(field in letter.payload)) continue;
    const p = document.createElement('p'); p.dataset.presenceField = field;
    p.textContent = `${field} · ${Array.isArray(letter.payload[field]) ? (letter.payload[field] as string[]).join('；') : letter.payload[field]}`;
    dialog.append(p);
  }
  const close = document.createElement('button'); close.type = 'button'; close.setAttribute('aria-label', '合上短简');
  close.style.cssText = `display:block;margin-left:auto;width:36px;height:36px;border:3px double ${PAL.gold};background:${TONE.ochreDark};cursor:pointer`;
  close.onclick = () => dialog.close(); dialog.append(close);
  dialog.addEventListener('keydown', e => e.stopPropagation());
  dialog.onclose = () => { dialog.remove(); previousFocus?.isConnected && previousFocus.focus(); onClose?.(); };
  document.body.append(dialog); dialog.showModal(); close.focus();
  return () => { if (dialog.open) dialog.close(); };
}
