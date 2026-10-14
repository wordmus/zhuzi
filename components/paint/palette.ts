// 色板：规格第二节的十二色，原样。所有画面只从这里取色。

export const PAL = {
  /** 漆黑：漆器底色（夜、屋内） */
  lacquer: '#120d0b',
  /** 漆褐：漆器的暖黑 */
  lacquer2: '#2a1a13',
  /** 朱：田伯、印、票根边、灯焰芯 */
  cinnabar: '#b33a26',
  /** 赭：禾的衣、土 */
  ochre: '#b0763a',
  /** 金：金银错的线（云纹、灯） */
  gold: '#c9a24a',
  /** 帛：白昼的底 */
  silk: '#e7d9b6',
  /** 帛暗：帛的阴影 */
  silkDim: '#cbb98f',
  /** 黄土：东郊的地 */
  loess: '#b99568',
  /** 裂：田缝 */
  umber: '#3b2a1e',
  /** 青铜：铺首、铜镜、灯树 */
  bronze: '#4f6b5a',
  /** 夜蓝：夜空 */
  night: '#141826',
  /** 粟：粟、灯光 */
  millet: '#d6b25a',
} as const;

export type PalName = keyof typeof PAL;

/** 由十二色调出的辅助色（只是深浅，不加新色相） */
export const TONE = {
  /** 墨线 */
  ink: '#1a110c',
  /** 人脸、手：帛与赭之间 */
  skin: '#d9b48a',
  /** 浅金：细线高光 */
  goldLight: '#e6c878',
  /** 暗金 */
  goldDark: '#8a6a2a',
  cinnabarDark: '#7a2418',
  cinnabarLight: '#d0583a',
  ochreDark: '#7a4e24',
  ochreLight: '#cf9a5c',
  bronzeDark: '#2c3d34',
  bronzeLight: '#7d9884',
  /** 铜锈 */
  patina: '#6f9585',
  loessDark: '#8f6f48',
  loessLight: '#d1b27f',
  /** 夜里的夯土墙 */
  wallNight: '#2e2119',
  /** 焰心 */
  flameCore: '#fff1c8',
  /** 竹 */
  bamboo: '#c9a66b',
  bambooDark: '#8d6d3d',
  /** 枯草 */
  straw: '#b89a5c',
  /** 活粟叶 */
  leaf: '#7f8a4a',
} as const;
