import type { Ctx, VisitChange, VisitRecord } from '../../app/context';

/** 只读两个来访快照：不读钟、不读存储、不掷骰子，也不修改输入。 */
export function computeVisitChanges(previous: VisitRecord | null, current: VisitRecord): VisitChange[] {
  if (!previous || current.n <= previous.n) return [];
  const history = previous.changes ?? [];
  const lastPlaces = new Set(history.filter(c => c.visit === previous.n).map(c => c.place));
  const top = Object.entries(previous.dwell).filter(([, ms]) => Number.isFinite(ms) && ms > 0)
    .sort(([a, am], [b, bm]) => bm - am || a.localeCompare(b))[0];
  const place = top?.[0] ?? previous.longestPlace;
  const ms = top?.[1] ?? previous.longestPlaceMs ?? 0;
  const evidence = top ? `visit.last.dwell[${JSON.stringify(place)}]=${ms}`
    : `visit.last.longestPlace=${JSON.stringify(place)}; longestPlaceMs=${ms}`;
  const base = { since: previous.at, visit: current.n };
  const lampX = place?.includes('ticket') ? 0.36 : 0.29;
  const priorLamp = history.filter(c => c.place === 'lamp').at(-1)?.lampX ?? 0.48;
  // 每回只改一处，给另一处留下一回来访的余地。原处已合适时不谎称又挪了灯。
  if (place && ms >= 3000 && !lastPlaces.has('lamp') && lampX !== priorLamp) {
    return [{ ...base, id: `visit-${current.n}-lamp`, place: 'lamp', lampX,
      what: '灯移到你的座位旁', why: `上次你在这里停得最久：${evidence}。`,
      before: `灯在横向 ${priorLamp}`, after: `灯在横向 ${lampX}，靠近你的座位`,
      attribution: '你停得久，灯就挪近了。' }];
  }
  const skippedTicket = previous.skipped?.includes('ticket');
  if (!lastPlaces.has('chronicle') && (skippedTicket || (place && ms >= 3000))) {
    return [{ ...base, id: `visit-${current.n}-chronicle`, place: 'chronicle',
      what: skippedTicket ? '墙上留下一版未拿起的票根草稿' : '墙上添了你停留处的改稿',
      why: skippedTicket ? '上次票根已出现但未拿起：visit.last.skipped 包含 "ticket"。'
        : `你留下的停留促成这张改稿：${evidence}。`,
      before: '第一天：灯在远处，票根只在案上',
      after: skippedTicket ? '票根的淡痕留在草图里，未拿起的这一版不抹去' : '草图圈出你上次停得最久的地方',
      attribution: skippedTicket ? '你没拿的那版，我留着。' : '你停过的地方，留下了。' }];
  }
  return [];
}

/** 在进门时交付一次，回到咖啡厅沿用同一版。 */
export function prepareVisitChanges(ctx: Ctx): VisitChange[] {
  if (ctx.handoff.visitChanges) return ctx.handoff.visitChanges as VisitChange[];
  const saved = ctx.store.get<VisitChange[]>('visit.changes', []);
  const history = [...saved];
  for (const item of ctx.visit.previous?.changes ?? []) if (!history.some(c => c.id === item.id)) history.push(item);
  const previous = ctx.visit.previous ? { ...ctx.visit.previous, changes: history } : null;
  const changes = computeVisitChanges(previous, ctx.record);
  for (const item of changes) if (!history.some(c => c.id === item.id)) history.push(item);
  ctx.record.changes = history;
  ctx.store.set('visit.changes', history);
  ctx.handoff.visitChanges = changes;
  return changes;
}

export function currentLampX(ctx: Ctx): number {
  return ctx.record.changes?.filter(c => c.place === 'lamp').at(-1)?.lampX ?? 0.48;
}
