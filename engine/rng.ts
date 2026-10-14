// 可复现的随机数。管线的复现率依赖它：同一个 seed、同一个标签，永远得到同一串数。
// fork(label) 用标签派生子流，新增一个消费者不会扰动别人的数列。

export interface Rng {
  readonly seed: number;
  /** [0,1) */
  next(): number;
  float(min?: number, max?: number): number;
  int(min: number, maxInclusive: number): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  weighted<T>(items: readonly T[], weight: (t: T) => number): T;
  shuffle<T>(items: readonly T[]): T[];
  gauss(mean?: number, sd?: number): number;
  fork(label: string): Rng;
}

export function hashString(s: string): number {
  // FNV-1a 32 位
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: number): Rng {
  const gen = mulberry32(seed >>> 0);
  const rng: Rng = {
    seed: seed >>> 0,
    next: gen,
    float(min = 0, max = 1) {
      return min + (max - min) * gen();
    },
    int(min, maxInclusive) {
      return Math.floor(min + (maxInclusive - min + 1) * gen());
    },
    chance(p) {
      return gen() < p;
    },
    pick(items) {
      if (items.length === 0) throw new Error('rng.pick: empty');
      return items[Math.floor(gen() * items.length)]!;
    },
    weighted(items, weight) {
      const ws = items.map(weight);
      const total = ws.reduce((a, b) => a + Math.max(0, b), 0);
      if (total <= 0) return rng.pick(items);
      let r = gen() * total;
      for (let i = 0; i < items.length; i++) {
        r -= Math.max(0, ws[i]!);
        if (r <= 0) return items[i]!;
      }
      return items[items.length - 1]!;
    },
    shuffle(items) {
      const a = items.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(gen() * (i + 1));
        [a[i], a[j]] = [a[j]!, a[i]!];
      }
      return a;
    },
    gauss(mean = 0, sd = 1) {
      const u = 1 - gen();
      const v = gen();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    fork(label) {
      return createRng(hashString(`${seed >>> 0}:${label}`));
    },
  };
  return rng;
}

/** 渲染用的确定性噪声：同一坐标永远同一个值，不消耗随机流。 */
export function noise2(x: number, y: number, seed = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 平滑值噪声，[0,1)。 */
export function smoothNoise(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = noise2(xi, yi, seed), b = noise2(xi + 1, yi, seed);
  const c = noise2(xi, yi + 1, seed), d = noise2(xi + 1, yi + 1, seed);
  const u = s(xf), v = s(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, y: number, seed = 0, octaves = 4): number {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * smoothNoise(x * freq, y * freq, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}
