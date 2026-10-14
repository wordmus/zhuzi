// 导师即机器：浏览器直接读得到的身体与感官（策划文档第 6 节「起步」阶段）。
// 你从它的行为里感到它的身体，而不是从仪表上读出——这里只产出特征，不画仪表。

import type { Bus } from './bus';
import type { Store } from './store';

export type DayPart = 'deep-night' | 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'night';

export interface Senses {
  /** 机器的「现在」（可被演示面板拨快，用于「假装离开两小时」） */
  now(): number;
  hour(): number;
  dayPart(): DayPart;
  /** 深夜：只排短的 */
  isLate(): boolean;
  dark(): boolean;
  online(): boolean;
  /** 力气：0..1，按核数与内存粗估 */
  strength(): number;
  coarsePointer(): boolean;
  /** 你在不在：页面是否在前台 */
  present(): boolean;
  /** 上一次离开了多久（毫秒），回来时更新 */
  lastAwayMs(): number;
  /** 演示面板：把机器的钟拨快 */
  skew(ms: number): void;
  skewMs(): number;
  /** 实际读到了哪些感官（真读到的单独标出） */
  inventory(): { name: string; real: boolean; value: string }[];
}

export function createSenses(bus: Bus, store: Store): Senses {
  let skewMs = store.get<number>('clock.skew', 0);
  let awayStart = 0;
  let lastAway = 0;
  const mqDark = window.matchMedia?.('(prefers-color-scheme: dark)');
  const mqCoarse = window.matchMedia?.('(pointer: coarse)');

  const now = () => Date.now() + skewMs;
  const hour = () => new Date(now()).getHours() + new Date(now()).getMinutes() / 60;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      awayStart = performance.now();
      bus.log('sense', { name: 'presence', value: 'away' });
      bus.emit('sense.away', {});
    } else if (awayStart) {
      lastAway = performance.now() - awayStart;
      awayStart = 0;
      bus.log('sense', { name: 'presence', value: 'back', awayMs: Math.round(lastAway) });
      bus.emit('sense.back', { awayMs: lastAway });
    }
  });
  window.addEventListener('online', () => {
    bus.log('sense', { name: 'network', value: 'online' });
    bus.emit('sense.network', { online: true });
  });
  window.addEventListener('offline', () => {
    bus.log('sense', { name: 'network', value: 'offline' });
    bus.emit('sense.network', { online: false });
  });
  mqDark?.addEventListener?.('change', () => bus.emit('sense.scheme', { dark: !!mqDark.matches }));

  const senses: Senses = {
    now,
    hour,
    dayPart() {
      const h = hour();
      if (h < 4.5) return 'deep-night';
      if (h < 6.5) return 'dawn';
      if (h < 11) return 'morning';
      if (h < 14) return 'noon';
      if (h < 17.5) return 'afternoon';
      if (h < 19.5) return 'dusk';
      if (h < 23) return 'night';
      return 'deep-night';
    },
    isLate() {
      const h = hour();
      return h >= 23 || h < 4.5;
    },
    dark: () => !!mqDark?.matches,
    online: () => navigator.onLine !== false,
    strength() {
      const cores = navigator.hardwareConcurrency || 4;
      const mem = (navigator as any).deviceMemory || 4;
      return Math.max(0.2, Math.min(1, (cores / 8) * 0.6 + (mem / 8) * 0.4));
    },
    coarsePointer: () => !!mqCoarse?.matches,
    present: () => !document.hidden,
    lastAwayMs: () => lastAway,
    skew(ms) {
      skewMs += ms;
      store.set('clock.skew', skewMs);
      bus.log('sense', { name: 'clock', value: 'skew', skewMs });
      bus.emit('sense.skew', { skewMs });
    },
    skewMs: () => skewMs,
    inventory() {
      return [
        { name: '时钟', real: true, value: new Date(now()).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) + (skewMs ? '（已拨快）' : '') },
        { name: '明暗', real: !!mqDark, value: mqDark?.matches ? '暗' : '明' },
        { name: '手', real: !!mqCoarse, value: mqCoarse?.matches ? '触屏' : '键鼠' },
        { name: '在场', real: true, value: document.hidden ? '离开' : '在' },
        { name: '网络', real: true, value: navigator.onLine === false ? '断' : '通' },
        { name: '力气', real: !!navigator.hardwareConcurrency, value: `${navigator.hardwareConcurrency || '?'} 核` },
        { name: '长期记忆', real: store.persistent, value: store.persistent ? '本机' : '仅此一次' },
      ];
    },
  };
  return senses;
}
