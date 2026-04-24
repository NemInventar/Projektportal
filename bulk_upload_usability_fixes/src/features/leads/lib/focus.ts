/**
 * Quick-time picker helpers + focus-utils.
 * Bruges af LeadFocusCard til knapperne "Om 1 t" / "Om 3 t" / "I morgen" / "Næste uge".
 */

/**
 * Returnerer `{ due_date: 'YYYY-MM-DD', due_time: 'HH:MM:00' }`
 * til brug i INSERT/UPDATE på crm_activities.
 */
export function toDateTimeParts(target: Date): { due_date: string; due_time: string } {
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  const hh = String(target.getHours()).padStart(2, '0');
  const mm = String(target.getMinutes()).padStart(2, '0');
  return { due_date: `${y}-${m}-${d}`, due_time: `${hh}:${mm}:00` };
}

export function inHours(hours: number): { due_date: string; due_time: string } {
  const t = new Date();
  t.setHours(t.getHours() + hours, 0, 0, 0);
  return toDateTimeParts(t);
}

export function tomorrowAt9(): { due_date: string; due_time: string } {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  t.setHours(9, 0, 0, 0);
  return toDateTimeParts(t);
}

export function nextMondayAt9(): { due_date: string; due_time: string } {
  const t = new Date();
  const daysUntilMonday = (8 - t.getDay()) % 7 || 7;
  t.setDate(t.getDate() + daysUntilMonday);
  t.setHours(9, 0, 0, 0);
  return toDateTimeParts(t);
}

export const QUICK_TIMES: Array<{
  key: string;
  label: string;
  fn: () => { due_date: string; due_time: string };
}> = [
  { key: '1h',  label: 'Om 1 t',     fn: () => inHours(1) },
  { key: '3h',  label: 'Om 3 t',     fn: () => inHours(3) },
  { key: 'tm',  label: 'I morgen',   fn: tomorrowAt9 },
  { key: 'nw',  label: 'Næste uge',  fn: nextMondayAt9 },
];

/** Kombinér due_date + due_time til Date, eller null hvis dato mangler. */
export function toDue(due_date: string | null, due_time: string | null): Date | null {
  if (!due_date) return null;
  const time = due_time && due_time.length >= 5 ? due_time.slice(0, 5) : '09:00';
  return new Date(`${due_date}T${time}:00`);
}

/** Er aktiviteten forfalden? */
export function isOverdue(due_date: string | null, due_time: string | null): boolean {
  const d = toDue(due_date, due_time);
  if (!d) return false;
  return d.getTime() < Date.now();
}
