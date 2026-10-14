// 本机存储 = 导师的长期记忆。只存在这台机器上；读写都可能失败（隐私窗口、预览），
// 失败时退回内存，页面照常可用。「让它忘掉我」= forget()。

const NS = 'zhuzi.v1';

export interface Store {
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): void;
  remove(key: string): void;
  keys(): string[];
  forget(): void;
  readonly persistent: boolean;
}

export function createStore(ns = NS): Store {
  const mem = new Map<string, string>();
  let persistent = false;
  try {
    const probe = `${ns}.__probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    persistent = true;
  } catch {
    persistent = false;
  }

  const k = (key: string) => `${ns}.${key}`;

  const read = (key: string): string | null => {
    if (persistent) {
      try {
        return localStorage.getItem(k(key));
      } catch {
        /* 落到内存 */
      }
    }
    return mem.get(k(key)) ?? null;
  };

  const write = (key: string, raw: string) => {
    mem.set(k(key), raw);
    if (persistent) {
      try {
        localStorage.setItem(k(key), raw);
      } catch {
        /* 写满或被禁：只留在内存 */
      }
    }
  };

  return {
    persistent,
    get<T>(key: string, fallback: T): T {
      const raw = read(key);
      if (raw == null) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      write(key, JSON.stringify(value));
    },
    remove(key) {
      mem.delete(k(key));
      if (persistent) {
        try {
          localStorage.removeItem(k(key));
        } catch {
          /* ignore */
        }
      }
    },
    keys() {
      const out = new Set<string>();
      for (const key of mem.keys()) if (key.startsWith(`${ns}.`)) out.add(key.slice(ns.length + 1));
      if (persistent) {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(`${ns}.`)) out.add(key.slice(ns.length + 1));
          }
        } catch {
          /* ignore */
        }
      }
      return [...out];
    },
    forget() {
      for (const key of this.keys()) this.remove(key);
    },
  };
}
