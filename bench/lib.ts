// bench 与 present 共用的小工具：起浏览器、静态服务、注入测量脚本、收控制台、截图像素差分。
// 页面内的逻辑全在 inpage.js（纯 JS），这里只用字符串调它，避开 tsx 给函数加 __name 的坑。

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..');
export const INPAGE_SRC = fs.readFileSync(path.join(HERE, 'inpage.js'), 'utf8');

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface Thresholds {
  version: number;
  firstActionSec: number;
  first3sActionsMax: number;
  feedbackMsMax: number;
  feedbackMsTarget: number;
  maxChars: number;
  consoleErrorsMax: number;
  fpsP5Min: number;
  notext: boolean;
  repro: boolean;
  feedback: { pixelDelta: number; globalFrac: number; localFrac: number; baselineMul: number; maxProbes: number };
  player: { maxSteps: number; maxSeconds: number; settleMs: number; minGapMs: number; emptyAffSeconds: number };
}

export function loadThresholds(): Thresholds {
  return JSON.parse(fs.readFileSync(path.join(HERE, 'thresholds.json'), 'utf8'));
}

// ---------------- 静态服务 ----------------

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
};

export interface Served {
  origin: string;
  close(): Promise<void>;
}

export function serveDir(dir: string): Promise<Served> {
  const base = path.resolve(dir);
  const server = http.createServer((req, res) => {
    try {
      const u = new URL(req.url ?? '/', 'http://x');
      if (u.pathname === '/favicon.ico') {
        res.writeHead(204).end();
        return;
      }
      let p = path.join(base, decodeURIComponent(u.pathname));
      if (!p.startsWith(base)) {
        res.writeHead(403).end();
        return;
      }
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
      if (!fs.existsSync(p)) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(p).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(p).pipe(res);
    } catch (err) {
      res.writeHead(500).end(String(err));
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port;
      resolve({
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}

// ---------------- 浏览器 ----------------

export interface LaunchOptions {
  headed?: boolean;
  viewport?: { width: number; height: number };
}

export async function launch(o: LaunchOptions = {}): Promise<Browser> {
  return chromium.launch({ headless: !o.headed });
}

export interface Diagnostics {
  consoleErrors: string[];
  pageErrors: string[];
  consoleWarnings: number;
}

/** 新开一个干净的上下文：外部字体直接给空，避免网络拖慢首个可操作时间 */
export async function newContext(browser: Browser, o: LaunchOptions = {}): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    viewport: o.viewport ?? { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
  });
  await ctx.route(/^https?:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => {
    const isCss = route.request().resourceType() === 'stylesheet';
    return route.fulfill({ status: 200, contentType: isCss ? 'text/css' : 'font/woff2', body: '' });
  });
  return ctx;
}

export function attachDiagnostics(page: Page): Diagnostics {
  const d: Diagnostics = { consoleErrors: [], pageErrors: [], consoleWarnings: 0 };
  page.on('console', (m) => {
    if (m.type() === 'error') d.consoleErrors.push(m.text());
    else if (m.type() === 'warning') d.consoleWarnings++;
  });
  page.on('pageerror', (e) => d.pageErrors.push(String(e.stack ?? e.message ?? e)));
  return d;
}

/** 在导航前装好测量脚本 */
export async function installBench(page: Page, opts: { noText?: boolean } = {}): Promise<void> {
  await page.addInitScript({ content: `${INPAGE_SRC}\n;window.__bench.start(${JSON.stringify({ noText: !!opts.noText })});` });
}

export const ev = <T = any>(page: Page, expr: string): Promise<T> => page.evaluate(expr) as Promise<T>;

// ---------------- 从页面里读回来的数据 ----------------

export interface PageData {
  firstActionMs: number | null;
  affSeries: { t: number; n: number }[];
  frames: number[];
  textSeries: { t: number; chars: number; digits: number }[];
  excl: [number, number][];
  trace: any[];
  stageFpsP5: number | null;
  done: boolean;
  now: number;
  /** 页面时钟减 bus 时钟：把 trace.t 换算成页面时间 */
  busOffset: number;
  planSeed: number | null;
  tier: string | null;
}

export async function readPageData(page: Page): Promise<PageData> {
  return ev<PageData>(
    page,
    `(() => {
      const B = window.__bench || {};
      const z = window.__zhuzi || {};
      let fps = null;
      try { fps = z.stage && z.stage.fpsP5 ? z.stage.fpsP5() : null; } catch (e) {}
      return {
        firstActionMs: B.firstAction == null ? null : B.firstAction,
        affSeries: B.affSeries || [],
        frames: B.frames || [],
        textSeries: B.textSeries || [],
        excl: B.excl || [],
        trace: Array.isArray(window.__trace) ? window.__trace.map((e) => { try { return JSON.parse(JSON.stringify(e)); } catch (_) { return { t: e && e.t, kind: e && e.kind, _unserializable: true }; } }) : [],
        stageFpsP5: fps,
        done: z.done === true,
        now: performance.now(),
        busOffset: z.bus && z.bus.now ? performance.now() - z.bus.now() : 0,
        planSeed: z.plan && typeof z.plan.seed === 'number' ? z.plan.seed : null,
        tier: z.plan && z.plan.tier ? z.plan.tier : null,
      };
    })()`,
  );
}

// ---------------- 截图像素差分 ----------------
// 在另一个独立上下文里的空白页解码，避免动到被测页面（后台页的 rAF 会被节流）。

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PairDiff {
  /** 全图变了的像素比例 */
  g: number;
  /** 目标周围区域变了的像素比例 */
  l: number;
}

const DIFF_FN = `
window.__diff = async (p) => {
  const dec = async (b64) => {
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([u8]));
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(bmp, 0, 0);
    return x.getImageData(0, 0, bmp.width, bmp.height);
  };
  const imgs = [];
  for (const s of p.images) imgs.push(await dec(s));
  const out = [];
  for (const [i, j] of p.pairs) {
    const A = imgs[i], Bm = imgs[j];
    if (A.width !== Bm.width || A.height !== Bm.height) { out.push({ g: 1, l: 1 }); continue; }
    const W = A.width, H = A.height;
    const r = p.rect || { x: 0, y: 0, w: W, h: H };
    const x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y));
    const x1 = Math.min(W, Math.ceil(r.x + r.w)), y1 = Math.min(H, Math.ceil(r.y + r.h));
    let g = 0, l = 0, ln = 0;
    const a = A.data, b = Bm.data;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const k = (y * W + x) * 4;
        const d = Math.max(Math.abs(a[k] - b[k]), Math.abs(a[k + 1] - b[k + 1]), Math.abs(a[k + 2] - b[k + 2]));
        const inside = x >= x0 && x < x1 && y >= y0 && y < y1;
        if (inside) ln++;
        if (d >= p.delta) { g++; if (inside) l++; }
      }
    }
    out.push({ g: g / (W * H), l: ln ? l / ln : 0 });
  }
  return out;
};
`;

export class Differ {
  private constructor(private ctx: BrowserContext, private page: Page) {}

  static async create(browser: Browser): Promise<Differ> {
    const ctx = await browser.newContext({ viewport: { width: 400, height: 300 } });
    const page = await ctx.newPage();
    await page.setContent('<!doctype html><meta charset="utf-8"><title>diff</title>');
    await page.evaluate(DIFF_FN);
    return new Differ(ctx, page);
  }

  async compare(images: Buffer[], pairs: [number, number][], rect: Rect | null, delta: number): Promise<PairDiff[]> {
    const payload = { images: images.map((b) => b.toString('base64')), pairs, rect, delta };
    return this.page.evaluate(`window.__diff(${JSON.stringify(payload)})`) as Promise<PairDiff[]>;
  }

  async close() {
    await this.ctx.close().catch(() => {});
  }
}

// ---------------- 杂项 ----------------

export function percentile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * q)));
  return sorted[i]!;
}

export const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** trace 里一条 world.fact 的文字，格式未定，尽量宽容 */
export function factText(ev: any): string {
  return String(ev?.text ?? ev?.fact?.text ?? ev?.fact ?? JSON.stringify({ ...ev, t: undefined }));
}

export function slug(s: string): string {
  return s.replace(/^https?:\/\//, '').replace(/[^A-Za-z0-9一-龥._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'target';
}
