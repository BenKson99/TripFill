import { isGrownUpTask } from "./family.js";

export const PREP_WHEN = ["week", "dayBefore", "morning"] as const;
export type PrepWhen = typeof PREP_WHEN[number];
export const PREP_WHEN_LABEL: Record<PrepWhen, string> = {
  week: "A week before",
  dayBefore: "The day before",
  morning: "Morning you leave",
};

const MORNING = /photo id packed|online check-in|departure day|passport, phone, wallet|id, phone, wallet|chargers, power bank & cables packed/i;
const WEEK = /passport|visa|entry rules|insurance|vaccination|bank|card issuer|roaming|esim|bookings?|tickets|restaurant reservation|hold mail|plant & pet|tell your bank/i;
const DAY_BEFORE = /check the car|tyres|fluids|route, fuel|parking|tolls|download offline|save tickets|empty the fridge|thermostat|lock up|pack$|fuel up|charge or fuel/i;

export function prepTiming(task: string): PrepWhen {
  const t = task || "";
  if (MORNING.test(t)) return "morning";
  if (DAY_BEFORE.test(t)) return "dayBefore";
  if (WEEK.test(t)) return "week";
  return "dayBefore";
}

export function prepOwnerHint(task: string, grownUp?: boolean): string | undefined {
  if (grownUp === false) return undefined;
  if (grownUp || isGrownUpTask(task)) return "A grown-up should handle this";
  return undefined;
}

export function groupPrepTasks<T extends { task: string; grownUp?: boolean }>(tasks: T[]): { when: PrepWhen; label: string; items: T[] }[] {
  const buckets: Record<PrepWhen, T[]> = { week: [], dayBefore: [], morning: [] };
  for (const t of tasks) buckets[prepTiming(t.task)].push(t);
  const grownFirst = (a: T, b: T) => Number(!!(b.grownUp || isGrownUpTask(b.task))) - Number(!!(a.grownUp || isGrownUpTask(a.task)));
  return PREP_WHEN.map(when => ({ when, label: PREP_WHEN_LABEL[when], items: [...buckets[when]].sort(grownFirst) })).filter(g => g.items.length);
}
