import type { Ctx } from '../../app/context';
import type { Affordance, AffShape } from '../../engine/affordance';
import {
  affirmHypothesis,
  correctHypothesis,
  deriveMentorTemperament,
  getOrInitHypotheses,
  listActiveHypotheses,
  retireHypothesis,
  type Hypothesis,
  type TemperamentSummary,
} from '../../engine/mind/hypotheses';

export interface BooksController {
  draw(c: CanvasRenderingContext2D, w: number, h: number, interactive: boolean): void;
  openYou(): void;
  openIt(): void;
  close(): void;
  remove(): void;
}

export function mountBooks(ctx: Ctx): BooksController {
  const { stage, aff, lines, store } = ctx;
  let bookYouAff: Affordance | null = null;
  let bookItAff: Affordance | null = null;
  let modalAffs: Affordance[] = [];

  let isOpen = false;
  let openKind: 'you' | 'it' | null = null;
  let currentIndex = 0;
  let isEditing = false;
  let mentorSpoken = '';

  // DOM 容器（z-index 45，位于画布 20 之上、affordances 50 之下，让 aff 透明按钮在上层响应）
  const domLayer = stage.dom('vignette-books', 45);
  const container = document.createElement('div');
  container.dataset.testid = 'books-modal';
  container.style.cssText =
    'position:absolute;inset:0;pointer-events:none;display:none;align-items:center;justify-content:center;z-index:45;';
  domLayer.appendChild(container);

  const card = document.createElement('div');
  card.style.cssText =
    'position:relative;pointer-events:auto;background:#20160f;color:#e8d8b7;border:1px solid #89704c;box-shadow:0 12px 32px rgba(0,0,0,0.72);padding:20px 24px;border-radius:4px;font:15px/1.7 "Songti SC",serif;width:min(480px,86vw);max-height:80vh;overflow-y:auto;box-sizing:border-box;';
  container.appendChild(card);

  // 初始化或读取假设
  let hypotheses = getOrInitHypotheses(store, {
    previous: ctx.visit.previous,
    current: ctx.record,
    dayPart: ctx.senses.dayPart(),
    changes: ctx.record.changes,
  });

  const traits = deriveMentorTemperament({
    previous: ctx.visit.previous,
    current: ctx.record,
    changes: ctx.record.changes,
  });

  function clearModalAffs() {
    for (const a of modalAffs) a.remove();
    modalAffs = [];
  }

  function closeDialog() {
    isOpen = false;
    openKind = null;
    isEditing = false;
    mentorSpoken = '';
    container.style.display = 'none';
    clearModalAffs();
  }

  function addModalAff(id: string, label: string, btnEl: HTMLElement, onActivate: () => void, represents?: string) {
    const rect = btnEl.getBoundingClientRect();
    const stageRect = stage.root.getBoundingClientRect();
    const shape: AffShape = {
      kind: 'rect',
      x: rect.left - stageRect.left,
      y: rect.top - stageRect.top,
      w: Math.max(rect.width, 32),
      h: Math.max(rect.height, 28),
    };
    const a = aff.add({
      id,
      label,
      shape,
      represents: represents ?? label,
      onActivate() {
        btnEl.focus();
        onActivate();
      },
    });
    modalAffs.push(a);
    btnEl.onclick = () => {
      onActivate();
    };
    return a;
  }

  function renderYou() {
    card.innerHTML = '';
    clearModalAffs();

    const activeList = listActiveHypotheses(hypotheses);
    if (!activeList.length) {
      const p = document.createElement('p');
      p.style.cssText = 'margin:16px 0;font-size:16px;text-align:center;color:#bba882;';
      p.textContent = '册中的假设已全部撤销。';
      card.appendChild(p);

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.textContent = '合上册子';
      closeBtn.style.cssText =
        'margin:12px auto 0;display:block;background:#38291a;color:#e8d8b7;border:1px solid #89704c;padding:6px 20px;cursor:pointer;font:inherit;';
      card.appendChild(closeBtn);
      setTimeout(() => addModalAff('book-close', '合上册子', closeBtn, closeDialog), 0);
      return;
    }

    if (currentIndex >= activeList.length) currentIndex = 0;
    const hypo = activeList[currentIndex]!;

    if (isEditing) {
      renderYouEdit(hypo);
      return;
    }

    // 标题
    const head = document.createElement('div');
    head.style.cssText = 'display:flex;justify-content:space-between;border-bottom:1px solid #4a3826;padding-bottom:8px;margin-bottom:12px;';
    const title = document.createElement('h3');
    title.style.cssText = 'margin:0;font-size:16px;font-weight:600;color:#f0e2c8;';
    title.textContent = `《它眼中的你》· 假设（${currentIndex + 1}/${activeList.length}）`;
    const status = document.createElement('span');
    status.style.cssText = 'font-size:13px;color:#c99e52;';
    status.textContent = `${hypo.status === 'edited' ? '已纠正' : '推测中'} · 置信度 ${(hypo.confidence * 100).toFixed(0)}%`;
    head.appendChild(title);
    head.appendChild(status);
    card.appendChild(head);

    // 假设正文（一屏一个焦点，≤1 句）
    const body = document.createElement('p');
    body.style.cssText = 'font-size:17px;line-height:1.6;margin:14px 0 8px;color:#fff2da;font-weight:500;';
    body.textContent = `「${hypo.text}」`;
    card.appendChild(body);

    // 真实证据引用
    const ev = document.createElement('p');
    ev.style.cssText = 'font-size:13px;line-height:1.5;color:#9e8766;margin:0 0 16px;';
    const evText = hypo.evidence.map(e => `第${e.visit}访·${e.what}`).join('；');
    ev.textContent = `依据：${evText}`;
    card.appendChild(ev);

    // 导师反馈（若刚才改了/留了）
    if (mentorSpoken) {
      const resp = document.createElement('p');
      resp.style.cssText = 'font-size:14px;color:#d8a85a;margin:0 0 14px;border-left:2px solid #89704c;padding-left:8px;';
      resp.textContent = `导师：${mentorSpoken}`;
      card.appendChild(resp);
    }

    // 动作栏
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;';

    const btnStyle =
      'background:#342316;color:#e8d8b7;border:1px solid #735a3d;padding:6px 14px;cursor:pointer;font:inherit;border-radius:2px;font-size:14px;';

    const affirmBtn = document.createElement('button');
    affirmBtn.type = 'button';
    affirmBtn.textContent = '留着';
    affirmBtn.style.cssText = btnStyle;
    actions.appendChild(affirmBtn);

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.textContent = '改一条';
    editBtn.style.cssText = btnStyle;
    actions.appendChild(editBtn);

    const retireBtn = document.createElement('button');
    retireBtn.type = 'button';
    retireBtn.textContent = '撤销';
    retireBtn.style.cssText = btnStyle;
    actions.appendChild(retireBtn);

    if (activeList.length > 1) {
      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.textContent = '下一条';
      nextBtn.style.cssText = btnStyle;
      actions.appendChild(nextBtn);
      setTimeout(() => {
        addModalAff('hypo-next', '看下一条假设', nextBtn, () => {
          currentIndex = (currentIndex + 1) % activeList.length;
          mentorSpoken = '';
          renderYou();
        });
      }, 0);
    }

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '合上';
    closeBtn.style.cssText = btnStyle + 'margin-left:auto;border-color:#89704c;';
    actions.appendChild(closeBtn);

    card.appendChild(actions);

    setTimeout(() => {
      addModalAff('hypo-affirm', '留着：确认此条假设', affirmBtn, () => {
        const res = affirmHypothesis(hypotheses, hypo.id, store);
        hypotheses = res.hypotheses;
        mentorSpoken = res.line;
        void lines.say({
          who: '导师',
          text: res.line,
          tone: 'mentor',
          sticky: true,
          source: { source: 'script' },
          anchor: () => ({ x: stage.width * 0.55, y: stage.height * 0.24 }),
        });
        renderYou();
      });

      addModalAff('hypo-edit', '改一条：纠正此假设', editBtn, () => {
        isEditing = true;
        renderYou();
      });

      addModalAff('hypo-retire', '撤销：删除此条假设', retireBtn, () => {
        const res = retireHypothesis(hypotheses, hypo.id, store);
        hypotheses = res.hypotheses;
        mentorSpoken = res.line;
        void lines.say({
          who: '导师',
          text: res.line,
          tone: 'mentor',
          sticky: true,
          source: { source: 'script' },
          anchor: () => ({ x: stage.width * 0.55, y: stage.height * 0.24 }),
        });
        renderYou();
      });

      addModalAff('book-close', '合上册子', closeBtn, closeDialog);
    }, 0);
  }

  function renderYouEdit(hypo: Hypothesis) {
    card.innerHTML = '';
    clearModalAffs();

    const head = document.createElement('h3');
    head.style.cssText = 'margin:0 0 10px;font-size:16px;color:#f0e2c8;border-bottom:1px solid #4a3826;padding-bottom:6px;';
    head.textContent = '改一条 · 纠正假设';
    card.appendChild(head);

    const prompt = document.createElement('p');
    prompt.style.cssText = 'font-size:14px;color:#baa682;margin:0 0 12px;';
    prompt.textContent = `原说法：「${hypo.text}」`;
    card.appendChild(prompt);

    // 候选预设
    const presets: Record<string, string[]> = {
      'h-focus': ['其实我更看重胜负大势', '我更在意仓廪与数字', '我只看故事本身'],
      'h-dwell': ['我只是走神了', '我在看墨迹渐干', '我习惯停下来想'],
      'h-night': ['夜里我更想看长卷', '白天我才看短的', '我不受时段约束'],
    };
    const options = presets[hypo.id] ?? ['其实我关注另一面', '这并非我的初衷'];

    const optList = document.createElement('div');
    optList.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-bottom:14px;';

    const commitCorrection = (newText: string) => {
      const res = correctHypothesis(hypotheses, hypo.id, newText, store);
      hypotheses = res.hypotheses;
      mentorSpoken = res.line;
      isEditing = false;
      void lines.say({
        who: '导师',
        text: res.line,
        tone: 'mentor',
        sticky: true,
        source: { source: 'script' },
        anchor: () => ({ x: stage.width * 0.55, y: stage.height * 0.24 }),
      });
      renderYou();
    };

    options.forEach((opt, idx) => {
      const optBtn = document.createElement('button');
      optBtn.type = 'button';
      optBtn.textContent = `「${opt}」`;
      optBtn.style.cssText =
        'background:#2c1e13;color:#e8d8b7;border:1px solid #6b5338;padding:8px 12px;text-align:left;cursor:pointer;font:inherit;border-radius:2px;';
      optList.appendChild(optBtn);
      setTimeout(() => {
        addModalAff(`edit-choice-${idx + 1}`, `纠正为：${opt}`, optBtn, () => commitCorrection(opt));
      }, 0);
    });
    card.appendChild(optList);

    // 自定义输入
    const customRow = document.createElement('div');
    customRow.style.cssText = 'display:flex;gap:6px;margin-bottom:14px;';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 18;
    input.placeholder = '或自己写一句（≤18字）';
    input.style.cssText =
      'flex:1;background:#18100a;border:1px solid #735a3d;color:#e8d8b7;padding:6px 10px;font:inherit;border-radius:2px;outline:none;';
    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.textContent = '写定';
    confirmBtn.style.cssText =
      'background:#4a3422;color:#e8d8b7;border:1px solid #89704c;padding:6px 14px;cursor:pointer;font:inherit;border-radius:2px;';
    customRow.appendChild(input);
    customRow.appendChild(confirmBtn);
    card.appendChild(customRow);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = '放弃修改';
    cancelBtn.style.cssText =
      'background:transparent;color:#9e8766;border:0;padding:4px 8px;cursor:pointer;font:inherit;text-decoration:underline;';
    card.appendChild(cancelBtn);

    setTimeout(() => {
      addModalAff('edit-confirm', '写定新说法', confirmBtn, () => {
        if (input.value.trim()) commitCorrection(input.value.trim());
      });
      addModalAff('edit-cancel', '放弃修改', cancelBtn, () => {
        isEditing = false;
        renderYou();
      });
    }, 0);
  }

  function renderIt() {
    card.innerHTML = '';
    clearModalAffs();

    const trait = traits[currentIndex % traits.length]!;

    const head = document.createElement('div');
    head.style.cssText = 'display:flex;justify-content:space-between;border-bottom:1px solid #4a3826;padding-bottom:8px;margin-bottom:12px;';
    const title = document.createElement('h3');
    title.style.cssText = 'margin:0;font-size:16px;font-weight:600;color:#f0e2c8;';
    title.textContent = `《你眼中的它》· 脾性（${(currentIndex % traits.length) + 1}/3）`;
    const tag = document.createElement('span');
    tag.style.cssText = 'font-size:13px;color:#9e8766;';
    tag.textContent = '真实行为归纳';
    head.appendChild(title);
    head.appendChild(tag);
    card.appendChild(head);

    const body = document.createElement('p');
    body.style.cssText = 'font-size:17px;line-height:1.6;margin:14px 0 10px;color:#fff2da;font-weight:500;';
    body.textContent = `「${trait.trait}」`;
    card.appendChild(body);

    const ev = document.createElement('p');
    ev.style.cssText = 'font-size:13px;line-height:1.6;color:#baa682;margin:0 0 18px;background:#18100a;padding:8px 10px;border-left:2px solid #89704c;';
    ev.textContent = trait.evidence;
    card.appendChild(ev);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:12px;';
    const btnStyle =
      'background:#342316;color:#e8d8b7;border:1px solid #735a3d;padding:6px 16px;cursor:pointer;font:inherit;border-radius:2px;font-size:14px;';

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.textContent = '下一条';
    nextBtn.style.cssText = btnStyle;
    actions.appendChild(nextBtn);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '合上';
    closeBtn.style.cssText = btnStyle + 'border-color:#89704c;';
    actions.appendChild(closeBtn);

    card.appendChild(actions);

    setTimeout(() => {
      addModalAff('trait-next', '看下一条脾性', nextBtn, () => {
        currentIndex = (currentIndex + 1) % traits.length;
        renderIt();
      });
      addModalAff('book-close', '合上册子', closeBtn, closeDialog);
    }, 0);
  }

  function openYou() {
    isOpen = true;
    openKind = 'you';
    currentIndex = 0;
    isEditing = false;
    mentorSpoken = '';
    container.style.display = 'flex';
    renderYou();
  }

  function openIt() {
    isOpen = true;
    openKind = 'it';
    currentIndex = 0;
    isEditing = false;
    mentorSpoken = '';
    container.style.display = 'flex';
    renderIt();
  }

  return {
    draw(c: CanvasRenderingContext2D, w: number, h: number, interactive: boolean) {
      // 在咖啡厅右侧画书架及两本册子
      const shelfX = w * 0.77;
      const shelfY = h * 0.45;
      const shelfW = Math.min(w * 0.19, h * 0.28);
      const shelfH = shelfW * 0.65;

      c.save();
      // 木制书架底座与托板
      c.fillStyle = '#2b1c12';
      c.fillRect(shelfX, shelfY + shelfH * 0.7, shelfW, shelfH * 0.12);
      c.strokeStyle = '#614328';
      c.lineWidth = 1.5;
      c.strokeRect(shelfX, shelfY + shelfH * 0.7, shelfW, shelfH * 0.12);

      // 书架背板微光
      c.fillStyle = '#1c120c';
      c.globalAlpha = 0.55;
      c.fillRect(shelfX + 4, shelfY + 4, shelfW - 8, shelfH * 0.66);
      c.globalAlpha = 1.0;

      // 册子 1：「它眼中的你」
      const b1X = shelfX + shelfW * 0.08;
      const b1Y = shelfY + shelfH * 0.16;
      const b1W = shelfW * 0.38;
      const b1H = shelfH * 0.52;

      c.fillStyle = '#6e563a';
      c.fillRect(b1X, b1Y, b1W, b1H);
      c.strokeStyle = '#9e8156';
      c.lineWidth = 1;
      c.strokeRect(b1X + 2, b1Y + 2, b1W - 4, b1H - 4);
      // 丝带扎绳
      c.fillStyle = '#9e2e22';
      c.fillRect(b1X + b1W * 0.44, b1Y, b1W * 0.12, b1H);

      c.fillStyle = '#1a100a';
      c.font = `${Math.max(9, b1W * 0.24)}px "Songti SC",serif`;
      c.fillText('它眼', b1X + b1W * 0.08, b1Y + b1H * 0.4);
      c.fillText('看你', b1X + b1W * 0.08, b1Y + b1H * 0.8);

      // 册子 2：「你眼中的它」
      const b2X = shelfX + shelfW * 0.54;
      const b2Y = shelfY + shelfH * 0.16;
      const b2W = shelfW * 0.38;
      const b2H = shelfH * 0.52;

      c.fillStyle = '#57422d';
      c.fillRect(b2X, b2Y, b2W, b2H);
      c.strokeStyle = '#856a47';
      c.lineWidth = 1;
      c.strokeRect(b2X + 2, b2Y + 2, b2W - 4, b2H - 4);
      c.fillStyle = '#8a6a2a';
      c.fillRect(b2X + b2W * 0.44, b2Y, b2W * 0.12, b2H);

      c.fillStyle = '#1a100a';
      c.font = `${Math.max(9, b2W * 0.24)}px "Songti SC",serif`;
      c.fillText('你眼', b2X + b2W * 0.08, b2Y + b2H * 0.4);
      c.fillText('看它', b2X + b2W * 0.08, b2Y + b2H * 0.8);

      // 标注
      c.fillStyle = '#9e8766';
      c.font = `${Math.max(9, shelfW * 0.075)}px "Songti SC",serif`;
      c.fillText('架上两册', shelfX + shelfW * 0.28, shelfY + shelfH * 0.95);

      c.restore();

      // 交互 affordance 注册
      if (interactive && !isOpen) {
        if (!bookYouAff) {
          bookYouAff = aff.add({
            id: 'book-you',
            label: '翻开册子：它眼中的你',
            shape: { kind: 'rect', x: b1X, y: b1Y, w: b1W, h: b1H },
            represents: '翻开它眼中的你：带证据假设',
            onActivate: openYou,
          });
        } else {
          bookYouAff.setShape({ kind: 'rect', x: b1X, y: b1Y, w: b1W, h: b1H });
          bookYouAff.setEnabled(true);
        }

        if (!bookItAff) {
          bookItAff = aff.add({
            id: 'book-it',
            label: '翻开册子：你眼中的它',
            shape: { kind: 'rect', x: b2X, y: b2Y, w: b2W, h: b2H },
            represents: '翻开你眼中的它：脾性摘要',
            onActivate: openIt,
          });
        } else {
          bookItAff.setShape({ kind: 'rect', x: b2X, y: b2Y, w: b2W, h: b2H });
          bookItAff.setEnabled(true);
        }
      } else {
        if (bookYouAff) bookYouAff.setEnabled(false);
        if (bookItAff) bookItAff.setEnabled(false);
      }
    },
    openYou,
    openIt,
    close: closeDialog,
    remove() {
      bookYouAff?.remove();
      bookItAff?.remove();
      clearModalAffs();
      container.remove();
      stage.removeLayer('vignette-books');
    },
  };
}
