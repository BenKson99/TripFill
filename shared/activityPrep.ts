import { ACTIVITY_BY_ID, resolveActivities, suitableActivities, type ActivityId } from "./activities.js";

export interface PrepItem { id: string; task: string; why?: string; done: boolean }
export interface TimelineTask { id: string; due: string; task: string; done: boolean }

const addDays = (iso: string, k: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };

export function activityPrepItems(input: any, weather?: any, placeName?: string): PrepItem[] {
  const out: PrepItem[] = [];
  for (const id of suitableActivities(input, weather, placeName)) {
    const def = ACTIVITY_BY_ID[id];
    for (const p of def?.prep || []) {
      out.push({ id: `prep-act-${id}-${p.task.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`, task: p.task, why: p.why, done: false });
    }
  }
  return out;
}

export function mergeActivityPrep(plan: any, current?: PrepItem[]): PrepItem[] {
  const cur = [...(current || plan.prep || [])];
  for (const t of activityPrepItems(plan.input, plan.weather, plan.place?.name)) if (!cur.some(x => x.task === t.task || x.id === t.id)) cur.push(t);
  return cur;
}

export function activityTimelineTasks(input: any, start: string, todayIso?: string, weather?: any, placeName?: string): TimelineTask[] {
  const today = todayIso || start;
  const out: TimelineTask[] = [];
  for (const id of suitableActivities(input, weather, placeName) as ActivityId[]) {
    const def = ACTIVITY_BY_ID[id];
    for (const p of def?.prep || []) {
      let due = addDays(start, -p.daysBefore);
      let task = p.task;
      if (due < today) { due = today; task = p.task + " (overdue — do now)"; }
      out.push({ id: `tl-act-${id}-${p.daysBefore}`, due, task, done: false });
    }
  }
  return out;
}

export function mergeActivityTimeline(list: TimelineTask[], plan: any, todayIso?: string): TimelineTask[] {
  const cur = [...(list || [])];
  const start = plan.input?.start;
  if (!start) return cur;
  for (const t of activityTimelineTasks(plan.input, start, todayIso, plan.weather, plan.place?.name)) {
    if (!cur.some(x => x.task === t.task || x.id === t.id)) cur.push(t);
  }
  return cur.sort((a, b) => a.due.localeCompare(b.due) || a.task.localeCompare(b.task));
}

export function normalizePrepTask(task: string) {
  return (task || "").replace(/\s*\(overdue — do now\)\s*/gi, "").trim().toLowerCase();
}

export function tasksOverlap(a: string, b: string) {
  return normalizePrepTask(a) === normalizePrepTask(b);
}

/** Activity tasks belong on the dated timeline; drop the same wording from the checklist. */
export function dedupePrepAgainstTimeline<T extends { task: string }>(prep: T[] | undefined, timeline: { task: string }[] | undefined): T[] {
  const tl = timeline || [];
  return (prep || []).filter(p => !tl.some(t => tasksOverlap(t.task, p.task)));
}
