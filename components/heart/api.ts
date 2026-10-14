// 心象（看进禾的心）的接口：一面青铜镜里的一块黄昏的田。
// walk2d 框架通过它显示禾的心智、接收你在心里做的事；实现见 components/heart/index.ts。

import type { Approach, Layer, MindSnapshot, Rehearsal, Response, Seed, Trait, Weights } from '../../engine/types';

export interface HeartErrorView {
  trait: Trait;
  before: Weights;
  after: Weights;
  predicted: Response;
  actual: Response;
}

export type HeartEvent =
  /** 拨小田伯的秤：某个砝码加减 */
  | { kind: 'nudge'; trait: Trait; delta: number }
  /** 把一个来由放到小田伯面前预演（不花一天） */
  | { kind: 'rehearse'; approach: Approach }
  /** 就带这个来由去田伯家（花一天） */
  | { kind: 'go'; approach: Approach }
  /** 你亲手写给禾的一句话 */
  | { kind: 'write'; words: string }
  /** 关上心象 */
  | { kind: 'close' };

export interface HeartView {
  readonly isOpen: boolean;
  /** 在禾头顶打开铜镜（anchor 每帧调用：禾的头顶位置） */
  open(anchor: () => { x: number; y: number }, opts?: { reason?: 'first' | 'player' | 'error' | 'unfold' }): Promise<void>;
  close(): Promise<void>;
  /** 同步心智快照：种子、信念（小田伯的秤）、三盏心灯、压力 */
  update(snapshot: MindSnapshot): void;
  /** 小田伯按禾的信念做出反应，并说出禾想象中的一句话 */
  showRehearsal(r: Rehearsal): Promise<void>;
  /** 预演与实际之差：砝码滑到新位置，旧位置留一道淡痕；小田伯随之变准 */
  showError(e: HeartErrorView): Promise<void>;
  /** 一颗新种子落进心田（被挡下的念头、流言、你写的话） */
  addSeed(seed: Seed): Promise<void>;
  sprout(seed: Seed): Promise<void>;
  /** 一件事停在哪层：那盏心灯亮一下 */
  flashLayer(layer: Layer): void;
  /** 可用的来由（社坛未起时没有「祭」等）；默认三种都可 */
  setApproaches(list: Approach[]): void;
  /** 是否允许你写一句话（模型可用或规则可用时都允许） */
  setWritable(on: boolean): void;
  on(fn: (e: HeartEvent) => void): () => void;
  destroy(): void;
}
