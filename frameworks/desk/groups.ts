import type { WorkEntry } from '../../engine/types';

const names: Record<string, string> = {
  vignette: '人间', reveal: '开卷', walk2d: '行游', film: '光影',
  gallery: '藏画', east3d: '立境', chronicle: '年谱', game: '博弈', desk: '案上', console: '机杼',
};
export interface WorkGroup { form: string; title: string; works: WorkEntry[] }
/** Index forms are preserved verbatim; reserved empty media never acquire invented works. */
export function groupWorks(works: WorkEntry[]): WorkGroup[] {
  const indexed = works.filter(w => w.intent !== 'desk');
  const forms: string[] = [...new Set(indexed.map(w => w.form as string))];
  return [...forms, ...Object.keys(names).filter(f => f !== 'desk' && !forms.includes(f))].map(form => ({
    form, title: names[form] ?? '异形', works: indexed.filter(w => (w.form as string) === form),
  }));
}
