// 横幅留下的痕迹，也是下一天选择的条件。
import type { Beat, Mark, MarkBy, PlaceId } from '../types';

export function createLandscape() {
  const marks: Mark[] = [];
  const closings: { what: string; day: number }[] = [];
  const paths: Partial<Record<PlaceId, number>> = {};
  let water = 1;
  let green = 0;
  let acorns = 1;
  let departed = 0;
  let guard = 0;
  let oldFavorClosed = false;
  let fieldClosed = false;

  function mark(kind: Mark['kind'], place: PlaceId, by: MarkBy, strength: number, effect: string, day: number, beats: Beat[]) {
    const id = `${kind}:${place}:${by}`;
    const value = Math.round(Math.max(0, Math.min(1, strength)) * 100) / 100;
    const previous = marks.find(m => m.id === id);
    if (previous?.strength === value) return;
    const next: Mark = { id, kind, place, by, strength: value, since: previous?.since ?? day, effect };
    if (previous) marks[marks.indexOf(previous)] = next;
    else marks.push(next);
    beats.push({ kind: 'mark', mark: { ...next }, prev: previous?.strength });
  }
  const waterMark = (by: MarkBy, day: number, beats: Beat[]) =>
    mark('well', 'well', by, water, '井水越少，井边的流言越少；见底后只能刨井。', day, beats);
  const greenMark = (by: MarkBy, day: number, beats: Beat[]) =>
    mark('green', 'field', by, green, '活苗让禾更愿守田，也让田伯愿多给些粟买地。', day, beats);
  const oakMark = (by: MarkBy, day: number, beats: Beat[]) =>
    mark('oak', 'altar', by, 1 - acorns, '橡子捡光后，社树下不能再补粟瓮。', day, beats);
  const doorMark = (day: number, beats: Beat[]) =>
    mark('door', 'home', 'neighbors', departed / 3, '邻家封门后，登门的人少了，去莒的念头更近。', day, beats);

  return {
    get water() { return water; },
    get green() { return green; },
    get acorns() { return acorns; },
    get departed() { return departed; },
    get guard() { return guard; },
    get oldFavorClosed() { return oldFavorClosed; },
    get fieldClosed() { return fieldClosed; },
    marks: () => marks.map(m => ({ ...m })),
    closings: () => closings.map(c => ({ ...c })),
    path: (place: PlaceId) => Math.min(1, (paths[place] ?? 0) / 3),
    opening(day: number, crack: number, beats: Beat[]) {
      mark('ground', 'field', 'world', crack, '裂缝越宽，禾守田的把握越小。', day, beats);
      waterMark('world', day, beats);
      oakMark('world', day, beats);
    },
    walk(place: PlaceId, day: number, beats: Beat[]) {
      paths[place] = (paths[place] ?? 0) + 1;
      mark('path', place, 'he', (paths[place] ?? 0) / 3, '走深的路让禾更容易照旧去那一处。', day, beats);
    },
    touchField(day: number, crack: number, beats: Beat[]) {
      mark('ground', 'field', 'he', Math.min(1, crack + 0.18), '禾的手印让他认清裂缝；活苗仍牵住他。', day, beats);
    },
    drawWater(day: number, beats: Beat[]) {
      if (water <= 0) return false;
      water = Math.max(0, water - 0.12);
      green = Math.min(1, green + 0.22);
      waterMark('he', day, beats);
      greenMark('he', day, beats);
      return true;
    },
    gather(day: number, beats: Beat[]) {
      if (acorns <= 0) return 0;
      const amount = Math.min(acorns, 0.2);
      acorns -= amount;
      oakMark('he', day, beats);
      return amount * 3;
    },
    watch(day: number, visits: number, beats: Beat[]) {
      guard = Math.max(guard, Math.min(1, visits * 0.12));
      mark('gate', 'gate', 'tianbo', guard, '田伯记住禾的来由；叩得越多，门前越戒备。', day, beats);
    },
    endDay(day: number, crack: number, beats: Beat[]) {
      water = Math.max(0, water - 0.035);
      green *= 0.92;
      const closures: { what: string; place: PlaceId; close: () => void }[] = [
        { what: '邻家钉上了第一块门板。', place: 'home', close: () => { departed = Math.max(departed, 1); doorMark(day, beats); } },
        { what: '井水只够吊半桶了。', place: 'well', close: () => { water = Math.min(water, 0.55); } },
        { what: '社树下只剩零星的橡子。', place: 'altar', close: () => { acorns = Math.min(acorns, 0.35); oakMark('neighbors', day, beats); } },
        { what: '又一家封门，往莒去了。', place: 'home', close: () => { departed = Math.max(departed, 2); doorMark(day, beats); } },
        { what: green > 0 ? '那一小片活苗又枯了一半。' : '垄边最后一丛野草也枯了。', place: 'field', close: () => { green *= 0.5; if (green > 0) greenMark('world', day, beats); } },
        { what: '田伯门前添了一个看门人。', place: 'gate', close: () => { guard = Math.max(guard, 0.35); this.watch(day, Math.ceil(guard / 0.12), beats); } },
        { what: '井底见了泥，吊桶落空。', place: 'well', close: () => { water = 0; } },
        { what: '社树下的橡子被捡光了。', place: 'altar', close: () => { acorns = 0; oakMark('neighbors', day, beats); } },
        { what: '最后一家乡邻也封了门。', place: 'home', close: () => { departed = 3; doorMark(day, beats); } },
        { what: '田伯不再肯听旧情了。', place: 'gate', close: () => { oldFavorClosed = true; guard = Math.max(guard, 0.65); this.watch(day, Math.ceil(guard / 0.12), beats); } },
        { what: '冻土合上了最后一道田垄。', place: 'field', close: () => { fieldClosed = true; } },
      ];
      const closure = closures[Math.min(day - 1, closures.length - 1)]!;
      if (!closings.some(c => c.what === closure.what)) {
        closure.close();
        closings.push({ what: closure.what, day });
        beats.push({ kind: 'closing', what: closure.what, place: closure.place });
      }
      mark('ground', 'field', 'world', crack, '裂缝越宽，禾守田的把握越小。', day, beats);
      waterMark('world', day, beats);
      if (green > 0) greenMark('world', day, beats);
    },
  };
}
