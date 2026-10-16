import type { Store } from '../store';

export const LAMP_KEY = 'mentor.lamps';
export function lampAllocation(store: Store | undefined, intent: string): number | undefined {
  const value = store?.get<Record<string, number>>(LAMP_KEY, {})[intent];
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

/** The UI and headless proof use the very same conserved transfer. */
export function pourLamp(store: Store, from: string, to: string) {
  const values = store.get<Record<string, number>>(LAMP_KEY, {});
  if (from === to) return values;
  const source = lampAllocation(store, from) ?? 1, target = lampAllocation(store, to) ?? 1;
  const amount = Math.max(0, Math.min(.25, source - .1));
  const after = { ...values, [from]: source - amount, [to]: target + amount };
  store.set(LAMP_KEY, after);
  store.set('mentor.lampTransfer', { from, to, amount, before: { [from]: source, [to]: target }, after });
  return after;
}
