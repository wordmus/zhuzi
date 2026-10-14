// 声音的接口。实现见 engine/audio.ts（Web Audio 程序化合成，不用任何音频文件）。
// 声音只在你第一次动手（推门）之后才响：unlock() 由第一下点击调用。

export type SfxName =
  | 'door-creak' | 'door-close' | 'latch'
  | 'lamp' // 一盏灯亮：编钟一声（按 index 升调）
  | 'brush' | 'slide' | 'pickup' | 'seal'
  | 'dissolve' | 'develop' | 'shimmer'
  | 'soil' | 'crack' | 'step' | 'wind-gust'
  | 'knock' | 'gate-open' | 'gate-shut'
  | 'heart-open' | 'heart-close' | 'seed' | 'sprout' | 'weight' | 'error' | 'insight'
  | 'tally-snap' | 'fire' | 'crowd' | 'jar' | 'water' | 'cough'
  | 'hover' | 'tick' | 'refuse' | 'season';

export type AmbienceName = 'night' | 'cafe' | 'city' | 'field-spring' | 'field-summer' | 'field-autumn' | 'field-winter' | 'heart' | 'gate' | 'silence';

/** 五声：宫商角徵羽 */
export type Mode = 'gong' | 'shang' | 'jue' | 'zhi' | 'yu';

export interface Audio {
  readonly unlocked: boolean;
  unlock(): void;
  sfx(name: SfxName, opts?: { index?: number; gain?: number; pan?: number; rate?: number }): void;
  /** 交叉淡入一种环境声，0 = 静 */
  ambience(name: AmbienceName, level?: number, fadeMs?: number): void;
  /** 音乐：编钟/埙的稀疏旋律。tension 0..1 改变调式与密度 */
  music(opts: { mode?: Mode; tension?: number; on?: boolean }): void;
  /** 一个五声音级上的钟声（i 可为负/大于 5） */
  bell(i: number, opts?: { gain?: number; delayMs?: number }): void;
  setMasterGain(g: number): void;
  mute(on: boolean): void;
  readonly muted: boolean;
}

/** 无声替身：音频未实现或被关掉时用 */
export function createSilentAudio(): Audio {
  let unlocked = false;
  let muted = false;
  return {
    get unlocked() {
      return unlocked;
    },
    unlock() {
      unlocked = true;
    },
    sfx() {},
    ambience() {},
    music() {},
    bell() {},
    setMasterGain() {},
    mute(on) {
      muted = on;
    },
    get muted() {
      return muted;
    },
  };
}
