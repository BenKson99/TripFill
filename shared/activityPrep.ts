import { ACTIVITY_BY_ID, resolveActivities, type ActivityId } from "./activities.js";

export interface PrepItem { id: string; task: string; why?: string; done: boolean }
export interface TimelineTask { id: string; due: string; task: string; done: boolean }

const addDays = (iso: string, k: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };

export function activityPrepItems(input: any): PrepItem[] {
  const out: PrepItem[] = [];
  for (const id of resolveActivities(input)) {
    const def = ACTIVITY_BY_ID[id];
    for (const p of def?.prep || []) {
      out.push({ id: `prep-act-${id}-${p.task.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`, task: p.task, why: p.why, done: false });
    }
  }
  return out;
}

export function mergeActivityPrep(plan: any, current?: PrepItem[]): PrepItem[] {
  const cur = [...(current || plan.prep || [])];
  for (const t of activityPrepItems(plan.input)) if (!cur.some(x => x.task === t.task || x.id === t.id)) cur.push(t);
  return cur;
}

export function activityTimelineTasks(input: any, start: string, todayIso?: string): TimelineTask[] {
  const today = todayIso || start;
  const out: TimelineTask[] = [];
  for (const id of resolveActivities(input) as ActivityId[]) {
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
  for (const t of activityTimelineTasks(plan.input, start, todayIso)) {
    if (!cur.some(x => x.task === t.task || x.id === t.id)) cur.push(t);
  }
  return cur.sort((a, b) => a.due.localeCompare(b.due) || a.task.localeCompare(b.task));
}
